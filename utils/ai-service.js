const { pipeline } = require('@huggingface/transformers');
const fs = require('fs');
const path = require('path');

let globalContext = null;

let generator = null;
let isInitializing = false;

/**
 * Initializes the Qwen 2.5 0.5B model.
 * Using the 4-bit quantized ONNX version to fit within 1GB RAM limits.
 */
async function initModel() {
    if (generator) return generator;
    if (isInitializing) {
        while (isInitializing) await new Promise(r => setTimeout(r, 100));
        return generator;
    }

    isInitializing = true;
    try {
        console.log("[AI-SERVICE] Deploying Llama 3.2 1B (High-Precision CPU Core)...");
        generator = await pipeline('text-generation', 'onnx-community/Llama-3.2-1B-Instruct', {
            device: 'cpu',
            dtype: 'q4', // Standard 4-bit quantization for ONNX
            cache_dir: './models',
        });
        console.log("[AI-SERVICE] 1B Intelligence Core active.");
    } catch (err) {
        console.error("[AI-SERVICE] Failed to load Llama core:", err);
        throw err;
    } finally {
        isInitializing = false;
    }
    return generator;
}

/**
 * Generates a response using the internal model.
 * @param {string} query - The user question.
 * @param {string} context - The resume context (summary).
 * @returns {Promise<string>} - The generated answer.
 */
async function generateResponse(query, context, history = [], candidates = []) {
    const pipe = await initModel();

    // Format candidates for the LLM context (ONLY what was deterministically found)
    const formattedCandidates = (Array.isArray(candidates) && candidates.length > 0)
        ? candidates.map((c, i) => `[Fact ${i+1}] (Intent: ${c.intent})\n${c.content}`).join('\n\n')
        : "No specific facts found for this query. Provide a general overview from the registry.";

    const systemPrompt = `You are a professional AI Portfolio Assistant for Akhilesh Angadi. 
Your primary goal is to provide accurate answers using the data provided.

TIER 1 (Specific Facts):
${formattedCandidates}

TIER 2 (Main Registry & Biography):
${globalContext || "No global context available."}

STRICT PERSONA RULES:
1. Answers must be grounded in TIER 1 or TIER 2.
2. If specific details are missing from TIER 1, use TIER 2 and state "Based on his profile..."
3. Answer in the 3rd person only ("He holds...", "His role is...").
4. Never invent outside certifications or companies.
5. Max length: 2-3 concise sentences.
`;

    const messages = [
        { role: "system", content: systemPrompt },
        ...history.slice(-6).map(m => ({ 
            role: m.type === 'bot' ? 'assistant' : 'user', 
            content: m.text || '' 
        })).filter(m => m.content.length > 0),
        { role: "user", content: query }
    ];

    const output = await pipe(messages, {
        max_new_tokens: 100,
        do_sample: false,
        return_full_text: false,
        repetition_penalty: 1.1
    });

    if (!output || !output[0] || !output[0].generated_text) {
        throw new Error("AI_GENERATION_EMPTY_RESPONSE");
    }

    const lastMsg = output[0].generated_text[output[0].generated_text.length - 1];
    let answer = lastMsg ? lastMsg.content : "I'm not sure how to answer that.";
    
    // Final Persona Scrubbing
    answer = answer.replace(/\b(I am|I'm|I have|My name is)\b/gi, (match) => {
        if (match.toLowerCase().includes("name")) return "Akhilesh's name is";
        if (match.toLowerCase().includes("have")) return "He has";
        return "He is";
    });

    return answer.trim();
}

module.exports = { generateResponse, initModel };
