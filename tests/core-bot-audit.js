/**
 * Akhilesh Angadi Portfolio — Comprehensive Bot Accuracy Audit
 *
 * High-fidelity stress test that exercises every unique question in the master
 * test dataset with conservative pacing to avoid quota exhaustion.
 *
 * Responsibilities:
 *   1. Load full question set from tests/data/chatbot-data-master.json
 *   2. Post each query to /api/chat/llm with 4-second inter-query pacing
 *   3. Validate intent resolution, detect persona leaks, and track engine mix
 *   4. Write detailed_audit_report.json for consumption by master-test.js
 *
 * Dependencies:
 *   - supertest  — HTTP assertion against the live Express app
 *   - ../app     — Express application instance
 *   - tests/data/chatbot-data-master.json — master question/intent dataset
 *
 * Safety:
 *   - 4-second pacing is intentional; do not reduce without verifying Gemini quota
 *
 * Usage:
 *   npm run test:audit
 *
 * Author: Akhilesh Angadi
 */
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const app = require('../app');

const MASTER_DATA_PATH = path.join(__dirname, 'data', 'chatbot-data-master.json');
const CONCURRENCY = 1; // 1 to prevent CPU thrashing during Llama inference

async function main() {
    console.log("💎 [AUDIT] Starting High-Fidelity Multi-Intent Core Bot Audit...");

    if (!fs.existsSync(MASTER_DATA_PATH)) {
        console.error("❌ MASTER DATA NOT FOUND: " + MASTER_DATA_PATH);
        process.exit(1);
    }

    const rawSuite = JSON.parse(fs.readFileSync(MASTER_DATA_PATH, 'utf8'));

    // --- MULTI-INTENT AWARENESS (QA Hardening) ---
    // Group all valid intents for each unique question
    const testMap = {};
    rawSuite.forEach(item => {
        const q = item.question.toLowerCase().trim();
        if (!testMap[q]) {
            testMap[q] = { question: item.question, allowedIntents: new Set() };
        }
        testMap[q].allowedIntents.add(item.intent);
    });

    const uniqueQuestions = Object.keys(testMap);
    const report = {
        total: uniqueQuestions.length,
        passed: 0,
        failed: 0,
        aiLed: 0,
        onlineLed: 0,
        offlineLed: 0,
        engineLed: 0,
        personaErrors: 0,
        failures: []
    };

    console.log(`📊 Processing ${uniqueQuestions.length} unique questions (deduplicated from ${rawSuite.length} records)...`);

    const startTime = Date.now();
    const LOG_INTERVAL = 50;

    for (let i = 0; i < uniqueQuestions.length; i++) {
        const queryKey = uniqueQuestions[i];
        const testCase = testMap[queryKey];
        const query = testCase.question;
        const allowedIntents = testCase.allowedIntents;

        // Strategic Pacing: Avoid burst 429s for high-fidelity probes
        await new Promise(resolve => setTimeout(resolve, 4000));

        process.stdout.write('.');
        if ((i + 1) % LOG_INTERVAL === 0) console.log(` [${i + 1}/${uniqueQuestions.length}]`);

        try {
            const res = await request(app)
                .post('/api/chat/llm')
                .send({ query, history: [] });

            // Parse SSE stream — res.body is empty for text/event-stream
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

            // 1. Accuracy Check — require non-empty actualIntent so empty parses never slip through
            const actualIntent = data.intent || "";
            const isMatch = actualIntent !== "" && (
                (actualIntent === 'llm_fallback') ||
                Array.from(allowedIntents).some(expected =>
                    actualIntent === expected ||
                    actualIntent.startsWith(expected) ||
                    expected.startsWith(actualIntent)
                )
            );

            // 2. Persona Audit (Strict 3rd-Person Verification)
            const skipPersona = ['small_talk', 'jokes', 'facts', 'riddles', 'thanks', 'bye'];
            const needsPersonaCheck = !Array.from(allowedIntents).some(i => skipPersona.includes(i));

            const hasPersonaLeak = needsPersonaCheck &&
                !answer.includes("ai assistant") &&
                (answer.includes(" i am ") || answer.includes(" i'm ") || answer.includes(" my ") ||
                    answer.startsWith("i am ") || answer.startsWith("i'm ") || answer.startsWith("my "));

            // Track which inference tier handled each response
            if (data.engine === 'online') {
                report.aiLed++;
                report.onlineLed++;
            } else if (data.engine === 'offline') {
                report.aiLed++;
                report.offlineLed++;
            } else if (data.engine === 'ai' || data.intent === 'llm_fallback') {
                report.aiLed++;
                report.offlineLed++; // Assume offline if unknown ai
            } else {
                report.engineLed++;
            }

            if (isMatch && !hasPersonaLeak) {
                report.passed++;
            } else {
                report.failed++;
                if (hasPersonaLeak) report.personaErrors++;
                report.failures.push({
                    query,
                    expected: Array.from(allowedIntents),
                    received: data.intent,
                    personaError: hasPersonaLeak,
                    answer: data.answer
                });
            }
        } catch (err) {
            report.failed++;
            report.failures.push({ query, error: err.message });
        }
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    const accuracy = ((report.passed / report.total) * 100).toFixed(2);
    const auditFilePath = path.join(__dirname, 'detailed_audit_report.json');

    console.log("\n\n========================================================");
    console.log("✅ AUDIT COMPLETE.");
    console.log(`⏱ Total Time: ${totalTime}s`);
    console.log(`📊 Global Accuracy: ${accuracy}%`);
    console.log(`🤖 Engine Mix: AI=${report.aiLed} (Online=${report.onlineLed}, Offline=${report.offlineLed}), Deterministic=${report.engineLed}`);
    console.log(`👤 Persona Errors: ${report.personaErrors}`);
    console.log(`💾 Full report: ${auditFilePath}`);
    console.log("========================================================\n");

    fs.writeFileSync(auditFilePath, JSON.stringify(report, null, 2));
}

main().catch(console.error);
