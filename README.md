# Akhilesh Angadi | Cloud & DevOps Portfolio

![Build Status](https://github.com/akhilangadi/My_Resume/actions/workflows/main_akhilesh-resume.yml/badge.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Azure](https://img.shields.io/badge/deployment-Azure%20F1-0089D6?logo=microsoft-azure)
![AI Intelligence](https://img.shields.io/badge/intelligence-Llama%203.2%20+%20Gemini-8A2BE2?logo=meta)
![Fidelity](https://img.shields.io/badge/fidelity-100%25-green?logo=checkmarx)

**Cloud & DevOps Engineer | SAP ECS | Kubernetes, Docker, CI/CD | MS in ITM (IIT Chicago)**

---

## 📋 Table of Contents
1. [🌟 Project Identity](#-project-identity)
2. [🧠 Architecture: The Hybrid Hub](#-architecture-the-hybrid-hub)
3. [🖥️ Site Directory](#%EF%B8%8F-site-directory)
4. [🚀 Core Features](#-core-features)
5. [🛠️ Technical Stack](#%EF%B8%8F-technical-stack)
6. [⚙️ Local Development](#%EF%B8%8F-local-development)
7. [🧪 QA & Quality Seals](#-qa--quality-seals)
8. [🚢 Deployment & CI/CD](#-deployment--cicd)
9. [🤝 Connect with Me](#-connect-with-me)

---

## 🌟 Project Identity
This platform is a **Self-Contained Intelligence Hub** engineered for the **Azure Free Tier (F1)**. It is designed to demonstrate high-fidelity system design by bridging deterministic career data with high-performance AI synthesis. The goal is to provide recruiters with an instantaneous, accurate, and interactive window into my professional journey.

---

## 🧠 Architecture: The Hybrid Hub
The system utilizes a sophisticated three-tier intelligence architecture to ensure 100% factual accuracy while maintaining human-like warmth:

### 1️⃣ Tier 1: The Deterministic Guard (The Shield)
- **Deterministic-First Matching**: Uses character trigrams and weighted anchors to resolve queries with <1ms latency.
- **Zero-Tolerance Phrase Shield**: Hardcoded exact-path routing for career facts (e.g., "What was your role at SAP?").
- **Anti-Hallucination Design**: Bypasses LLM reasoning for core factual claims.

### 2️⃣ Tier 2: Offline Intelligence (Private & Fast)
- **Engine**: **Llama 3.2 1B Instruct (4-bit ONNX)** via `Transformers.js`.
- **Privacy**: Runs fully in-browser/in-process on the Azure CPU—no external API calls for T2 queries.
- **Grounding**: Responses are strictly grounded in an automated technical registry generated from raw JSON data.

### 3️⃣ Tier 3: Cloud Synthesis (Hybrid Fallback)
- **Engine**: **Gemini 2.0 / 3.1 Flash-Lite** (via Secure Secret Injection).
- **Purpose**: Specialized in complex narrative synthesis, multi-turn disambiguation, and career cross-referencing.
- **Rotation**: Model-agnostic fallback ensures availability even under free-tier quota constraints.

---

## 🖥️ Site Directory
The portfolio is meticulously organized into specialized data-driven views:

| Section | Route | Purpose | Features |
| :--- | :--- | :--- | :--- |
| **Home** | `/` | Entry Hub | Profile headline, quick summary, and global AI Chatbot. |
| **About** | `/personal-details` | Narrative | Career philosophy, biography, and personal mission statement. |
| **Experience** | `/education-work` | Professional | Career roadmap (SAP, Juniper) with roles & impact. |
| **Skills** | `/my-skills` | Technical | Interactive Charts (Radar/Bar) with proficiency tracking. |
| **Projects** | `/my-works` | Innovation | Deep-dives into IoT, Automation, and CI/CD projects. |
| **Education** | `/education` | Academic | MS from IIT Chicago and BE from SDMCET Dharwad. |
| **Certs** | `/certifications` | Credibility | CKA, Cloud, and Professional Certifications. |
| **Awards** | `/honors-awards` | Recognition | Patents, SAP Appreciations, and Juniper Spot Awards. |
| **Research** | `/publications` | Thought | Published papers in Networking and Distributed Systems. |
| **Testimonials**| `/recommendations` | Social | Recommendations from managers at Juniper and Microsoft. |
| **Contact** | `/contact-me`| Engagement | Direct connectivity with secure inbound proxy relay. |

---

## 🚀 Core Features
- **✨ Intelligent Grounding**: Automated harvester (`update-summary.js`) that converts raw JSON datasets into LLM-ready context snapshots.
- **📈 Intelligence Dashboard**: Real-time metrics tracking bot accuracy, engine mix (Deterministic vs AI), and persona integrity.
- **🛡️ Persona Lockdown**: Multi-layered filters enforcing a consistent 3rd-person professional narrative.
- **⚡ AI Warmup Lifecycle**: Automated build-time weight optimization for the Llama core to prevent production cold-starts.
- **🎨 Glassmorphic UI**: High-fidelity vanilla CSS design with interactive radar charts and mobile-responsive layouts.
- **🛎️ Recruiter FAB**: Dynamic interaction triggers for high-value audit queries and recruiter-specific workflows.

---

## 🛠️ Technical Stack
- **Backend & Logic**: Node.js, Express.js, EJS Templating
- **Intelligence Core**: `Transformers.js` (Llama 3.2 1B) & `Google Generative AI` (Gemini)
- **Data Engine**: Data-driven JSON architecture for 1-to-1 grounding accuracy.
- **Frontend Design**: Vanilla CSS (Glassmorphism), Chart.js (Interactive Metrics)
- **Quality Assurance**: `Playwright` (End-to-End), `Master Audit Suite` (Intelligence)
- **DevOps**: GitHub Actions (CI/CD), Azure App Service (F1 Hosting)

---

## ⚙️ Local Development

### 1. Installation
```bash
npm install
```

### 2. Configure Environment
Add `GEMINI_API_KEY` to your local `.env` file for Hybrid fallback.

### 3. Warm up the AI Model
Triggers the download of the 4-bit ONNX weights to the `models/` directory:
```bash
npm run warmup
```

### 4. Run Development Server
```bash
npm start
```

---

## 🧪 QA & Quality Seals

- **Master Test Suite**: `npm test` - Validates route health and master intent mapping.
- **High-Fidelity Audit**: `npm run test:audit` - Executes a **400-query stress test**.
  - **Status**: ✅ **100.00% Fidelity** (Verified 2026-04-10).
- **Sanity Sweep**: `npm run test:sanity` - Browser-level validation for mobile responsiveness and UI state sync.

---

## 🚢 Deployment & CI/CD
1. **Validation**: Test failures on the master branch prevent deployment.
2. **Secret Injection**: Keys are securely injected during the GitHub Actions build cycle.
3. **Model Pre-Caching**: Weights are bundled during build to ensure "Zero-Second" cold starts on Azure.

---

## 🤝 Connect with Me
- **LinkedIn**: [linkedin.com/in/akhilesh-angadi](https://linkedin.com/in/akhilesh-angadi)
- **GitHub**: [github.com/akhileshangadi](https://github.com/akhileshangadi)
- **Portfolio**: [akhilesh-resume.azurewebsites.net](https://akhilesh-resume.azurewebsites.net)

---
© 2026 Akhilesh Angadi. Engineered with high-fidelity intelligence.
