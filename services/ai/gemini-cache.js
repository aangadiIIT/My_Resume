'use strict';

const crypto = require('crypto');
const { GEMINI_DEDUP_TTL_MS } = require('../../config');

const MAX_CACHE_SIZE = 5_000;
const _cache = new Map();

function _key(query, candidates) {
  const intentsSorted = (candidates || []).map(c => c.intent || '').sort().join(',');
  return crypto.createHash('sha256').update(query + '|' + intentsSorted).digest('hex');
}

function _evict() {
  if (_cache.size < MAX_CACHE_SIZE) return;
  // Evict oldest 20% — Map preserves insertion order, so first keys are oldest
  const toEvict = Math.ceil(MAX_CACHE_SIZE * 0.2);
  let i = 0;
  for (const key of _cache.keys()) {
    if (i++ >= toEvict) break;
    _cache.delete(key);
  }
}

function get(query, candidates) {
  const entry = _cache.get(_key(query, candidates));
  if (!entry || Date.now() > entry.expiresAt) return null;
  return entry.text;
}

function set(query, candidates, text) {
  _evict();
  _cache.set(_key(query, candidates), { text, expiresAt: Date.now() + GEMINI_DEDUP_TTL_MS });
}

// Sweep expired entries every 60 s; .unref() so this never prevents process exit
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of _cache) {
    if (now > v.expiresAt) _cache.delete(k);
  }
}, 60_000).unref();

module.exports = { get, set };
