import { Query } from 'node-appwrite';
import OpenAI from 'openai';
import { premiumGuard }                                              from '../../../shared/premiumGuard.js';
import { serverDb, DB_ID, COL_ENTITIES, COL_EMAILS }                from '../../../shared/serverDb.js';

/**
 * aiQuery — Premium HTTP Appwrite Function
 *
 * Flow:
 *  1. Verify JWT + require premium subscription
 *  2. Parse natural language query → structured intent JSON (OpenAI)
 *  3. Execute intent against `extracted_entities` (or `emails`) collection
 *  4. Generate human-readable answer from DB results (OpenAI)
 *  5. Return { answer, intent, data }
 *
 * Intent schema:
 * {
 *   action:  "sum" | "count" | "list" | "find" | "summarize",
 *   entity:  "price" | "merchant" | "otp" | "flight" | "job" | "email",
 *   filter: {
 *     merchant?: string,
 *     type?:     string,
 *     month?:    "current" | "YYYY-MM",
 *     dateFrom?: ISO8601,
 *     dateTo?:   ISO8601,
 *     keyword?:  string
 *   },
 *   limit: number
 * }
 */
export default async ({ req, res, log, error }) => {
  // ── 1. Auth + Premium Gate ────────────────────────────────────────────────
  const guard = await premiumGuard(req, { requirePremium: true });
  if (guard.error) {
    return res.json(
      { error: guard.error, upgradeUrl: guard.upgradeUrl },
      guard.status
    );
  }

  const { userId } = guard;

  // ── 2. Validate input ─────────────────────────────────────────────────────
  let body;
  try { body = JSON.parse(req.body || '{}'); } catch { body = {}; }

  const query = (body.query || '').trim();
  if (!query) return res.json({ error: 'query is required' }, 400);
  if (query.length > 500) return res.json({ error: 'query too long (max 500 chars)' }, 400);

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const MODEL  = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  log(`[aiQuery] userId=${userId} | query="${query}"`);

  // ── 3. Parse natural language → structured intent ─────────────────────────
  let intent;
  try {
    intent = await parseIntent(openai, MODEL, query);
    log(`[aiQuery] intent=${JSON.stringify(intent)}`);
  } catch (e) {
    error(`[aiQuery] Intent parsing failed: ${e.message}`);
    return res.json({ error: 'Failed to understand query' }, 422);
  }

  // ── 4. Execute intent against database ────────────────────────────────────
  let dbResults;
  try {
    dbResults = await executeIntent(intent, userId);
  } catch (e) {
    error(`[aiQuery] DB query failed: ${e.message}`);
    return res.json({ error: 'Database query failed' }, 500);
  }

  // ── 5. Generate human-readable answer ─────────────────────────────────────
  let answer;
  try {
    answer = await generateAnswer(openai, MODEL, query, intent, dbResults);
  } catch (e) {
    // Fallback: return raw data without natural language answer
    answer = `Found ${dbResults.count} results. Please see data below.`;
  }

  return res.json({ answer, intent, data: dbResults });
};

// ─── Intent Parsing ───────────────────────────────────────────────────────────

const INTENT_PROMPT = `
You are an intent parser for a personal email intelligence platform.

Convert the user's natural language query into a structured JSON intent.

Return ONLY a valid JSON object matching this schema:
{
  "action":  "<sum|count|list|find|summarize>",
  "entity":  "<price|merchant|otp|flight_pnr|flight_route|job_status|tracking_num|subscription|email>",
  "filter": {
    "merchant": "<string or null>",
    "type":     "<entity type or null>",
    "month":    "<YYYY-MM or 'current' or null>",
    "dateFrom": "<ISO 8601 or null>",
    "dateTo":   "<ISO 8601 or null>",
    "keyword":  "<free text search or null>"
  },
  "limit": <integer, default 20, max 100>
}

Examples:
- "Find my McDonald's bills"
  → { "action": "list", "entity": "price", "filter": { "merchant": "McDonald's" }, "limit": 20 }

- "Total spent this month"
  → { "action": "sum", "entity": "price", "filter": { "month": "current" }, "limit": 100 }

- "Show all job rejection emails"
  → { "action": "list", "entity": "job_status", "filter": { "keyword": "rejected" }, "limit": 20 }

- "Extract OTPs from last 7 days"
  → { "action": "list", "entity": "otp", "filter": { "dateFrom": "<7 days ago ISO>", "dateTo": "<now ISO>" }, "limit": 50 }

- "How many times did I order from Swiggy?"
  → { "action": "count", "entity": "price", "filter": { "merchant": "Swiggy" }, "limit": 100 }

- "Summarize my flight bookings"
  → { "action": "summarize", "entity": "flight_pnr", "filter": {}, "limit": 50 }

Current date: ${new Date().toISOString()}
`;

