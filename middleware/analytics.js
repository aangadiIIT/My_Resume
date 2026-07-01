'use strict';

const createError   = require('http-errors');
const { getResumeData } = require('../services/resume-data');
const { recordVisit }   = require('../services/stats-store');

const FALLBACK_DATA = { profile: { profile: { name: 'Resume', social_links: {}, contact: {} } } };

async function analyticsMiddleware(req, res, next) {
  // Track page views — exclude static files, API calls, and asset downloads
  if (!req.path.includes('.') && !req.path.startsWith('/api/') && !req.path.startsWith('/view-asset/')) {
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const ua = req.get('User-Agent') || 'unknown';
    recordVisit(ip, ua);
  }

  const data = (await getResumeData()) || FALLBACK_DATA;
  if (!data || !data.profile) {
    return next(createError(500, 'Fatal Data Error. Site is currently offline.'));
  }

  res.locals.data        = data;
  res.locals.totalVisits = require('../services/stats-store').getStats().visits;
  next();
}

module.exports = analyticsMiddleware;
