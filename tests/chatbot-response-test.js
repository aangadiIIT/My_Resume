/**
 * Chatbot Response Quality Test
 * Tests all major query categories, intent routing, persona integrity, and answer quality.
 */
'use strict';

require('dotenv').config();
const http = require('http');
const app  = require('../app');

const server = http.createServer(app);

async function chat(port, query, history = []) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query, history });
    const req  = http.request({
      hostname: 'localhost', port,
      path: '/api/chat/llm', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, res => {
      let text = '';
      res.on('data', d => text += d);
      res.on('end', () => {
        let answer = '', intent = '', engine = '';
        text.split('\n').forEach(line => {
          if (!line.startsWith('data: ')) return;
          try {
            const d = JSON.parse(line.slice(6));
            if (d.type === 'token')  answer += d.content;
            if (d.type === 'answer') answer  = d.answer;
            if (d.type === 'done')  { intent = d.intent; engine = d.engine; }
          } catch (_) {}
        });
        resolve({ answer: answer.trim(), intent, engine });
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('timeout')); });
    req.write(body);
    req.end();
  });
}

const TESTS = [
  // ── Bot identity ────────────────────────────────────────────────────────
  { label: 'Bot identity',         q: 'who are you',
    intent: 'bot_identity',
    check: a => a.toLowerCase().includes('portfolio') || a.toLowerCase().includes('assistant'),
    note:  'Must describe itself as a portfolio assistant' },

  { label: 'Bot capabilities',     q: 'what can you help me with',
    intentPattern: /capabilities|bot_help/,
    check: a => a.length > 20,
    note:  'Must give a non-empty capabilities answer (bot_help = capabilities)' },

  // ── Experience ──────────────────────────────────────────────────────────
  { label: 'SAP role',             q: 'what does he do at SAP',
    intent: 'experience_sap',
    check: a => a.toLowerCase().includes('sap') || a.toLowerCase().includes('cloud') || a.toLowerCase().includes('kubernetes'),
    note:  'Must mention SAP or cloud/kubernetes work' },

  { label: 'Juniper role',         q: 'his role at juniper networks',
    intent: 'experience_juniper',
    check: a => a.toLowerCase().includes('juniper') || a.toLowerCase().includes('engineer') || a.toLowerCase().includes('software'),
    note:  'Must mention Juniper or engineering' },

  { label: 'SAP project (fixed)',  q: 'tell me about his sap project in detail',
    intent: 'experience_sap',
    check: a => !a.toLowerCase().includes('smart water') && (a.toLowerCase().includes('sap') || a.toLowerCase().includes('cloud') || a.toLowerCase().includes('kubernetes') || a.toLowerCase().includes('gardener')),
    note:  'Must NOT show IoT water project; must show SAP cloud work' },

  { label: 'Career summary',       q: 'give me a career overview',
    intentPattern: /experience/,
    check: a => a.toLowerCase().includes('year') || a.toLowerCase().includes('sap') || a.toLowerCase().includes('juniper'),
    note:  'Must mention years or companies' },

  { label: 'Previous experience',  q: 'what did he do before SAP',
    intent: 'experience_previous',
    check: a => a.toLowerCase().includes('juniper') || a.toLowerCase().includes('engineer') || a.toLowerCase().includes('previous'),
    note:  'Must mention pre-SAP experience' },

  // ── Skills ──────────────────────────────────────────────────────────────
  { label: 'All skills',           q: 'what are his main technical skills',
    intent: 'skills_summary',
    check: a => a.toLowerCase().includes('kubernetes') || a.toLowerCase().includes('cloud') || a.toLowerCase().includes('devops'),
    note:  'Must mention core skills' },

  { label: 'Cloud skills',         q: 'show cloud and devops skills',
    intentPattern: /skills/,
    check: a => a.toLowerCase().includes('kubernetes') || a.toLowerCase().includes('docker') || a.toLowerCase().includes('aws') || a.toLowerCase().includes('azure'),
    note:  'Must mention cloud technologies' },

  // ── Projects ────────────────────────────────────────────────────────────
  { label: 'IoT project',          q: 'tell me about his iot project',
    intent: 'projects_iot',
    check: a => a.toLowerCase().includes('iot') || a.toLowerCase().includes('water') || a.toLowerCase().includes('sensor') || a.toLowerCase().includes('agriculture'),
    note:  'Must describe the IoT/water project' },

  { label: 'CI/CD project',        q: 'what is his cicd project',
    intent: 'projects_cicd',
    check: a => a.toLowerCase().includes('ci') || a.toLowerCase().includes('pipeline') || a.toLowerCase().includes('jenkins') || a.toLowerCase().includes('automation'),
    note:  'Must describe CI/CD automation project' },

  { label: 'All projects',         q: 'show me all his projects',
    intent: 'projects_summary',
    check: a => a.length > 15,
    note:  'Must return project information' },

  // ── Education ───────────────────────────────────────────────────────────
  { label: 'Masters degree',       q: 'where did he do his masters',
    intentPattern: /education/,
    check: a => a.toLowerCase().includes('illinois') || a.toLowerCase().includes('iit') || a.toLowerCase().includes('chicago') || a.toLowerCase().includes('information technology'),
    note:  'Must mention IIT Chicago / masters details' },

  { label: 'Engineering degree',   q: 'where he did his engineering',
    intent: 'education_bachelors',
    check: a => a.toLowerCase().includes('sdmcet') || a.toLowerCase().includes('dharwad') || a.toLowerCase().includes('computer'),
    note:  'Must mention SDMCET or Dharwad BE' },

  // ── Certifications & Awards ─────────────────────────────────────────────
  { label: 'Certifications',       q: 'show his certifications',
    intent: 'certifications',
    check: a => a.toLowerCase().includes('certif') || a.toLowerCase().includes('kubernetes') || a.toLowerCase().includes('docker') || a.toLowerCase().includes('terraform'),
    note:  'Must list certifications' },

  { label: 'Awards count',         q: 'how many awards does he have',
    intent: 'awards',
    check: a => /\d/.test(a) || a.toLowerCase().includes('award') || a.toLowerCase().includes('recogni'),
    note:  'Must mention awards count or recognition' },

  // ── Contact & social ────────────────────────────────────────────────────
  { label: 'Contact info',         q: 'how do i contact him',
    intent: 'contact',
    check: a => a.toLowerCase().includes('email') || a.toLowerCase().includes('linkedin') || a.toLowerCase().includes('contact') || a.toLowerCase().includes('@') || a.toLowerCase().includes('reach'),
    note:  'Must provide contact details (email address or linkedin)' },

  { label: 'LinkedIn',             q: 'linkedin profile link',
    intent: 'linkedin',
    check: a => a.toLowerCase().includes('linkedin'),
    note:  'Must mention LinkedIn' },

  { label: 'Resume download',      q: 'download his resume',
    intent: 'resume_download',
    check: a => a.toLowerCase().includes('resume') || a.toLowerCase().includes('download') || a.toLowerCase().includes('pdf'),
    note:  'Must provide resume download info' },

  // ── Recruiter queries ───────────────────────────────────────────────────
  { label: 'Why hire',             q: 'why should I hire him',
    intentPattern: /hire|why/,
    check: a => a.toLowerCase().includes('akhilesh') || a.toLowerCase().includes('year') || a.toLowerCase().includes('cloud') || a.toLowerCase().includes('engineer'),
    note:  'Must give hiring pitch' },

  { label: 'Location',             q: 'where is he currently located',
    intent: 'location',
    check: a => a.toLowerCase().includes('bangalore') || a.toLowerCase().includes('bengaluru') || a.toLowerCase().includes('india'),
    note:  'Must mention Bangalore/Bengaluru' },

  { label: 'Availability',         q: 'is he available for work',
    intentPattern: /hire|identity|headline|available|location/,
    check: a => a.length > 15,
    note:  'Must give availability status' },

  // ── Small talk & entertainment ──────────────────────────────────────────
  { label: 'Greeting',             q: 'hello',
    intent: 'small_talk',
    check: a => a.length > 10,
    note:  'Must greet back' },

  { label: 'Joke',                 q: 'tell me a programming joke',
    intent: 'jokes',
    check: a => a.length > 20,
    note:  'Must tell a joke' },

  { label: 'Goodbye',              q: 'bye',
    intent: 'bye',
    check: a => a.length > 5,
    note:  'Must say goodbye' },

  // ── Persona integrity ───────────────────────────────────────────────────
  { label: 'No first-person leak', q: 'tell me about his cloud experience',
    intentPattern: /skills|experience/,
    check: a => !a.toLowerCase().match(/\bi am\b|\bi've\b|\bi have\b|\bmy skills\b|\bmy experience\b/),
    note:  'Must NOT use first-person pronouns in professional answers' },

  { label: 'Third-person voice',   q: 'what is his expertise in kubernetes',
    intentPattern: /skills|experience|projects/,
    check: a => a.toLowerCase().includes('he') || a.toLowerCase().includes('his') || a.toLowerCase().includes('akhilesh'),
    note:  'Must use third-person (he/his/Akhilesh)' },

  // ── Multi-turn context ──────────────────────────────────────────────────
  { label: 'Follow-up: more detail', q: 'tell me more',
    history: [{ type: 'user', text: 'what are his skills', intent: 'skills_summary' }, { type: 'bot', text: 'He has cloud and DevOps skills.', intent: 'skills_summary' }],
    intentPattern: /skills|experience|llm_fallback/,
    check: a => a.length > 20,
    note:  'Must handle follow-up in context — llm_fallback is acceptable' },
];

server.listen(0, async () => {
  const port = server.address().port;
  console.log('\n🤖 Chatbot Response Quality Test');
  console.log('════════════════════════════════════════════════════════════════════\n');

  // Wait for model registry discovery
  await new Promise(r => setTimeout(r, 2500));

  let passed = 0, failed = 0;
  const failures = [];
  const engineCounts = {};

  for (const t of TESTS) {
    let r;
    try {
      r = await chat(port, t.q, t.history || []);
    } catch (err) {
      r = { answer: '', intent: 'ERROR', engine: 'error' };
    }

    const intentOk = t.intent
      ? r.intent === t.intent
      : t.intentPattern
        ? t.intentPattern.test(r.intent)
        : true;

    const answerOk  = t.check(r.answer);
    const notEmpty  = r.answer.length > 5;
    const ok        = intentOk && answerOk && notEmpty;

    engineCounts[r.engine || 'unknown'] = (engineCounts[r.engine || 'unknown'] || 0) + 1;

    const intentLabel = (r.intent || '?').padEnd(22);
    const engineLabel = (r.engine || '?').slice(0, 13).padEnd(13);

    if (ok) {
      passed++;
      console.log('✅', t.label.padEnd(24), '[' + engineLabel + ']', '[' + intentLabel + ']', r.answer.slice(0, 75));
    } else {
      failed++;
      const why = !notEmpty ? 'EMPTY_ANSWER'
        : !intentOk ? 'WRONG_INTENT(got:' + r.intent + ')'
        : 'ANSWER_FAIL';
      console.log('❌', t.label.padEnd(24), '[' + engineLabel + ']', '[' + intentLabel + ']', why);
      console.log('   Expected intent:', t.intent || t.intentPattern?.toString());
      console.log('   Answer snippet: ', r.answer.slice(0, 100) || '(empty)');
      console.log('   Note:', t.note);
      failures.push({ label: t.label, intent: r.intent, engine: r.engine, answer: r.answer, why, note: t.note });
    }

    await new Promise(r => setTimeout(r, 250));
  }

  console.log('\n════════════════════════════════════════════════════════════════════');
  console.log('Results:', passed + '/' + TESTS.length + ' passed' + (failed > 0 ? ',  ❌ ' + failed + ' failed' : '  ✅ All passed'));
  console.log('Engine usage:', JSON.stringify(engineCounts));

  if (failures.length > 0) {
    console.log('\n── Failures ──────────────────────────────────────────────────────────');
    failures.forEach(f => {
      console.log('\n❌', f.label);
      console.log('  Why:', f.why);
      console.log('  Note:', f.note);
      console.log('  Answer:', f.answer.slice(0, 150) || '(empty)');
    });
  }

  server.close();
  process.exit(failed > 0 ? 1 : 0);
});
