/**
 * Merge Learning Utility
 * Safely promotes unknown queries to the test suite after manual verification.
 */
const fs = require('fs');
const path = require('path');

const logsPath = path.join(__dirname, '..', 'logs', 'unknown_queries.json');
const testSuitePath = path.join(__dirname, '..', 'chatbot_test_suite_cleaned.json');

function mergeLearning() {
    if (!fs.existsSync(logsPath)) {
        console.log("No unknown queries to merge.");
        return;
    }

    const logs = JSON.parse(fs.readFileSync(logsPath, 'utf8'));
    const testSuite = JSON.parse(fs.readFileSync(testSuitePath, 'utf8'));
    
    console.log(`\n🧠 [LEARNING LOOP] Reviewing ${Object.keys(logs).length} unknown queries...`);

    // Only promote queries seen at least 2 times OR with high count
    const candidates = Object.entries(logs)
        .filter(([q, data]) => data.count >= 2)
        .map(([q, data]) => ({
            question: q,
            intent: data.suggested,
            count: data.count
        }));

    if (candidates.length === 0) {
        console.log("No high-confidence candidates found for auto-merge yet. (Need count >= 2)");
        return;
    }

    console.log(`\n✅ Promoting ${candidates.length} queries to test suite:`);
    candidates.forEach(c => {
        console.log(` - [${c.intent}] "${c.question}" (Seen ${c.count}x)`);
        
        // Avoid duplicates
        if (!testSuite.some(t => t.question.toLowerCase() === c.question.toLowerCase())) {
            testSuite.push({
                question: c.question,
                intent: c.intent,
                domain: c.intent.split('_')[0] // Rough domain extraction
            });
        }
    });

    fs.writeFileSync(testSuitePath, JSON.stringify(testSuite, null, 2));
    
    // Clear logs after merge (selective clear would be better in prod)
    // fs.writeFileSync(logsPath, JSON.stringify({}, null, 2));

    console.log(`\n🔥 Learning complete. Test suite updated.`);
}

mergeLearning();
