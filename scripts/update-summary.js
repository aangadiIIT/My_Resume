const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const registry = require('./intent-registry');
const ChatbotEngine = require('../public/scripts/chatbot-engine');
const MLIntentMatcher = require('../public/scripts/ml-intent-matcher');

const dataDir = path.join(__dirname, '..', 'secure_assets', 'data');
const outputDir = path.join(__dirname, '..', 'public', 'data');
const outputFile = path.join(outputDir, 'summary.json');
const statsFile = path.join(outputDir, 'stats.json');
const testSuitePath = path.join(__dirname, '..', 'chatbot_test_suite_cleaned.json');

function loadAllData() {
    const data = {};
    const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));
    files.forEach(file => {
        const key = file.replace('.json', '');
        try {
            data[key] = JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'));
        } catch (e) {
            console.error(`[CRITICAL] Error parsing ${file}:`, e.message);
        }
    });
    return data;
}

function generateVariations(baseData, intent) {
    const variations = [];
    const { answer, deeper_answer } = baseData;

    // Strip known auto-generated label prefixes before embedding in templates
    const cleanAnswer = (answer || '')
        .replace(/^Relevant tools:\s*/i, '')
        .replace(/^His primary strengths are\s*/i, '')
        .replace(/^Project:\s*/i, '')
        .replace(/^He is a\s*/i, 'He is a ')
        .trim();

    // Fixed variations for professional intents
    if (intent.includes('skills')) {
        variations.push(`His technical expertise includes: ${cleanAnswer}`);
        variations.push(`Akhilesh specializes in several technologies, including ${cleanAnswer}`);
        variations.push(`Here is a look at his technical stack: ${cleanAnswer}`);
    } else if (intent.includes('experience')) {
        variations.push(`Regarding his professional background: ${cleanAnswer}`);
        variations.push(`Akhilesh has worked extensively in this area. ${cleanAnswer}`);
        variations.push(`His career highlights include: ${cleanAnswer}`);
    } else if (intent.includes('project')) {
        variations.push(`Here is a project he built: ${cleanAnswer}`);
        variations.push(`One of his notable works is: ${cleanAnswer}`);
        variations.push(`Check out this project detail: ${cleanAnswer}`);
    } else {
         // Generic variations
         const lowerStart = cleanAnswer.replace(/^He\b/, 'he').replace(/^His\b/, 'his');
         variations.push(answer);
         variations.push(`Sure, here is the information: ${lowerStart}`);
         variations.push(`Regarding ${intent.replace(/_/g, ' ')}, ${lowerStart}`);
    }

    return variations;
}

function convertToReadable(details, domain) {
    if (!details) return null;
    
    // Recursive formatter for nested objects - HUMAN FRIENDLY
    const formatValue = (v) => {
        if (v === null || v === undefined) return '';
        if (Array.isArray(v)) return v.join(', ');
        if (typeof v === 'object') {
            return Object.entries(v)
                .filter(([ki]) => !['icon', 'id', 'link'].includes(ki))
                .map(([ki, vi]) => formatValue(vi))
                .filter(s => s.length > 0)
                .join('. ');
        }
        return String(v);
    };

    // Handle Arrays (Education, Certifications, etc.)
    if (Array.isArray(details)) {
        return details.map(item => {
            if (domain === 'education') return `🎓 ${item.degree}\n${item.institution} (${item.duration?.start || ''} - ${item.duration?.end || ''})\nGrade: ${item.gpa || 'N/A'}`;
            if (domain === 'certifications') return `📜 ${item.name}\nIssued by ${item.issuer} in ${item.issue_date}`;
            if (domain === 'awards') return `🏆 ${item.title}\nRecognized by ${item.issuer} (${item.date})`;
            if (domain === 'projects') return `🚀 ${item.title}\n${item.organization}\n${item.description_raw?.slice(0, 200)}...`;
            if (domain === 'publications') return `📝 ${item.title}\nPublished in ${item.journal} (${item.date})`;
            if (domain === 'recommendations') return `💬 Recommendation from ${item.author?.name || 'a colleague'}\n"${item.recommendation_raw?.slice(0, 200)}..."`;
            return `• ${typeof item === 'string' ? item : formatValue(item)}`;
        }).join('\n\n');
    }

    // Handle Objects (Experience entries, Profile contact, Identity)
    if (typeof details === 'object' && details !== null) {
        // Specialty handling for identity/about
        if (domain === 'identity' && details.summary) {
            return details.summary;
        }

        const keys = Object.keys(details).filter(k => !['description_raw', 'id', 'intent', 'about_raw', 'about_structured', 'core_domains', 'icon', 'link', 'summary'].includes(k));
        
        let output = "";
        output += keys.map(k => {
            const val = details[k];
            const label = k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, ' ');
            
            if (typeof val === 'object' && val !== null) {
                if (k === 'duration') return `🗓️ Period: ${val.start} to ${val.end}`;
                if (k === 'skills_used') return `🛠️ Skills: ${val.join(', ')}`;
                if (Array.isArray(val)) {
                    return `🔹 ${label}:\n` + val.map(v => `  - ${formatValue(v)}`).join('\n');
                }
                return `🔹 ${label}: ${formatValue(val)}`;
            }
            return `🔹 ${label}: ${val}`;
        }).filter(s => s.length > 0).join('\n');
        
        return output;
    }

    return String(details);
}

