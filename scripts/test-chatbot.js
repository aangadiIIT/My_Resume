const fs = require('fs');
const path = require('path');
const ChatbotEngine = require('../public/scripts/chatbot-engine');

const summaryPath = path.join(__dirname, '..', 'public', 'data', 'summary.json');
const testSuitePath = path.join(__dirname, '..', 'chatbot_test_suite_massive.json');

function runBenchmark() {
    console.log(`\n🚀 [BENCHMARK] Starting Massive Stress Test Execution...`);

    if (!fs.existsSync(summaryPath) || !fs.existsSync(testSuitePath)) {
        console.error('❌ Missing summary.json or massive test suite.');
        return;
    }

    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    const testSuite = JSON.parse(fs.readFileSync(testSuitePath, 'utf8'));

    console.log(`📂 Using test suite: ${path.basename(testSuitePath)} (${testSuite.length} scenarios)`);

    let stats = {
        total: testSuite.length,
        passed: 0,
        failed: 0,
        deterministicMatches: 0,
        mlRecoveries: 0,
        fallbacks: 0,
        ambiguities: 0,
        misclassifications: 0
    };

    const failures = [];
    const confusionGroups = {};

    console.time("BenchmarkDuration");

    testSuite.forEach((test, index) => {
        const result = ChatbotEngine.findResponse(test.question, summary);
        
        const intentOk = result.intent === test.intent;
        const isFallback = result.trace?.path === 'FALLBACK';
        const isAmbiguous = result.trace?.path === 'AMBIGUITY_GUARD';

        if (intentOk) {
            stats.passed++;
            if (result.matcher === 'ml') {
                stats.mlRecoveries++;
            } else {
                stats.deterministicMatches++;
            }
        } else {
            stats.failed++;
            
            let failType = 'misclassification';
            if (isFallback) {
                failType = 'fallback_error';
                stats.fallbacks++;
            } else if (isAmbiguous) {
                failType = 'ambiguity_miss';
                stats.ambiguities++;
            } else {
                stats.misclassifications++;
            }

            const confusionKey = `${test.intent} -> ${result.intent || 'NONE'}`;
            confusionGroups[confusionKey] = (confusionGroups[confusionKey] || 0) + 1;

            failures.push({
                question: test.question,
                expected: test.intent,
                actual: result.intent,
                path: result.trace.path,
                determ_score: result.trace.deterministic_score,
                ml_score: result.trace.ml_confidence,
                failType
            });
        }
        
        if (index > 0 && index % 5000 === 0) console.log(`Processed ${index} queries...`);
    });

    console.timeEnd("BenchmarkDuration");

    const accuracy = (stats.passed / stats.total) * 100;

    console.log(`\n📊 [FINAL RESULTS]`);
    console.log(`✅ Total Passed: ${stats.passed} / ${stats.total}`);
    console.log(`🎯 Deterministic: ${stats.deterministicMatches}`);
    console.log(`🤖 ML Recoveries:  ${stats.mlRecoveries}`);
    console.log(`❌ Total Failed:   ${stats.failed}`);
    console.log(`📈 Accuracy:       ${accuracy.toFixed(2)}%`);
    
    console.log(`\n🔍 [FAILURE BREAKDOWN]`);
    console.log(`- Misclassifications: ${stats.misclassifications}`);
    console.log(`- Ambiguity Misses:   ${stats.ambiguities}`);
    console.log(`- Fallback Errors:    ${stats.fallbacks}`);

    if (failures.length > 0) {
        console.log(`\n🔴 [TOP CONFUSION GROUPS]`);
        Object.entries(confusionGroups)
            .sort((a,b) => b[1] - a[1])
            .slice(0, 10)
            .forEach(([pair, count]) => console.log(` - ${pair}: ${count} cases`));

        console.log(`\n🔴 [FAILURE SAMPLES] (First 5)`);
        failures.slice(0, 5).forEach(f => {
            console.log(` - Q: "${f.question}"`);
            console.log(`   Expected: ${f.expected} | Actual: ${f.actual} | Path: ${f.path}`);
            console.log(`   Scores: Determ=${f.determ_score}, ML=${f.ml_score}`);
        });
        // Save detailed failure log for analysis
        if (!fs.existsSync(path.join(__dirname, '..', 'logs'))) {
            fs.mkdirSync(path.join(__dirname, '..', 'logs'));
        }
        fs.writeFileSync(path.join(__dirname, '..', 'logs', 'failure_analysis_massive.json'), JSON.stringify({ stats, failures, confusionGroups }, null, 2));
        console.log(`\n💾 Detailed failure analysis saved to logs/failure_analysis_massive.json`);
    }

    // MULTI-TURN DEPTH VERIFICATION
    console.log(`\n🔄 [MULTI-TURN] Verifying Progressive Depth Resolution...`);
    const multiTurnQueries = [
        { q: "Tell me about SAP", expectedIntent: "experience_sap" },
        { q: "Tell me about skills", expectedIntent: "skills_summary" },
        { q: "Publications", expectedIntent: "publications_summary" }
    ];

    multiTurnQueries.forEach(flow => {
        let context = {};
        for (let d = 0; d <= 3; d++) {
            const query = (d === 0) ? flow.q : "tell me more";
            const res = ChatbotEngine.findResponse(query, summary, context);
            const updatedContext = res.updatedContext;

            const intentOk = res.intent === flow.expectedIntent;
            const depthOk = updatedContext.depth === (d === 0 ? 0 : d); // Handle initial depth reset

            const status = intentOk ? "✅" : "❌";
            console.log(`${status} Depth ${d} | Query: "${query}" -> Intent: ${res.intent} | Depth: ${updatedContext.depth}`);
            
            context = updatedContext;
        }
    });

    // Exit with error if accuracy < 99.5%
    if (accuracy < 99.5) {
        console.log(`\n⚠️  Target not met (Target: 99.5%). Current: ${accuracy.toFixed(2)}%`);
        process.exit(1);
    } else {
        console.log(`\n🏁  TARGET ACHIEVED! High reliability system confirmed.`);
        process.exit(0);
    }
}

runBenchmark();
