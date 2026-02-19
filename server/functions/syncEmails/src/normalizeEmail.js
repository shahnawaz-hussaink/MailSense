/**
 * normalizeEmail — Converts a raw Gmail API message object into the
 * canonical format stored in the `emails` collection.
 *
 * Output matches the `emails` collection schema exactly.
 *
 * @param {object} gmailMsg - Full Gmail message from messages.get (format: 'full')
 * @param {string} userId   - Appwrite userId of the owner
 * @returns {object}        - Normalized document ready for Appwrite DB
 */
export function normalizeEmail(gmailMsg, userId) {
  const headers = gmailMsg.payload?.headers || [];

  /**
   * Case-insensitive header lookup helper
   */
  const getHeader = (name) =>
    headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value?.trim() ?? '';

  const body = extractPlainText(gmailMsg.payload);

  return {
    userId,
    gmailId:        gmailMsg.id,
    threadId:       gmailMsg.threadId,
    historyId:      gmailMsg.historyId || '',
    from:           getHeader('From'),
    to:             getHeader('To').substring(0, 512),
    subject:        getHeader('Subject').substring(0, 998),
    body:           body.substring(0, 65535),           // Max 64 KB
    snippet:        (gmailMsg.snippet || '').substring(0, 512),
    timestamp:      parseTimestamp(getHeader('Date'), gmailMsg.internalDate),
    labels:         gmailMsg.labelIds || [],
    hasAttachments: hasAttachments(gmailMsg.payload),
    sizeEstimate:   gmailMsg.sizeEstimate || 0,
    processed:      false,
    processingError: '',
    createdAt:      new Date().toISOString(),
  };
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/**
 * Recursively extracts plain text body from Gmail payload.
 * Prefers text/plain over text/html. Handles multipart emails.
 */
function extractPlainText(payload) {
  if (!payload) return '';

  // Direct body (non-multipart message)
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  // Multipart — walk parts recursively
  if (payload.parts && Array.isArray(payload.parts)) {
    // Try plain text first
    const textPart = payload.parts.find(p => p.mimeType === 'text/plain');
    if (textPart?.body?.data) {
      return decodeBase64Url(textPart.body.data);
    }

    // Recurse into multipart/alternative, multipart/mixed, etc.
    for (const part of payload.parts) {
      const text = extractPlainText(part);
      if (text) return text;
    }
  }

  return '';
}

/**
 * Decodes Gmail's Base64URL-encoded body data
 */
function decodeBase64Url(data) {
  try {
    // Gmail uses URL-safe base64 (replace - → + and _ → /)
    const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(base64, 'base64').toString('utf8');
  } catch {
    return '';
  }
}

/**
 * Detects if the email has non-inline attachments
 */
function hasAttachments(payload) {
  if (!payload) return false;
  if (!payload.parts) return false;

  return payload.parts.some(part => {
    const hasFilename = part.filename && part.filename.length > 0;
    const isAttachment = part.headers?.some(
      h => h.name.toLowerCase() === 'content-disposition' &&
           h.value.toLowerCase().includes('attachment'),
    );
    return hasFilename || isAttachment;
  });
}

/**
 * Parses a reliable ISO timestamp from Gmail data.
 * Prefers internalDate (Unix ms from Gmail) over header Date (often malformed).
 */
function parseTimestamp(dateHeader, internalDate) {
  if (internalDate) {
    const ms = parseInt(internalDate, 10);
    if (!isNaN(ms)) return new Date(ms).toISOString();
  }
  if (dateHeader) {
    const parsed = new Date(dateHeader);
    if (!isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return new Date().toISOString();
}
