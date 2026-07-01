/**
 * Akhilesh Angadi Portfolio — Express Application Entry Point
 *
 * Thin wiring file. All business logic lives in dedicated modules:
 *   config/         — constants
 *   middleware/     — security, analytics, rate-limits
 *   routes/         — page renders + API handlers
 *   services/       — AI pipeline, resume data, stats, forms
 *
 * Author: Akhilesh Angadi
 */
require('dotenv').config();

const express     = require('express');
const path        = require('path');
const createError = require('http-errors');
const logger      = require('morgan');

const app = express();

// View engine
app.set('views',       path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.enable('view cache');   // cache compiled EJS templates in production

// Logging
app.use(logger('dev', { skip: (req) => req.path.startsWith('/socket.io') }));

// Security: nonce, helmet, compression, static assets
require('./middleware/security').apply(app);

// Enforce HTTPS in production (Azure/cloud deployments terminate TLS at proxy)
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      return res.redirect(301, `https://${req.header('host')}${req.url}`);
    }
    next();
  });
}

// Analytics + resume data injection into res.locals
app.use(require('./middleware/analytics'));

// Routes
app.use('/',    require('./routes/pages'));
app.use('/',    require('./routes/contact'));
app.use('/',    require('./routes/chat'));
app.use('/',    require('./routes/jd-match'));
app.use('/',    require('./routes/assets'));
app.use('/api', require('./routes/metrics'));

// 404 handler
app.use((req, res, next) => next(createError(404)));

// Error handler
app.use((err, req, res, next) => {
  res.locals.data    = res.locals.data || { profile: { profile: { name: 'Resume', social_links: {}, contact: {} } } };
  res.locals.message = err.message;
  res.locals.error   = {};  // Never expose error internals to template
  res.status(err.status || 500);
  res.render('error', { pageTitle: 'Error' });
});

module.exports = app;
