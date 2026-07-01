'use strict';

module.exports = {
  // ── Cache TTLs ─────────────────────────────────────────────────────────────
  RESUME_CACHE_TTL_MS:  5 * 60 * 1000,  // 5 min
  CONTEXT_TTL_MS:       5 * 60 * 1000,  // 5 min
  GEMINI_DEDUP_TTL_MS:  30 * 1000,      // 30 s  — dedup identical Gemini queries
  // Allow TEST_SSE_TIMEOUT_MS env override so CI runners (slow CPU) don't hit the
  // 2-minute wall mid-Llama inference. Production stays at 120s.
  SSE_STREAM_TIMEOUT_MS: process.env.TEST_SSE_TIMEOUT_MS
    ? parseInt(process.env.TEST_SSE_TIMEOUT_MS, 10)
    : 120 * 1000,    // 2 min — max SSE connection duration

  // ── Form submission ────────────────────────────────────────────────────────
  FORM_TIMEOUT_MS: 10_000,
  // Load from env vars in production; hardcoded values are fallback for local dev only
  GOOGLE_FORM_URL: process.env.GOOGLE_FORM_URL || 'https://docs.google.com/forms/d/e/1FAIpQLSd1IAe_XPmBDZ3JFcp8me0fh9yFhHQj7dVU-_0Cqf_qu-8czg/formResponse',
  GOOGLE_FORM_ENTRY_IDS: {
    name:    process.env.GOOGLE_FORM_ENTRY_NAME    || 'entry.1760114498',
    email:   process.env.GOOGLE_FORM_ENTRY_EMAIL   || 'entry.912588963',
    subject: process.env.GOOGLE_FORM_ENTRY_SUBJECT || 'entry.716766072',
    rating:  process.env.GOOGLE_FORM_ENTRY_RATING  || 'entry.2000139713',
    message: process.env.GOOGLE_FORM_ENTRY_MESSAGE || 'entry.797942613',
  },

  // ── Validation ─────────────────────────────────────────────────────────────
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,

  // ── JD matching ────────────────────────────────────────────────────────────
  JD_TEXT_MIN_LEN: 20,
  JD_TEXT_MAX_LEN: 50_000,

  // ── AI pipeline ────────────────────────────────────────────────────────────
  HISTORY_SLICE: 6,
  CHAT_HISTORY_MAX: 50,  // max messages stored in browser localStorage

  CORE_INTENTS: [
    'bot_identity', 'bot_help', 'small_talk', 'thanks', 'bye',
    'jokes', 'facts', 'riddles', 'contact', 'resume_download',
    'location', 'linkedin', 'github', 'feedback',
    'experience_previous', 'projects_cicd',
  ],

  FALLBACK_HINTS: [
    'Tell me about his skills',
    'Show certifications',
    'How to contact him?',
  ],

  FALLBACK_CANDIDATE_INTENTS: ['identity', 'experience_sap'],

  // ── Rate limits (windowMs + max per IP per window) ─────────────────────────
  RATE_LIMITS: {
    chat:    { windowMs: 60_000, max: 20 },
    metrics: { windowMs: 60_000, max: 30 },
    contact: { windowMs: 60_000, max:  5 },
    jd:      { windowMs: 60_000, max: 10 },
  },

  // ── Analytics ──────────────────────────────────────────────────────────────
  VISITOR_MAX: 5_000,  // evict oldest entries when dict exceeds this
};
