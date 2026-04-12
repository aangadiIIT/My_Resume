/**
 * AI Model Warmup Script
 * Forces the download and caching of model weights during the build process.
 * This ensures the production environment has the model ready for immediate inference.
 */
const { pipeline } = require('@huggingface/transformers');
const path = require('path');

async function warmup() {
    console.log("🚀 [AI-WARMUP] Starting model weight pre-download...");
    console.log("📦 Target Model: onnx-community/Llama-3.2-1B-Instruct (q4)");
    
    try {
        const startTime = Date.now();
        
        // Initialize the pipeline to trigger the download
        // The 'dtype: q4' ensures we download the highly efficient 4-bit quantized version
        await pipeline('text-generation', 'onnx-community/Llama-3.2-1B-Instruct', {
            device: 'cpu',
            dtype: 'q4',
            cache_dir: path.join(__dirname, '../models'),
        });
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`✅ [AI-WARMUP] Model is ready and cached. Duration: ${duration}s`);
        process.exit(0);
    } catch (err) {
        console.error("❌ [AI-WARMUP] Failed to download model weights:", err);
        process.exit(1);
    }
}

warmup();
