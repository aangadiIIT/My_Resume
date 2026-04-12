/**
 * Intent Registry: Multi-Domain Knowledge Graph Mapping
 */
module.exports = {
    intents: {
        "resume_download": {
            domain: "resume",
            priority: 3500,
            data_query: "profile:resume_link",
            follow_up: [
                { text: "View Projects", intent: "projects_summary" },
                { text: "Contact him", intent: "contact" }
            ],
            canonical_questions: ["download resume", "get resume", "view resume", "resume link", "cv download", "download cv", "get cv"]
        },
        "contact": {
            domain: "contact",
            priority: 4500,
            data_query: "profile:contact",
            follow_up: [
                { text: "LinkedIn Profile", intent: "linkedin" },
                { text: "Download Resume", intent: "resume_download" }
            ],
            canonical_questions: ["contact", "how to contact him", "reach him", "email address", "phone number", "get in touch"]
        },
        "location": {
            domain: "contact",
            priority: 3000,
            data_query: "profile:location",
            canonical_questions: ["location", "address", "where is he located", "where does he live", "current city", "which city"]
        },
        "linkedin": {
            domain: "contact",
            priority: 3000,
            data_query: "profile:linkedin",
            canonical_questions: ["linkedin", "linkedin profile", "linkedin link"]
        },
        "github": {
            domain: "contact",
            priority: 3000,
            data_query: "profile:github",
            canonical_questions: ["github", "github profile", "source code", "git profile"]
        },
        "feedback": {
            domain: "contact",
            priority: 3000,
            data_query: "bot_responses:feedback",
            follow_up: [
                { text: "Contact Form", intent: "contact" },
                { text: "Career Summary", intent: "experience_summary" }
            ],
            canonical_questions: ["how to give feedback", "give feedback", "send feedback", "contact form", "how to message him", "message him", "complaint", "suggestion"]
        },
        "headline": {
            domain: "identity",
            priority: 3800,
            data_query: "profile:headline",
            canonical_questions: ["headline", "title", "what is his professional title", "role summary", "what is his role", "professional summary"]
        },
        "identity": {
            domain: "identity",
            priority: 4000,
            data_query: "profile:about",
            follow_up: [
                { text: "Show Skills", intent: "skills_summary" },
                { text: "Career History", intent: "experience_summary" }
            ],
            canonical_questions: ["identity", "who is he", "biography", "background", "akhilesh", "profile", "bio", "about"],
            negatives: ["resume", "projects", "download", "email", "you"]
        },
        "bot_identity": {
            domain: "identity",
            priority: 1800,
            data_query: "bot_responses:bot_identity",
            follow_up: [
                { text: "How can you help?", intent: "bot_help" },
                { text: "Who is Akhilesh?", intent: "identity" }
            ],
            canonical_questions: ["who are you", "your name", "what are you", "who am i talking to", "what is your purpose", "about this bot", "persona"]
        },
        "bot_help": {
            domain: "identity",
            priority: 1800,
            data_query: "bot_responses:bot_help",
            follow_up: [
                { text: "Experience", intent: "experience_summary" },
                { text: "Why hire him?", intent: "why_hire" }
            ],
            canonical_questions: ["how can you help", "what can i ask you", "help me", "guide me", "what do you do", "bot help"]
        },
        "capabilities": {
            domain: "identity",
            priority: 3100,
            data_query: "profile:about_structured:core_domains",
            follow_up: [
                { text: "Experience", intent: "experience_summary" },
                { text: "Contact", intent: "contact" }
            ],
            canonical_questions: ["what can you do", "features", "capabilities", "bot power", "how to use", "how to use this bot", "bot guide", "bot functions"],
            negatives: ["resume", "contact", "linkedin", "publication", "project", "github", "award"]
        },
        "persona_private": {
            domain: "identity",
            priority: 5000,
            data_query: "bot_responses:persona_private",
            canonical_questions: ["age", "height", "eyes", "personal life", "private info", "salary", "pay", "income"]
        },
        "experience_sap": {
            domain: "experience",
            priority: 4500,
            data_query: "experience:SAP",
            follow_up: [
                { text: "Juniper Work", intent: "experience_juniper" },
                { text: "Cloud Skills", intent: "skills_cloud" }
            ],
            canonical_questions: ["sap", "sap experience", "what did he do at sap", "his role at sap", "sap achievements", "sap gardener", "sap ecs", "it cloud service specialist", "cloud service specialist", "current company", "current employer", "working now", "currently working", "current workplace", "where does he work now"]
        },
        "experience_juniper": {
            domain: "experience",
            priority: 4000,
            data_query: "experience:Juniper Networks",
            follow_up: [
                { text: "SAP Work", intent: "experience_sap" },
                { text: "Projects", intent: "projects_summary" }
            ],
            canonical_questions: ["juniper", "high performance", "juniper networks", "juniper experience", "networks role", "what did he do at juniper", "his role at juniper", "juniper achievements", "software engineer 3", "software engineer 2", "software engineer 1", "software engineer intern", "juniper se3", "juniper se2", "juniper se1", "juniper intern"]
        },
        "experience_previous": {
            domain: "experience",
            priority: 4300,
            data_query: "experience:Juniper Networks",
            follow_up: [
                { text: "Current Work", intent: "experience_sap" },
                { text: "Career Summary", intent: "experience_summary" }
            ],
            canonical_questions: ["previous employer", "past companies", "where did he work before", "earlier roles", "prior experience", "previously worked", "past company", "previous job", "whom did he work for before", "before sap", "prior to sap", "career before", "work history before"]
        },
        "experience_summary": {
            domain: "experience",
            priority: 4400,
            data_query: "experience:experience_summary",
            follow_up: [
                { text: "SAP Work", intent: "experience_sap" },
                { text: "Juniper Work", intent: "experience_juniper" }
            ],
            canonical_questions: ["experience highlights", "career summary", "work experience", "career highlights", "professional background", "experience summary", "work history", "timeline", "professional timeline", "career arc", "job history", "job", "previous", "earlier", "past", "history", "before", "prior"],
            negatives: ["kubernetes", "docker", "aws", "publication", "paper", "degree", "university", "award", "react", "golang", "python", "javascript", "cloud"]
        },
        "skills_devops": {
            domain: "skills",
            priority: 5000,
            data_query: "skills:categorized:cloud_devops",
            follow_up: [
                { text: "Cloud Skills", intent: "skills_cloud" },
                { text: "Projects", intent: "projects_summary" }
            ],
            canonical_questions: ["kubernetes", "k8s", "terraform", "docker", "devops", "helm", "devops skills", "does he know kubernetes", "does he know docker", "ci/cd", "infrastructure as code", "gitops", "pipelines", "argocd", "argo workflows", "gitops automation", "ansible"]
        },
        "skills_summary": {
            domain: "skills",
            priority: 4000,
            data_query: "skills:skill_summary",
            follow_up: [
                { text: "Backend Skills", intent: "skills_backend" },
                { text: "DevOps Skills", intent: "skills_devops" }
            ],
            canonical_questions: ["skills", "tech stack", "tools", "what can he do", "technical expertise", "what are his skills", "all skills", "skill summary", "technical background", "skill details", "tech list", "core competencies", "capabilities"],
            negatives: ["paper", "publication", "award", "certifications"]
        },
        "skills_cloud": {
            domain: "skills",
            priority: 4500,
            data_query: "skills:categorized:cloud_devops",
            follow_up: [
                { text: "DevOps", intent: "skills_devops" },
                { text: "Certifications", intent: "certifications" }
            ],
            canonical_questions: ["aws", "cloud", "azure", "google cloud", "cloud platforms", "public cloud", "cloud skills", "cloud tech"]
        },
        "skills_backend": {
            domain: "skills",
            priority: 4500,
            data_query: "skills:categorized:backend_development",
            follow_up: [
                { text: "Frontend Skills", intent: "skills_frontend" },
                { text: "AI Skills", intent: "skills_ai" }
            ],
            canonical_questions: ["backend", "python", "golang", "nodejs", "java", "databases", "api development", "server side", "rest api", "backend skills"]
        },
        "skills_frontend": {
            domain: "skills",
            priority: 4000,
            data_query: "skills:categorized:frontend_development",
            follow_up: [
                { text: "Backend Skills", intent: "skills_backend" },
                { text: "AI Skills", intent: "skills_ai" }
            ],
            canonical_questions: ["frontend", "js", "javascript", "react", "html", "css", "web development", "ui design", "ux design", "browser development", "frontend skills"]
        },
        "skills_ai": {
            domain: "skills",
            priority: 4500,
            data_query: "skills:categorized:ai_and_emerging",
            follow_up: [
                { text: "System Design", intent: "skills_system_design" },
                { text: "Projects", intent: "projects_summary" }
            ],
            canonical_questions: ["ai", "machine learning", "data science", "nlp", "llm", "generative ai", "prompt engineering", "ai skills"]
        },
        "skills_system_design": {
            domain: "skills",
            priority: 4500,
            data_query: "skills:categorized:system_design_architecture",
            follow_up: [
                { text: "Cloud Skills", intent: "skills_cloud" },
                { text: "DevOps Skills", intent: "skills_devops" }
            ],
            canonical_questions: ["system design", "architecture", "networking", "distributed systems", "scalable systems", "high availability", "design patterns", "system design skills"]
        },
        "skills_soft_skills": {
            domain: "skills",
            priority: 2500,
            data_query: "skills:categorized:soft_skills",
            follow_up: [
                { text: "Experience", intent: "experience_summary" },
                { text: "Recommendations", intent: "recommendations_summary" }
            ],
            canonical_questions: ["soft skills", "communication", "leadership", "problem solving", "mentorship", "teamwork", "collaboration"]
        },
        "publications_summary": {
            domain: "publications",
            priority: 5500,
            data_query: "publications:publications",
            follow_up: [
                { text: "Education", intent: "education" },
                { text: "Projects", intent: "projects_summary" }
            ],
            canonical_questions: ["publications", "research papers", "published work", "articles", "journals", "his paper", "what did he publish", "research journal", "technical paper"]
        },
        "recommendations_summary": {
            domain: "recommendations",
            priority: 4000,
            data_query: "recommendations:recommendations",
            follow_up: [
                { text: "Experience", intent: "experience_summary" },
                { text: "Awards", intent: "awards" }
            ],
            canonical_questions: ["recommendations", "testimonials", "what others say", "feedback from colleagues", "endorsements", "what did his manager say", "references"]
        },
        "languages_summary": {
            domain: "languages",
            priority: 4000,
            data_query: "languages:detailed",
            follow_up: [
                { text: "Contact him", intent: "contact" },
                { text: "About him", intent: "identity" }
            ],
            canonical_questions: ["languages", "what languages does he speak", "multilingual", "mother tongue", "speak English", "speak Hindi", "speak Kannada"]
        },
        "hiring_mentorship": {
            domain: "experience",
            priority: 4100,
            data_query: "experience:experience_summary",
            follow_up: [
                { text: "Experience", intent: "experience_summary" },
                { text: "Recommendations", intent: "recommendations_summary" }
            ],
            canonical_questions: ["hiring", "interviewer", "mentor", "mentorship", "has he worked as interviewer", "did he take interviews", "hiring initiatives", "recruitment", "onboarding interns", "guide interns", "award for hiring"]
        },
        "education": {
            domain: "education",
            priority: 3000,
            data_query: "education:education",
            follow_up: [
                { text: "Masters Degree", intent: "education_masters" },
                { text: "Bachelors Degree", intent: "education_bachelors" }
            ],
            canonical_questions: ["education", "degree", "university", "college", "academic background", "where did he study", "graduation", "education details", "academic history", "qualifications"]
        },
        "education_bachelors": {
            domain: "education",
            priority: 4500,
            data_query: "education:bachelor",
            follow_up: [
                { text: "Masters Degree", intent: "education_masters" },
                { text: "Certifications", intent: "certifications" }
            ],
            canonical_questions: ["bachelors", "undergraduate", "college degree", "where did he do his bachelors", "what did he study for bachelors"]
        },
        "education_masters": {
            domain: "education",
            priority: 4500,
            data_query: "education:masters",
            follow_up: [
                { text: "Bachelors Degree", intent: "education_bachelors" },
                { text: "Certifications", intent: "certifications" }
            ],
            canonical_questions: ["masters", "ms", "grad school", "graduate degree", "where did he do his masters", "university studies"]
        },
        "certifications": {
            domain: "certifications",
            priority: 3500,
            data_query: "certifications:certifications",
            follow_up: [
                { text: "Education", intent: "education" },
                { text: "Experience", intent: "experience_summary" }
            ],
            canonical_questions: ["certifications", "certificates", "courses", "badges", "learning badges", "certified", "credentials", "exam", "how many certifications", "total certifications", "list his certifications", "licenses", "accreditations"]
        },
        "certifications_cka": {
            domain: "certifications",
            priority: 5000,
            data_query: "certifications:cka",
            follow_up: [
                { text: "Other Certs", intent: "certifications" },
                { text: "Skills Used", intent: "skills_devops" }
            ],
            canonical_questions: ["cka", "certified kubernetes administrator", "is he cka certified", "k8s certification"]
        },
        "awards": {
            domain: "awards",
            priority: 4000,
            data_query: "awards:awards",
            follow_up: [
                { text: "Recommendations", intent: "recommendations_summary" },
                { text: "Experience", intent: "experience_summary" }
            ],
            canonical_questions: ["awards", "honors", "achievements", "recognition", "medals", "awards he received", "how many awards", "total awards", "awards count", "notable achievements", "winner of", "recognized for"]
        },
        "projects_iot": {
            domain: "projects",
            priority: 3500,
            data_query: "projects:Water Monitoring",
            follow_up: [
                { text: "CI/CD Project", intent: "projects_cicd" },
                { text: "All Projects", intent: "projects_summary" }
            ],
            canonical_questions: ["iot project", "smart irrigation", "raspberry pi", "hardware project", "embedded systems project", "iot", "iot monitoring", "describe his iot project"]
        },
        "projects_cicd": {
            domain: "projects",
            priority: 4000,
            data_query: "projects:Pre-Commit",
            follow_up: [
                { text: "IoT Project", intent: "projects_iot" },
                { text: "DevOps Skills", intent: "skills_devops" }
            ],
            canonical_questions: ["cicd project", "automation script", "jenkins project", "github actions project", "devops project", "ci/cd project", "ci/cd", "cicd"]
        },
        "projects_summary": {
            domain: "projects",
            priority: 4400,
            data_query: "projects:projects_summary",
            follow_up: [
                { text: "IoT Project", intent: "projects_iot" },
                { text: "CI/CD Project", intent: "projects_cicd" }
            ],
            canonical_questions: ["projects", "portfolio", "github", "what has he built", "work samples", "show me his work", "project summary", "all projects", "work projects", "his work", "his portfolio", "engineering projects"]
        },
        "why_hire": {
            domain: "hire_role",
            priority: 1500,
            data_query: "bot_responses:hire_him_mode",
            follow_up: [
                { text: "📄 View Resume", intent: "resume_download" },
                { text: "🔗 LinkedIn", intent: "linkedin" },
                { text: "📬 Contact", intent: "contact" }
            ],
            canonical_questions: [
                "why hire him", "his strengths", "what makes him unique",
                "why should i hire him", "value proposition", "why hire",
                "is he a good fit", "fit for role", "should i hire",
                "what sets him apart", "his edge", "top candidate",
                "key strengths", "business value", "what does he bring",
                "hire me", "hire him", "is he a good candidate"
            ]
        },
        "small_talk": {
            domain: "small_talk",
            priority: 100,
            data_query: "bot_responses:small_talk",
            follow_up: [
                { text: "Capabilities", intent: "capabilities" },
                { text: "Experience", intent: "experience_summary" }
            ],
            canonical_questions: ["hi", "hello", "how are you", "hey", "greetings", "hi there", "hey there", "whats up", "yo", "hi bot", "symbolic_query", "next"]
        },
        "thanks": {
            domain: "small_talk",
            priority: 100,
            data_query: "bot_responses:thanks",
            follow_up: [
                { text: "Resume", intent: "resume_download" },
                { text: "Contact", intent: "contact" }
            ],
            canonical_questions: ["thanks", "thank you", "cheers", "awesome", "great", "cool", "helpful", "perfect", "good job", "thx"]
        },
        "bye": {
            domain: "small_talk",
            priority: 100,
            data_query: "bot_responses:bye",
            follow_up: [
                { text: "Wait!", intent: "identity" },
                { text: "Experience", intent: "experience_summary" }
            ],
            canonical_questions: ["bye", "goodbye", "see ya", "exit", "quit", "close", "stop", "ciao", "bye bye"]
        },
        "jokes": {
            domain: "entertainment",
            priority: 100,
            data_query: "bot_responses:jokes",
            follow_up: [
                { text: "Another Joke", intent: "jokes" },
                { text: "Riddle", intent: "riddles" }
            ],
            canonical_questions: ["joke", "funny", "laugh", "tell me a joke", "do you know any jokes", "another joke"]
        },
        "riddles": {
            domain: "entertainment",
            priority: 100,
            data_query: "bot_responses:riddles",
            follow_up: [
                { text: "Solution", intent: "riddles" },
                { text: "Joke", intent: "jokes" }
            ],
            canonical_questions: ["riddle", "puzzle", "brain teaser", "logic puzzle", "another riddle"]
        },
        "facts": {
            domain: "entertainment",
            priority: 100,
            data_query: "bot_responses:facts",
            follow_up: [
                { text: "Real Fact", intent: "facts" },
                { text: "Joke", intent: "jokes" }
            ],
            canonical_questions: ["tell me a fact", "fact", "fun fact", "trivia", "interesting fact", "another fact"]
        }
    },
    // Global Noise & Keywords to Reject
    noise: [
        'a', 'an', 'the', 'is', 'are', 'was', 'were', 'do', 'does', 'did',
        'of', 'in', 'on', 'at', 'by', 'for', 'with', 'from', 'to', 'me',
        'my', 'your', 'his', 'him', 'her', 'he', 'she', 'they', 'them', 'their', 'it',
        'please', 'tell', 'show', 'give', 'how', 'what', 'where', 'when', 'who', 'which',
        'actually', 'basically', 'literally', 'honestly', 'clearly', 'obviously', 'simply', 'just', 'kind', 'sort', 'maybe',
        'about', 'want', 'hear', 'talk', 'info', 'deal', 'say', 'show', 'me', 'get',
        'details', 'walk', 'through', 'track', 'record', 'impact', 'mention', 'specifics', 'brief'
    ],
    // Technical Anchors (Fast-Pass for high-value tokens)
    technical_anchors: {
        "kubernetes": "skills_devops", "k8s": "skills_devops", "docker": "skills_devops", "terraform": "skills_devops",
        "jenkins": "projects_cicd", "argocd": "skills_devops", "helm": "skills_devops",
        "cicd": "projects_cicd", "ci/cd": "projects_cicd", "pipeline": "projects_cicd", "ci": "projects_cicd", "cd": "projects_cicd",
        "sap": "experience_sap", "juniper": "experience_juniper", "networks": "experience_juniper",
        "aws": "skills_cloud", "azure": "skills_cloud", "gcp": "skills_cloud", "cloud": "skills_cloud",
        "react": "skills_frontend", "javascript": "skills_frontend", "js": "skills_frontend", "html": "skills_frontend", "css": "skills_frontend",
        "nodejs": "skills_backend", "golang": "skills_backend", "python": "skills_backend", "java": "skills_backend", "rest": "skills_backend",
        "certifications": "certifications", "certified": "certifications", "cka": "certifications_cka", "badges": "certifications",
        "publications": "publications_summary", "paper": "publications_summary", "journal": "publications_summary",
        "education": "education", "bachelors": "education_bachelors", "masters": "education_masters", "university": "education", "engineering": "education_bachelors", "b.e": "education_bachelors", "b.tech": "education_bachelors",
        "projects": "projects_summary", "iot": "projects_iot", "hardware": "projects_iot",
        "resume": "resume_download", "cv": "resume_download", "download": "resume_download",
        "contact": "contact", "email": "contact", "linkedin": "linkedin", "github": "github",
        "recommendations": "recommendations_summary", "manager": "recommendations_summary", "colleagues": "recommendations_summary",
        "strengths": "why_hire", "unique": "why_hire", "fit": "why_hire", "hire": "why_hire",
        "awards": "awards", "honors": "awards", "recognitions": "awards",
        "instructions": "bot_help", "capabilities": "skills_summary", "features": "capabilities",
        "skills": "skills_summary", "experience": "experience_summary", "work": "experience_summary", "career": "experience_summary",
        "biography": "identity", "background": "identity", "identity": "identity", "profile": "identity",
        "role": "headline", "title": "headline", "position": "headline",
        "age": "persona_private", "salary": "persona_private", "personal": "persona_private",
        "persona": "bot_identity", "bot": "bot_identity",
        "current": "experience_sap", "present": "experience_sap", "employer": "experience_sap", "now": "experience_sap",
        "workplace": "experience_sap", "currently": "experience_sap", "working": "experience_sap", "latest": "experience_sap",
        "previous": "experience_summary", "past": "experience_summary", "earlier": "experience_summary", "before": "experience_summary", "previously": "experience_summary", "prior": "experience_summary",
        "timeline": "experience_summary", "history": "experience_summary",
        "academic": "education", "qualifications": "education", "gpa": "education", "cgpa": "education",
        "list": "skills_summary", "tech": "skills_summary", "tools": "skills_summary", "capabilities": "skills_summary",
        "working": "experience_sap", "present": "experience_sap", "touch": "contact"
    },
    min_keyword_length: 2
};
