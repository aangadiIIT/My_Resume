'use strict';

const rateLimit = require('express-rate-limit');
const { RATE_LIMITS } = require('../config');

// Use socket.remoteAddress (actual TCP connection) not req.ip (spoofable via X-Forwarded-For)
const isLoopback = (req) => {
  const addr = req.socket.remoteAddress;
  return addr === '::1' || addr === '::ffff:127.0.0.1' || addr === '127.0.0.1';
};

const chatRateLimit = rateLimit({
  ...RATE_LIMITS.chat,
  skip:           isLoopback,
  standardHeaders: true,
  legacyHeaders:  false,
  message: { error: 'Too many requests. Please wait a moment before sending another message.' },
});

const metricsRateLimit = rateLimit({
  ...RATE_LIMITS.metrics,
  skip:           isLoopback,
  standardHeaders: true,
  legacyHeaders:  false,
  message: { error: 'Too many requests.' },
});

const contactRateLimit = rateLimit({
  ...RATE_LIMITS.contact,
  message: { error: 'Too many submissions.' },
});

const jdMatchRateLimit = rateLimit({
  ...RATE_LIMITS.jd,
  skip:    isLoopback,
  message: { error: 'Too many requests. Please wait a moment.' },
});

module.exports = { chatRateLimit, metricsRateLimit, contactRateLimit, jdMatchRateLimit, isLoopback };
