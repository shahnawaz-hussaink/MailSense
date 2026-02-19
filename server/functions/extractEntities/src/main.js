import { Query, ID } from 'node-appwrite';
import OpenAI from 'openai';
import { serverDb, DB_ID, COL_EMAILS, COL_ENTITIES } from '../../../shared/serverDb.js';

/**
 * extractEntities — HTTP + Cron Appwrite Function
 *
 * Processes emails with `processed: false` through OpenAI to extract
 * structured entities (price, otp, merchant, flight, job, date, etc).
 *
 * Each entity is a separate row in `extracted_entities`:
 *   { userId, emailId, type, value, confidence, metadata }
 *
 * This design makes querying and aggregating trivial:
 *   "Sum all price entities for userId X in current month"
 */
export default async ({ req, res, log, error }) => {
  const db     = serverDb();
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const BATCH_SIZE  = parseInt(process.env.EXTRACT_BATCH_SIZE || '20', 10);
  const MODEL       = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  // ── 1. Fetch a batch of unprocessed emails ─────────────────────────────
  const unprocessed = await db.listDocuments(DB_ID(), COL_EMAILS, [
    Query.equal('processed', false),
    Query.equal('processingError', ''),    // Skip previously failed
    Query.limit(BATCH_SIZE),
    Query.orderAsc('createdAt'),           // Oldest first (FIFO queue)
  ]);

  log(`[extractEntities] Processing ${unprocessed.documents.length} emails`);

  let successCount = 0;
  let failCount    = 0;

  for (const email of unprocessed.documents) {
    try {
      // ── 2. Call OpenAI for entity extraction ─────────────────────────────
      const entities = await extractFromEmail(openai, MODEL, email);

      // ── 3. Store each entity as a separate document ───────────────────────
      for (const entity of entities) {
        await db.createDocument(DB_ID(), COL_ENTITIES, ID.unique(), {
          userId:     email.userId,
          emailId:    email.$id,
          type:       entity.type,
          value:      String(entity.value ?? ''),
          confidence: parseFloat(entity.confidence ?? 0.5),
          metadata:   JSON.stringify(entity.metadata ?? {}),
          createdAt:  new Date().toISOString(),
        });
      }

      // ── 4. Mark email as processed ────────────────────────────────────────
      await db.updateDocument(DB_ID(), COL_EMAILS, email.$id, {
        processed: true,
      });

      log(`[extractEntities] emailId=${email.$id} → ${entities.length} entities`);
      successCount++;

    } catch (e) {
      error(`[extractEntities] Failed for emailId=${email.$id}: ${e.message}`);

      // Store error so we don't retry indefinitely
      await db.updateDocument(DB_ID(), COL_EMAILS, email.$id, {
        processingError: e.message.substring(0, 512),
      });

      failCount++;
    }
  }

  return res.json({
    success:   true,
    processed: successCount,
    failed:    failCount,
    total:     unprocessed.documents.length,
  });
};

// ─── OpenAI Extraction ────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `
You are a precise email entity extraction engine for a personal email intelligence platform.

Analyze the provided email and extract ALL meaningful entities. Return ONLY a valid JSON object with an "entities" array.

Each entity in the array must follow this exact schema:
{
  "type": "<entity_type>",
  "value": "<string representation of the value>",
  "confidence": <float 0.0 to 1.0>,
  "metadata": { ...type-specific fields }
}

Supported entity types and their metadata:
- "price"        → metadata: { currency, rawText, merchant }
- "merchant"     → metadata: { domain, category }
- "otp"          → metadata: { expiresInSeconds, service }
- "flight_pnr"   → metadata: { airline, from, to, departure }
- "flight_route" → metadata: { from, to, airline }
- "job_company"  → metadata: { role, jobBoard }
- "job_status"   → metadata: { company, role, stage: "applied|interview|offer|rejected" }
- "date"         → metadata: { context, format }
- "tracking_num" → metadata: { carrier, url }
- "subscription" → metadata: { service, billingCycle, amount }
- "sender_domain"→ metadata: { domain }
- "custom"       → metadata: { description }

Rules:
- Be precise. Only extract what is explicitly stated in the email.
- Do NOT hallucinate values.
- For price, always extract the numeric value (e.g., "349.00").
- For otp, extract only the code (e.g., "483920").
- Multiple entities of the same type are allowed.
- Return empty array [] if nothing meaningful is found.
- Confidence: 0.9+ for explicit data, 0.5-0.8 for inferred, <0.5 if uncertain.
`;

async function extractFromEmail(openai, model, email) {
  const emailContent = [
    `From: ${email.from}`,
    `Subject: ${email.subject}`,
    `Date: ${email.timestamp}`,
    '',
    email.body.substring(0, 4000), // Limit to avoid token overflow
  ].join('\n');

  const response = await openai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user',   content: emailContent },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 1500,
    temperature: 0.1, // Low temperature for deterministic extraction
  });

  const parsed = JSON.parse(response.choices[0].message.content);
  return Array.isArray(parsed.entities) ? parsed.entities : [];
}