function queryData(query, allData) {
    if (!query) return null;
    const parts = query.split(':');
    const [file, value, sub] = parts;
    const source = allData[file];
    
    if (!source) {
        console.warn(`[STRICT] Data Source Missing: ${file}`);
        return null;
    }

    // Identify domain for formatting
    const domainMap = {
        'education': 'education',
        'certifications': 'certifications',
        'awards': 'awards',
        'experience': 'experience',
        'skills': 'skills',
        'projects': 'projects',
        'publications': 'publications',
        'recommendations': 'recommendations',
        'languages': 'languages',
        'profile': 'contact'
    };
    const domain = domainMap[file] || 'general';

    // Logic for different file structures (same as before but we'll use convertToReadable later)
    let result = null;
    if (file === 'profile') {
        if (value === 'resume_link') result = { answer: "Akhilesh's resume can be downloaded here: /view-asset/documents/resume.pdf", deeper_answer: "The resume covers his 6+ years of experience in Cloud/DevOps, including his transition from Network Automation to Cloud Platform Engineering.", details: { link: "/view-asset/documents/resume.pdf" } };
        else if (value === 'contact') result = { answer: `He can be reached at ${source.profile.contact.email}.`, deeper_answer: `LinkedIn is the best place for professional inquiries. He is originally from ${source.profile.contact.location_hometown}.`, details: source.profile.contact };
        else if (value === 'location') result = { answer: `Akhilesh is based in ${source.profile.contact.location_current}.`, deeper_answer: `He is originally from ${source.profile.contact.location_hometown}.`, details: { current: source.profile.contact.location_current } };
        else if (value === 'linkedin') result = { answer: `You can find his professional profile on LinkedIn here: ${source.profile.social_links.linkedin}`, deeper_answer: "He is active on LinkedIn for professional networking.", details: { linkedin: source.profile.social_links.linkedin } };
        else if (value === 'github') result = { answer: `His open-source contributions and projects are available on GitHub: ${source.profile.social_links.github}`, deeper_answer: "He uses GitHub for personal and collaborative software projects.", details: { github: source.profile.social_links.github } };
        else if (value === 'headline') result = { answer: source.profile.headline, deeper_answer: source.profile.headline_raw, details: source.profile.headline_structured };
        else if (value === 'about') result = { answer: source.profile.about_structured.summary, deeper_answer: source.profile.about_raw, details: source.profile.about_structured };
        else if (value === 'about_structured' && sub) {
            const data = source.profile.about_structured[sub];
            if (data) {
                const text = Array.isArray(data) ? (typeof data[0] === 'string' ? data.join(', ') : data.map(i => i.title).join(', ')) : data;
                result = { answer: `Key highlights: ${text}`, deeper_answer: "I specialize in building scalable, future-ready systems with a focus on automation and reliability.", details: data };
            }
        }
    } else if (file === 'experience') {
        if (value === 'experience_summary') result = { answer: `Akhilesh has ${source.experience_summary.total_years_experience} of experience across ${source.experience_summary.companies_worked.join(' and ')}.`, deeper_answer: `His career progression: ${source.experience_summary.career_progression[0]}`, details: source.experience_summary };
        else {
            const companyRoles = (source.experience || []).filter(e => e.company === value);
            if (companyRoles.length > 0) {
                const entry = companyRoles[0]; // Latest
                const period = entry.period || (entry.duration ? `${entry.duration.start} - ${entry.duration.end}` : '');
                result = { 
                    answer: `He has worked as a ${entry.role} at ${entry.company} (${period}).`, 
                    deeper_answer: `He has 6+ years of experience including roles at SAP and Juniper Networks.`, 
                    details: companyRoles // ALL roles for sub-resolution
                };
            }
        }
    } else if (file === 'skills') {
        if (value === 'skill_summary') result = { answer: `His primary strengths are ${source.skills.skill_summary.primary_strengths.join(', ')}.`, deeper_answer: `He also has expertise in ${source.skills.skill_summary.secondary_strengths.join(', ')}.`, details: source.skills.skill_summary };
        else if (value === 'categorized' && sub) {
            const list = source.skills.categorized[sub];
            if (list) result = { answer: `Relevant tools: ${list.slice(0, 15).join(', ')}.`, deeper_answer: `He is proficient in various ${sub.replace(/_/g, ' ')} technologies including ${list.slice(0, 5).join(', ')}...`, details: list };
        }
    } else if (file === 'education' || file === 'certifications' || file === 'awards') {
        let list = source[file];
        if (file === 'education' && value !== 'education') {
            const v = value.toLowerCase();
            const specific = list.find(e => {
                const d = e.degree.toLowerCase();
                if (v === 'bachelor' || v === 'bachelors') return d.includes('bachelor');
                if (v === 'master' || v === 'masters') return d.includes('master');
                return d.includes(v);
            });
            if (specific) list = [specific];
        }
        if (file === 'certifications' && value !== 'certifications') {
            const v = value.toLowerCase();
            const specific = list.find(c => {
                const n = c.name.toLowerCase();
                // Use regex for cka to be safe
                if (v === 'cka') return /\(cka\)/i.test(n) || /certified kubernetes administrator/i.test(n);
                return n.includes(v);
            });
            if (specific) {
                // console.log(`[DEBUG] Found specific cert for ${v}: ${specific.name}`);
                list = [specific];
            } else {
                // console.log(`[DEBUG] NO specific cert found for ${v}. Original count: ${list.length}`);
            }
        }
        
        if (list && list.length > 0) {
            if (file === 'education') result = { answer: `He holds a ${list[0].degree} in ${list[0].field_of_study} from ${list[0].institution}.`, deeper_answer: list[0].description_raw, details: list };
            else if (file === 'certifications') {
                const count = source.certifications_summary.total_certifications;
                const top3 = list.slice(0, 3).map(c => c.name);
                const highlight = list.length === 1 ? list[0].name : top3.join(', ');
                result = { 
                    answer: value === 'certifications' ? `He holds ${count} professional certifications, including: ${highlight}.` : `He has a certification in ${highlight} from ${list[0]?.issuer || 'a professional body'}.`,
                    deeper_answer: `His certification focus includes ${source.certifications_summary.recent_focus_areas.join(', ')}.`, 
                    details: list 
                };
            }
            else if (file === 'awards') result = { answer: `He has received ${source.awards_summary.total_awards} awards, including recognition for ${source.awards_summary.core_strengths_recognized.slice(0, 3).join(' and ')}.`, deeper_answer: `Recognition milestones: ${source.awards_summary.core_strengths_recognized.join(', ')}.`, details: list };
        }
    } else if (file === 'projects') {
        if (value === 'projects_summary') result = { answer: `His portfolio includes ${source.projects_summary.total_projects} major projects in ${source.projects_summary.core_domains.join(', ')}.`, deeper_answer: `Notable highlight: ${source.projects_summary.highlight_project}.`, details: source.projects_summary };
        else {
            const entry = (source.projects || []).find(p => p.title.toLowerCase().includes(value.toLowerCase()));
            if (entry) result = { answer: `Project: ${entry.title}. Organization: ${entry.organization}.`, deeper_answer: entry.description_raw, details: entry };
        }
    } else if (file === 'publications') {
        const list = source.publications;
        if (list && list.length > 0) {
            const pub = list[0];
            const date = pub.publication_date || pub.date || 'unknown';
            result = { 
                answer: `Akhilesh has published ${source.publications_summary.total_publications} research paper: "${pub.title}".`, 
                deeper_answer: `Published in ${pub.journal} (${date}). ${pub.publication_type} detailing ${pub.research_domain.join(' and ')}.`, 
                details: list 
            };
        }
    } else if (file === 'recommendations') {
        const list = source.recommendations;
        if (list && list.length > 0) result = { answer: `He has received ${source.recommendations_summary.total_recommendations} professional recommendations from leaders at Juniper Networks and Microsoft.`, deeper_answer: `Common praise: ${source.recommendations_summary.common_strengths_across_recommendations.slice(0, 5).join(', ')}.`, details: list };
    } else if (file === 'languages') {
        const list = source.detailed;
        if (list) {
            const summaryText = list.map(l => `${l.language} (${l.proficiency})`).join(', ');
            result = { answer: `He is multilingual and speaks: ${summaryText}.`, deeper_answer: `Total languages: ${source.summary.total_languages}. Native in ${source.summary.primary_language}.`, details: source.detailed };
        }
    } else if (file === 'bot_responses') {
        const response = (source.responses || {})[value];
        if (response) {
            const ans = Array.isArray(response.answer) ? response.answer : [response.answer];
            result = { answer: ans, deeper_answer: response.deeper_answer, suggestions: response.suggestions, details: null };
        }
    }

    if (result) {
        const formatted = convertToReadable(result.details, domain);
        result.details_formatted = formatted ? formatted.replace(/#\w+/g, "") : null;
        return result;
    }

    console.warn(`[STRICT] No query mapping found for: ${query}`);
    return null;
}

function buildEntityRegistry(allData) {
    const registry = {};
    const domains = ['publications', 'certifications', 'awards', 'projects'];
    
    domains.forEach(domain => {
        const source = allData[domain];
        if (source && source[domain]) {
            source[domain].forEach((item, index) => {
                const title = (item.title || item.name || '').toLowerCase().trim();
                if (title) {
                    if (!registry[title]) {
                        registry[title] = { 
                            intent: domain === 'projects' ? 'projects_summary' : (domain === 'publications' ? 'publications_summary' : domain),
                            indices: [index],
                            type: domain 
                        };
                    } else {
                        // Multi-Match for duplicates (Iteration 16)
                        registry[title].indices.push(index);
                    }
                }
            });
        }
    });

    return registry;
}

function generateSummary() {
    console.log(`\n[STRICT] Generating 100% DATA-DRIVEN Knowledge Base...`);
    
    const allData = loadAllData();
    const summary = { 
        mappings: [], 
        all_data: allData, 
        entity_registry: buildEntityRegistry(allData),
        timestamp: new Date().toISOString(), 
        entropy_map: {},
        phrase_anchors: {}, 
        technical_anchors: {} 
    };
    const newTestSuite = [];
    
    // 1. Calculate keyword frequencies across all intents
    const globalWordCounts = {};
    Object.entries(registry.intents).forEach(([intent, meta]) => {
        meta.canonical_questions.forEach(q => {
            const normalizedQ = ChatbotEngine.normalize(q);
            const words = new Set(normalizedQ.split(/\s+/).filter(w => w.length >= registry.min_keyword_length && !registry.noise.includes(w)));
            words.forEach(w => {
                globalWordCounts[w] = (globalWordCounts[w] || 0) + 1;
            });
        });
    });
    summary.entropy_map = globalWordCounts;

    // 2. Pre-calculate Rarity Weights (EWS)
    const keywordWeights = {};
    Object.keys(globalWordCounts).forEach(w => {
        // More specific words (lower frequency) get higher weight
        keywordWeights[w] = 1000 / globalWordCounts[w];
    });
    summary.keyword_weights = keywordWeights;

    const phraseAnchors = {};
    Object.entries(registry.intents).forEach(([intent, meta]) => {
        meta.canonical_questions.forEach(q => {
            const words = ChatbotEngine.normalize(q).split(/\s+/).filter(w => w.length > 0);
            if (words.length >= 2) {
                const phrase = words.join(' ');
                // Only anchor if it contains at least one rare word (weight > 400)
                const hasSpecificWord = words.some(w => keywordWeights[w] > 400); 
                if (hasSpecificWord) {
                    if (!phraseAnchors[phrase]) phraseAnchors[phrase] = [];
                    phraseAnchors[phrase].push(intent);
                }
            }
        });
    });
    summary.phrase_anchors = phraseAnchors;
    summary.technical_anchors = registry.technical_anchors;

    Object.entries(registry.intents).forEach(([intent, meta]) => {
        const result = queryData(meta.data_query, allData);
        if (!result) {
            console.error(`❌ [FAILURE] No data found for intent: ${intent} (Query: ${meta.data_query})`);
            return;
        }

        // Variation logic
        const answers = Array.isArray(result.answer) ? result.answer : generateVariations(result, intent);

        const mapping = {
            id: `staff_${crypto.createHash('md5').update(intent).digest('hex').slice(0,8)}`,
            intent: intent,
            domain: meta.domain,
            priority: meta.priority,
            exact_questions: meta.canonical_questions,
            keywords: Array.from(meta.canonical_questions.reduce((acc, q) => {
                const normalizedQ = ChatbotEngine.normalize(q);
                normalizedQ.split(/\s+/).forEach(w => {
                    if (w.length >= registry.min_keyword_length && !registry.noise.includes(w)) {
                        const weight = q.includes(w) ? 1.5 : 1.0; // Boost weight if it's a primary word
                        if (!acc.has(w) || acc.get(w) < weight) acc.set(w, weight);
                    }
                });
                return acc;
            }, new Map())).map(([text, weight]) => ({ text, weight })),
            answer: answers, // Stores array of variations
            deeper_answer: result.deeper_answer,
            details: result.details, // Keep raw array/object for Iteration 16 engine
            details_formatted: result.details_formatted, // Keep for legacy UI if needed
            suggestions: result.suggestions || meta.suggestions || [],
            follow_up: meta.follow_up || [],
            // High Entropy = Rare word (appears in <= 10 intents)
            high_entropy_keywords: Array.from(meta.canonical_questions.reduce((acc, q) => {
                const normalizedQ = ChatbotEngine.normalize(q);
                normalizedQ.split(/\s+/).forEach(w => {
                    if (w.length >= registry.min_keyword_length && !registry.noise.includes(w)) {
                        if (globalWordCounts[w] <= 10) acc.add(w);
                    }
                });
                return acc;
            }, new Set())),
            // EWS Weights for this intent's keywords
            weights: meta.canonical_questions.reduce((acc, q) => {
                const normalizedQ = ChatbotEngine.normalize(q);
                normalizedQ.split(/\s+/).forEach(w => {
                    if (w.length >= registry.min_keyword_length && !registry.noise.includes(w)) {
                        acc[w] = (keywordWeights[w] || 1.0);
                    }
                });
                return acc;
            }, {}),
            phrases: meta.canonical_questions.filter(q => q.split(/\s+/).length >= 2).map(q => ChatbotEngine.normalize(q)),
            // Pre-calculate ML vectors for trigram matching
            ml_vectors: meta.canonical_questions.map(q => MLIntentMatcher.vectorize(q)),
            negatives: meta.negatives || []
        };

        summary.mappings.push(mapping);
        console.log(`✅ [SUCCESS] Mapped: ${intent} -> ${answers.length} variations`);

        // Build Test Suite Variations
        meta.canonical_questions.forEach(q => {
            newTestSuite.push({
                intent: intent,
                domain: meta.domain,
                question: q,
                answer: answers[0], // Test against the first variation
                follow_up: mapping.follow_up
            });
        });
    });

    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(outputFile, JSON.stringify(summary, null, 2));
    fs.writeFileSync(testSuitePath, JSON.stringify(newTestSuite, null, 2));

    console.log(`\n🔥 Knowledge Base & Test Suite Generated.`);
    console.log(`📊 Total Mappings: ${summary.mappings.length}`);
    console.log(`📊 Test Suite Size: ${newTestSuite.length}\n`);
}

generateSummary();
