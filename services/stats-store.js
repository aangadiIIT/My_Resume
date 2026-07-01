'use strict';

const fs   = require('fs');
const path = require('path');
const { VISITOR_MAX } = require('../config');

const STATS_FILE = path.join(__dirname, '../public/data/stats.json');

let stats = { visits: 0, visitors: {} };
let pendingFlush = false;

async function loadStats() {
  try {
    const raw = await fs.promises.readFile(STATS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    stats.visits   = parsed.visits   || 0;
    stats.visitors = parsed.visitors || {};
  } catch {
    stats = { visits: 0, visitors: {} };
  }
}

function _scheduleFlush() {
  if (pendingFlush) return;
  pendingFlush = true;
  // Batch writes every 5s — reduces I/O from per-request to ~12/min at 100 RPS
  setTimeout(() => {
    pendingFlush = false;
    fs.promises.writeFile(STATS_FILE, JSON.stringify(stats))
      .catch(err => console.error('[STATS] Write error:', err.message));
  }, 5_000);
}

function _evictOldestVisitors() {
  const keys = Object.keys(stats.visitors);
  if (keys.length < VISITOR_MAX) return;
  // Sort by lastSeen ascending, delete oldest 500
  keys.sort((a, b) => new Date(stats.visitors[a].lastSeen) - new Date(stats.visitors[b].lastSeen));
  keys.slice(0, 500).forEach(k => delete stats.visitors[k]);
}

function recordVisit(ip, ua) {
  stats.visits++;
  if (!stats.visitors[ip]) {
    _evictOldestVisitors();
    stats.visitors[ip] = { hits: 0, ua, firstSeen: new Date().toISOString() };
  }
  stats.visitors[ip].hits++;
  stats.visitors[ip].lastSeen = new Date().toISOString();
  _scheduleFlush();
}

function associateName(ip, name) {
  if (stats.visitors[ip]) {
    stats.visitors[ip].name = name;
    _scheduleFlush();
  }
}

function getStats() {
  return stats;
}

module.exports = { loadStats, recordVisit, associateName, getStats };
