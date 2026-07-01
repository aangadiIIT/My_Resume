'use strict';

const crypto      = require('crypto');
const path        = require('path');
const helmet      = require('helmet');
const compression = require('compression');
const express     = require('express');

function apply(app) {
  // Per-request CSP nonce — must run before helmet
  app.use((req, res, next) => {
    res.locals.nonce = crypto.randomBytes(16).toString('base64');
    next();
  });

  // Security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'script-src':    ["'self'", (req, res) => `'nonce-${res.locals.nonce}'`, 'cdn.jsdelivr.net', 'unpkg.com', 'cdnjs.cloudflare.com'],
        // unsafe-inline is required for style="" attributes (inline styles on HTML elements).
        // Nonces only protect <style> tags, not style="" attributes — those need unsafe-inline.
        // This is acceptable: CSS injection risk is far lower than script injection risk,
        // and the entire app uses Bootstrap/animation inline styles that would break without it.
        'style-src':     ["'self'", "'unsafe-inline'", 'fonts.googleapis.com', 'cdn.jsdelivr.net', 'unpkg.com', 'cdnjs.cloudflare.com'],
        'font-src':      ["'self'", 'fonts.gstatic.com', 'cdnjs.cloudflare.com'],
        'img-src':       ["'self'", 'data:', 'https:'],
        'connect-src':   ["'self'", 'cdn.jsdelivr.net', 'unpkg.com', 'cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'],
        'base-uri':      ["'self'"],
        'form-action':   ["'self'"],
        'frame-ancestors': ["'self'"],
        'object-src':    ["'none'"],
        'worker-src':    ["'self'"],
        'upgrade-insecure-requests': [],
      },
    },
  }));

  // Compress responses > 4KB; skip tiny JSON payloads
  app.use(compression({ threshold: 4096 }));

  // Reject socket.io polling with 403 — Engine.io treats this as permanent rejection
  // Express 5 requires named wildcards; use /socket.io/* with wildcard param
  app.all('/socket.io/{*splat}', (req, res) => res.status(403).end());

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.use(express.static(path.join(__dirname, '../public'), { maxAge: '1d', etag: true }));
}

module.exports = { apply };
