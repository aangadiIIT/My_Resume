const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');
require('dotenv').config();

let genAI = null;
let modelCache = {}; // Cache models by name
let globalContext = null;

// Priority Stack: High-Quota 'Workhorse' Models (AI Studio Table Iteration 28)
const MODEL_STACK = [
    { name: "gemini-3.1-flash-lite-preview", version: 'v1beta' },   // Tier 1 (Active)
    { name: "gemma-3-1b-it", version: 'v1beta' },                   // Tier 2 (Volume King)
    { name: "gemini-2.5-flash", version: 'v1' },                    // Tier 3 (Elite Tier)
    { name: "gemini-2.0-flash-lite", version: 'v1' }                // Tier 4 (Last Resort)
];

/**
 * Initializes a specific Gemini model from the stack.
 */
function getModel(modelConfig) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.length < 10) return null;

    if (!genAI) genAI = new GoogleGenerativeAI(apiKey);

    const cacheKey = modelConfig.name;
    if (!modelCache[cacheKey]) {
        modelCache[cacheKey] = genAI.getGenerativeModel({
            model: modelConfig.name,
            generationConfig: {
                maxOutputTokens: 150,
                temperature: 0.1,
            }
        }, { apiVersion: modelConfig.version });
    }
    return modelCache[cacheKey];
}

/**
 * Generates an accurate, grounded response with Automated Model Rotation.
 */
async function generateOnlineResponse(query, history = [], candidates = []) {
    // Load Global Context (Cached)
    if (!globalContext) {
        try {
            const contextPath = path.join(__dirname, '../public/data/llm-context.txt');
            if (fs.existsSync(contextPath)) {
                globalContext = fs.readFileSync(contextPath, 'utf8');
            }
        } catch (e) { console.error("[GEMINI-SERVICE] Context error:", e); }
    }

    const formattedCandidates = candidates.map((c, i) => `[Fact ${i + 1}]\n${c.content}`).join('\n\n');
    const systemPrompt = `You are the dedicated AI Portfolio Assistant for Akhilesh Angadi. 
Your goal is to answer questions about his career, projects, and skills with professional warmth and 100% accuracy.

GROUNDING DATA:
[Specific Facts]:
${formattedCandidates || "No specific facts found for this query."}

[Core Biography & Registry]:
${globalContext || ""}

STRICT PERSONA RULES:
1. Use 3rd person only ("He is...", "He has...").
2. Answer based on the GROUNDING DATA. 
3. If specific facts are missing, use the Core Biography/Registry to provide a high-level overview.
4. Only say "I don't have that information" if the topic is completely outside his professional profile.
5. Max output: 2-3 concise sentences.`;

    // Tiered Rotation: Attempt models in hierarchy until success
    let lastError = null;
    for (const config of MODEL_STACK) {
        try {
            const activeModel = getModel(config);
            if (!activeModel) continue;

            const chat = activeModel.startChat({
                history: history.slice(-6).map(m => ({
                    role: m.type === 'bot' ? 'model' : 'user',
                    parts: [{ text: m.text || '' }],
                })).filter(m => m.parts[0].text.length > 0),
            });

            const result = await chat.sendMessage(`${systemPrompt}\n\nUSER: ${query}`);
            const response = await result.response;
            let answer = response.text().trim();

            // Persona Cleanup
            answer = answer.replace(/\b(I am|I'm|I have|My name is)\b/gi, (match) => {
                if (match.toLowerCase().includes("name")) return "Akhilesh's name is";
                if (match.toLowerCase().includes("have")) return "He has";
                return "He is";
            });

            console.log(`[GEMINI-SERVICE] Active Success: ${config.name}`);
            return answer;
        } catch (err) {
            lastError = err;
            if (err.message.includes("429") || err.message.includes("404")) {
                console.warn(`[GEMINI-SERVICE] Rotating: ${config.name} (${err.message.split('\n')[0]})`);
                continue; // Try next model
            }
            throw err; // Stop on non-quota errors
        }
    }

    throw lastError || new Error("ALL_MODELS_FAILED");
}

module.exports = { generateOnlineResponse, isGeminiAvailable: () => !!process.env.GEMINI_API_KEY };
