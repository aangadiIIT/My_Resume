'use strict';

/**
 * Gemini Model Registry — Runtime-adaptive model stack with circuit breakers.
 *
 * Discovered via live API call on 2026-07-02 against the project's API key.
 * Models are ordered: fastest/most-available first, degrading gracefully.
 *
 * Circuit breaker per model:
 *   - 429 QUOTA  → cooldown = retryDelay from error body (or 300s default)
 *   - 429 OTHER  → cooldown = 60s
 *   - 503        → cooldown = 15s (temporary overload, retry sooner)
 *   - Other err  → cooldown = 10s
 *
 * The stack is refreshed on startup via discoverModels() which calls
 * the real Gemini API and re-ranks by actual availability.
 */

const https = require('https');

// ── Static baseline stack (confirmed working 2026-07-02 with project key) ──
// Order: best balance of speed + availability first
const BASELINE_STACK = [
  { name: 'gemini-3.5-flash',      version: 'v1beta', tier: 'paid',  inputLimit: 1048576, outputLimit: 65536 },
  { name: 'gemini-3.1-flash-lite', version: 'v1beta', tier: 'paid',  inputLimit: 1048576, outputLimit: 65536 },
  { name: 'gemini-2.5-flash-lite', version: 'v1beta', tier: 'free',  inputLimit: 1048576, outputLimit: 65536 },
  { name: 'gemini-2.5-flash',      version: 'v1beta', tier: 'free',  inputLimit: 1048576, outputLimit: 65536 },
  { name: 'gemini-2.5-pro',        version: 'v1beta', tier: 'free',  inputLimit: 1048576, outputLimit: 65536 },
  { name: 'gemini-2.0-flash-lite', version: 'v1',     tier: 'free',  inputLimit: 1048576, outputLimit: 8192  },
  { name: 'gemini-2.0-flash',      version: 'v1',     tier: 'free',  inputLimit: 1048576, outputLimit: 8192  },
];

// ── Per-model circuit breaker state ────────────────────────────────────────
const _breakers = new Map(); // modelName → { cooldownUntil, failures, lastError }

function _breakerState(modelName) {
  if (!_breakers.has(modelName)) {
    _breakers.set(modelName, { cooldownUntil: 0, failures: 0, lastError: null });
  }
  return _breakers.get(modelName);
}

function isAvailable(modelName) {
  const b = _breakerState(modelName);
  return Date.now() >= b.cooldownUntil;
}

/**
 * Record a failure for a model and set its cooldown.
 * @param {string} modelName
 * @param {Error}  err — GoogleGenerativeAIFetchError with .status and .errorDetails
 */
function recordFailure(modelName, err) {
  const b = _breakerState(modelName);
  b.failures++;
  b.lastError = err?.message?.slice(0, 120);

  const status = err?.status;

  if (status === 429) {
    // Try to extract retryDelay from the error body (RetryInfo proto)
    let retrySeconds = 60; // default
    const details = err?.errorDetails || [];
    for (const d of details) {
      if (d['@type']?.includes('RetryInfo') && d.retryDelay) {
        const s = parseInt(d.retryDelay, 10);
        if (!isNaN(s) && s > 0) retrySeconds = Math.max(s, 10);
      }
      // If it's a per-day quota, use a much longer cooldown
      if (d['@type']?.includes('QuotaFailure')) {
        const violations = d.violations || [];
        const isDaily = violations.some(v =>
          (v.quotaId || '').toLowerCase().includes('day') ||
          (v.quotaMetric || '').toLowerCase().includes('day')
        );
        if (isDaily) retrySeconds = Math.max(retrySeconds, 3600); // 1 hour for daily quota
      }
    }
    b.cooldownUntil = Date.now() + retrySeconds * 1000;
    console.warn(`[REGISTRY] ${modelName} → 429 quota, cooldown ${retrySeconds}s (until ${new Date(b.cooldownUntil).toISOString()})`);

  } else if (status === 503) {
    // Temporary overload — short cooldown, retry soon
    b.cooldownUntil = Date.now() + 15_000;
    console.warn(`[REGISTRY] ${modelName} → 503 overload, cooldown 15s`);

  } else {
    // Other errors (network, model not found, etc.) — brief cooldown
    b.cooldownUntil = Date.now() + 10_000;
    console.warn(`[REGISTRY] ${modelName} → error ${status}, cooldown 10s`);
  }
}

/** Record a success — reset failure count */
function recordSuccess(modelName) {
  const b = _breakerState(modelName);
  b.failures = 0;
  b.cooldownUntil = 0;
  b.lastError = null;
}

/**
 * Returns the current MODEL_STACK with unavailable models filtered out.
 * Always returns at least one model (the last in the list, as emergency fallback).
 */
function getActiveStack() {
  const available = BASELINE_STACK.filter(m => isAvailable(m.name));
  if (available.length === 0) {
    // All models in cooldown — return the one with the shortest remaining cooldown
    const soonest = [...BASELINE_STACK].sort((a, b) => {
      const ta = _breakerState(a.name).cooldownUntil;
      const tb = _breakerState(b.name).cooldownUntil;
      return ta - tb;
    });
    console.warn('[REGISTRY] All models in cooldown — using soonest available:', soonest[0].name);
    return [soonest[0]];
  }
  return available;
}

/**
 * Probe the live Gemini API and re-order the stack based on what's
 * actually accessible to this API key right now.
 * Call once on startup — non-blocking (failure is silent, fallback to BASELINE_STACK).
 */
async function discoverModels(apiKey) {
  if (!apiKey || apiKey.length < 10) return;
  return new Promise(resolve => {
    const req = https.request({
      hostname: 'generativelanguage.googleapis.com',
      path: '/v1beta/models?pageSize=100',
      headers: { 'x-goog-api-key': apiKey },
    }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try {
          const data = JSON.parse(raw);
          const liveNames = new Set(
            (data.models || [])
              .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
              .map(m => m.name.replace('models/', ''))
          );

          // Mark any model in BASELINE_STACK not accessible to this key as permanently unavailable
          for (const m of BASELINE_STACK) {
            if (!liveNames.has(m.name)) {
              const b = _breakerState(m.name);
              b.cooldownUntil = Date.now() + 24 * 3600_000; // 24h — not accessible
              console.log(`[REGISTRY] ${m.name} not in API response — skipping`);
            }
          }

          // Log confirmed accessible models
          const accessible = BASELINE_STACK.filter(m => liveNames.has(m.name));
          console.log(`[REGISTRY] ${accessible.length}/${BASELINE_STACK.length} baseline models accessible to this key:`,
            accessible.map(m => m.name).join(', '));
        } catch (e) {
          console.warn('[REGISTRY] discoverModels parse error:', e.message);
        }
        resolve();
      });
    });
    req.on('error', e => {
      console.warn('[REGISTRY] discoverModels network error:', e.message);
      resolve();
    });
    req.setTimeout(8000, () => { req.destroy(); resolve(); });
    req.end();
  });
}

/** Debug: print current breaker state */
function status() {
  const now = Date.now();
  return BASELINE_STACK.map(m => {
    const b = _breakerState(m.name);
    const remaining = Math.max(0, Math.ceil((b.cooldownUntil - now) / 1000));
    return {
      model:     m.name,
      available: remaining === 0,
      cooldownRemainingS: remaining,
      failures:  b.failures,
      lastError: b.lastError,
    };
  });
}

module.exports = { getActiveStack, recordFailure, recordSuccess, isAvailable, discoverModels, status, BASELINE_STACK };
