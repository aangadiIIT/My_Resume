/**
 * Akhilesh Angadi Portfolio — Full-Site Sanity Sweep
 *
 * Primary CI/CD health check: validates every production route, all chatbot
 * intent domains, and all API endpoint contracts in a single automated pass.
 *
 * Responsibilities:
 *   1. HTTP 200 check on all 13 critical UI routes
 *   2. Intent resolution check across 30 chatbot domains (deterministic + AI paths)
 *   3. API contract validation for site-metrics, jd-match, contact, robots, sitemap
 *   4. Persona integrity audit (no first-person pronouns in professional responses)
 *
 * Dependencies:
 *   - supertest  — HTTP assertion against the live Express app
 *   - ../app     — Express application instance
 *
 * Safety:
 *   - Loopback requests bypass rate limiting so this suite runs without throttling
 *   - 200ms pacing between chatbot queries prevents false quota-exhaustion failures
 *
 * Usage:
 *   npm run test:sanity
 *
 * Author: Akhilesh Angadi
 */
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const app = require('../app');

const CRITICAL_ROUTES = [
  '/',
  '/personal-details',
  '/experience',
  '/my-works',
  '/my-skills',
  '/education',
  '/certifications',
  '/honors-awards',
  '/recommendations',
  '/publications',
  '/contact-me',
  '/for-recruiters',
  '/jd-match'
];

const CHAT_SWEEP = [
  { q: "download resume", intent: "resume_download", name: "Resume" },
  { q: "contact details", intent: "contact", name: "Contact" },
  { q: "where is he located", intent: "location", name: "Location" },
  { q: "linkedin profile", intent: "linkedin", name: "LinkedIn" },
  { q: "github link", intent: "github", name: "GitHub" },
  { q: "how to send feedback", intent: "feedback", name: "Feedback" },
  { q: "who is he", intent: "identity", name: "Biography" },
  { q: "what is his headline", intent: "headline", name: "Headline" },
  { q: "who are you", intent: "bot_identity", name: "Bot Identity" },
  { q: "what can you do", intent: "capabilities", name: "Capabilities" },
  { q: "tell me about his career", intent: "experience_summary", name: "Exp Summary" },
  { q: "what did he do at SAP", intent: "experience_sap", name: "Exp SAP" },
  { q: "his role at Juniper", intent: "experience_juniper", name: "Exp Juniper" },
  { q: "what are his main skills", intent: "skills_summary", name: "Skills Summary" },
  { q: "show cloud skills", intent: "skills_cloud", name: "Skills Cloud" },
  { q: "backend expertise", intent: "skills_backend", name: "Skills Backend" },
  { q: "show publications", intent: "publications_summary", name: "Publications" },
  { q: "any recommendations?", intent: "recommendations", name: "Recommendations" },
  { q: "what languages does he speak", intent: "languages", name: "Languages" },
  { q: "where did he study", intent: "education", name: "Education" },
  { q: "show certifications", intent: "certifications", name: "Certifications" },
  { q: "did he win any awards?", intent: "awards", name: "Awards" },
  { q: "tell me about his projects", intent: "projects_summary", name: "Projects Summary" },
  { q: "describe his IoT project", intent: "projects_iot", name: "Projects IoT" },
  { q: "what is his CI/CD project", intent: "projects_cicd", name: "Projects CI/CD" },
  { q: "is he a good fit for DevOps", intent: "hire_role", name: "Hiring Fit" },
  { q: "hello", intent: "small_talk", name: "Greeting" },
  { q: "tell me a joke", intent: "jokes", name: "Joke" },
  { q: "give me a fun fact", intent: "facts", name: "Fact" },
  { q: "solve a riddle", intent: "riddles", name: "Riddle" }
];

