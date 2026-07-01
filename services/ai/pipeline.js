'use strict';

/**
 * AI Pipeline Service — 3-tier routing:
 *   Tier 1: ChatbotEngine (deterministic)
 *   Tier 2: Gemini cloud streaming
 *   Tier 3: Llama offline fallback
 *
 * Extracted from app.js POST /api/chat/llm handler.
 * Yields SSE-shaped event objects consumed by routes/chat.js.
 */
const ChatbotEngine = require('../../public/scripts/chatbot-engine');
const { generateResponse }               = require('./offline');
const { generateOnlineResponseStream }   = require('./online');
const { CORE_INTENTS, FALLBACK_HINTS, FALLBACK_CANDIDATE_INTENTS } = require('../../config');

const INTENT_MAP_HINTS = {
  experience:    ['What are his top skills?', 'Why is he a good fit for DevOps?', 'Show SAP impact?'],
  skills:        ['Show certifications?', 'Tell me about his IoT project?', 'View professional awards?'],
  projects:      ['What cloud tech does he use?', 'Show DevOps automation work?', 'How to contact him?'],
  education:     ['Is he available for hire?', 'Show his research work?', 'Tell me about his SAP role?'],
  certifications:['What are his main skills?', 'Tell me about his career?', 'Download resume PDF?'],
  awards:        ['What did he do at SAP?', 'Show his publications?', 'Why hire Akhilesh?'],
  contact:       ['Download resume?', 'View LinkedIn profile?', 'What can you do?'],
  identity:      ['What are his main skills?', 'Tell me about his projects?', 'Show certifications?'],
  hire_role:     ['Show certifications?', 'Download resume?', 'Contact Akhilesh now?'],
  small_talk:    ['Tell me about his career?', 'What are his main skills?', 'How many awards?'],
  default:       ['Tell me about his career?', 'What are his top skills?', 'Show certifications?'],
};

function getAdaptiveHints(intent = 'default', count = 3) {
  const baseCategory = Object.keys(INTENT_MAP_HINTS).find(cat => intent && intent.startsWith(cat)) || 'default';
  const pool = INTENT_MAP_HINTS[baseCategory] || INTENT_MAP_HINTS.default;
  return [...pool].sort(() => Math.random() - 0.5).slice(0, count);
}

/**
 * @param {{ query, history, summary, summaryByIntent, signal }} opts
 * @yields {{ type, ... }} SSE event objects
 */
async function* runAIPipeline({ query, history, summary, summaryByIntent, signal, sseTimeout }) {
  // Step 1 — Deterministic Engine
  const engineResult = ChatbotEngine.findResponse(query, summary, {
    lastIntent: (history && history.length > 0) ? history[history.length - 1].intent : null,
  });

  const isHighConfidence = engineResult.trace?.confidence_bucket === 'HIGH';
  const isCoreIntent     = CORE_INTENTS.includes(engineResult.trace?.intent);

  if ((isHighConfidence && !engineResult.isMultiIntent && !engineResult.isDetailed) || isCoreIntent) {
    clearTimeout(sseTimeout);
    const hints = engineResult.suggestions?.length > 0
      ? engineResult.suggestions.slice(0, 3)
      : getAdaptiveHints(engineResult.trace?.intent);
    yield { type: 'answer', answer: engineResult.answer, hints, intent: engineResult.trace?.intent, engine: 'deterministic' };
    yield { type: 'done',   hints, intent: engineResult.trace?.intent, engine: 'deterministic' };
    return;
  }

  // Build candidates for AI tiers
  const officialHints = engineResult.suggestions?.length >= 2
    ? engineResult.suggestions.slice(0, 3)
    : getAdaptiveHints(engineResult.trace?.intent);

  let candidates = engineResult.candidates || [];
  if (candidates.length === 0) {
    FALLBACK_CANDIDATE_INTENTS.forEach(intentName => {
      const m = summaryByIntent.get(intentName);
      if (m) candidates.push({ intent: intentName, domain: m.domain,
        content: Array.isArray(m.answer) ? m.answer[0] : m.answer });
    });
  }

  // Step 2 — Gemini streaming
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 20) {
    try {
      let fullAnswer = '';
      let tokensSent = 0;
      for await (const token of generateOnlineResponseStream(query, history, candidates)) {
        if (signal.aborted) break;
        fullAnswer += token;
        tokensSent++;
        yield { type: 'token', content: token };
      }

      clearTimeout(sseTimeout);

      // Strip suggestion suffix, extract hints
      let finalHints = officialHints;
      const suggestionMatch = fullAnswer.match(/(?:\[?SUGGESTIONS\]?|Suggestions:|Follow-up questions:|Ask me about:)\s*(.*)/is);
      if (suggestionMatch) {
        fullAnswer = fullAnswer.split(suggestionMatch[0])[0].trim();
        const extracted = suggestionMatch[1].split(/,|\n/)
          .map(h => h.trim().replace(/^[:\-\*]\s*/, '').replace(/[.!?]$/, ''))
          .filter(h => h.length > 2 && h.length < 50);
        if (extracted.length > 0) finalHints = extracted.slice(0, 3);
      }

      yield { type: 'done', intent: engineResult.trace?.intent || 'llm_fallback', engine: 'online', hints: finalHints };
      return;
    } catch (geminiErr) {
      console.warn('[PIPELINE] Gemini stream failed:', geminiErr.message);
      if (typeof tokensSent !== 'undefined' && tokensSent > 0) {
        clearTimeout(sseTimeout);
        yield { type: 'token', content: ' … [response interrupted]' };
        yield { type: 'done', intent: engineResult.trace?.intent || 'llm_fallback', engine: 'online', hints: officialHints };
        return;
      }
    }
  }

  // Step 3 — Llama offline fallback
  console.log('[PIPELINE] Routing to Local Intelligence (Llama 3.2 1B)...');
  const offlineAnswer = await generateResponse(query, null, history, candidates);
  const offlineIntent = engineResult.trace?.intent || 'llm_fallback';
  clearTimeout(sseTimeout);
  yield { type: 'answer', answer: offlineAnswer, hints: officialHints, intent: offlineIntent, engine: 'offline' };
  yield { type: 'done',   hints: officialHints, intent: offlineIntent, engine: 'offline' };
}

module.exports = { runAIPipeline, getAdaptiveHints };
