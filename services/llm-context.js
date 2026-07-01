'use strict';

const fs   = require('fs');
const path = require('path');
const { CONTEXT_TTL_MS } = require('../config');

const CONTEXT_PATH = path.join(__dirname, '../public/data/llm-context.txt');

let _cache      = null;
let _loadedAt   = 0;
let _loadPromise = null;

/**
 * Returns the LLM knowledge-base context string.
 * Cached for CONTEXT_TTL_MS; concurrent first-callers await the same Promise
 * rather than racing to issue multiple disk reads.
 */
async function getLLMContext() {
  if (_cache && Date.now() - _loadedAt < CONTEXT_TTL_MS) return _cache;
  if (_loadPromise) return _loadPromise;

  _loadPromise = fs.promises.readFile(CONTEXT_PATH, 'utf8')
    .then(text => {
      _cache      = text;
      _loadedAt   = Date.now();
      _loadPromise = null;
      console.log(`[LLM-CONTEXT] Loaded (${text.length} chars)`);
      return text;
    })
    .catch(err => {
      console.error('[LLM-CONTEXT] Failed to load:', err.message);
      _loadPromise = null;
      return 'No context available.';
    });

  return _loadPromise;
}

module.exports = { getLLMContext };
