'use strict';

const router = require('express').Router();
const os     = require('os');
const { metricsRateLimit } = require('../middleware/rate-limits');
const { getStats }         = require('../services/stats-store');
const registry             = require('../services/ai/gemini-model-registry');

function maskIp(ip) {
  if (!ip) return 'unknown';
  if (ip === '::1' || ip === '127.0.0.1' || ip.includes('127.0.0.1')) return 'localhost';
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  if (ip.includes('.')) {
    const parts = ip.split('.');
    return parts.length === 4 ? `${parts[0]}.${parts[1]}.${parts[2]}.xxx` : 'anonymous';
  }
  if (ip.includes(':')) {
    const parts = ip.split(':');
    return parts.length > 2 ? `${parts[0]}:${parts[1]}:${parts[2]}::xxxx` : 'anonymous';
  }
  return 'anonymous';
}

function getCpuUsage() {
  // Two-sample delta over 100ms — accurate real-time reading.
  // The single-sample (boot-average) approach always returns near 0% on an idle server.
  return new Promise(resolve => {
    const sample = () => {
      const cpus = os.cpus();
      let idle = 0, total = 0;
      cpus.forEach(cpu => {
        for (const t in cpu.times) total += cpu.times[t];
        idle += cpu.times.idle;
      });
      return { idle, total };
    };
    const s1 = sample();
    setTimeout(() => {
      const s2 = sample();
      const idleDiff  = s2.idle  - s1.idle;
      const totalDiff = s2.total - s1.total;
      resolve(totalDiff === 0 ? 0 : Math.round((1 - idleDiff / totalDiff) * 100));
    }, 100);
  });
}

/**
 * Shared auth check for monitoring endpoints.
 * Allows the request when:
 *   (a) ADMIN_API_KEY is not set (open mode)
 *   (b) x-admin-key header matches the secret (key-authenticated access)
 *
 * Note: same-origin browser checks via Referer/Origin are unreliable —
 * browsers omit these headers on same-origin fetches in many configurations.
 * The rate limiter (30 req/min) already protects against external abuse.
 */
function isAuthorised(req) {
  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey) return true;                                 // (a) gate disabled
  if (req.headers['x-admin-key'] === adminKey) return true;  // (b) key supplied
  return false;
}

// GET /api/site-metrics
router.get('/site-metrics', metricsRateLimit, async (req, res) => {
  if (!isAuthorised(req)) return res.status(403).json({ error: 'Unauthorized' });

  const stats    = getStats();
  const memTotal = os.totalmem();
  const memFree  = os.freemem();

  res.json({
    uptime:         Math.floor(process.uptime()),
    visits:         stats.visits,
    uniqueVisitors: Object.keys(stats.visitors || {}).length,
    visitors:       Object.entries(stats.visitors || {}).map(([ip, info]) => ({
      maskedIp: maskIp(ip),
      name:     info.name,
      hits:     info.hits,
      lastSeen: info.lastSeen,
    })),
    status: 'Operational',
    cpu:    await getCpuUsage(),
    ram:    Math.floor(((memTotal - memFree) / memTotal) * 100),
  });
});

// GET /api/model-status
router.get('/model-status', metricsRateLimit, (req, res) => {
  if (!isAuthorised(req)) return res.status(403).json({ error: 'Unauthorized' });

  res.json({
    activeStack: registry.getActiveStack().map(m => m.name),
    models:      registry.status(),
    timestamp:   new Date().toISOString(),
  });
});

module.exports = router;
