/**
 * ML Intent Matcher - Staff+ Hybrid Component
 * Uses Character Trigrams + Cosine Similarity for high typo-tolerance.
 */
(function(root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof exports === 'object') {
        module.exports = factory();
    } else {
        root.MLIntentMatcher = factory();
    }
}(typeof self !== 'undefined' ? self : this, function() {

    /**
     * Extracts character trigrams from text for typo-robust matching.
     */
    const _vectorCache = new Map();

    function getTrigrams(text) {
        if (!text) return [];
        const clean = text.toLowerCase().replace(/[^\w\s]/g, '').trim();
        const trigrams = [];
        
        // Handle very short words (e.g., "AI", "SAP")
        if (clean.length < 3) {
            if (clean.length > 0) trigrams.push(clean);
            return trigrams;
        }

        for (let i = 0; i < clean.length - 2; i++) {
            trigrams.push(clean.substring(i, i + 3));
        }
        return trigrams;
    }

    /**
     * Converts text into a frequency vector of trigrams.
     */
    function vectorize(text) {
        if (!text) return {};
        const cacheKey = text.toLowerCase().trim();
        if (_vectorCache.has(cacheKey)) return _vectorCache.get(cacheKey);

        const trigrams = getTrigrams(text);
        const vector = {};
        trigrams.forEach(t => {
            vector[t] = (vector[t] || 0) + 1;
        });

        // Limit cache size to 1000
        if (_vectorCache.size > 1000) {
            const firstKey = _vectorCache.keys().next().value;
            _vectorCache.delete(firstKey);
        }
        _vectorCache.set(cacheKey, vector);

        return vector;
    }

    /**
     * Standard Cosine Similarity between two sparse vectors.
     */
    function calculateSimilarity(v1, v2) {
        let dotProduct = 0;
        let mag1 = 0;
        let mag2 = 0;

        // Iterate over v1 keys
        for (const key in v1) {
            if (v2[key]) dotProduct += v1[key] * v2[key];
            mag1 += v1[key] * v1[key];
        }

        // Iterate over v2 keys for magnitude
        for (const key in v2) {
            mag2 += v2[key] * v2[key];
        }

        if (mag1 === 0 || mag2 === 0) return 0;
        return dotProduct / (Math.sqrt(mag1) * Math.sqrt(mag2));
    }

    /**
     * Finds the best matching intent from the pre-vectorized registry.
     */
    function findMatch(query, registry, options = {}) {
        const threshold = options.threshold || 0.65;
        const ambiguityGap = options.ambiguityGap || 0.05;
        
        const queryVector = vectorize(query);
        const results = [];

        // Registry expected in format: [{ intent: 'intent_id', vectors: [v1, v2...] }]
        registry.forEach(item => {
            let bestScoreForIntent = 0;
            item.vectors.forEach(v => {
                const score = calculateSimilarity(queryVector, v);
                if (score > bestScoreForIntent) bestScoreForIntent = score;
            });

            if (bestScoreForIntent > 0) {
                results.push({ intent: item.intent, score: bestScoreForIntent });
            }
        });

        // Sort by score descending
        results.sort((a, b) => b.score - a.score);

        if (results.length === 0 || results[0].score < threshold) {
            return { matched: false, intent: null, score: 0 };
        }

        // Ambiguity Check: If Top 1 and Top 2 are too close
        if (results.length >= 2 && (results[0].score - results[1].score < ambiguityGap)) {
            return { 
                matched: true, 
                intent: results[0].intent, // Still return but flag as ambiguous
                isAmbiguous: true, 
                score: results[0].score,
                alternatives: [results[0].intent, results[1].intent]
            };
        }

        return { matched: true, intent: results[0].intent, score: results[0].score };
    }

    return {
        getTrigrams,
        vectorize,
        calculateSimilarity,
        findMatch
    };
}));
