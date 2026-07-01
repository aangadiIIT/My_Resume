'use strict';

const router = require('express').Router();
const { submitToGoogleForm } = require('../services/form-submit');
const { associateName }      = require('../services/stats-store');
const { validateEmail, validateRating } = require('../utils/validators');
const { contactRateLimit }   = require('../middleware/rate-limits');

// Page render
router.get('/contact-me', (req, res) => res.render('contact-me', { pageTitle: 'Contact | Akhilesh Angadi' }));

// Website feedback form (from contact page)
router.post('/contact-me', async (req, res) => {
  const { name, email, subject, message, rating } = req.body;
  const isAjax = req.headers['content-type']?.includes('application/json');

  // Type checks first — prevents object/array injection into stats store
  if (typeof name !== 'string' || typeof message !== 'string') {
    return isAjax
      ? res.status(400).json({ error: 'Name and message must be strings.' })
      : res.status(400).send('Invalid input.');
  }
  const trimmedName = name.trim().slice(0, 200);

  if (!trimmedName || !email || !message.trim()) {
    return isAjax
      ? res.status(400).json({ error: 'Name, email and message are required.' })
      : res.status(400).send('Missing required fields.');
  }
  const emailErr  = validateEmail(email);
  if (emailErr) {
    return isAjax ? res.status(400).json({ error: emailErr }) : res.status(400).send(emailErr);
  }
  const ratingErr = validateRating(rating);
  if (ratingErr) {
    return isAjax ? res.status(400).json({ error: ratingErr }) : res.status(400).send(ratingErr);
  }

  const enrichedMessage = (rating ? `[Rating: ${rating}/5] ` : '') + String(message).slice(0, 2000);
  console.log(`[FEEDBACK] Received: name=${trimmedName}, rating=${rating}, subject=${subject}`);

  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  associateName(ip, trimmedName);

  try {
    await submitToGoogleForm({ name, email, subject: subject || 'Website Feedback', rating, message: enrichedMessage });
  } catch (err) {
    console.error('[CONTACT] Google Form error:', err.message);
  }

  if (isAjax) return res.json({ success: true });
  res.render('contact-success', { pageTitle: 'Message Sent | Akhilesh Angadi', userName: name });
});

// API contact (hiring popup)
router.post('/api/contact', contactRateLimit, async (req, res) => {
  const { name, email, subject, message } = req.body;
  if (!name || !email || !message) return res.status(400).json({ error: 'Missing required fields.' });
  const emailErr = validateEmail(email);
  if (emailErr) return res.status(400).json({ success: false, message: emailErr });

  try {
    await submitToGoogleForm({ name, email, subject: subject || 'Hiring Opportunity', rating: '', message });
    res.json({ success: true });
  } catch (err) {
    console.error('[API/CONTACT] Google Forms error:', err.message);
    res.status(500).json({ error: 'Submission failed. Please try email directly.' });
  }
});

module.exports = router;
