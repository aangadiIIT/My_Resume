'use strict';

const router = require('express').Router();
const fs   = require('fs');
const path = require('path');

const { chatRateLimit }  = require('../middleware/rate-limits');
const { runAIPipeline }  = require('../services/ai/pipeline');
const { SSE_STREAM_TIMEOUT_MS, FALLBACK_HINTS } = require('../config');

// Load summary once at module load — same as original app.js
const summary        = JSON.parse(fs.readFileSync(path.join(__dirname, '../public/data/summary.json'), 'utf8'));
const summaryByIntent = new Map(summary.mappings.map(m => [m.intent, m]));  // O(1) lookup

router.post('/api/chat/llm', chatRateLimit, async (req, res) => {
  const { query, history } = req.body;

  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.flushHeaders();

  const controller = new AbortController();

  const send = (data) => {
    if (res.writableEnded) return Promise.resolve();
    const ok = res.write(`data: ${JSON.stringify(data)}\n\n`);
    // If socket buffer is full, wait for drain before continuing (backpressure)
    if (!ok) return new Promise(resolve => res.once('drain', resolve));
    return Promise.resolve();
  };

  // 2-minute maximum connection duration — prevents zombie SSE connections
  const sseTimeout = setTimeout(() => {
    if (!res.writableEnded) {
      send({ type: 'done', hints: [], intent: 'timeout', engine: 'deterministic' });
      res.end();
    }
  }, SSE_STREAM_TIMEOUT_MS);

  req.on('close', () => { clearTimeout(sseTimeout); controller.abort(); });

  try {
    for await (const event of runAIPipeline({ query, history, summary, summaryByIntent, signal: controller.signal, sseTimeout })) {
      await send(event);
      if (event.type === 'done') break;
    }
    if (!res.writableEnded) res.end();
  } catch (outerErr) {
    clearTimeout(sseTimeout);
    console.error('[SSE CRITICAL ERROR]:', outerErr);
    await send({ type: 'answer', answer: "I don't have that specific information in my digital profile.", hints: FALLBACK_HINTS, intent: 'unknown', engine: 'deterministic' });
    await send({ type: 'done',   hints: FALLBACK_HINTS, intent: 'unknown', engine: 'deterministic' });
    if (!res.writableEnded) res.end();
  }
});

module.exports = router;
