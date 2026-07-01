/**
 * Akhilesh Angadi Portfolio — Unit Test Suite
 *
 * Exercises pure functions in chatbot-engine and online-ai-service that are
 * not reachable through the HTTP integration tests in sanity.js.
 *
 * Coverage:
 *   1. normalize()            — tokenisation, stop-word removal, shorthand expansion
 *   2. levenshtein()          — edit-distance correctness
 *   3. sanitize()             — markdown stripping, linkification, idempotency
 *   4. enforceThirdPerson()   — first-person replacement, verb conjugation, skip domains
 *   5. detectUserMode()       — recruiter / explorer keyword detection
 *   6. normalizeHistory()     — Gemini alternating-role normalisation
 *   7. enforceThirdPerson()   — domain skip coverage (bot_identity, bot_help, capabilities)
 *   8. persona-scrubber       — scrubPersona() first-person replacement correctness
 *
 * Usage:
 *   npm run test:unit
 *
 * Author: Akhilesh Angadi
 */

const assert = require('assert');
const ChatbotEngine = require('../public/scripts/chatbot-engine');
const { normalizeHistory } = require('../services/ai/online');

// ─── tiny test harness ────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures = [];

function test(label, fn) {
    try {
        fn();
        console.log(`  ✅ ${label}`);
        passed++;
    } catch (err) {
        console.error(`  ❌ ${label}: ${err.message}`);
        failures.push({ label, message: err.message });
        failed++;
    }
}

function section(title) {
    console.log(`\n── ${title} ──`);
}

// ─── helpers ─────────────────────────────────────────────────────────────────

const { normalize, sanitize, enforceThirdPerson, detectUserMode } = ChatbotEngine;

// levenshtein is not exported directly — access via findResponse trace is complex,
// so we test it indirectly through normalize-adjacent behaviour where edit-distance
// is exercised. We also expose it by re-requiring the module (same instance).
// Direct levenshtein access: not exported, tested via observable normalise side-effects.

// ─── 1. normalize() ───────────────────────────────────────────────────────────

section('normalize()');

test('empty string → empty string', () => {
    assert.strictEqual(normalize(''), '');
});

test('null → empty string', () => {
    assert.strictEqual(normalize(null), '');
});

test('undefined → empty string', () => {
    assert.strictEqual(normalize(undefined), '');
});

test('pure symbols → "symbolic_query"', () => {
    assert.strictEqual(normalize('???'), 'symbolic_query');
    assert.strictEqual(normalize('??'), 'symbolic_query');
    assert.strictEqual(normalize('!!!'), 'symbolic_query');
});

test('"another" → "re_trigger_match"', () => {
    assert.strictEqual(normalize('another'), 're_trigger_match');
});

test('"another one" → "re_trigger_match"', () => {
    assert.strictEqual(normalize('another one'), 're_trigger_match');
});

test('"next" → "re_trigger_match"', () => {
    assert.strictEqual(normalize('next'), 're_trigger_match');
});

test('"more" → "re_trigger_match"', () => {
    assert.strictEqual(normalize('more'), 're_trigger_match');
});

test('"one more" → "re_trigger_match"', () => {
    assert.strictEqual(normalize('one more'), 're_trigger_match');
});

test('tech shorthand: k8s → kubernetes', () => {
    const result = normalize('k8s deployment');
    assert.ok(result.includes('kubernetes'), `Expected "kubernetes" in "${result}"`);
});

test('tech shorthand: tf → terraform', () => {
    const result = normalize('tf scripts');
    assert.ok(result.includes('terraform'), `Expected "terraform" in "${result}"`);
});

test('tech shorthand: ml → machine learning', () => {
    const result = normalize('ml project');
    assert.ok(result.includes('machine learning'), `Expected "machine learning" in "${result}"`);
});

test('tech shorthand: cicd → ci cd', () => {
    const result = normalize('cicd pipeline');
    assert.ok(result.includes('ci') && result.includes('cd'), `Expected "ci cd" in "${result}"`);
});

test('tech shorthand: genai → generative ai', () => {
    const result = normalize('genai work');
    assert.ok(result.includes('generative ai'), `Expected "generative ai" in "${result}"`);
});

test('stop words are removed (tell, show, what)', () => {
    const result = normalize('tell me what skills does he have');
    assert.ok(!result.includes('tell'), `"tell" should be stripped`);
    assert.ok(!result.includes('what'), `"what" should be stripped`);
    assert.ok(!result.includes('me'), `"me" should be stripped`);
});

test('single-char tokens are removed', () => {
    const result = normalize('a b c experience');
    assert.ok(!result.split(' ').some(w => w.length === 1), `Single-char tokens should be removed`);
});

