# Akhilesh Angadi | Cloud & DevOps Portfolio

![Build Status](https://github.com/aangadiIIT/My_Resume/actions/workflows/main_akhilesh-resume.yml/badge.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen?logo=node.js)
![AI Stack](https://img.shields.io/badge/AI-Gemini%207--model%20stack%20%2B%20Llama%203.2%201B-8A2BE2?logo=google)
![Express](https://img.shields.io/badge/express-5.x-000000?logo=express)
![Tests](https://img.shields.io/badge/tests-192%20passing-brightgreen)

---

## Overview

A production-grade Node.js/Express portfolio that serves as both a career showcase and a technical demonstration. The application implements a three-tier AI chat pipeline — deterministic matching, a seven-model Gemini cloud stack with per-model circuit breakers, and an offline Llama 3.2 1B ONNX fallback — to answer recruiter questions with zero hallucination on factual data. The app ships a full test suite (192 assertions across four runners), a JD-match scoring tool, a PWA service worker, and a clean modular architecture with thin `app.js` wiring (~55 lines) delegating to `config/`, `middleware/`, `routes/`, and `services/`.

**Live:** [akhilesh-resume.azurewebsites.net](https://akhilesh-resume.azurewebsites.net)

---

## Architecture — 3-Tier AI Pipeline

```
User query
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│  Tier 1 — Deterministic Guard                           │
│  Trigram + weighted-anchor matching, <1ms               │
│  Zero-tolerance exact-path routing for career facts     │
│  → Returns immediately if match confidence is high      │
└────────────────────────┬────────────────────────────────┘
                         │ (no match)
                         ▼
┌─────────────────────────────────────────────────────────┐
│  Tier 2 — Gemini Cloud  (services/ai/online.js)         │
│  7-model registry, tried in priority order:             │
│    1. gemini-3.5-flash      (v1beta, paid)              │
│    2. gemini-3.1-flash-lite (v1beta, paid)              │
│    3. gemini-2.5-flash-lite (v1beta, free)              │
│    4. gemini-2.5-flash      (v1beta, free)              │
│    5. gemini-2.5-pro        (v1beta, free)              │
│    6. gemini-2.0-flash-lite (v1,     free)              │
│    7. gemini-2.0-flash      (v1,     free)              │
│  Per-model circuit breakers (429/503/error cooldowns)   │
│  LRU dedup cache (5 000 entries, 30s TTL)               │
│  Startup discovery via live /v1beta/models API call     │
└────────────────────────┬────────────────────────────────┘
                         │ (all models in cooldown)
                         ▼
┌─────────────────────────────────────────────────────────┐
│  Tier 3 — Llama 3.2 1B Offline  (services/ai/offline)   │
│  4-bit ONNX via @huggingface/transformers               │
│  No external API call; grounded in JSON resume data     │
└─────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
My_Resume/
├── app.js                          # Thin wiring (~55 lines)
├── bin/www                         # HTTP server bootstrap
├── package.json
│
├── config/
│   └── index.js                    # All constants: TTLs, rate limits, form IDs
│
├── middleware/
│   ├── analytics.js                # Visitor tracking, res.locals injection
│   ├── rate-limits.js              # Per-endpoint express-rate-limit instances
│   └── security.js                 # Helmet (nonce CSP), compression, static serve
│
├── routes/
│   ├── assets.js                   # /view-asset/:category/:file (path-traversal-safe)
│   ├── chat.js                     # POST /chat  (SSE streaming)
│   ├── contact.js                  # POST /contact-me
│   ├── jd-match.js                 # POST /api/jd-match
│   ├── metrics.js                  # GET /api/site-metrics, GET /api/model-status
│   └── pages.js                    # All EJS page renders
│
├── services/
│   ├── ai/
│   │   ├── gemini-cache.js         # LRU dedup cache (5 000 entries)
│   │   ├── gemini-model-registry.js # 7-model stack + circuit breakers
│   │   ├── offline.js              # Llama 3.2 1B ONNX tier
│   │   ├── online.js               # Gemini cloud tier
│   │   ├── persona-scrubber.js     # Shared persona-enforcement filter
│   │   └── pipeline.js             # Orchestrates all three tiers
│   ├── form-submit.js              # Google Forms proxy
│   ├── jd-analyzer.js              # JD skill-match scoring
│   ├── llm-context.js              # Converts JSON data → LLM context snapshot
│   ├── resume-data.js              # JSON loader with 5-min LRU cache
│   └── stats-store.js              # In-process stats with 5s batch flush
│
├── utils/
│   └── validators.js               # Input validation helpers
│
├── scripts/
│   ├── update-summary.js           # Runs on `npm start`; writes summary.json
│   └── warmup-ai.js                # Downloads + optimizes ONNX weights
│
├── tests/
│   ├── unit-engine.js              # 73 unit tests (engine logic)
│   ├── sanity.js                   # 63 HTTP/supertest assertions
│   ├── chatbot-response-test.js    # 28 chatbot response tests
│   ├── ui-sanity.spec.js           # 28 Playwright end-to-end tests
│   ├── master-test.js              # Integration smoke suite
│   ├── core-bot-audit.js           # 400-query fidelity audit
│   └── regression.spec.js          # Playwright regression suite
│
├── views/                          # EJS templates
│   └── partials/                   # Shared components
│
├── public/
│   ├── scripts/                    # Client JS (chatbot-engine, command-palette, etc.)
│   ├── stylesheets/                # CSS (style, chatbot, components, toast)
│   ├── sw.js                       # Service worker (PWA offline caching)
│   ├── robots.txt
│   └── sitemap.xml
│
└── secure_assets/
    └── data/                       # profile.json, skills.json (authoritative resume data)
```

---

## Site Directory

| Page | Route | Description |
|---|---|---|
| Home | `/` | Entry hub with profile headline and AI chatbot |
| About | `/personal-details` | Biography, career philosophy, mission statement |
| Experience | `/experience` | Professional timeline (SAP ECS, Juniper) |
| Skills | `/my-skills` | Interactive radar/bar charts with proficiency tracking |
| Projects | `/my-works` | IoT, automation, and CI/CD project deep-dives |
| Education | `/education` | MS IIT Chicago, BE SDMCET Dharwad |
| Certifications | `/certifications` | CKA, cloud, and professional certs with PDF viewer |
| Awards | `/honors-awards` | Patents, SAP appreciations, Juniper Spot Awards |
| Publications | `/publications` | Research papers in networking and distributed systems |
| Recommendations | `/recommendations` | Manager testimonials (Juniper, Microsoft) |
| Contact | `/contact-me` | Secure Google Forms inbound proxy relay |
| For Recruiters | `/for-recruiters` | One-page hiring manager summary with direct CTAs |
| JD Match | `/jd-match` | Paste a job description, get instant skill match score |

---

## Technical Stack

| Category | Technology | Notes |
|---|---|---|
| Runtime | Node.js >= 20 | LTS; required by jsdom 29 and undici 7 transitive deps |
| Framework | Express 5 | Thin `app.js`; all logic in modules |
| Templating | EJS 6 | Full partial system; view cache enabled |
| AI — Cloud | `@google/generative-ai` | 7-model Gemini stack, circuit breakers, LRU cache |
| AI — Offline | `@huggingface/transformers`, `onnxruntime-node` | Llama 3.2 1B, 4-bit ONNX |
| Security | `helmet` 8, `express-rate-limit` 8 | Nonce CSP, HTTPS redirect, rate limits |
| Compression | `compression` | Gzip on all responses |
| Logging | `morgan` | Dev format, skips socket.io noise |
| Frontend | Vanilla CSS, Chart.js | Glassmorphic design, no framework |
| PWA | Service worker (`public/sw.js`) | Offline caching, install-to-home-screen |
| Testing | `supertest`, `jsdom`, `@playwright/test` | 192 assertions total |
| CI/CD | GitHub Actions | Deploy to Azure App Service on push to main |

---

## Local Development

### Prerequisites

- Node.js >= 18
- A Gemini API key (free tier works; the registry will discover which models are accessible)

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Create .env in the project root
echo "GEMINI_API_KEY=your_key_here" > .env

# 3. Download and optimize Llama ONNX weights (~400 MB, written to models/)
npm run warmup

# 4. Start the server (also regenerates summary.json on every start)
npm start
# → http://localhost:3000
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | Yes (for Tier 2) | Google AI Studio API key; omit to run offline-only |
| `ADMIN_API_KEY` | Optional | If set, requires `x-admin-key: <value>` on `/api/site-metrics` and `/api/model-status`. **Do not set** if you want the System Health widget to work — browsers can't send custom auth headers on plain `fetch()` calls. |
| `GOOGLE_FORM_URL` | Optional | Contact form submission URL; defaults to hardcoded fallback |
| `NODE_ENV` | Optional | Set to `production` to enable HTTPS redirect and view cache |

---

## Test Suite

| Command | Runner | Count | Coverage |
|---|---|---|---|
| `npm run test:unit` | Node (unit-engine.js) | 73 | Engine logic: trigram matching, intent routing, persona scrubber |
| `npm run test:sanity` | Node + supertest (sanity.js) | 63 | HTTP routes, response shapes, rate limit headers |
| `npm run test:chatbot` | Node (chatbot-response-test.js) | 28 | Chatbot response quality and grounding accuracy |
| `npm run test:ui:headless` | Playwright (ui-sanity.spec.js) | 28 | End-to-end browser: page loads, chatbot UI, command palette |
| `npm test` | Node (master-test.js) | — | Integration smoke test; gates CI/CD deployment |
| `npm run test:audit` | Node (core-bot-audit.js) | 400 | Full fidelity stress test against intent map |

---

## API Endpoints

| Method | Path | Rate Limit | Description |
|---|---|---|---|
| `POST` | `/api/chat/llm` | 20 req/min | SSE streaming chat; runs the 3-tier AI pipeline |
| `POST` | `/contact-me` | 5 req/min | Google Forms proxy; validates and forwards contact submissions |
| `POST` | `/api/jd-match` | 10 req/min | Scores a pasted job description against the resume skill set |
| `GET` | `/api/site-metrics` | 30 req/min | Returns uptime, visit counts, CPU/RAM usage (optional admin key gate) |
| `GET` | `/api/model-status` | 30 req/min | Returns live Gemini model registry state and circuit breaker status |
| `GET` | `/view-asset/:category/:file` | — | Secure proxy for PDF/image assets; path traversal protected |

---

## Security

- **CSP with per-request nonces** — `script-src` enforces nonces via Helmet; `style-src` allows `unsafe-inline` for inline styles only
- **SRI hashes** on all external CDN resources (Chart.js, fonts)
- **HTTPS redirect** — `x-forwarded-proto` check enforced in production; no plaintext HTTP served
- **Path traversal protection** — `/view-asset/` route validates and normalizes paths before serving files from `secure_assets/`
- **Prompt injection mitigation** — user input is passed as `contents`, never injected into `systemInstruction`
- **Rate limiting** — per-endpoint limits (chat: 20/min, metrics: 30/min, contact: 5/min, jd-match: 10/min); loopback IPs skipped for local dev
- **IP spoofing resistance** — rate limiter keys on `req.socket.remoteAddress` (actual TCP connection), not `req.ip`
- **No secrets in source** — `.env` is gitignored; `secure_assets/data/` contains only resume content (no credentials)

---

## AI Pipeline — Detail

### Tier 1: Deterministic Guard

Character trigrams and weighted keyword anchors resolve high-confidence queries in under 1 ms. Exact-path routing is hardcoded for career facts (employer names, dates, project outcomes) so those answers never touch an LLM. This is the anti-hallucination layer.

### Tier 2: Gemini Cloud

`services/ai/gemini-model-registry.js` maintains a seven-model stack, discovered live against the API key at startup via `discoverModels()`. Each model has an independent circuit breaker:

- `429` with `RetryInfo` in the error body → cooldown = `retryDelay` seconds from the proto (min 10s, up to 1h for daily quota violations)
- `429` without details → 60s cooldown
- `503` (overload) → 15s cooldown
- Other errors → 10s cooldown

`getActiveStack()` always returns at least one model; if all are in cooldown it picks the one with the shortest remaining wait. `gemini-cache.js` deduplicates identical queries within a 30-second window (LRU, 5 000 entries) to avoid redundant API calls.

### Tier 3: Llama 3.2 1B Offline

`@huggingface/transformers` runs a 4-bit quantized ONNX model in-process on the server CPU. Activated only when all Gemini models are unavailable. Grounded strictly in the JSON resume data snapshot generated by `scripts/update-summary.js`.

---

## Deployment

### Current: Azure App Service (F1 Free Tier)

GitHub Actions workflow (`.github/workflows/main_akhilesh-resume.yml`) deploys on every push to `main`. ONNX model weights are excluded from the deployment package to stay within the 1 GB artifact limit; a warmup step runs in the Actions build job to pre-cache weights in the Azure VFS.


### Recommended Migration: Railway

Railway offers persistent disk, no cold-start penalty, and free-tier Node.js hosting without the Azure VFS complexities that caused the recent 409 deployment conflicts. Migration steps:

1. Add a `railway.toml` with `startCommand = "npm start"`
2. Set `GEMINI_API_KEY` and `NODE_ENV=production` in the Railway dashboard
3. Point the custom domain and update the live badge URL in this README

---

## Connect

- **LinkedIn:** [linkedin.com/in/akhilesh-angadi](https://linkedin.com/in/akhilesh-angadi)
- **GitHub:** [github.com/aangadiIIT](https://github.com/aangadiIIT)
- **Portfolio:** [akhilesh-resume.azurewebsites.net](https://akhilesh-resume.azurewebsites.net)

---

© 2026 Akhilesh Angadi