async function parseIntent(openai, model, query) {
  const response = await openai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: INTENT_PROMPT },
      { role: 'user',   content: query },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 300,
    temperature: 0.0, // Fully deterministic
  });

  return JSON.parse(response.choices[0].message.content);
}

// ─── Intent Executor ──────────────────────────────────────────────────────────

async function executeIntent(intent, userId) {
  const db      = serverDb();
  const filters = [
    Query.equal('userId', userId),
    Query.greaterThan('confidence', 0.4), // Exclude low confidence extractions
  ];

  // Entity type filter
  if (intent.entity && intent.entity !== 'email') {
    filters.push(Query.equal('type', intent.entity));
  }

  // Merchant filter (searches in the value field)
  if (intent.filter?.merchant) {
    filters.push(Query.search('value', intent.filter.merchant));
  }

  // Keyword filter
  if (intent.filter?.keyword) {
    filters.push(Query.search('value', intent.filter.keyword));
  }

  // Date range
  const { dateFrom, dateTo } = resolveDateRange(intent.filter);
  if (dateFrom) filters.push(Query.greaterThanEqual('createdAt', dateFrom));
  if (dateTo)   filters.push(Query.lessThanEqual('createdAt', dateTo));

  filters.push(Query.limit(Math.min(intent.limit || 20, 100)));
  filters.push(Query.orderDesc('createdAt'));

  // For "email" entity, query the emails collection instead
  if (intent.entity === 'email') {
    return queryEmails(userId, intent);
  }

  const result = await db.listDocuments(DB_ID(), COL_ENTITIES, filters);

  // Aggregate for sum action
  if (intent.action === 'sum') {
    const total = result.documents
      .map(d => parseFloat(d.value) || 0)
      .reduce((a, b) => a + b, 0);

    return {
      action:    'sum',
      total:     Math.round(total * 100) / 100,
      count:     result.documents.length,
      documents: result.documents,
    };
  }

  return {
    action:    intent.action,
    count:     result.total,
    documents: result.documents,
  };
}

async function queryEmails(userId, intent) {
  const db      = serverDb();
  const filters = [Query.equal('userId', userId)];

  if (intent.filter?.keyword) {
    filters.push(Query.search('subject', intent.filter.keyword));
  }

  const { dateFrom, dateTo } = resolveDateRange(intent.filter);
  if (dateFrom) filters.push(Query.greaterThanEqual('timestamp', dateFrom));
  if (dateTo)   filters.push(Query.lessThanEqual('timestamp', dateTo));

  filters.push(Query.limit(Math.min(intent.limit || 20, 100)));
  filters.push(Query.orderDesc('timestamp'));

  const result = await db.listDocuments(DB_ID(), COL_EMAILS, filters);
  return { action: intent.action, count: result.total, documents: result.documents };
}

/**
 * Resolves "current" month or explicit date range to ISO strings
 */
function resolveDateRange(filter = {}) {
  if (filter.month === 'current') {
    const now   = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    return { dateFrom: start.toISOString(), dateTo: end.toISOString() };
  }

  if (filter.month && /^\d{4}-\d{2}$/.test(filter.month)) {
    const [year, month] = filter.month.split('-').map(Number);
    const start = new Date(year, month - 1, 1);
    const end   = new Date(year, month, 0, 23, 59, 59);
    return { dateFrom: start.toISOString(), dateTo: end.toISOString() };
  }

  return {
    dateFrom: filter.dateFrom || null,
    dateTo:   filter.dateTo   || null,
  };
}

// ─── Answer Generation ────────────────────────────────────────────────────────

async function generateAnswer(openai, model, originalQuery, intent, dbResults) {
  const ANSWER_SYSTEM = `
You are a concise personal email assistant.
Answer the user's question based ONLY on the provided data.
Be direct and specific. Use currency symbols where appropriate.
If data is empty, say so clearly and suggest what might have been missed.
Keep your response under 3 sentences unless a list is requested.
`;

  const dataSnippet = JSON.stringify({
    count:     dbResults.count,
    total:     dbResults.total,
    sample:    (dbResults.documents || []).slice(0, 10).map(d => ({
      type:  d.type,
      value: d.value,
      meta:  d.metadata,
    })),
  });

  const response = await openai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: ANSWER_SYSTEM },
      { role: 'user',   content: `User asked: "${originalQuery}"\n\nData: ${dataSnippet}` },
    ],
    max_tokens: 300,
    temperature: 0.3,
  });

  return response.choices[0].message.content.trim();
}