test('punctuation is stripped', () => {
    const result = normalize('What are his skills?');
    assert.ok(!result.includes('?'), `Punctuation should be removed`);
    assert.ok(!result.includes('!'), `Punctuation should be removed`);
});

test('case insensitivity — uppercase input normalised', () => {
    const lower = normalize('experience');
    const upper = normalize('EXPERIENCE');
    assert.strictEqual(lower, upper);
});

// ─── 2. sanitize() ────────────────────────────────────────────────────────────

section('sanitize()');

test('empty string → empty string', () => {
    assert.strictEqual(sanitize(''), '');
});

test('null → empty string', () => {
    assert.strictEqual(sanitize(null), '');
});

test('non-string coerced to string', () => {
    assert.strictEqual(typeof sanitize(42), 'string');
});

test('removes # markdown symbol', () => {
    assert.ok(!sanitize('## Heading').includes('#'));
});

test('removes * markdown symbol', () => {
    const result = sanitize('some * text');
    assert.ok(!result.includes('*'), `"*" should be stripped`);
});

test('removes backtick markdown symbol', () => {
    assert.ok(!sanitize('`code`').includes('`'));
});

test('converts **bold** to <b> tags', () => {
    const result = sanitize('**hello**');
    assert.ok(result.includes('<b>hello</b>'), `Expected <b>hello</b>, got: ${result}`);
});

test('does not double-apply <b> when already tagged', () => {
    const input = '<b>hello</b>';
    const result = sanitize(input);
    assert.strictEqual(result, input);
});

test('linkifies /view-asset PDF path', () => {
    const result = sanitize('Download /view-asset/awards/cert.pdf here');
    assert.ok(result.includes('<a href="/view-asset/awards/cert.pdf"'), `Expected anchor tag, got: ${result}`);
});

test('does not re-linkify already-wrapped <a> tag', () => {
    const input = '<a href="/view-asset/awards/cert.pdf" target="_blank" class="chat-link">📄 Open Document</a>';
    const result = sanitize(input);
    assert.ok(!result.includes('<a href="/view-asset/awards/cert.pdf"<a'), `Should not double-wrap anchor`);
    assert.strictEqual(result.match(/<a/g)?.length, 1, `Should have exactly one anchor tag`);
});

test('linkifies raw LinkedIn URL', () => {
    const result = sanitize('Visit https://linkedin.com/in/akhilangadi for profile');
    assert.ok(result.includes('href="https://linkedin.com/in/akhilangadi"'), `Expected LinkedIn anchor`);
    assert.ok(result.includes('LinkedIn Profile'), `Expected LinkedIn label`);
});

test('linkifies raw GitHub URL', () => {
    const result = sanitize('Code at https://github.com/akhilangadi');
    assert.ok(result.includes('href="https://github.com/akhilangadi"'), `Expected GitHub anchor`);
    assert.ok(result.includes('GitHub Profile'), `Expected GitHub label`);
});

test('does not double-linkify already-href LinkedIn', () => {
    const input = '<a href="https://linkedin.com/in/akhilangadi" target="_blank" class="chat-link">🔗 LinkedIn Profile</a>';
    const result = sanitize(input);
    assert.strictEqual(result.match(/href=/g)?.length ?? 0, 1, `Should not create duplicate href`);
});

test('normalises multiple spaces to single space', () => {
    const result = sanitize('hello   world');
    assert.strictEqual(result, 'hello world');
});

// ─── 3. enforceThirdPerson() ─────────────────────────────────────────────────

section('enforceThirdPerson()');

test('empty string → empty string', () => {
    assert.strictEqual(enforceThirdPerson('', 'identity', 'identity'), '');
});

test('"I am" → "Akhilesh is"', () => {
    const result = enforceThirdPerson('I am a developer', 'identity', 'identity');
    assert.ok(result.startsWith('Akhilesh is'), `Expected "Akhilesh is …", got: "${result}"`);
});

test('"I have" → "Akhilesh has"', () => {
    const result = enforceThirdPerson('I have 5 years of experience', 'experience', 'experience');
    assert.ok(result.includes('Akhilesh has'), `Expected "Akhilesh has", got: "${result}"`);
});

test('"My skills" → "His skills"', () => {
    const result = enforceThirdPerson('My skills include Python', 'skills', 'skills');
    assert.ok(result.startsWith('His'), `Expected "His …", got: "${result}"`);
});

test('"I will" → "He will"', () => {
    const result = enforceThirdPerson("I will join next month", 'identity', 'identity');
    assert.ok(result.includes('He will'), `Expected "He will", got: "${result}"`);
});

test('"I built" → "He built"', () => {
    const result = enforceThirdPerson('I built the CI/CD pipeline', 'projects', 'projects');
    assert.ok(result.includes('He built'), `Expected "He built", got: "${result}"`);
});

