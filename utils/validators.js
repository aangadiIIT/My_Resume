'use strict';

const { EMAIL_REGEX } = require('../config');

/**
 * Returns null if valid, error string if invalid.
 */
function validateEmail(email) {
  if (!email || !EMAIL_REGEX.test(email)) return 'Invalid email address.';
  return null;
}

/**
 * Returns null if valid (or absent), error string if invalid.
 */
function validateRating(rating) {
  if (rating === undefined || rating === '' || rating === null) return null;
  const n = Number(rating);
  if (isNaN(n) || n < 1 || n > 5) return 'Rating must be between 1 and 5.';
  return null;
}

module.exports = { validateEmail, validateRating };
