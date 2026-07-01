'use strict';

/**
 * Tier 3 AI: Gemini cloud streaming with runtime-adaptive model rotation.
 *
 * Uses gemini-model-registry.js for:
 *   - Live model discovery on startup (filters to models accessible to this API key)
 *   - Per-model circuit breakers (cooldown on 429/503)
 *   - retryDelay extraction from 429 error bodies (RetryInfo proto)
 *   - Daily quota detection → 1h cooldown vs transient → 60s cooldown
 */
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const { getLLMContext }  = require('../llm-context');
const { scrubPersona }   = require('./persona-scrubber');
const geminiCache         = require('./gemini-cache');
const registry            = require('./gemini-model-registry');
const { HISTORY_SLICE }  = require('../../config');

let genAI = null;

// Run discovery once at module load — non-blocking, falls back to BASELINE_STACK on error
const _discoveryPromise = (async () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey && apiKey.length >= 10) {
    await registry.discoverModels(apiKey);
  }
})();

// Merge consecutive same-role entries so Gemini's strict alternating-role requirement is never violated.
function normalizeHistory(history) {
  const cleaned = [];
  history.slice(-HISTORY_SLICE).forEach(m => {
    const role = m.type === 'bot' ? 'model' : 'user';
    const text = (m.text || '').trim();
    if (!text) return;
    if (cleaned.length > 0 && cleaned[cleaned.length - 1].role === role) {
      cleaned[cleaned.length - 1].parts[0].text += '\n' + text;
    } else {
      cleaned.push({ role, parts: [{ text }] });
    }
  });
  return cleaned;
}

function _getModelInstance(config, systemInstruction) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.length < 10) return null;
  if (!genAI) genAI = new GoogleGenerativeAI(apiKey);

  // Always build a fresh instance when systemInstruction is present
  // (it contains per-request grounding candidates, so cannot be shared)
  return genAI.getGenerativeModel(
    {
      model: config.name,
      ...(systemInstruction ? { systemInstruction } : {}),
      generationConfig: { maxOutputTokens: 150, temperature: 0.1 },
    },
    { apiVersion: config.version }
  );
}

function _buildSystemPrompt(globalContext, candidates) {
  const formattedCandidates = candidates.map((c, i) => `[Fact ${i + 1}]\n${c.content}`).join('\n\n');
  return `You are the dedicated AI Portfolio Assistant for Akhilesh Angadi.
Your goal is to answer questions about his career, projects, and skills with professional warmth and 100% accuracy.

GROUNDING DATA:
[Specific Facts]:
${formattedCandidates || 'No specific facts found for this query.'}

[Core Biography & Registry]:
${globalContext || ''}

STRICT PERSONA RULES:
1. Use 3rd person only ("He is...", "He has...").
2. Answer based on the GROUNDING DATA.
3. If specific facts are missing, use the Core Biography/Registry to provide a high-level overview.
4. Only say "I don't have that information" if the topic is completely outside his professional profile.
5. Max output: 2-3 concise sentences.`;
}

async function generateOnlineResponse(query, history = [], candidates = []) {
  const cached = geminiCache.get(query, candidates);
  if (cached) return cached;

  await _discoveryPromise;  // ensure discovery ran before first request
  const globalContext = await getLLMContext();
  const systemPrompt  = _buildSystemPrompt(globalContext, candidates);

  let lastError = null;
  const stack = registry.getActiveStack();

  for (const config of stack) {
    try {
      const activeModel = _getModelInstance(config, systemPrompt);
      if (!activeModel) continue;

      const chat   = activeModel.startChat({ history: normalizeHistory(history) });
      const result = await chat.sendMessage(query);
      const resp   = await result.response;
      const answer = scrubPersona(resp.text().trim());

      registry.recordSuccess(config.name);
      console.log(`[GEMINI-SERVICE] Success: ${config.name}`);
      geminiCache.set(query, candidates, answer);
      return answer;
    } catch (err) {
      lastError = err;
      if (err.name === 'AbortError') throw err;
      registry.recordFailure(config.name, err);
      console.warn(`[GEMINI-SERVICE] Rotating from ${config.name} (${err.status || err.message?.slice(0,60)})`);
    }
  }
  throw lastError || new Error('ALL_MODELS_FAILED');
}

async function* generateOnlineResponseStream(query, history = [], candidates = []) {
  await _discoveryPromise;
  const globalContext = await getLLMContext();
  const systemPrompt  = _buildSystemPrompt(globalContext, candidates);

  let lastError = null;
  const stack = registry.getActiveStack();

  for (const config of stack) {
    try {
      const activeModel = _getModelInstance(config, systemPrompt);
      if (!activeModel) continue;

      const chat   = activeModel.startChat({ history: normalizeHistory(history) });
      const result = await chat.sendMessageStream(query);
      for await (const chunk of result.stream) {
        const token = chunk.text();
        if (token) yield token;
      }
      registry.recordSuccess(config.name);
      console.log(`[GEMINI-STREAM] Success: ${config.name}`);
      return;
    } catch (err) {
      lastError = err;
      if (err.name === 'AbortError') throw err;
      registry.recordFailure(config.name, err);
      console.warn(`[GEMINI-STREAM] Rotating from ${config.name} (${err.status || err.message?.slice(0,60)})`);
    }
  }
  throw lastError || new Error('ALL_MODELS_FAILED');
}

module.exports = {
  generateOnlineResponse,
  generateOnlineResponseStream,
  normalizeHistory,
  isGeminiAvailable: () => !!process.env.GEMINI_API_KEY,
};