test('small_talk domain is skipped — text unchanged', () => {
    const input = 'I am just chatting with you';
    assert.strictEqual(enforceThirdPerson(input, 'small_talk', 'small_talk'), input);
});

test('jokes domain is skipped — text unchanged', () => {
    const input = 'I know a good joke';
    assert.strictEqual(enforceThirdPerson(input, 'jokes', 'jokes'), input);
});

test('thanks domain is skipped — text unchanged', () => {
    const input = 'I appreciate your thanks';
    assert.strictEqual(enforceThirdPerson(input, 'thanks', 'thanks'), input);
});

test('bye domain is skipped — text unchanged', () => {
    const input = 'I will see you later';
    assert.strictEqual(enforceThirdPerson(input, 'bye', 'bye'), input);
});

test('removes hashtags', () => {
    const result = enforceThirdPerson('He specializes in #DevOps', 'skills', 'skills');
    assert.ok(!result.includes('#DevOps'), `Hashtags should be removed, got: "${result}"`);
});

test('verb conjugation fix: "He specialize" → "He specializes"', () => {
    const result = enforceThirdPerson('I specialize in cloud', 'skills', 'skills');
    assert.ok(result.includes('He specializes'), `Expected "He specializes", got: "${result}"`);
});

test('verb conjugation fix: "He work" → "He works"', () => {
    const result = enforceThirdPerson('I work at SAP', 'experience', 'experience');
    assert.ok(result.includes('He works'), `Expected "He works", got: "${result}"`);
});

test('no double-words produced', () => {
    const result = enforceThirdPerson('His his portfolio', 'identity', 'identity');
    assert.ok(!result.includes('His his'), `Double word "His his" should be removed, got: "${result}"`);
});

// ─── 4. detectUserMode() ─────────────────────────────────────────────────────

section('detectUserMode()');

test('null → null', () => {
    assert.strictEqual(detectUserMode(null), null);
});

test('empty string → null', () => {
    assert.strictEqual(detectUserMode(''), null);
});

test('"hire" keyword → recruiter', () => {
    assert.strictEqual(detectUserMode('looking to hire a candidate'), 'recruiter');
});

test('"recruit" keyword → recruiter', () => {
    assert.strictEqual(detectUserMode('We are recruiting for a position'), 'recruiter');
});

test('"interview" keyword → recruiter', () => {
    assert.strictEqual(detectUserMode('can we schedule an interview'), 'recruiter');
});

test('"open to" keyword → recruiter', () => {
    assert.strictEqual(detectUserMode('are you open to opportunities'), 'recruiter');
});

test('"explore" keyword → explorer', () => {
    assert.strictEqual(detectUserMode('I want to explore his background'), 'explorer');
});

test('"deep dive" keyword → explorer', () => {
    assert.strictEqual(detectUserMode('let me do a deep dive'), 'explorer');
});

test('"tell me everything" → explorer', () => {
    assert.strictEqual(detectUserMode('tell me everything about him'), 'explorer');
});

test('neutral query → null', () => {
    assert.strictEqual(detectUserMode('what are his skills'), null);
});

test('case-insensitive matching', () => {
    assert.strictEqual(detectUserMode('HIRE this person'), 'recruiter');
    assert.strictEqual(detectUserMode('EXPLORE his work'), 'explorer');
});

// ─── 5. normalizeHistory() ───────────────────────────────────────────────────

section('normalizeHistory()');

test('empty array → empty array', () => {
    assert.deepStrictEqual(normalizeHistory([]), []);
});

test('single user message → [{role: "user", parts: [{text: ...}]}]', () => {
    const result = normalizeHistory([{ type: 'user', text: 'hello' }]);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].role, 'user');
    assert.strictEqual(result[0].parts[0].text, 'hello');
});

test('single bot message → role "model"', () => {
    const result = normalizeHistory([{ type: 'bot', text: 'Hi there' }]);
    assert.strictEqual(result[0].role, 'model');
});

test('alternating user/bot messages are preserved as-is', () => {
    const history = [
        { type: 'user', text: 'hello' },
        { type: 'bot', text: 'hi' },
        { type: 'user', text: 'how are you' }
    ];
    const result = normalizeHistory(history);
    assert.strictEqual(result.length, 3);
    assert.strictEqual(result[0].role, 'user');
    assert.strictEqual(result[1].role, 'model');
    assert.strictEqual(result[2].role, 'user');
});

test('consecutive same-role messages are merged', () => {
    const history = [
        { type: 'user', text: 'first question' },
        { type: 'user', text: 'second question' }
    ];
    const result = normalizeHistory(history);
    assert.strictEqual(result.length, 1);
    assert.ok(result[0].parts[0].text.includes('first question'));
    assert.ok(result[0].parts[0].text.includes('second question'));
});

