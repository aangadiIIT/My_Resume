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
  '/contact-me'
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
      // Strategic pacing for Gemini Free Tier burst quotas
      await new Promise(resolve => setTimeout(resolve, 4000));

      const res = await request(app)
        .post('/api/chat/llm')
        .send({ query: test.q, history: [] });

      const data = res.body;
      const answer = (data.answer || "").toLowerCase();

      // Intent Resolution Check
      const actualIntent = data.intent || "";
      const expectedIntent = test.intent;

      const isDirectMatch = actualIntent === expectedIntent;
      const isHierarchicalMatch = actualIntent.startsWith(expectedIntent) || expectedIntent.startsWith(actualIntent);
      const isCrossMatch = (expectedIntent === 'identity' && actualIntent === 'intro') ||
        (expectedIntent === 'hire_role' && actualIntent === 'why_hire') ||
        (expectedIntent === 'skills_backend' && actualIntent === 'skills_summary');

      const isMatch = isDirectMatch || isHierarchicalMatch || isCrossMatch;

      // Persona Audit
      const skipPersona = ['small_talk', 'jokes', 'facts', 'riddles', 'thanks', 'bye'];
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
  const totalPassed = report.siteHealth.passed + report.chatbot.passed;
  const totalFailed = report.siteHealth.failed + report.chatbot.failed;
  console.log(`📊 Final Results: ${totalPassed} Passed, ${totalFailed} Failed`);

  const statusStr = totalFailed === 0 ? "PASSED (100% SITE HEALTH)" : "FAILED (Needs Attention)";
  report.globalStatus = statusStr;

  console.log(`🏆 Status: ${statusStr}`);
  console.log("-------------------------------------------\n");

  fs.writeFileSync(path.join(__dirname, 'sanity_report.json'), JSON.stringify(report, null, 2));

  process.exit(totalFailed > 0 ? 1 : 0);
}

runSanity();
