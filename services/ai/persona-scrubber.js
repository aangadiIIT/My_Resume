'use strict';

/**
 * Replaces first-person pronouns/verbs with third-person equivalents.
 * Extracted from ai-service.js and online-ai-service.js (was duplicated).
 */
function scrubPersona(text) {
  if (!text) return text;
  return text
    .replace(/\b(I am|I'm)\b/gi,  (m) => 'Akhilesh is')
    .replace(/\b(I have|I've)\b/gi, () => 'Akhilesh has')
    .replace(/\bI will\b/gi,  () => 'He will')
    .replace(/\bI'll\b/gi,    () => 'He will')
    .replace(/\bI would\b/gi, () => 'He would')
    .replace(/\bI'd\b/gi,     () => 'He would')
    .replace(/\bMy name is\b/gi, () => "Akhilesh's name is")
    .replace(/\bI\b/g,  () => 'He')
    .replace(/\bme\b/g, () => 'him')
    .replace(/\bmy\b/g, () => 'his')
    .trim();
}

module.exports = { scrubPersona };