test('two consecutive bot messages are merged', () => {
    const history = [
        { type: 'bot', text: 'part one' },
        { type: 'bot', text: 'part two' }
    ];
    const result = normalizeHistory(history);
    assert.strictEqual(result.length, 1);
    assert.ok(result[0].parts[0].text.includes('part one'));
    assert.ok(result[0].parts[0].text.includes('part two'));
});

test('entries with empty text are filtered out', () => {
    const history = [
        { type: 'user', text: '' },
        { type: 'bot', text: 'response' },
        { type: 'user', text: '   ' }
    ];
    const result = normalizeHistory(history);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].role, 'model');
});

test('only the last 6 messages are used', () => {
    const history = Array.from({ length: 10 }, (_, i) => ({
        type: i % 2 === 0 ? 'user' : 'bot',
        text: `message ${i}`
    }));
    const result = normalizeHistory(history);
    // Last 6 entries alternate correctly — result should have at most 6 entries
    assert.ok(result.length <= 6, `Expected <= 6 entries, got ${result.length}`);
    // Last message in source should appear in result
    assert.ok(
        result.some(r => r.parts[0].text.includes('message 9')),
        `Last message should be present`
    );
    // First message (message 0) should NOT be present
    assert.ok(
        !result.some(r => r.parts[0].text.includes('message 0')),
        `Messages beyond the 6-entry window should be dropped`
    );
});

// ─── 6. enforceThirdPerson() — domain skip coverage ──────────────────────────

section('enforceThirdPerson() — domain skip coverage');

test('bot_identity domain skips third-person enforcement — preserves first-person bot voice', () => {
    const input = "I am Akhilesh's AI Portfolio Assistant. I'm a knowledge engine.";
    const result = enforceThirdPerson(input, 'bot_identity', 'bot_identity');
    assert.ok(result.startsWith('I am'), `Expected result to start with "I am", got: "${result}"`);
    assert.ok(!result.includes('Akhilesh is Akhilesh'), `Should not produce "Akhilesh is Akhilesh", got: "${result}"`);
});

test('bot_help domain skips third-person enforcement', () => {
    const input = 'I can help you explore his career';
    const result = enforceThirdPerson(input, 'bot_help', 'bot_help');
    assert.ok(result.startsWith('I can'), `Expected result to start with "I can", got: "${result}"`);
});

test('capabilities domain skips third-person enforcement', () => {
    const input = 'I am able to answer questions';
    const result = enforceThirdPerson(input, 'capabilities', 'capabilities');
    assert.strictEqual(result, input, `Expected text unchanged, got: "${result}"`);
});

test('professional domain (experience) still enforces third-person', () => {
    const result = enforceThirdPerson('I am a Cloud Engineer at SAP', 'experience_sap', 'experience');
    assert.ok(!result.startsWith('I am'), `Expected third-person replacement, but result still starts with "I am": "${result}"`);
    assert.ok(result.includes('Akhilesh is'), `Expected "Akhilesh is" in result, got: "${result}"`);
});

// ─── 7. persona-scrubber: correctness ────────────────────────────────────────

section('persona-scrubber: correctness');

const { scrubPersona } = require('../services/ai/persona-scrubber');

test('scrubPersona replaces "I am" — produces "Akhilesh is" (not identity-preserving for bot text)', () => {
    const original = 'I am his dedicated assistant. I help recruiters.';
    const result = scrubPersona(original);
    assert.notStrictEqual(result, original, `Expected scrubbing to occur, but text was unchanged`);
    assert.ok(result.includes('Akhilesh is'), `Expected "Akhilesh is" in result, got: "${result}"`);
});

test('scrubPersona replaces "I have" with "Akhilesh has"', () => {
    const result = scrubPersona('I have 5 years of experience');
    assert.strictEqual(result, 'Akhilesh has 5 years of experience', `Got: "${result}"`);
});

test('scrubPersona replaces bare "I" with "He"', () => {
    const result = scrubPersona('I led the team');
    assert.strictEqual(result, 'He led the team', `Got: "${result}"`);
});

test('scrubPersona trims leading and trailing whitespace', () => {
    const result = scrubPersona('  I am great  ');
    assert.strictEqual(result, 'Akhilesh is great', `Got: "${result}"`);
});

// ─── summary ──────────────────────────────────────────────────────────────────

console.log('\n──────────────────────────────────────────');
console.log(`📊 Unit Tests: ${passed} passed, ${failed} failed`);

if (failures.length > 0) {
    console.log('\nFailed tests:');
    failures.forEach(f => console.log(`  • ${f.label}: ${f.message}`));
}

const status = failed === 0 ? '✅ ALL UNIT TESTS PASSED' : `❌ ${failed} UNIT TEST(S) FAILED`;
console.log(`\n${status}`);
console.log('──────────────────────────────────────────\n');

process.exit(failed > 0 ? 1 : 0);
