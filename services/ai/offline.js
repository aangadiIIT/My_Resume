'use strict';

/**
 * Tier 2 AI: Llama 3.2 1B offline inference.
 * Refactored from utils/ai-service.js — spin-wait replaced with Promise singleton,
 * context loading delegated to services/llm-context.js.
 */
const { pipeline } = require('@huggingface/transformers');
const path = require('path');
const { getLLMContext } = require('../llm-context');
const { scrubPersona }  = require('./persona-scrubber');
const { HISTORY_SLICE } = require('../../config');

let generator    = null;
let isInitializing = false;   // kept for external warmup checks
let initPromise  = null;      // Promise-based singleton — no spin-wait

async function initModel() {
  if (generator)    return generator;
  if (initPromise)  return initPromise;

  initPromise = (async () => {
    isInitializing = true;
    try {
      console.log('[AI-SERVICE] Deploying Llama 3.2 1B (High-Precision CPU Core)...');
      generator = await pipeline('text-generation', 'onnx-community/Llama-3.2-1B-Instruct', {
        device:    'cpu',
        dtype:     'q4',
        cache_dir: path.join(__dirname, '../../models'),
      });
      console.log('[AI-SERVICE] 1B Intelligence Core active.');
      return generator;
    } catch (err) {
      console.error('[AI-SERVICE] Failed to load Llama core:', err);
      initPromise  = null;  // allow retry on next call
      throw err;
    } finally {
      isInitializing = false;
    }
  })();

  return initPromise;
}

async function generateResponse(query, _contextUnused, history = [], candidates = []) {
  const globalContext = await getLLMContext();
  const pipe          = await initModel();

  const formattedCandidates = (Array.isArray(candidates) && candidates.length > 0)
    ? candidates.map((c, i) => `[Fact ${i + 1}] (Intent: ${c.intent})\n${c.content}`).join('\n\n')
    : 'No specific facts found for this query. Provide a general overview from the registry.';

  const systemPrompt = `You are a professional AI Portfolio Assistant for Akhilesh Angadi.
Your primary goal is to provide accurate answers using the data provided.

TIER 1 (Specific Facts):
${formattedCandidates}

TIER 2 (Main Registry & Biography):
${globalContext}

STRICT PERSONA RULES:
1. Answers must be grounded in TIER 1 or TIER 2.
2. If specific details are missing from TIER 1, use TIER 2 and state "Based on his profile..."
3. Answer in the 3rd person only ("He holds...", "His role is...").
4. Never invent outside certifications or companies.
5. Max length: 2-3 concise sentences.
`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-HISTORY_SLICE).map(m => ({
      role:    m.type === 'bot' ? 'assistant' : 'user',
      content: m.text || '',
    })).filter(m => m.content.length > 0),
    { role: 'user', content: query },
  ];

  const output = await pipe(messages, {
    max_new_tokens:     100,
    do_sample:          false,
    return_full_text:   false,
    repetition_penalty: 1.1,
  });

  if (!output || !output[0] || !output[0].generated_text) {
    throw new Error('AI_GENERATION_EMPTY_RESPONSE');
  }

  const lastMsg = output[0].generated_text[output[0].generated_text.length - 1];
  const answer  = lastMsg ? lastMsg.content : "I'm not sure how to answer that.";
  return scrubPersona(answer).trim();
}

module.exports = { generateResponse, initModel };
