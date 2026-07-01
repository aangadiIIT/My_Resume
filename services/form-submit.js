'use strict';

const { GOOGLE_FORM_URL, GOOGLE_FORM_ENTRY_IDS, FORM_TIMEOUT_MS } = require('../config');

/**
 * Submits a contact/feedback entry to the Google Form backend.
 * @param {{ name, email, subject, rating, message }} fields
 */
async function submitToGoogleForm({ name, email, subject, rating, message }) {
  const formData = new URLSearchParams();
  formData.append(GOOGLE_FORM_ENTRY_IDS.name,    name);
  formData.append(GOOGLE_FORM_ENTRY_IDS.email,   email);
  formData.append(GOOGLE_FORM_ENTRY_IDS.subject, subject || '');
  formData.append(GOOGLE_FORM_ENTRY_IDS.rating,  rating ? String(rating) : '');
  formData.append(GOOGLE_FORM_ENTRY_IDS.message, message);

  const controller = new AbortController();
  const timeout    = setTimeout(() => controller.abort(), FORM_TIMEOUT_MS);

  try {
    const res = await fetch(GOOGLE_FORM_URL, {
      method:  'POST',
      body:    formData,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal:  controller.signal,
    });
    console.log(`[FORM] Submission status: ${res.status} ${res.statusText}`);
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { submitToGoogleForm };
