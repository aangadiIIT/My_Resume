'use strict';

const fs   = require('fs');
const path = require('path');
const { RESUME_CACHE_TTL_MS } = require('../config');

const DATA_DIR = path.join(__dirname, '../secure_assets/data');

let cachedResumeData = null;
let lastDataLoadTime = 0;

const ICON_MAP = {
  architect: 'fa-sitemap',    design: 'fa-sitemap',
  stack: 'fa-layer-group',    development: 'fa-layer-group',
  devops: 'fa-infinity',      pipeline: 'fa-infinity',
  api: 'fa-network-wired',
  security: 'fa-shield-alt',  compliance: 'fa-shield-alt',
  cloud: 'fa-cloud',          kubernetes: 'fa-cloud', docker: 'fa-cloud',
  migration: 'fa-exchange-alt',
  team: 'fa-users',           mentor: 'fa-users',
  default: 'fa-bolt',
};

async function getResumeData() {
  const now = Date.now();
  if (cachedResumeData && (now - lastDataLoadTime < RESUME_CACHE_TTL_MS)) {
    return cachedResumeData;
  }

  try {
    try {
      await fs.promises.access(DATA_DIR);
    } catch {
      console.error('[RESUME-DATA] Data directory missing:', DATA_DIR);
      return null;
    }

    const files = (await fs.promises.readdir(DATA_DIR)).filter(f => f.endsWith('.json'));

    // Parallel reads — all files fetched concurrently
    const entries = await Promise.all(
      files.map(async file => {
        const content = await fs.promises.readFile(path.join(DATA_DIR, file), 'utf8');
        const key = path.basename(file, '.json');
        try {
          return { key, value: JSON.parse(content) };
        } catch (e) {
          console.error(`[RESUME-DATA] Error parsing ${file}:`, e.message);
          return null;
        }
      })
    );

    const combinedData = {};
    for (const entry of entries) {
      if (entry) combinedData[entry.key] = entry.value;
    }

    // Pre-calculate Resume Metrics
    if (combinedData.experience && combinedData.experience.experience_summary) {
      const expStr = combinedData.experience.experience_summary.total_years_experience || '';
      const m = expStr.match(/\d+/);
      combinedData.yrsExperience = m ? m[0] : '5';
    }

    // Dynamic Icon Mapping for Superpowers
    if (combinedData.profile?.profile?.about_structured?.superpowers) {
      combinedData.profile.profile.about_structured.superpowers.forEach(power => {
        const title    = power.title.toLowerCase();
        const foundKey = Object.keys(ICON_MAP).find(k => title.includes(k));
        power.icon     = ICON_MAP[foundKey] || ICON_MAP.default;
      });
    }

    // Pre-calculate Certification Styling
    if (combinedData.certifications?.certifications) {
      combinedData.certifications.certifications.forEach(cert => {
        const cat = cert.category.toLowerCase();
        if (cat.includes('ai') || cat.includes('machine learning')) cert.accentColor = 'var(--accent-primary)';
        else if (cat.includes('cloud') || cat.includes('azure') || cat.includes('aws')) cert.accentColor = '#0dcaf0';
        else cert.accentColor = 'var(--text-secondary)';
      });
    }

    // Language Proficiency Widths
    if (combinedData.languages?.detailed) {
      combinedData.languages.detailed.forEach(lang => {
        const prof = lang.proficiency_level_standardized.toLowerCase();
        if (prof === 'native' || prof === 'bilingual')           lang.progressWidth = '100%';
        else if (prof.includes('full professional'))             lang.progressWidth = '90%';
        else if (prof.includes('professional'))                  lang.progressWidth = '75%';
        else if (prof.includes('elementary'))                    lang.progressWidth = '30%';
        else                                                     lang.progressWidth = '50%';
      });
    }

    // Job / Project / Education Summaries
    if (combinedData.experience?.experience) {
      combinedData.experience.experience.forEach(j => { j.summary = j.description_raw?.split('\n\n')[0] || ''; });
    }
    if (combinedData.projects?.projects) {
      combinedData.projects.projects.forEach(p => { p.summary = p.description_raw?.split('\n\n')[0] || ''; });
    }
    if (combinedData.education?.education) {
      combinedData.education.education.forEach(e => { e.summary = e.description_raw?.split('\n\n')[0] || ''; });
    }

    // Radar Chart Data
    combinedData.radarValues = [0, 0, 0, 0, 0, 0];
    combinedData.radarLabels = ['Cloud & DevOps', 'Backend', 'System Design', 'Frontend', 'Networking', 'AI & Emerging'];
    const skillsData = combinedData.skills?.skills || combinedData.skills;
    if (skillsData?.radar_scores) {
      const rs = skillsData.radar_scores;
      combinedData.radarValues = [
        rs.cloud_devops || 0, rs.backend_development || 0,
        rs.system_design_architecture || 0, rs.frontend_development || 0,
        rs.networking || 0, rs.ai_and_emerging || 0,
      ];
    } else if (skillsData?.categorized) {
      const cat = skillsData.categorized;
      combinedData.radarValues = [
        Math.min((cat.cloud_devops || []).length * 10, 100),
        Math.min((cat.backend_development || []).length * 12, 100),
        Math.min((cat.system_design_architecture || []).length * 15, 100),
        Math.min((cat.frontend_development || []).length * 15, 100),
        Math.min((cat.networking || []).length * 15, 100),
        Math.min((cat.ai_and_emerging || []).length * 25, 100),
      ];
    }

    // Typed.js Strings
    const typedStrings = [];
    if (combinedData.profile?.profile) {
      const p = combinedData.profile.profile;
      if (p.headline_structured?.primary_role) typedStrings.push(p.headline_structured.primary_role);
      if (p.about_structured?.core_domains) {
        p.about_structured.core_domains.slice(0, 5).forEach(d => typedStrings.push(d));
      }
    }
    if (typedStrings.length === 0) typedStrings.push('Cloud Architect', 'Full Stack Developer', 'DevOps Engineer');
    combinedData.typedStrings = typedStrings;

    cachedResumeData = combinedData;
    lastDataLoadTime = now;
    console.log(`[DATA] Resume data loaded at ${new Date(now).toISOString()}`);
    return combinedData;
  } catch (err) {
    console.error('[RESUME-DATA] Error reading data directory:', err);
    return cachedResumeData;
  }
}

module.exports = { getResumeData, initialize };

async function initialize() {
  console.log('[RESUME-DATA] Eager-loading on startup...');
  await getResumeData();
}
