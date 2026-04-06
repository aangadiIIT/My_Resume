/**
 * Intent Registry (Staff+ v13) - Single Source of Truth
 */
module.exports = {
    intents: {
        "resume_download": {
            domain: "resume",
            priority: 5000,
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
            canonical_questions: ["contact", "how to contact him", "reach him", "email address", "phone number"]
        },
        "location": {
            domain: "contact",
            priority: 5000,
            data_query: "profile:location",
            canonical_questions: ["location", "address", "where is he located", "where does he live", "current city", "which city"]
        },
        "linkedin": {
            domain: "contact",
            priority: 5000,
            data_query: "profile:linkedin",
            canonical_questions: ["linkedin", "linkedin profile", "linkedin link"]
        },
        "github": {
            domain: "contact",
            priority: 5000,
            data_query: "profile:github",
            canonical_questions: ["github", "github profile", "source code", "git profile"]
        },
        "contact": {
            domain: "contact",
            priority: 4000,
            data_query: "profile:contact",
            follow_up: [
                { text: "Feedback", intent: "feedback" },
                { text: "LinkedIn", intent: "linkedin" }
            ],
            canonical_questions: ["contact", "how to reach him", "get in touch", "phone number", "reach out", "email address"]
        },
        "feedback": {
            domain: "contact",
            priority: 5000,
            data_query: "bot_responses:feedback",
            follow_up: [
                { text: "Contact Form", intent: "contact" },
                { text: "Career Summary", intent: "experience_summary" }
            ],
            canonical_questions: ["how to give feedback", "give feedback", "send feedback", "contact form", "how to message him", "message him", "complaint", "suggestion"]
        },
        "headline": {
            domain: "identity",
            priority: 3000,
            data_query: "profile:headline",
            canonical_questions: ["headline", "title", "what is his role", "professional summary", "about work"]
        },
        "identity": {
            domain: "identity",
            priority: 2000,
            data_query: "profile:about",
            follow_up: [
                { text: "Show Skills", intent: "skills_summary" },
                { text: "Career History", intent: "experience_summary" }
            ],
            canonical_questions: ["who are you", "your name", "identity", "who is he", "biography", "background", "akhilesh", "about this bot", "persona", "age", "height"],
            negatives: ["resume", "projects", "download", "email"]
        },
        "capabilities": {
            domain: "identity",
            priority: 3000,
            data_query: "profile:about_structured:core_domains",
            follow_up: [
                { text: "Experience", intent: "experience_summary" },
                { text: "Contact", intent: "contact" }
            ],
            canonical_questions: ["what can you do", "features", "capabilities", "bot power"],
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
            canonical_questions: ["sap", "sap experience", "what did he do at sap", "his role at sap", "sap achievements", "sap gardener", "sap ecs", "it cloud service specialist", "cloud service specialist"]
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
        "experience_summary": {
            domain: "experience",
            priority: 2500,
            data_query: "experience:experience_summary",
            follow_up: [
                { text: "SAP Work", intent: "experience_sap" },
                { text: "Juniper Work", intent: "experience_juniper" }
            ],
            canonical_questions: ["experience highlights", "career summary", "work experience", "career highlights", "professional background", "experience summary", "work history"],
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
            priority: 3500,
            data_query: "skills:skill_summary",
            follow_up: [
                { text: "Backend Skills", intent: "skills_backend" },
                { text: "DevOps Skills", intent: "skills_devops" }
            ],
            canonical_questions: ["skills", "tech stack", "tools", "what can he do", "technical expertise", "what are his skills", "all skills", "skill summary", "technical background", "skill details"]
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
            canonical_questions: ["recommendations", "testimonials", "what others say", "feedback from colleagues", "endorsements", "what did his manager say"]
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
            priority: 5500,
            data_query: "experience:experience_summary",
            follow_up: [
                { text: "Experience", intent: "experience_summary" },
                { text: "Recommendations", intent: "recommendations_summary" }
            ],
            canonical_questions: ["hiring", "interviewer", "mentor", "mentorship", "has he worked as interviewer", "did he take interviews", "hiring initiatives", "recruitment", "onboarding interns", "guide interns"]
        },
        "education": {
            domain: "education",
            priority: 3000,
            data_query: "education:education",
            follow_up: [
                { text: "Masters Degree", intent: "education_masters" },
                { text: "Bachelors Degree", intent: "education_bachelors" }
            ],
            canonical_questions: ["education", "degree", "university", "college", "academic background", "where did he study", "graduation", "education details"]
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
            priority: 6000,
            data_query: "certifications:certifications",
            follow_up: [
                { text: "Education", intent: "education" },
                { text: "Experience", intent: "experience_summary" }
            ],
            canonical_questions: ["certifications", "certificates", "courses", "badges", "learning badges", "certified", "credentials", "exam", "how many certifications", "total certifications", "list his certifications"]
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
            priority: 1000,
            data_query: "awards:awards",
            follow_up: [
                { text: "Recommendations", intent: "recommendations_summary" },
                { text: "Experience", intent: "experience_summary" }
            ],
            canonical_questions: ["awards", "honors", "achievements", "recognition", "medals", "awards he received", "how many awards", "total awards", "awards count"]
        },
        "projects_iot": {
            domain: "projects",
            priority: 2000,
            data_query: "projects:Water Monitoring",
            follow_up: [
                { text: "CI/CD Project", intent: "projects_cicd" },
                { text: "All Projects", intent: "projects_summary" }
            ],
            canonical_questions: ["iot project", "smart irrigation", "raspberry pi", "hardware project", "embedded systems project", "iot"]
        },
        "projects_cicd": {
            domain: "projects",
            priority: 2000,
            data_query: "projects:Pre-Commit",
            follow_up: [
                { text: "IoT Project", intent: "projects_iot" },
                { text: "DevOps Skills", intent: "skills_devops" }
            ],
            canonical_questions: ["cicd project", "automation script", "jenkins project", "github actions project", "devops project", "cicd"]
        },
        "projects_summary": {
            domain: "projects",
            priority: 3000,
            data_query: "projects:projects_summary",
            follow_up: [
                { text: "IoT Project", intent: "projects_iot" },
                { text: "CI/CD Project", intent: "projects_cicd" }
            ],
            canonical_questions: ["projects", "portfolio", "github", "what has he built", "work samples", "show me his work", "project summary", "all projects"]
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
        'my', 'your', 'please', 'tell', 'show', 'give', 'how', 'what', 'where', 'when', 'who', 'which',
        'actually', 'basically', 'literally', 'honestly', 'clearly', 'obviously', 'simply', 'just', 'kind', 'sort', 'maybe',
        'about', 'his', 'him', 'her', 'he', 'she', 'they', 'them', 'their', 'want', 'hear', 'talk', 'info', 'deal', 'say',
        'details', 'walk', 'through', 'track', 'record', 'impact', 'mention', 'specifics', 'brief'
    ],
    // Technical Anchors (Fast-Pass for high-value tokens)
    technical_anchors: {
        "kubernetes": "skills_devops", "k8s": "skills_devops", "docker": "skills_devops", "terraform": "skills_devops",
        "jenkins": "projects_cicd", "argocd": "skills_devops", "helm": "skills_devops",
        "sap": "experience_sap", "juniper": "experience_juniper", "networks": "experience_juniper",
        "aws": "skills_cloud", "azure": "skills_cloud", "gcp": "skills_cloud", "cloud": "skills_cloud",
        "react": "skills_frontend", "javascript": "skills_frontend", "js": "skills_frontend", "html": "skills_frontend", "css": "skills_frontend",
        "nodejs": "skills_backend", "golang": "skills_backend", "python": "skills_backend", "java": "skills_backend", "rest": "skills_backend",
        "certifications": "certifications", "certified": "certifications", "cka": "certifications_cka", "badges": "certifications",
        "publications": "publications_summary", "paper": "publications_summary", "journal": "publications_summary",
        "education": "education", "bachelors": "education_bachelors", "masters": "education_masters", "university": "education",
        "projects": "projects_summary", "iot": "projects_iot", "hardware": "projects_iot",
        "resume": "resume_download", "cv": "resume_download", "download": "resume_download",
        "contact": "contact", "email": "contact", "linkedin": "linkedin", "github": "github",
        "recommendations": "recommendations_summary", "manager": "recommendations_summary", "colleagues": "recommendations_summary",
        "strengths": "why_hire", "unique": "why_hire", "fit": "why_hire", "hire": "why_hire",
        "awards": "awards", "honors": "awards", "recognitions": "awards",
        "instructions": "capabilities", "capabilities": "capabilities", "features": "capabilities",
        "skills": "skills_summary", "experience": "experience_summary", "work": "experience_summary", "career": "experience_summary",
        "biography": "identity", "background": "identity", "identity": "identity",
        "age": "persona_private", "salary": "persona_private", "personal": "persona_private"
    },
    min_keyword_length: 2
};
