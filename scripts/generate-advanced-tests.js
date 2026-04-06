const fs = require('fs');
const path = require('path');
const registry = require('./intent-registry');

const outputPath = path.join(__dirname, '..', 'chatbot_test_suite_massive.json');

const RECRUITER_PHRASES = [
    "I'm looking for a candidate with", "Does this person have experience in", "Can you provide details on",
    "Show me evidence of", "I need to evaluate his", "Tell me more about his",
    "What are the specifics of his", "Can you walk me through his", "I'm interested in his",
    "How proficient is he in", "Give me a deep dive into", "I want to verify his",
    "Does his resume show", "Is there any mention of", "Can he handle",
    "What is his track record with", "Explain his role in", "Describe his impact on"
];

const CASUAL_PHRASES = [
    "Yo, what's up with his", "Give me the lowdown on", "What's he good at in",
    "Tell me everything about", "So, does he know", "Hey, what about his",
    "Can you talk about his", "I want to hear about his", "Brief me on his",
    "Got any info on", "What's the deal with", "Is he any good at",
    "Tell me a bit about", "Show me his", "What can you say about"
];

const INTERROGATIVE_PREFIXES = [
    "Who is responsible for", "What can he tell me about", "How does he manage",
    "Where did he learn", "When did he start", "Why did he choose",
    "Could you explain", "Would you mind showing"
];

const NOISE_WORDS = ["actually", "basically", "literally", "honestly", "clearly", "obviously", "simply", "just", "kind of", "sort of", "maybe"];

function addTypo(word) {
    if (word.length < 4) return word;
    const idx = 1 + Math.floor(Math.random() * (word.length - 2));
    const chars = word.split('');
    if (Math.random() > 0.5) {
        // Swap
        [chars[idx], chars[idx+1]] = [chars[idx+1], chars[idx]];
    } else {
        // Remove
        chars.splice(idx, 1);
    }
    return chars.join('');
}

function randomizeCasing(text) {
    return text.split('').map(c => Math.random() > 0.8 ? (Math.random() > 0.5 ? c.toUpperCase() : c.toLowerCase()) : c).join('');
}

function addNoise(text) {
    let words = text.split(' ');
    if (Math.random() > 0.5) {
        const noise = NOISE_WORDS[Math.floor(Math.random() * NOISE_WORDS.length)];
        const idx = Math.floor(Math.random() * words.length);
        words.splice(idx, 0, noise);
    }
    return words.join(' ');
}

function generateVariations(intentId, meta) {
    const questions = [...meta.canonical_questions];
    const variations = new Set();

    questions.forEach(q => {
        // 1. Phrasing Variations (Combinatorial)
        RECRUITER_PHRASES.forEach(p => variations.add(`${p} ${q}`));
        CASUAL_PHRASES.forEach(p => variations.add(`${p} ${q}`));
        INTERROGATIVE_PREFIXES.forEach(p => variations.add(`${p} ${q}`));
        
        // 2. Noisy & Iterative Typo injections
        for(let i=0; i<20; i++) {
            let noisy = addNoise(q);
            if (Math.random() > 0.5) noisy = randomizeCasing(noisy);
            
            const words = noisy.split(' ');
            const typoed = words.map(w => Math.random() > 0.4 ? addTypo(w) : w).join(' ');
            variations.add(typoed);
        }

        // 3. Nested Phrasing
        variations.add(`Actually, ${q}`);
        variations.add(`I was wondering, ${q}`);
        variations.add(`Please ${q}`);
    });

    // Domain Specific Keywords mix
    if (meta.domain === 'skills') {
        variations.add(`hands-on with ${intentId.replace('skills_', '')}`);
        variations.add(`expert in ${intentId.replace('skills_', '')}`);
    }

    return Array.from(variations).map(v => ({
        intent: intentId,
        domain: meta.domain,
        question: v
    }));
}

function generateMassiveSuite() {
    console.log("🚀 Generating GIGANTIC QA Stress Test Suite...");
    let allTests = [];

    Object.entries(registry.intents).forEach(([id, meta]) => {
        const intentVariations = generateVariations(id, meta);
        allTests = allTests.concat(intentVariations);
        console.log(`✅ Generated ${intentVariations.length} variations for: ${id}`);
    });

    // Shuffle
    allTests.sort(() => Math.random() - 0.5);

    // Write all to file
    fs.writeFileSync(outputPath, JSON.stringify(allTests, null, 2));
    console.log(`\n🔥 Success! ${allTests.length} tests written to chatbot_test_suite_massive.json`);
}

generateMassiveSuite();
