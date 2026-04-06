# Akhilesh Angadi | Cloud & DevOps Portfolio

![Build Status](https://github.com/akhilangadi/My_Resume/actions/workflows/main_akhilesh-resume.yml/badge.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

A premium, high-performance resume website built with **Node.js, Express, and EJS**, featuring a **Deterministic Knowledge Engine** and a stunning **Glassmorphism UI**.

## 🚀 Key Features

- **🧠 Deterministic Knowledge Engine**: A custom, search-aware chatbot that achieves 100% precision using a registry-based hybrid intent matcher.
- **🛡️ High Availability Architecture**: Built for zero-failure responses using a combination of deterministic scoring and ML-backed typo tolerance.
- **✨ Glassmorphism UI**: Premium design aesthetics with dynamic blurred backgrounds and smooth micro-animations.
- **📈 Interactive Skills Radar**: High-impact visualization of technical expertise categories using Chart.js.
- **📊 Modular Data Architecture**: Decoupled JSON data layers for rapid updates to experience, certifications, and awards.
- **📧 Custom Inbound Proxy**: Headless contact form integration communicating directly with Google Forms via a secure backend relay.

---

## 🧠 Chatbot Intelligence & Search

The portfolio features a **Staff-level Knowledge Engine** that handles complex recruiter queries with contextual precision:

### 🔍 Advanced Search Capabilities
- **Sub-Resolution**: High-granularity matching for specific roles (e.g., distinguishing between "Software Engineer 2" and "Intern" achievements).
- **Selection Resolver**: A contextual memory anchor that lets you select specific items by year (e.g., "2025-09") after a multi-match disambiguation list is shown. 
- **Synergy Filtering**: Intelligently filters domain-specific lists (like Certifications) when tech keywords (like "Docker" or "Kubernetes") are detected.
- **Implicit Domain Locking**: Automatically prioritizes the most relevant context (Experience, Awards, Publications) based on query semantics.

---

## 🛠️ Technical Stack

- **Backend**: Node.js, Express.js
- **Intelligence**: Custom `ChatbotEngine` with `MLIntentMatcher`
- **Frontend**: EJS, Bootstrap 5, Vanilla CSS (Glassmorphism)
- **Visualization**: Chart.js
- **CI/CD**: GitHub Actions
- **Cloud**: Azure App Service

---

## 📦 Development & Maintenance

### Prerequisites
- Node.js (v18 or higher)
- npm

### Installation & Run
1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm start
   ```

### 🔨 Knowledge Base Updates
All chatbot intelligence is data-driven. After updating any JSON files in `secure_assets/data/`, you **must** regenerate the unified knowledge base:
```bash
node scripts/update-summary.js
```
This script rebuilds the entity registry and synchronizes all intent mappings to `public/data/summary.json`.

---

## 🚢 Deployment
Automated deployment is handled via **GitHub Actions** targeting **Azure Web Apps**.
- **Target**: `akhilesh-resume`
- **Configuration**: `.github/workflows/main_akhilesh-resume.yml`

---
© 2026 Akhilesh Angadi. Built with passion for technology and design.
