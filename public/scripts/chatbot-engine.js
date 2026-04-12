/**
 * Portfolio Chatbot Engine - Unified Module
 */
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['MLIntentMatcher'], factory);
    } else if (typeof exports === 'object') {
        const MLIntentMatcher = require('./ml-intent-matcher');
        module.exports = factory(MLIntentMatcher);
    } else {
        root.ChatbotEngine = factory(root.MLIntentMatcher);
    }
}(typeof self !== 'undefined' ? self : this, function (MLIntentMatcher) {

    function levenshtein(a, b) {
        if (!a || !b) return 100;
        const tmp = [];
        for (let i = 0; i <= a.length; i++) tmp[i] = [i];
        for (let j = 0; j <= b.length; j++) tmp[0][j] = j;
        for (let i = 1; i <= a.length; i++) {
            for (let j = 1; j <= b.length; j++) {
                tmp[i][j] = Math.min(
                    tmp[i - 1][j] + 1,
                    tmp[i][j - 1] + 1,
                    tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
                );
            }
        }
        return tmp[a.length][b.length];
    }

    // === CORE ENGINE - Resolution ===
    const _responseCache = new Map();
    const _CACHE_BYPASS = new Set(['small_talk', 'jokes', 'riddles', 'facts', 'thanks', 'bye', 'entertainment']);

    // === USER MODE DETECTION ===
    function detectUserMode(query) {
        if (!query) return null;
        const lq = query.toLowerCase();
        if (/\b(hire|recruit|position|role|team|fit|looking for|candidate|evaluate|interview|opportunity|open to)\b/.test(lq)) return 'recruiter';
        if (/\b(curious|explore|deep dive|learn|tell me everything|explain fully|detailed|all about|deep)\b/.test(lq)) return 'explorer';
        return null;
    }

    // === MULTI-INTENT DETECTION ===
    function detectMultiIntent(query, summary) {
        if (!query || !summary) return null;
        const nInput = normalize(query);
        const words = new Set(nInput.split(/\s+/).filter(w => w.length > 1));
        if (words.size < 2) return null;
        const intentScores = [];
        summary.mappings.forEach(m => {
            if (_CACHE_BYPASS.has(m.domain)) return;
            const score = m.keywords.reduce((acc, k) => words.has(k.text.toLowerCase()) ? acc + k.weight : acc, 0);
            if (score >= 1.5) intentScores.push({ intent: m.intent, domain: m.domain, score });
        });
        intentScores.sort((a, b) => b.score - a.score);
        // Only return multi-intent if top 2 are from DISTINCT domains
        if (intentScores.length >= 2 && intentScores[0].domain !== intentScores[1].domain) {
            return intentScores.slice(0, 2).map(i => i.intent);
        }
        return null;
    }

    const STOP_WORDS = new Set([
        'a', 'an', 'the', 'is', 'are', 'was', 'were', 'do', 'does', 'did',
        'of', 'in', 'on', 'at', 'by', 'for', 'with', 'from', 'to', 'me',
        'my', 'your', 'his', 'him', 'her', 'he', 'she', 'they', 'them', 'their', 'it',
        'please', 'tell', 'show', 'give', 'how', 'what', 'where', 'when', 'who', 'which',
        'actually', 'basically', 'literally', 'honestly', 'clearly', 'obviously', 'simply', 'just', 'kind', 'sort', 'maybe',
        'about', 'want', 'hear', 'talk', 'info', 'deal', 'say',
        'details', 'walk', 'through', 'track', 'record', 'impact', 'mention', 'specifics', 'brief',
        'asap', 'quickly', 'pls', 'bro', 'full', 'quick', 'detail', 'quickly', 'detail', 'in detail', 'immediately'
    ]);

    // --- Fast-Path Deterministic Phrase Matching ---
    // These bypass normalization entirely to ensure bot persona matches
    const FAST_PATH_EXACT_MAP = {
        "who are you": "bot_identity",
        "who are you?": "bot_identity",
        "what are you": "bot_identity",
        "what are you?": "bot_identity",
        "your name": "bot_identity",
        "your name?": "bot_identity",
        "how can you help": "bot_help",
        "how can you help?": "bot_help",
        "how can you help me": "bot_help",
        "how can you help me?": "bot_help",
        "help": "bot_help",
        "what can i ask you": "bot_help",
        "what can i ask you?": "bot_help",
        "what do you do": "bot_help",
        "ci cd project": "projects_cicd",
        "ci/cd project": "projects_cicd",
        "ci cd": "projects_cicd",
        "cicd": "projects_cicd",
        "work": "experience_summary",
        "show projects": "projects_summary",
        // --- Deterministic Phrase Mapping (Audit Calibration) ---
        "about work": "headline",
        "how to use": "bot_help",
        "how to use this bot": "bot_help",
        "bot functions": "bot_help",
        "bot guide": "bot_help",
        "before sap": "experience_previous",
        "prior sap": "experience_previous",
        "previous sap": "experience_previous",
        "past sap": "experience_previous",
        // --- Zero-Tolerance Specificity Mapping ---
        "what is his experience before sap": "experience_previous",
        "experience before sap": "experience_previous",
        "work before sap": "experience_previous",
        "career before sap": "experience_previous",
        "where he did his engineering": "education_bachelors",
        "where did he do his engineering": "education_bachelors",
        "engineering education": "education_bachelors",
        "engineering projects": "projects_summary",
        "bot functions": "capabilities",
        "bot guide": "capabilities",
        "how to use this bot": "capabilities",
        "role history": "experience_summary",
        "show me his work": "projects_summary",
        "his work": "projects_summary",
        "work projects": "projects_summary",
        // --- Greetings Typo-Tolerance (Prevents hi -> CI/CD) ---
        "hi": "small_talk", "hey": "small_talk", "hello": "small_talk", "howdy": "small_talk",
        "yo": "small_talk", "greetings": "small_talk", "sup": "small_talk", "hiya": "small_talk",
        "heya": "small_talk", "helol": "small_talk", "hlelo": "small_talk", "helo": "small_talk",
        "how are you": "small_talk", "how are you?": "small_talk", "how r u": "small_talk",
        // --- Profile / Identity (Prevents who is he -> bot_identity) ---
        "who is he": "identity", "who is he?": "identity", "about him": "identity",
        "his profile": "identity", "profile please": "identity", "show profile": "identity",
        "show me his profile": "identity", "who is akhilesh": "identity",
        // --- Bye / Farewell Typo-Tolerance ---
        "bye": "bye", "goodbye": "bye", "goodybe": "bye", "goodbey": "bye", "ogodbye": "bye",
        "cya": "bye", "later": "bye", "farewell": "bye", "see you": "bye", "bye bye": "bye",
        // --- Debug / Trace Typo-Tolerance (Prevents trace -> hiring_mentorship) ---
        "trace": "bot_help", "trace please": "bot_help", "show trace": "bot_help",
        "trcae": "bot_help", "traec": "bot_help", "rtace": "bot_help", "tarce": "bot_help",
        "debug": "bot_help", "debug please": "bot_help", "show debug": "bot_help",
        "dbeug": "bot_help", "deubg": "bot_help", "debgu": "bot_help", "edbug": "bot_help",
        "/trace": "bot_help", "/debug": "bot_help"
    };

    const DOMAIN_KEYWORDS = {
        experience: ["experience", "career", "sap", "juniper", "work", "history", "role"],
        skills: ["skills", "technology", "tools", "stack", "expertise", "technical", "coding", "programming"],
        projects: ["project", "built", "portfolio", "iot", "cicd"],
        publications: ["publication", "research", "paper", "published"],
        contact: ["contact", "email", "linkedin", "reach", "message"],
        identity: ["about", "profile", "identity", "who", "background"],
        hire_role: ["hire", "recruit", "candidate", "fit for role", "hiring", "recruiter"]
    };

    function normalize(text) {
        if (!text) return '';
        let lower = text.toLowerCase().trim();

        // --- Predictive Nuance & Complexity Detection ---
        // Forces AI synthesis for complex questions even if a deterministic match exists.
        function isNuancedQuery(rawQuery) {
            const lRaw = rawQuery.trim().toLowerCase();
            const words = lRaw.split(/\s+/).length;
            const nuanceKeywords = /\b(how|why|describe|explain|compare|versus|vs|suitability|opinion|think|fit|believe|tell me more about how|evaluate|pros|cons)\b/i;
            
            // 1. Long Questions (Exploratory)
            if (words > 6 && lRaw.includes('?')) return true;
            // 2. Nuance Keywords (Reasoning)
            if (nuanceKeywords.test(lRaw)) return true;
            // 3. Multi-part sentences
            if (lRaw.includes(',') || lRaw.includes(' and ') || lRaw.includes(' because ')) return true;
            
            return false;
        }

        // --- Technical Shorthand & Domain Expansion ---
        const TECH_MAP = {
            'k8s': 'kubernetes',
            'tf': 'terraform',
            'iac': 'infrastructure as code',
            'ha': 'high availability',
            'cicd': 'ci cd',
            'ml': 'machine learning',
            'genai': 'generative ai'
        };

        // Handle symbolic queries like ?? or ???
        if (/^[^\w\s]+$/.test(lower)) return "symbolic_query";
        if (lower === 'another' || lower === 'another one' || lower === 'next' || lower === 'one more' || lower === 'more') {
            return "re_trigger_match";
        }

        const DOMAIN_FOLLOWUP_MAP = {
            'experience': ['Show Skills', 'View Projects', 'Download Resume', 'Tech Stack'],
            'skills': ['Cloud Projects', 'Certifications', 'Experience', 'Contact Info'],
            'projects': ['Tech Stack', 'CI/CD details', 'Work History', 'Hire Him'],
            'identity': ['Experience', 'Skills', 'Projects', 'Contact'],
            'contact': ['Download Resume', 'LinkedIn', 'GitHub', 'Hire Him'],
            'certifications': ['Skills', 'Cloud Projects', 'Experience', 'Contact'],
            'small_talk': ['About Akhilesh', 'Experience', 'Skills', 'Projects'],
            'analytics': ['Who is he?', 'Main Skills', 'Projects', 'Contact']
        };

        function generateFollowUpChips(domain, intent, context = {}) {
            let chips = DOMAIN_FOLLOWUP_MAP[domain] || ['Experience', 'Skills', 'Projects', 'Contact'];
            
            // Recruiter Mode Overrides (Focus on conversion)
            if (context.userMode === 'recruiter') {
                chips = ['Download Resume', 'Contact Details', 'Hiring Fit', 'Main Skills'];
            }
            
            // Shuffle and pick 4
            return chips.sort(() => 0.5 - Math.random()).slice(0, 4);
        }

        return lower
            .replace(/[^\w\s]/g, '')
            .split(/\s+/)
            .map(w => TECH_MAP[w] || w) // Expand shorthand
            .filter(w => !STOP_WORDS.has(w) && w.length > 1)
            .join(' ');
    }

    function sanitize(text) {
        if (!text) return '';
        if (typeof text !== 'string') text = String(text);

        let cleaned = text
            .replace(/[#*`]/g, '')   // Remove Markdown symbols
            .replace(/\s+/g, ' ')    // Normalize whitespace
            .trim();

        // Convert /view-asset/... to clickable links (Only if not already an <a> tag)
        if (!cleaned.includes('<a')) {
            cleaned = cleaned.replace(/\/view-asset\/([^\s)]+\.pdf)/g, '<a href="/view-asset/$1" target="_blank" class="chat-link">📄 Open Document</a>');
        }

        // Convert Internal Page Links (Iteration 17)
        if (!cleaned.includes('href="/contact-me"')) {
            cleaned = cleaned.replace(/🔗 View Contact Page/g, '<a href="/contact-me" class="chat-link">🔗 View Contact Page</a>');
        }

        // Convert Markdown Bolding (Iteration 17)
        if (!cleaned.includes('<b>')) {
            cleaned = cleaned.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
        }

        // Convert LinkedIn URLs (Linkified only if raw)
        cleaned = cleaned.replace(/(?<!href=")(https?:\/\/(www\.)?linkedin\.com\/in\/[^\s)>"]+)/g, '<a href="$1" target="_blank" class="chat-link">🔗 LinkedIn Profile</a>');

        // Convert GitHub URLs
        cleaned = cleaned.replace(/(?<!href=")(https?:\/\/(www\.)?github\.com\/[^\s)>"]+)/g, '<a href="$1" target="_blank" class="chat-link">💻 GitHub Profile</a>');

        return cleaned;
    }

    let _lastTrace = null;

    function findResponse(query, summary, context = {}) {
        const raw = query.trim();
        const lRaw = raw.toLowerCase();

        if (lRaw === '/trace') {
            if (!_lastTrace) return { answer: "No trace data available.", suggestions: [], follow_up: [] };
            return {
                answer: `**Trace Output:**\n- **Query:** "${_lastTrace.query}"\n- **Path:** ${_lastTrace.path}\n- **Match:** ${_lastTrace.intent || 'None'}\n- **Determ. Score:** ${_lastTrace.deterministic_score}\n- **ML Score:** ${_lastTrace.ml_confidence || 'N/A'}\n- **Bucket:** ${_lastTrace.confidence_bucket}`,
                suggestions: [], follow_up: []
            };
        }

        const nInput = normalize(raw);
        console.log(`[HARDENED ENGINE] Query: "${raw}" | Normalized: "${nInput}"`);

        // --- Simultaneous Multi-Intent Discovery ---
        const multiIntents = typeof detectMultiIntent === 'function' ? detectMultiIntent(raw, summary) : null;
        if (multiIntents) {
            context.multiIntents = multiIntents;
            console.log(`[ENGINE] Multi-Intent Detected: ${multiIntents.map(i => i.intent).join(', ')}`);
        }

        const trace = {
            query: raw,
            intent: null,
            path: 'INIT',
            deterministic_score: 0,
            confidence_bucket: 'LOW'
        };

        // --- PURE UTILITY GUARDS ---
        const PURE_GREETINGS = new Set(['hi', 'hey', 'hello', 'howdy', 'yo', 'greetings', 'sup', 'hiya', 'heya', 'helol', 'hlelo', 'helo', 'howr u', 'howru']);
        const PURE_BYE_WORDS = new Set(['bye', 'goodbye', 'goodybe', 'goodbey', 'ogodbye', 'cya', 'later', 'farewell', 'see you']);
        const CAREER_KEYWORDS = new Set(['contact', 'email', 'message', 'reach', 'feedback', 'resume', 'cv', 'work', 'job', 'experience', 'skill', 'project', 'cert', 'award', 'mentorship']);
        
        const firstWord = nInput.split(' ')[0];
        const hasCareerKeywords = nInput.split(' ').some(w => CAREER_KEYWORDS.has(w));
        
        // GREETING INTERCEPT (Only if no career keywords present)
        if (!hasCareerKeywords && (PURE_GREETINGS.has(nInput) || PURE_GREETINGS.has(firstWord))) {
            const greetMatch = summary.mappings.find(m => m.intent === 'small_talk');
            if (greetMatch) {
                console.log(`[ENGINE] Pure Greeting Guard: Routing "${raw}" to small_talk`);
                trace.path = 'GREETING_GUARD';
                trace.intent = 'small_talk';
                trace.confidence_bucket = 'HIGH';
                context.trace = trace; _lastTrace = trace;
                const finalResult = resolveResult(greetMatch, context, lRaw);
                return { ...finalResult, candidates: [{ intent: 'small_talk', domain: 'small_talk', content: finalResult.answer, score: 999999 }] };
            }
        }

        // BYE INTERCEPT
        if (PURE_BYE_WORDS.has(nInput) || PURE_BYE_WORDS.has(firstWord)) {
            const byeMatch = summary.mappings.find(m => m.intent === 'bye');
            if (byeMatch) {
                console.log(`[ENGINE] Pure Bye Guard: Routing "${raw}" to bye`);
                trace.path = 'BYE_GUARD';
                trace.intent = 'bye';
                trace.confidence_bucket = 'HIGH';
                context.trace = trace; _lastTrace = trace;
                const finalResult = resolveResult(byeMatch, context, lRaw);
                return { ...finalResult, candidates: [{ intent: 'bye', domain: 'small_talk', content: finalResult.answer, score: 999999 }] };
            }
        }

        // --- STEP 0: FAST-PATH (Exact Bot Persona Matching) ---
        const fastPathMatch = FAST_PATH_EXACT_MAP[lRaw];
        if (fastPathMatch) {
            const match = summary.mappings.find(m => m.intent === fastPathMatch);
            if (match) {
                console.log(`[ENGINE] Fast-Path Exact Match: ${fastPathMatch}`);
                trace.intent = fastPathMatch;
                trace.path = 'FAST_PATH_EXACT';
                trace.deterministic_score = 1000000;
                trace.confidence_bucket = 'HIGH';
                context.trace = trace;
                _lastTrace = trace;
                const finalResult = resolveResult(match, context, lRaw);
                return { ...finalResult, candidates: [{ intent: match.intent, domain: match.domain, content: finalResult.answer, score: 1000000 }] };
            }
        }

        // --- Multi-Turn Context & Recursive Resolution ---
        const FOLLOWUP_TRIGGERS = new Set(['more', 'elaborate', 'tell me more', 'what else', 'continue', 'and', 'next', 'go on', 'expand', 'detail', 'full', 'pls', 'please']);
        
        // 1. Exact Re-Trigger (Variety)
        if (nInput === "re_trigger_match" && context.lastIntent) {
            const prevMatch = summary.mappings.find(m => m.intent === context.lastIntent);
            if (prevMatch) {
                console.log(`[ENGINE] Re-Trigger detected. Repeating: ${context.lastIntent}`);
                const finalResult = resolveResult(prevMatch, context, raw);
                return { ...finalResult, candidates: [{ intent: prevMatch.intent, domain: prevMatch.domain, content: finalResult.answer, score: 9999 }] };
            }
        }

        // 2. Vague Follow-up Resolver (Contextual Elaboration)
        if (FOLLOWUP_TRIGGERS.has(nInput) && context.lastIntent) {
            const prevMatch = summary.mappings.find(m => m.intent === context.lastIntent);
            if (prevMatch) {
                console.log(`[ENGINE] Contextual Follow-up detected for: ${context.lastIntent}`);
                trace.path = 'CONTEXTUAL_FOLLOWUP';
                trace.intent = context.lastIntent;
                trace.confidence_bucket = 'HIGH';
                context.depth = (context.depth || 0) + 1; // Increase depth for elaboration
                const finalResult = resolveResult(prevMatch, context, raw);
                return { ...finalResult, candidates: [{ intent: prevMatch.intent, domain: prevMatch.domain, content: finalResult.answer, score: 9999 }] };
            }
        }

        trace.query = raw;
        trace.intent = null;
        trace.path = 'FALLBACK';
        trace.deterministic_score = 0;
        trace.ml_confidence = null;
        trace.confidence_bucket = 'LOW';

        const ML_ENABLED = true;
        const STRICT_THRESHOLD = 700; // Lower further to catch single-word specificity
        const CANDIDATE_THRESHOLD = 300;
        const ML_SIMILARITY_THRESHOLD = 0.35; // Ultra-aggressive typo-tolerance
        const AMBIGUITY_GAP = 0.05; // Relaxed to allow close matches
        const LLM_CONFIDENCE_THRESHOLD = 0.50; // Queries scoring below this will trigger LLM fallback

        // --- Direct Selection Resolver (Indices & Highlights) ---
        // If we just showed a list, check if user is pointing to a specific year/index
        if (context.lastMultiMatchIndices && context.lastIntent) {
            // Match standalone years (2025) or full dates (2025-09)
            const yearMatch = raw.match(/\b(20\d{2}(-\d{2})?)\b/);
            if (yearMatch) {
                const intentMatch = summary.mappings.find(m => m.intent === context.lastIntent);
                if (intentMatch && Array.isArray(intentMatch.details)) {
                    const bestIdx = context.lastMultiMatchIndices.find(idx => {
                        const item = intentMatch.details[idx];
                        const searchable = (typeof item === 'object') ? JSON.stringify(item).toLowerCase() : String(item).toLowerCase();
                        return searchable.includes(yearMatch[1]);
                    });

                    if (bestIdx !== undefined) {
                        console.log(`[ENGINE] Selection Resolver: Matched ${yearMatch[1]} in last list.`);
                        trace.path = 'SELECTION_RESOLVER';
                        trace.intent = context.lastIntent;
                        trace.confidence_bucket = 'HIGH';
                        context.trace = trace;
                        context.specificItemIndex = bestIdx;
                        delete context.lastMultiMatchIndices; // Consume it
                        const finalResult = resolveResult(intentMatch, context, raw);
                        return { ...finalResult, candidates: [{ intent: intentMatch.intent, domain: intentMatch.domain, content: finalResult.answer, score: 10000 }] };
                    }
                }
            }
        }

        // 1. INTENT PINNING (PRINCIPAL RULE)
        const wordCount = raw.trim().split(/\s+/).length;
        const isFollowUp = /\b(more|explain|further|detail|elaborate|okay|yes|sure|next)\b/i.test(lRaw);

        // Strict pinning for why_hire
        if (context.lastIntent === 'why_hire' && isFollowUp) {
            const match = summary.mappings.find(m => m.intent === 'why_hire');
            if (match) {
                console.log(`[ENGINE] Strict Pinning Intent: why_hire`);
                trace.path = 'DETERMINISTIC_PINNED';
                trace.intent = 'why_hire';
                trace.confidence_bucket = 'HIGH';
                context.trace = trace;
                _lastTrace = trace;
                context.depth = (context.depth || 0) + 1;
                const finalResult = resolveResult(match, context);
                return { ...finalResult, candidates: [{ intent: match.intent, domain: match.domain, content: finalResult.answer, score: 10000 }] };
            }
        }

        if (wordCount <= 5 && isFollowUp) {
            if (context.lastIntent) {
                const match = summary.mappings.find(m => m.intent === context.lastIntent);
                if (match) {
                    console.log(`[ENGINE] Pinning Intent: ${context.lastIntent}`);
                    trace.path = 'DETERMINISTIC_PINNED';
                    trace.intent = context.lastIntent;
                    trace.confidence_bucket = 'HIGH';
                    context.trace = trace;
                    _lastTrace = trace;
                    context.depth = (context.depth || 0) + 1;
                    const finalResult = resolveResult(match, context, lRaw);
                    return { ...finalResult, candidates: [{ intent: match.intent, domain: match.domain, content: finalResult.answer, score: 10000 }] };
                }
            }
        }

        // 2. DOMAIN LOCK DETECTION
        let lockedDomain = null;
        for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
            if (keywords.some(k => lRaw.includes(k))) {
                lockedDomain = domain;
                console.log(`[ENGINE] Domain Lock: ${lockedDomain}`);
                break;
            }
        }

        // 3. FOLLOW-UP RESOLUTION
        if (context.lastFollowUps) {
            const matchedFollowUp = context.lastFollowUps.find(f =>
                f.text.toLowerCase() === lRaw || normalize(f.text) === nInput
            );
            if (matchedFollowUp && matchedFollowUp.intent) {
                const intentMatch = summary.mappings.find(m => m.intent === matchedFollowUp.intent);
                if (intentMatch) {
                    trace.path = 'FOLLOW_UP_MATCH';
                    trace.intent = matchedFollowUp.intent;
                    trace.confidence_bucket = 'HIGH';
                    context.trace = trace;
                    _lastTrace = trace;
                    const finalResult = resolveResult(intentMatch, context);
                    return { ...finalResult, candidates: [{ intent: intentMatch.intent, domain: intentMatch.domain, content: finalResult.answer, score: 10000 }] };
                }
            }
        }

        // --- Cross-Domain Synergy Resolver ---
        const CertTriggers = /\b(certified|certification|certificate|badge|exam|license)\b/i;
        if (CertTriggers.test(lRaw)) {
            const techKeywords = {
                kubernetes: ['certifications_cka'],
                docker: ['certifications'],
                azure: ['certifications'],
                aws: ['certifications'],
                sap: ['certifications']
            };

            for (const [tech, intents] of Object.entries(techKeywords)) {
                if (lRaw.includes(tech)) {
                    // Lock domain to 'identity'/certifications and let resolveResult filter the list
                    const match = summary.mappings.find(m => intents.includes(m.intent));
                    if (match) {
                        console.log(`[ENGINE] Synergy Resolver: Found ${tech} + Certification. Routing to ${match.intent}`);
                        trace.path = 'SYNERGY_RESOLVER';
                        trace.intent = match.intent;
                        trace.confidence_bucket = 'HIGH';
                        context.trace = trace;
                        _lastTrace = trace;
                        const finalResult = resolveResult(match, context, lRaw);
                        return finalResult;
                    }
                }
            }
        }

        // --- PASS 0: EXACT ENTITY MATCH ---
        if (summary.entity_registry) {
            const rawLower = lRaw.trim();
            const keys = Object.keys(summary.entity_registry);

            for (const title of keys) {
                if (rawLower.includes(title)) {
                    const entity = summary.entity_registry[title];
                    const intentMatch = summary.mappings.find(m => m.intent === entity.intent);
                    if (intentMatch) {
                        console.log(`[ENGINE] Pass 0: Entity Match Found! Title: "${title}"`);
                        trace.path = 'ENTITY_MATCH';
                        trace.intent = entity.intent;
                        trace.deterministic_score = 200000;
                        trace.confidence_bucket = 'HIGH';

                        // Handle Duplicate Indices (Iteration 16.7)
                        if (entity.indices && entity.indices.length > 0) {
                            let bestIndex = entity.indices[0]; // Default to latest
                            let foundSpecific = false;
                            const yearMatch = rawLower.match(/\b(20\d{2})\b/);

                            if (entity.indices.length > 1) {
                                if (yearMatch) {
                                    for (const idx of entity.indices) {
                                        const item = intentMatch.details[idx];
                                        const searchable = (typeof item === 'object') ? JSON.stringify(item).toLowerCase() : String(item).toLowerCase();
                                        if (searchable.includes(yearMatch[1])) {
                                            bestIndex = idx;
                                            foundSpecific = true;
                                            break;
                                        }
                                    }
                                } else {
                                    // NO year specified: Pass all indices for disambiguation (Iteration 16.7)
                                    context.multiMatchIndices = entity.indices;
                                    console.log(`[ENGINE] Multi-Match Detected: No year specified. Showing ${entity.indices.length} items.`);
                                }
                            }

                            if (!context.multiMatchIndices || foundSpecific) {
                                context.specificItemIndex = bestIndex;
                            }
                        }

                        // Force specific item highlight if it's a list domain (Iteration 16)
                        const listIntents = ['awards', 'certifications', 'projects_summary', 'publications_summary', 'experience_juniper', 'experience_sap'];
                        if (listIntents.includes(entity.intent)) {
                            // indices are handled above
                        }

                        context.trace = trace;
                        _lastTrace = trace;
                        context.depth = 0;
                        const finalResult = resolveResult(intentMatch, context, lRaw);
                        return finalResult;
                    }
                }
            }
        }

        // B. SEARCH SPACE (Global Search for better precision)
        const searchSpace = summary.mappings;

        // 4. EXACT MATCH
        const exactMatches = searchSpace.map(m => {
            let score = 0;
            if (m.exact_questions) {
                m.exact_questions.forEach(eq => {
                    const eqLow = eq.toLowerCase().trim();
                    if (eqLow === lRaw || normalize(eq) === nInput) score = 2;
                });
            }
            return { ...m, matchScore: score };
        }).filter(m => m.matchScore > 0);

        if (exactMatches.length > 0) {
            const exact = exactMatches.sort((a, b) => b.priority - a.priority)[0];
            trace.path = 'EXACT_MATCH';
            trace.intent = exact.intent;
            trace.deterministic_score = 10000; // Infinity for exact
            trace.confidence_bucket = 'HIGH';
            context.trace = trace;
            _lastTrace = trace;
            context.depth = 0; // Transition to new intent
            const finalResult = resolveResult(exact, context, lRaw);
            return finalResult;
        }

        // --- Hybrid Intent Resolution (Pass-Through Logic) ---
        const inputWords = nInput.split(/\s+/).filter(w => w.length > 0);

        // --- PASS 0: EXACT ANCHOR ---
        if (inputWords.length === 1) {
            const anchorMatch = searchSpace.find(m => m.weights && m.weights[inputWords[0]] > 500); // Rare only
            if (anchorMatch) {
                trace.path = 'EXACT_ANCHOR';
                trace.intent = anchorMatch.intent;
                trace.deterministic_score = 50000;
                trace.confidence_bucket = 'HIGH';
                context.trace = trace;
                _lastTrace = trace;
                context.intent = anchorMatch.intent; // Refresh context
                return resolveResult(anchorMatch, context, lRaw);
            }
        }

        let bestTechMatch = null;
        let highestPriority = -1;

        for (const w of inputWords) {
            // Exact Match First
            if (summary.technical_anchors && summary.technical_anchors[w]) {
                const intentName = summary.technical_anchors[w];
                const mapping = searchSpace.find(m => m.intent === intentName);
                const priority = mapping ? mapping.priority : 0;
                
                const queryIsNuanced = (lRaw.split(/\s+/).length > 3 || lRaw.includes('?'));
                if (!queryIsNuanced && priority > highestPriority) {
                    bestTechMatch = { intent: intentName, score: 100000 };
                    highestPriority = priority;
                }
            }
            
            // Fuzzy Match if no high-confidence exact match found yet in this word
            if (!bestTechMatch && summary.technical_anchors) {
                const keys = Object.keys(summary.technical_anchors);
                for (const k of keys) {
                    if (Math.abs(w.length - k.length) <= 1) {
                        const d = levenshtein(w, k);
                        if (w.length >= 4 && (d <= 1 || (w.length > 5 && d <= 2))) {
                            if (w === 'reach' && k === 'react') continue;
                            const intentName = summary.technical_anchors[k];
                            const mapping = searchSpace.find(m => m.intent === intentName);
                            const priority = mapping ? mapping.priority : 0;
                            
                            if (priority > highestPriority) {
                                bestTechMatch = { intent: intentName, score: 90000 };
                                highestPriority = priority;
                            }
                        }
                    }
                }
            }
        }

        if (bestTechMatch) {
            const anchorMatch = searchSpace.find(m => m.intent === bestTechMatch.intent);
            if (anchorMatch) {
                // CERT OVERRIDE: If query also contains cert keywords, route to certifications instead
                const CERT_OVERRIDE_KEYWORDS = /\b(cert|certificate|certification|badge|exam|license|credential|accreditation)\b/i;
                if (CERT_OVERRIDE_KEYWORDS.test(lRaw)) {
                    const certMatch = searchSpace.find(m => m.intent === 'certifications');
                    if (certMatch) {
                        console.log(`[ENGINE] Cert Override: Tech anchor "${anchorMatch.intent}" overridden by cert keyword`);
                        trace.path = 'CERT_OVER_RIDE';
                        trace.intent = 'certifications';
                        trace.deterministic_score = 95000;
                        trace.confidence_bucket = 'HIGH';
                        context.trace = trace; _lastTrace = trace;
                        context.intent = 'certifications';
                        return resolveResult(certMatch, context, lRaw);
                    }
                }
                trace.path = 'TECHNICAL_ANCHOR';
                trace.intent = anchorMatch.intent;
                trace.deterministic_score = bestTechMatch.score;
                trace.confidence_bucket = 'HIGH';
                context.trace = trace;
                _lastTrace = trace;
                context.intent = anchorMatch.intent;
                return resolveResult(anchorMatch, context, lRaw);
            }
        }

        // --- PASS 0.5: PHRASE ANCHORS (Multi-word technical sequences) ---
        if (inputWords.length >= 2) {
            const inputPhrase = inputWords.join(' ');
            let bestPhraseMatch = null;

            Object.entries(summary.phrase_anchors || {}).forEach(([p, intents]) => {
                if (inputPhrase.includes(p)) {
                    if (!bestPhraseMatch || p.length > bestPhraseMatch.phrase.length) {
                        bestPhraseMatch = { phrase: p, intent: intents[0] };
                    }
                }
            });

            if (bestPhraseMatch) {
                const phraseIntent = searchSpace.find(m => m.intent === bestPhraseMatch.intent);
                if (phraseIntent) {
                    trace.path = 'PHRASE_ANCHOR';
                    trace.intent = phraseIntent.intent;
                    trace.deterministic_score = 40000;
                    trace.confidence_bucket = 'HIGH';
                    context.trace = trace;
                    _lastTrace = trace;
                    const finalResult = resolveResult(phraseIntent, context, lRaw);
                    return { ...finalResult, candidates: [{ intent: phraseIntent.intent, domain: phraseIntent.domain, content: finalResult.answer, score: 10000 }] };
                }
            }
        }

        // --- PASS 1: SPECIFICITY FIRST (Entropy Weighted) ---
        const specificScores = searchSpace.map(m => {
            let score = 0;
            inputWords.forEach(w => {
                if (m.high_entropy_keywords && m.high_entropy_keywords.includes(w)) {
                    // Specificity Boost based on rarity
                    score += (m.weights[w] || 100) * 50;
                }
            });

            // 💎 SOFT DOMAIN BOOST (PASS 1)
            if (m.domain === lockedDomain) score += 5000;

            return { ...m, matchScore: score };
        }).filter(m => m.matchScore >= 5000);

        if (specificScores.length > 0) {
            const bestSpecific = specificScores.sort((a, b) => b.matchScore - a.matchScore || b.priority - a.priority)[0];
            trace.path = 'DETERMINISTIC_SPECIFIC';
            trace.intent = bestSpecific.intent;
            trace.deterministic_score = bestSpecific.matchScore;
            trace.confidence_bucket = 'HIGH';
            context.trace = trace;
            _lastTrace = trace;
            return resolveResult(bestSpecific, context, lRaw);
        }

        // --- PASS 2: FULL SCORING (Standard Fallback) ---
        const scores = searchSpace.map(m => {
            let score = 0;

            inputWords.forEach(w => {
                // Rarity Weighted Scoring
                if (m.weights && m.weights[w]) {
                    score += (m.weights[w] * 5);
                }
            });

            // 🔍 PASS 1.5: FUZZY RECOVERY (Cumulative Scoring for Iteration 8)
            if (score === 0 && inputWords.length <= 3) {
                inputWords.forEach(iw => {
                    if (iw.length >= 3 && m.high_entropy_keywords) {
                        m.high_entropy_keywords.forEach(hk => {
                            const d = levenshtein(iw, hk.toLowerCase());
                            if ((iw.length > 4 && d <= 2) || (iw.length <= 4 && d <= 1)) {
                                score += (4000 / (d + 1));
                            }
                        });
                    }
                });
            }

            // ❌ NEGATIVE KEYWORD PENALTY (STRICT DETERMINISTIC GUARD)
            if (m.negatives) {
                m.negatives.forEach(neg => {
                    if (inputWords.includes(neg.toLowerCase())) {
                        score -= 5000;
                    }
                });
            }

            // 💎 SOFT DOMAIN BOOST (PASS 2)
            if (m.domain === lockedDomain) {
                score += 2000;
            }

            const priorityFactor = (m.priority || 1000) / 1000;
            let finalScore = score * priorityFactor;

            // --- Refined Contextual Keyword Search ---
            // Protect utility intents from being outscored by professional keywords in multi-intent queries.
            // ONLY use typo variants or rare sequences to avoid misfiring on generic 'who'/'how' queries.
            const UTILITY_TYPO_ANCHORS = {
                'bye': 'bye', 'goodbye': 'bye', 'goodybe': 'bye', 'ogodbye': 'bye', 'goodbey': 'bye',
                'trace': 'bot_help', 'trcae': 'bot_help', 'debug': 'bot_help', 'dbeug': 'bot_help', 'debgu': 'bot_help'
            };
            for (const [anchor, targetIntent] of Object.entries(UTILITY_TYPO_ANCHORS)) {
                if (inputWords.includes(anchor) && m.intent === targetIntent) {
                    finalScore += 100000;
                }
                if (nInput.includes(anchor) && m.intent === targetIntent) {
                    finalScore += 100000;
                }
            }

            // --- TIE-BREAKER: WORK PROJECTS (Iteration 20) ---
            if (m.intent === 'projects_summary' && inputWords.includes('work') && inputWords.includes('project')) {
                finalScore += 2000;
            }

            return { ...m, matchScore: finalScore };
        });

        // 🔍 PASS 2.5: SELECT WINNER
        const sortedScores = scores.sort((a, b) => b.matchScore - a.matchScore || b.priority - a.priority);
        const winners = sortedScores.filter(s => s.matchScore >= CANDIDATE_THRESHOLD);

        const best = scores.sort((a, b) => b.matchScore - a.matchScore)[0];
        if (best) trace.deterministic_score = best.matchScore;

        // --- Final Hybrid Resolution (Weighted Matching) ---
        let finalMatch = null;
        let candidates = [];

        // Collect all candidates above threshold from the full scoring pass
        const thresholdCandidates = scores
            .filter(m => m.matchScore >= CANDIDATE_THRESHOLD)
            .sort((a, b) => b.matchScore - a.matchScore);

        // Limit to top 3 candidates for AI context efficiency
        const topCandidates = thresholdCandidates.slice(0, 3);
        
        const queryIsNuanced = (lRaw.split(/\s+/).length > 6 || /\b(how|why|compare|vs|opinion|fit|think|describe|explain)\b/.test(lRaw));

        if (best && best.matchScore >= STRICT_THRESHOLD && !queryIsNuanced) {
            console.log(`[ENGINE] High Confidence Deterministic Match: ${best.intent} (${best.matchScore})`);
            finalMatch = best;
            trace.path = 'DETERMINISTIC_STRONG';
            trace.confidence_bucket = 'HIGH';
        } else if (ML_ENABLED && raw.length >= 3) {
            console.log(`[ENGINE] Low/Mid Confidence (${best?.matchScore || 0}). Triggering ML Fallback...`);

            const mlRegistry = summary.mappings.map(m => ({
                intent: m.intent,
                vectors: m.ml_vectors || [],
                minFloor: m.min_ml_score || ML_SIMILARITY_THRESHOLD
            }));

            const mlResult = MLIntentMatcher.findMatch(raw, mlRegistry, {
                threshold: ML_SIMILARITY_THRESHOLD,
                ambiguityGap: AMBIGUITY_GAP
            });

            if (mlResult.matched) {
                trace.ml_confidence = mlResult.score.toFixed(3);
                const domainConflict = (lockedDomain && summary.mappings.find(m => m.intent === mlResult.intent)?.domain !== lockedDomain);

                if (mlResult.isAmbiguous || domainConflict) {
                    const alts = mlResult.alternatives || [mlResult.intent, best?.intent || 'general'].filter(x => x);
                    console.warn(`[ENGINE] ML Ambiguity/Conflict Detected: ${alts.join(' vs ')}`);
                    trace.path = 'AMBIGUITY_GUARD';
                    trace.confidence_bucket = 'LOW';
                    _lastTrace = trace;

                    return {
                        answer: `Your question could relate to multiple areas. Did you mean:\n\n👉 **${alts[0].replace(/_/g, ' ')}**\n👉 **${alts[1].replace(/_/g, ' ')}**`,
                        suggestions: alts.map(a => a.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')),
                        follow_up: alts.map(a => ({ text: a.replace(/_/g, ' '), intent: a })),
                        updatedContext: { ...context, depth: 0 },
                        trace
                    };
                }

                console.log(`[ENGINE] ML Match Found: ${mlResult.intent} (Score: ${mlResult.score.toFixed(2)})`);
                finalMatch = summary.mappings.find(m => m.intent === mlResult.intent);

                if (finalMatch) {
                    context.matcher = 'ml';
                    trace.path = 'ML_RECOVERED';
                    trace.confidence_bucket = mlResult.score > 0.85 ? 'HIGH' : 'MEDIUM';
                }
            }
        }

        // Finalize Candidates for AI synthesis
        if (finalMatch) {
            // Ensure finalMatch is in candidates and ranked first
            candidates = [finalMatch, ...topCandidates.filter(c => c.intent !== finalMatch.intent)].slice(0, 3);
        } else if (topCandidates.length > 0) {
            candidates = topCandidates;
            finalMatch = topCandidates[0];
        }

        if (!finalMatch) {
            trace.intent = 'unknown';
            trace.confidence_bucket = 'NONE';
            _lastTrace = trace;
            console.log(`[ENGINE] No Match Found. Returning Fallback.`);
            logUnknownQuery(lRaw, best?.intent);
            return {
                answer: "I'm not quite sure I understand that yet. You can ask about Akhilesh's project history, skills, or even for a joke!",
                isFallback: true,
                intent: 'unknown',
                suggestions: ["SAP Experience", "Technical Skills", "Tell me a joke"],
                trace,
                candidates: []
            };
        }

        trace.intent = finalMatch.intent;
        _lastTrace = trace;
        context.depth = 0;
        context.trace = trace;

        // Resolve all candidates to their final answers/details
        const resolvedCandidates = candidates.map(c => {
            // For professional domains, use Depth 2 (Detail View) to give LLM full grounding facts (Iteration 22.1: Anti-Hallucination)
            const listDomains = ['experience', 'skills', 'projects', 'certifications', 'awards', 'publications', 'recommendations', 'education', 'identity', 'capabilities'];
            const groundingDepth = listDomains.includes(c.domain) ? 2 : 0;

            const res = resolveResult(c, { ...context, depth: groundingDepth, silent: true }, lRaw);
            return {
                intent: c.intent,
                domain: c.domain,
                content: res.answer,
                score: c.matchScore || 1000
            };
        });

        const primaryResult = resolveResult(finalMatch, context, lRaw);
        return {
            ...primaryResult,
            candidates: resolvedCandidates
        };
    }

    function logUnknownQuery(query, suggestedIntent) {
        // In browser, this would be an API call. In local benchmark, it writes to a file.
        if (typeof window === 'undefined' && typeof require !== 'undefined') {
            const fs = require('fs');
            const path = require('path');
            const logPath = path.join(process.cwd(), 'logs', 'unknown_queries.json');

            try {
                if (!fs.existsSync(path.join(process.cwd(), 'logs'))) fs.mkdirSync(path.join(process.cwd(), 'logs'));

                let logs = {};
                if (fs.existsSync(logPath)) {
                    logs = JSON.parse(fs.readFileSync(logPath, 'utf8'));
                }

                const key = query.toLowerCase().trim();
                let isNew = false;
                if (!logs[key]) {
                    logs[key] = { count: 0, suggested: suggestedIntent, firstSeen: new Date().toISOString() };
                    isNew = true;
                }
                logs[key].count++;
                logs[key].lastSeen = new Date().toISOString();

                // Log size limit handling (keep top 500 by count)
                if (isNew && Object.keys(logs).length > 500) {
                    const entries = Object.entries(logs).sort((a, b) => b[1].count - a[1].count);
                    const newLogs = {};
                    entries.slice(0, 500).forEach(([k, v]) => { newLogs[k] = v; });
                    fs.writeFileSync(logPath, JSON.stringify(newLogs, null, 2));
                } else {
                    fs.writeFileSync(logPath, JSON.stringify(logs, null, 2));
                }
            } catch (e) {
                console.error(`[ENGINE] Failed to log unknown query:`, e.message);
            }
        }
    }

    function enforceThirdPerson(text, intent, domain) {
        if (!text) return '';
        const skipDomains = ['small_talk', 'entertainment', 'jokes', 'thanks', 'bye', 'facts', 'riddles'];
        if (skipDomains.includes(domain) || skipDomains.includes(intent)) return text;

        let processed = text;

        // Handle sentence fragments starting with adjectives (Identity case)
        if (/^[A-Z][a-z]+ (and|with) [a-z]+/.test(processed) && !processed.toLowerCase().startsWith("akhilesh") && !processed.toLowerCase().startsWith("he ")) {
            processed = "Akhilesh is a " + processed.charAt(0).toLowerCase() + processed.slice(1);
        }

        const replacements = [
            [/\bI am\b/g, "Akhilesh is"],
            [/\bI'm\b/gi, "Akhilesh is"],
            [/\bI have\b/g, "Akhilesh has"],
            [/\bI've\b/gi, "Akhilesh has"],
            [/\bI will\b/gi, "He will"],
            [/\bI'll\b/gi, "He will"],
            [/\bI would\b/gi, "He would"],
            [/\bI'd\b/gi, "He would"],
            [/\bI worked\b/g, "He worked"],
            [/\bI hold\b/g, "He holds"],
            [/\bI specialize\b/g, "He specializes"],
            [/\bI helped\b/g, "He helped"],
            [/\bI led\b/g, "He led"],
            [/\bI managed\b/g, "He managed"],
            [/\bI built\b/g, "He built"],
            [/\bI created\b/g, "He created"],
            [/\bI implemented\b/g, "He implemented"],
            [/\bI played\b/g, "He played"],
            [/\bMy\b/g, "His"],
            [/(?<![\/-])\bmy\b/g, "his"], // Ignore URLs/Paths
            [/(?<![\/-])\bme\b/g, "him"], // Ignore URLs/Paths
            [/\bI\b/g, "He"], // Catch-all for stray capital I
            [/\bi\b/g, "he"]   // Catch-all for stray lowercase i
        ];

        replacements.forEach(([regex, replacement]) => {
            processed = processed.replace(regex, replacement);
        });

        // Final cleanup: Fix double words or possessive artifacts
        processed = processed.replace(/\b(\w+)\s+\1\b/gi, "$1")
            .replace(/\bis His\b/gi, "is his")
            .replace(/\bHis his\b/gi, "His")
            .replace(/\bHe thrive\b/gi, "He thrives")
            .replace(/\bHe lead\b/gi, "He leads")
            .replace(/\bHe head\b/gi, "He heads")
            .replace(/\bHe manage\b/gi, "He manages")
            .replace(/\bHe build\b/gi, "He builds")
            .replace(/\bHe specialize\b/gi, "He specializes")
            .replace(/\bHe work\b/gi, "He works")
            .replace(/\bHe play\b/gi, "He plays")
            .replace(/\bHe contribute\b/gi, "He contributes")
            .replace(/\bHe help\b/gi, "He helps")
            .replace(/\bHe strengthen\b/gi, "He strengthens")
            .replace(/\bHe support\b/gi, "He supports")
            .replace(/\bHe focus\b/gi, "He focuses")
            .replace(/\bHe design\b/gi, "He designs")
            .replace(/\bHe develop\b/gi, "He develops")
            .replace(/\bHe drive\b/gi, "He drives")
            .replace(/\bHe mentor\b/gi, "He mentors")
            .replace(/#\w+/g, ""); // Remove hashtags

        return processed.trim();
    }

    function formatObject(item, domain = "") {
        if (!item || typeof item !== 'object') return String(item || "");

        // --- SUMMARY OBJECT FORMATTER (Iteration 16.7) ---
        // Checks for common list/summary keys to format human-friendly
        const summaryKeys = ['total_years_experience', 'companies_worked', 'career_progression', 'core_growth_areas',
            'primary_strengths', 'secondary_strengths', 'core_domains', 'recent_focus_areas', 'core_strengths_recognized'];

        const isSummary = Object.keys(item).some(k => summaryKeys.includes(k));
        if (isSummary) {
            return Object.entries(item)
                .filter(([k]) => summaryKeys.includes(k) || k.startsWith('total_'))
                .map(([k, v]) => {
                    const label = k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    const value = Array.isArray(v) ? v.join('\n  • ') : v;
                    return `🔹 **${label}**: ${Array.isArray(v) ? '\n  • ' + value : value}`;
                }).join('\n\n');
        }

        // --- DETAIL OBJECT FORMATTER (Experience/Pubs/Awards/Certs) ---
        const start = item.duration?.start || item.publication_date || item.issue_date || item.date || item.year || '';
        const end = item.duration?.end || '';
        const dateRange = (end && end !== 'Present') ? `${start} - ${end}` : (start || 'N/A');
        const role = item.role || item.title || item.name || 'Detail';
        const company = item.company || item.issuer || item.publisher || item.organization || item.institution;

        let output = `🔹 ${company ? company + ': ' : ''}${role}\n🗓️ Period: ${dateRange}\n\n`;

        if (item.bullet_points) output += item.bullet_points.map(b => '• ' + b).join('\n');
        else if (item.responsibilities) output += item.responsibilities.map(b => '• ' + b).join('\n');
        else if (item.description_raw) output += item.description_raw;
        else if (item.solution) output += `Solution: ${item.solution.join(' ')}`;
        else if (item.description) output += item.description;

        return output.trim();
    }

    function resolveResult(match, context, query = "") {
        // --- Narrative Synthesis Policy ---
        // INTENT GUARD: Delegating nuanced or complex queries to AI for grounded synthesis.
        // We allow deterministic bypass ONLY for very short, direct queries in protected domains.
        const PROTECTED_INTENTS = new Set(['small_talk', 'thanks', 'bye', 'resume_download', 'jokes', 'facts', 'riddles', 'identity', 'location', 'contact', 'why_hire', 'hiring_mentorship', 'experience_summary', 'experience_sap', 'experience_juniper', 'projects_summary', 'skills_core', 'capabilities']);
        
        const queryLength = (query || "").trim().split(/\s+/).length;
        const isNuanced = /\b(how|why|describe|explain|compare|opinion|fit|think|versus|vs|suitability|evaluate)\b/i.test(query || "");
        
        // Conditions to trigger AI Synthesis:
        // 1. The intent is not a "simple" protected FAQ
        // 2. The query is nuanced (uses How/Why/Fit etc.)
        // 3. The query is long enough to suggest a conversational need (> 5 words)
        const shouldSynthesize = match && (!PROTECTED_INTENTS.has(match.intent) || isNuanced || queryLength > 5);

        if (!context.silent && shouldSynthesize) {
            console.log(`[ENGINE] 🧠 Intelligence Triggered: Delegating ${match.intent} to AI Synthesis.`);
            context.useLLM = true;
        }

        let depth = context.depth || 0;
        const lQuery = query.toLowerCase().trim();

        // --- DOMAIN RESET (Iteration 15) ---
        // If we are deep in a domain but found a high-confidence match in A DIFFERENT domain, reset depth.
        if (depth > 0 && match.domain && context.lastDomain && match.domain !== context.lastDomain) {
            const trace = context.trace || {};
            if (trace.deterministic_score >= 800 || trace.path === 'ENTITY_MATCH' || trace.path === 'TECHNICAL_ANCHOR') {
                console.log(`[ENGINE] Domain Escape Triggered: ${context.lastDomain} -> ${match.domain}. Resetting depth.`);
                depth = 0;
            }
        }

        // DEPTH GUARD
        const guardedDomains = ['small_talk', 'jokes', 'thanks', 'bye', 'facts', 'riddles'];
        if (guardedDomains.includes(match.intent) || guardedDomains.includes(match.domain)) {
            if (depth > 1) depth = 1;
        }

        // --- VARIATION SEED (Iteration 18: Response Variety) ---
        if (match.intent === context.lastIntent) {
            context.variationSeed = (context.variationSeed || 0) + 1;
        } else {
            context.variationSeed = 0;
        }

        let finalAnswer = "";
        const variations = Array.isArray(match.answer) ? match.answer : [match.answer];
        
        // --- RANDOM VARIETY (User Feedback Iteration 26) ---
        // For Personality/Humor intents, use true randomization instead of sequential cycling
        const RANDOM_VARIETY_INTENTS = new Set(['jokes', 'riddles', 'facts', 'small_talk']);
        let variationIndex;
        if (RANDOM_VARIETY_INTENTS.has(match.intent) || RANDOM_VARIETY_INTENTS.has(match.domain)) {
            variationIndex = Math.floor(Math.random() * variations.length);
        } else {
            variationIndex = (context.variationSeed || 0) % variations.length;
        }
        
        const baseAnswer = variations[variationIndex];

        // --- SUB-RESOLUTION (Iteration 16: Role/Item Specific Search) ---
        if (match.domain === 'experience' && Array.isArray(match.details)) {
            const roleKeywords = [
                { key: 'intern', label: 'Intern' },
                { key: 'engineer 3', label: 'Engineer 3' },
                { key: 'se3', label: 'Engineer 3' },
                { key: 'engineer 2', label: 'Engineer 2' },
                { key: 'se2', label: 'Engineer 2' },
                { key: 'engineer 1', label: 'Engineer 1' },
                { key: 'se1', label: 'Engineer 1' },
                { key: 'cloud service specialist', label: 'Cloud Service Specialist' }
            ];

            for (const r of roleKeywords) {
                if (lQuery.includes(r.key)) {
                    const idx = match.details.findIndex(d => {
                        const searchTarget = (typeof d === 'string' ? d : (d.role || '')).toLowerCase();
                        return searchTarget.includes(r.label.toLowerCase());
                    });
                    if (idx !== -1) {
                        console.log(`[ENGINE] Sub-Resolution: Matched Role "${r.label}"`);
                        context.specificItemIndex = idx;
                        break;
                    }
                }
            }
        }

        // --- MULTI-MATCH DISAMBIGUATION (Iteration 16.7) ---
        if (context.multiMatchIndices && Array.isArray(match.details)) {
            const items = context.multiMatchIndices.map(idx => match.details[idx]).filter(Boolean);
            if (items.length > 0) {
                finalAnswer = `🔀 Found multiple records. Specify a year if you need more detail:\n\n` +
                    items.map(item => {
                        const name = item.role || item.title || item.name || "Item";
                        const date = item.duration?.start || item.issue_date || item.date || item.year || "";
                        const company = item.company || item.issuer || item.publisher || item.organization;
                        return `🔹 ${company ? company + ': ' : ''}${name}${date ? ' (' + date + ')' : ''}`;
                    }).join('\n\n');
                depth = 2;
                context.lastMultiMatchIndices = context.multiMatchIndices; // PERSIST for next turn selection
            }
            delete context.multiMatchIndices;
        }

        // --- SPECIFIC ITEM OVERRIDE (Iteration 16) ---
        if (context.specificItemIndex !== undefined && Array.isArray(match.details)) {
            const item = match.details[context.specificItemIndex];
            finalAnswer = formatObject(item, match.domain);
            depth = 2; // Treat as specific detail response
            delete context.specificItemIndex; // Consume it
        }

        // --- SYNERGY FILTERING BOOTSTRAP (Iteration 16.8) ---
        // If query contains a tech keyword and we are in a list domain, force depth 2 to show filtered list
        const listIntents = ['certifications', 'awards', 'projects_summary', 'experience_summary', 'publications_summary'];
        const techList = ['docker', 'kubernetes', 'helm', 'terraform', 'jenkins', 'aws', 'azure', 'gcp', 'sap', 'java', 'python'];
        const foundTech = techList.find(t => lQuery.includes(t));

        if (depth === 0 && foundTech && listIntents.includes(match.intent)) {
            console.log(`[ENGINE] Synergy Filtering Bootstrap: Forcing depth 2 for "${foundTech}" in ${match.intent}`);
            depth = 2;
        }

        // CHECK CACHE
        const cacheKey = `${match.intent}:${depth}`;
        const useCache = !_CACHE_BYPASS.has(match.domain) && !_CACHE_BYPASS.has(match.intent) && !finalAnswer;
        if (useCache && _responseCache.has(cacheKey)) {
            const cached = _responseCache.get(cacheKey);
            const updatedContext = {
                ...context,
                lastIntent: match.intent,
                lastDomain: match.domain,
                lastFollowUps: match.follow_up,
                depth,
                variationSeed: (context.variationSeed || 0) + 1
            };
            return { 
                ...cached, 
                candidates: cached.candidates || [], // Ensure candidates are returned from cache
                trace: context.trace, 
                updatedContext 
            };
        }

        if (!finalAnswer) {
            if (depth === 0) {
                finalAnswer = baseAnswer;
            } else if (depth === 1) {
                finalAnswer = match.deeper_answer || baseAnswer;
            } else if (depth === 2 && match.details) {
                if (Array.isArray(match.details)) {
                    // --- SYNERGY FILTERING (Iteration 16.8) ---
                    // If depth is 2/Detail view, filter the list by query keywords (e.g. "docker")
                    let filteredList = match.details;
                    const techList = ['docker', 'kubernetes', 'helm', 'terraform', 'jenkins', 'aws', 'azure', 'gcp', 'sap', 'java', 'python'];
                    const foundTech = techList.find(t => lQuery.includes(t));

                    if (foundTech) {
                        const keywordResults = match.details.filter(d => {
                            const searchable = JSON.stringify(d).toLowerCase();
                            return searchable.includes(foundTech);
                        });
                        if (keywordResults.length > 0) {
                            console.log(`[ENGINE] Synergy Filtering: Found ${keywordResults.length} items for "${foundTech}"`);
                            filteredList = keywordResults;
                        }
                    }

                    finalAnswer = filteredList.map(d => {
                        if (typeof d === 'object') {
                            const name = d.role || d.title || d.name || 'Detail';
                            const date = d.duration?.start || d.issue_date || d.date || d.year || "";
                            const company = d.company || d.issuer || d.publisher || d.organization;
                            return `🔹 ${company ? company + ': ' : ''}${name}${date ? ' (' + date + ')' : ''}`;
                        }
                        return d;
                    }).join('\n\n');
                } else {
                    finalAnswer = formatObject(match.details, match.domain);
                }
            }
        }

        if (!finalAnswer) {
            finalAnswer = "That's everything Akhilesh has on this. What else would you like to explore?";
            depth = 3;
        }

        // Confidence Tone Adjustments
        if (context.trace?.confidence_bucket === 'MEDIUM' && context.matcher === 'ml' && depth === 0) {
            finalAnswer = "Based on your query, here is what seems most relevant: " + finalAnswer;
        }

        finalAnswer = enforceThirdPerson(finalAnswer, match.intent, match.domain);

        const updatedContext = {
            ...context,
            lastIntent: match.intent,
            lastDomain: match.domain,
            lastFollowUps: match.follow_up,
            depth,
            variationSeed: (context.variationSeed || 0) + 1
        };

        // --- CANDIDATE EXTRACTION (Iteration 27: Grounding Stabilization) ---
        // Ensure that whenever the AI is triggered, it has the full factual context of the matched intent.
        let candidates = [];
        if (match.details) {
            if (Array.isArray(match.details)) {
                candidates = match.details.map(d => ({
                    intent: match.intent,
                    domain: match.domain,
                    content: typeof d === 'object' ? formatObject(d, match.domain) : String(d)
                }));
            } else {
                candidates = [{
                    intent: match.intent,
                    domain: match.domain,
                    content: formatObject(match.details, match.domain)
                }];
            }
        }
        
        // Fallback: If no structured details, use the sanitized answer as a candidate
        if (candidates.length === 0 && finalAnswer) {
            candidates = [{
                intent: match.intent,
                domain: match.domain,
                content: sanitize(finalAnswer)
            }];
        }

        const result = {
            intent: match.intent,
            domain: match.domain,
            answer: sanitize(finalAnswer),
            follow_up: match.follow_up,
            suggestions: match.suggestions,
            candidates, // NEW: Standardized Grounding Context
            isDetailed: depth > 0,
            isMultiIntent: context.trace?.path === 'MULTI_INTENT_MERGE' || !!context.multiIntents,
            matcher: context.matcher || 'deterministic',
            trace: context.trace,
            useLLM: updatedContext.useLLM || false,
            updatedContext
        };

        // STORE IN CACHE
        if (useCache) {
            _responseCache.set(cacheKey, {
                intent: result.intent,
                domain: result.domain,
                answer: result.answer,
                follow_up: result.follow_up,
                suggestions: result.suggestions,
                candidates: result.candidates, // Cache the grounding context
                isDetailed: result.isDetailed
            });
        }

        return result;
    }

    const DOMAIN_FOLLOWUP_MAP = {
        'experience': ['Show Skills', 'View Projects', 'Download Resume', 'Tech Stack'],
        'skills': ['Cloud Projects', 'Certifications', 'Experience', 'Contact Info'],
        'projects': ['Tech Stack', 'CI/CD details', 'Work History', 'Hire Him'],
        'identity': ['Experience', 'Skills', 'Projects', 'Contact'],
        'contact': ['Download Resume', 'LinkedIn', 'GitHub', 'Hire Him'],
        'certifications': ['Skills', 'Cloud Projects', 'Experience', 'Contact'],
        'small_talk': ['About Akhilesh', 'Experience', 'Skills', 'Projects'],
        'analytics': ['Who is he?', 'Main Skills', 'Projects', 'Contact']
    };

    function generateFollowUpChips(domain, intent, context = {}) {
        let chips = DOMAIN_FOLLOWUP_MAP[domain] || ['Experience', 'Skills', 'Projects', 'Contact'];
        if (context && context.userMode === 'recruiter') {
            chips = ['Download Resume', 'Contact Details', 'Hiring Fit', 'Main Skills'];
        }
        return chips.sort(() => 0.5 - Math.random()).slice(0, 4);
    }

    return {
        normalize,
        findResponse,
        detectUserMode,
        detectMultiIntent,
        sanitize,
        enforceThirdPerson,
        generateFollowUpChips
    };
}));