async function runSanity() {
  console.log("🏥 [SANITY] Starting Full-Site & All-Domain 'Golden Sweep'...");

  const report = {
    siteHealth: { total: CRITICAL_ROUTES.length, passed: 0, failed: 0 },
    chatbot: {
      total: CHAT_SWEEP.length,
      passed: 0,
      failed: 0,
      aiLed: 0,
      onlineLed: 0,
      offlineLed: 0,
      engineLed: 0,
      personaErrors: 0,
      failures: []
    },
    globalStatus: "PENDING",
    timestamp: new Date().toISOString()
  };

  // 1. UI Routes Sweep
  console.log("\n--- 🌐 UI ROUTES (Site Sweep) ---");
  for (const route of CRITICAL_ROUTES) {
    try {
      const res = await request(app).get(route);
      if (res.status === 200) {
        console.log(`  ✅ [200 OK] ${route.padEnd(20)}`);
        report.siteHealth.passed++;
      } else {
        console.error(`  ❌ [${res.status}] ${route.padEnd(20)}`);
        report.siteHealth.failed++;
      }
    } catch (err) {
      console.error(`  ❌ [ERROR] ${route.padEnd(20)}: ${err.message}`);
      report.siteHealth.failed++;
    }
  }

  // 2. Chatbot All-Domain Sweep
  console.log("\n--- 🤖 CHATBOT DOMAINS (Intent Sweep) ---");
  for (const test of CHAT_SWEEP) {
    try {
      // Pacing between queries — some queries route to Llama (2-4s inference).
      // 1500ms ensures Llama finishes before the next SSE stream opens, preventing
      // timeout errors caused by the model being busy with a previous request.
      await new Promise(resolve => setTimeout(resolve, 1500));

      const res = await request(app)
        .post('/api/chat/llm')
        .send({ query: test.q, history: [] });

      // Parse SSE stream from res.text — res.body is empty for text/event-stream responses
      let data = {};
      const lines = (res.text || '').split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const parsed = JSON.parse(line.slice(6).trim());
            data = { ...data, ...parsed };
          } catch (_) {}
        }
      }

      const answer = (data.answer || "").toLowerCase();

      // Intent Resolution Check — require a non-empty actualIntent so an empty SSE parse never
      // accidentally passes via `expectedIntent.startsWith("")`
      const actualIntent = data.intent || "";
      const expectedIntent = test.intent;

      const isDirectMatch = actualIntent !== "" && actualIntent === expectedIntent;
      const isHierarchicalMatch = actualIntent !== "" &&
        (actualIntent.startsWith(expectedIntent) || expectedIntent.startsWith(actualIntent));
      const isCrossMatch = actualIntent !== "" && (
        (expectedIntent === 'identity' && actualIntent === 'intro') ||
        (expectedIntent === 'hire_role' && actualIntent === 'why_hire') ||
        (expectedIntent === 'skills_backend' && actualIntent === 'skills_summary')
      );

      const isMatch = isDirectMatch || isHierarchicalMatch || isCrossMatch;

      // Persona Audit — bot_identity/bot_help intentionally use first-person voice
      const skipPersona = ['small_talk', 'jokes', 'facts', 'riddles', 'thanks', 'bye', 'bot_identity', 'bot_help', 'capabilities'];
      const hasPersonaLeak = !skipPersona.includes(test.intent) &&
        !answer.includes("ai assistant") &&
        (answer.includes(" i am ") || answer.includes(" i'm ") || answer.includes(" my ") ||
          answer.startsWith("i am ") || answer.startsWith("i'm ") || answer.startsWith("my "));

      // Engine Breakdown
      if (data.engine === 'online') {
        report.chatbot.aiLed++;
        report.chatbot.onlineLed++;
      } else if (data.engine === 'offline') {
        report.chatbot.aiLed++;
        report.chatbot.offlineLed++;
      } else if (data.engine === 'ai' || actualIntent === 'llm_fallback') {
        report.chatbot.aiLed++;
        report.chatbot.offlineLed++;
      } else {
        report.chatbot.engineLed++;
      }

      if (res.status === 200 && isMatch && !hasPersonaLeak) {
        console.log(`  ✅ [${test.name.padEnd(15)}] "${test.q.slice(0, 20)}..." -> ${data.intent}`);
        report.chatbot.passed++;
      } else {
        let errorMsg = `Expected ${test.intent}, got ${data.intent}`;
        if (hasPersonaLeak) {
          errorMsg = `PERSONA LEAK: First-person pronoun found in professional response.`;
          report.chatbot.personaErrors++;
        }
        console.error(`  ❌ [${test.name.padEnd(15)}] "${test.q.slice(0, 20)}..." -> ${errorMsg}`);
        report.chatbot.failed++;
        report.chatbot.failures.push({
          query: test.q,
          expected: test.intent,
          received: actualIntent,
          personaError: hasPersonaLeak,
          answer: data.answer
        });
      }
    } catch (err) {
      console.error(`  ❌ [CHAT ERROR] "${test.q}": ${err.message}`);
      report.chatbot.failed++;
      report.chatbot.failures.push({ query: test.q, error: err.message });
    }
  }

  console.log("\n-------------------------------------------");

  // 3. API Endpoint Sweep
  const apiReport = { total: 0, passed: 0, failed: 0 };
  console.log("\n--- 🔌 API ENDPOINTS ---");

  const apiTests = [
    {
      name: 'GET /api/site-metrics',
      fn: async () => {
        // Send ADMIN_API_KEY header if set — the gate is active in test env too
        const adminKey = process.env.ADMIN_API_KEY;
        const req = request(app).get('/api/site-metrics');
        if (adminKey) req.set('x-admin-key', adminKey);
        const res = await req;
        if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
        if (typeof res.body.visits !== 'number') throw new Error('Missing visits field');
        if (!Array.isArray(res.body.visitors)) throw new Error('visitors should be array');
      }
    },
    {
      name: 'POST /api/jd-match (valid)',
      fn: async () => {
        const res = await request(app).post('/api/jd-match').send({ jd_text: 'We are looking for a Cloud DevOps Engineer with experience in Kubernetes, Docker, Terraform, CI/CD pipelines and Node.js backend development.' });
        if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
        if (typeof res.body.score !== 'number') throw new Error('Missing score field');
        if (!Array.isArray(res.body.matched)) throw new Error('Missing matched array');
      }
    },
    {
      name: 'POST /api/jd-match (too short)',
      fn: async () => {
        const res = await request(app).post('/api/jd-match').send({ jd_text: 'short' });
        if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
      }
    },
    {
      name: 'POST /api/jd-match (too long)',
      fn: async () => {
        const res = await request(app).post('/api/jd-match').send({ jd_text: 'A'.repeat(60000) });
        if (res.status !== 413) throw new Error(`Expected 413, got ${res.status}`);
      }
    },
    {
      name: 'POST /api/contact (valid)',
      fn: async () => {
        const res = await request(app).post('/api/contact').send({ name: 'Test', email: 'test@test.com', message: 'Hello' });
        // Google Forms call may fail in test env — accept 200 or 500
        if (res.status !== 200 && res.status !== 500) throw new Error(`Unexpected status ${res.status}`);
      }
    },
    {
      name: 'POST /api/contact (missing fields)',
      fn: async () => {
        const res = await request(app).post('/api/contact').send({ name: 'Test' });
        if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
      }
    },
    {
      name: 'GET /robots.txt',
      fn: async () => {
        const res = await request(app).get('/robots.txt');
        if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
        if (!res.text.includes('User-agent')) throw new Error('Invalid robots.txt');
      }
    },
    {
      name: 'GET /sitemap.xml',
      fn: async () => {
        const res = await request(app).get('/sitemap.xml');
        if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
        if (!res.text.includes('<urlset')) throw new Error('Invalid sitemap.xml');
      }
    },
    {
      name: 'GET /view-asset (allowed category)',
      fn: async () => {
        const res = await request(app).get('/view-asset/profile/profile.jpg');
        if (res.status !== 200 && res.status !== 304) throw new Error(`Expected 200/304, got ${res.status}`);
      }
    },
    {
      name: 'GET /for-recruiters (content check)',
      fn: async () => {
        const res = await request(app).get('/for-recruiters');
        if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
        if (!res.text.includes('recruiter') && !res.text.includes('Recruiter'))
          throw new Error('Page content missing recruiter keywords');
      }
    },
    {
      name: 'GET /view-asset (blocked category — path traversal)',
      fn: async () => {
        const res = await request(app).get('/view-asset/../package.json');
        if (res.status !== 400 && res.status !== 403 && res.status !== 404)
          throw new Error(`Expected 400/403/404, got ${res.status}`);
      }
    },
    {
      name: 'GET /view-asset (unknown category)',
      fn: async () => {
        const res = await request(app).get('/view-asset/secrets/data.json');
        if (res.status !== 403 && res.status !== 404) throw new Error(`Expected 403/404, got ${res.status}`);
      }
    },
    {
      name: 'POST /api/chat/llm (empty query)',
      fn: async () => {
        const res = await request(app).post('/api/chat/llm').send({ query: '', history: [] });
        if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
        const lines = (res.text || '').split('\n');
        let hasDone = false;
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try { const d = JSON.parse(line.slice(6)); if (d.type === 'done') hasDone = true; } catch (_) {}
          }
        }
        if (!hasDone) throw new Error('SSE stream did not emit done event for empty query');
      }
    },
    {
      name: 'POST /api/contact (XSS payload — must not crash)',
      fn: async () => {
        const res = await request(app)
          .post('/api/contact')
          .send({ name: '<script>alert(1)</script>', email: 'x@x.com', message: 'test xss' });
        if (res.status !== 200 && res.status !== 500) throw new Error(`Unexpected status ${res.status}`);
      }
    },

    // ── Content-integrity checks ──────────────────────────────────────────────

    {
      name: 'GET / — availability badge renders full label text (not hardcoded "Open")',
      fn: async () => {
        const res = await request(app).get('/');
        if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
        // Must contain the full label from profile.json — a hardcoded "Open" truncation would fail
        if (!res.text.includes('Open to Opportunities'))
          throw new Error('Availability label "Open to Opportunities" not found in page — possible hardcoded truncation');
      }
    },
    {
      name: 'GET /jd-match — #jdResults section has display:none in inline style block',
      fn: async () => {
        const res = await request(app).get('/jd-match');
        if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
        // The <style> block in jd-match.ejs must declare display:none so the results
        // section is hidden on load — if CSP strips the style tag this rule would be absent
        if (!res.text.includes('#jdResults') || !res.text.includes('display: none'))
          throw new Error('#jdResults display:none rule missing — results section may be visible on page load');
        // Verify both parts appear in proximity (rule must reference jdResults, not a different selector)
        const styleBlockMatch = res.text.match(/#jdResults\s*\{[^}]*display:\s*none/);
        if (!styleBlockMatch)
          throw new Error('#jdResults { display: none } rule not found as a single declaration block');
      }
    },
    {
      name: 'POST /api/chat/llm (bot identity — first-person voice, no double-name artifact)',
      fn: async () => {
        const res = await request(app)
          .post('/api/chat/llm')
          .send({ query: 'who are you', history: [] });
        if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);

        let data = {};
        for (const line of (res.text || '').split('\n')) {
          if (line.startsWith('data: ')) {
            try { data = { ...data, ...JSON.parse(line.slice(6).trim()) }; } catch (_) {}
          }
        }

        const answer = (data.answer || '').trim();
        if (!answer) throw new Error('bot_identity response has empty answer');

        // First-person voice must be preserved for bot_identity
        const lc = answer.toLowerCase();
        if (!lc.startsWith('i am') && !lc.startsWith("i'm"))
          throw new Error(`bot_identity answer does not start with first-person voice. Got: "${answer.slice(0, 80)}"`);

        // Guard against double-name artifact (e.g. "Akhilesh is Akhilesh's AI...")
        // caused by enforceThirdPerson accidentally running on bot_identity responses
        if (/akhilesh\s+is\s+akhilesh/i.test(answer))
          throw new Error(`bot_identity answer contains double-name artifact "Akhilesh is Akhilesh": "${answer.slice(0, 120)}"`);
      }
    },
    {
      name: 'GET /for-recruiters — profile img has explicit width="160" and height="160" attributes',
      fn: async () => {
        const res = await request(app).get('/for-recruiters');
        if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
        if (!res.text.includes('width="160"'))
          throw new Error('Profile image missing width="160" attribute — image may render distorted');
        if (!res.text.includes('height="160"'))
          throw new Error('Profile image missing height="160" attribute — height:auto may override fixed size');
      }
    },
    {
      name: 'GET /certifications — all pdf-trigger data-pdf values point to /view-asset/ paths',
      fn: async () => {
        const res = await request(app).get('/certifications');
        if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);

        const dataPdfPattern = /data-pdf="([^"]+)"/g;
        const paths = [];
        let m;
        while ((m = dataPdfPattern.exec(res.text)) !== null) {
          paths.push(m[1]);
        }

        if (paths.length === 0)
          throw new Error('No data-pdf attributes found on /certifications — pdf-trigger buttons may be missing');

        const invalid = paths.filter(p => !p.startsWith('/view-asset/'));
        if (invalid.length > 0)
          throw new Error(`pdf-trigger data-pdf paths do not start with /view-asset/: ${invalid.join(', ')}`);
      }
    },
    {
      name: 'GET / — CSP script-src uses nonces (no unsafe-inline), style-src allows inline styles',
      fn: async () => {
        const res = await request(app).get('/');
        if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);

        const csp = res.headers['content-security-policy'] || '';
        if (!csp) throw new Error('Content-Security-Policy header missing');

        const directives = Object.fromEntries(
          csp.split(';').map(d => d.trim()).filter(Boolean).map(d => {
            const [name, ...rest] = d.split(/\s+/);
            return [name, rest.join(' ')];
          })
        );

        // script-src must NOT contain unsafe-inline — nonce-based for scripts (XSS prevention)
        const scriptSrc = directives['script-src'] || '';
        if (scriptSrc.includes("'unsafe-inline'"))
          throw new Error(`CSP script-src must NOT contain 'unsafe-inline'. Got: "${scriptSrc}"`);

        // style-src must be present (inline styles = essential for Bootstrap utility classes)
        const styleSrc = directives['style-src'] || '';
        if (!styleSrc)
          throw new Error('CSP style-src directive is missing');
      }
    }
  ];

  for (const t of apiTests) {
    apiReport.total++;
    try {
      await t.fn();
      console.log(`  ✅ ${t.name}`);
      apiReport.passed++;
    } catch (err) {
      console.error(`  ❌ ${t.name}: ${err.message}`);
      apiReport.failed++;
    }
  }

  console.log("\n-------------------------------------------");
  const totalPassed = report.siteHealth.passed + report.chatbot.passed + apiReport.passed;
  const totalFailed = report.siteHealth.failed + report.chatbot.failed + apiReport.failed;
  console.log(`📊 Final Results: ${totalPassed} Passed, ${totalFailed} Failed`);

  const statusStr = totalFailed === 0 ? "PASSED (100% SITE HEALTH)" : "FAILED (Needs Attention)";
  report.globalStatus = statusStr;

  console.log(`🏆 Status: ${statusStr}`);
  console.log("-------------------------------------------\n");

  fs.writeFileSync(path.join(__dirname, 'sanity_report.json'), JSON.stringify(report, null, 2));

  process.exit(totalFailed > 0 ? 1 : 0);
}

runSanity();
