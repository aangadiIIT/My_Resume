const createError = require('http-errors');
const express = require('express');
const path = require('path');
const logger = require('morgan');
const helmet = require('helmet');
const fs = require('fs');

const app = express();

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "script-src": ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net", "unpkg.com", "cdnjs.cloudflare.com"],
      "img-src": ["'self'", "data:", "https:"],
    },
  },
}));

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

// Data Caching Logic
let cachedResumeData = null;
let lastDataLoadTime = 0;
const CACHE_DURATION = 1000 * 60 * 5; // 5 minutes cache

function getResumeData() {
  const now = Date.now();
  if (cachedResumeData && (now - lastDataLoadTime < CACHE_DURATION)) {
    return cachedResumeData;
  }

  const dataDir = path.join(__dirname, 'secure_assets', 'data');
  const combinedData = {};

  try {
    if (!fs.existsSync(dataDir)) {
        console.error("Data directory missing:", dataDir);
        return null;
    }

    const files = fs.readdirSync(dataDir);
    files.forEach(file => {
      if (file.endsWith('.json')) {
        const filePath = path.join(dataDir, file);
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const key = path.basename(file, '.json');
        try {
            combinedData[key] = JSON.parse(fileContent);
        } catch (parseErr) {
            console.error(`Error parsing ${file}:`, parseErr);
        }
      }
    });

    // Pre-calculate Resume Metrics for UI Efficiency
    if (combinedData.experience && combinedData.experience.experience_summary) {
      const expStr = combinedData.experience.experience_summary.total_years_experience || '';
      const yrsMatch = expStr.match(/\d+/);
      combinedData.yrsExperience = yrsMatch ? yrsMatch[0] : '5';
    }

    // Dynamic Icon Mapping for Superpowers
    const iconMap = {
      architect: 'fa-sitemap', design: 'fa-sitemap',
      stack: 'fa-layer-group', development: 'fa-layer-group',
      devops: 'fa-infinity', pipeline: 'fa-infinity',
      api: 'fa-network-wired',
      security: 'fa-shield-alt', compliance: 'fa-shield-alt',
      cloud: 'fa-cloud', kubernetes: 'fa-cloud', docker: 'fa-cloud',
      migration: 'fa-exchange-alt',
      team: 'fa-users', mentor: 'fa-users',
      default: 'fa-bolt'
    };

    if (combinedData.profile && combinedData.profile.profile && combinedData.profile.profile.about_structured) {
      combinedData.profile.profile.about_structured.superpowers.forEach(power => {
        const title = power.title.toLowerCase();
        const foundKey = Object.keys(iconMap).find(key => title.includes(key));
        power.icon = foundKey ? iconMap[foundKey] : iconMap.default;
      });
    }

    // Pre-calculate Certification Styling
    if (combinedData.certifications && combinedData.certifications.certifications) {
      combinedData.certifications.certifications.forEach(cert => {
        const cat = cert.category.toLowerCase();
        if (cat.includes('ai') || cat.includes('machine learning')) cert.accentColor = 'var(--accent-primary)';
        else if (cat.includes('cloud') || cat.includes('azure') || cat.includes('aws')) cert.accentColor = '#0dcaf0';
        else cert.accentColor = 'var(--text-secondary)';
      });
    }

    // Pre-calculate Language Proficiency Widths
    if (combinedData.languages && combinedData.languages.detailed) {
      combinedData.languages.detailed.forEach(lang => {
        const prof = lang.proficiency_level_standardized.toLowerCase();
        if (prof === 'native' || prof === 'bilingual') lang.progressWidth = '100%';
        else if (prof.includes('full professional')) lang.progressWidth = '90%';
        else if (prof.includes('professional')) lang.progressWidth = '75%';
        else if (prof.includes('elementary')) lang.progressWidth = '30%';
        else lang.progressWidth = '50%';
      });
    }

    // Pre-calculate Job Summaries
    if (combinedData.experience && combinedData.experience.experience) {
      combinedData.experience.experience.forEach(job => {
        job.summary = job.description_raw ? job.description_raw.split('\n\n')[0] : '';
      });
    }

    // Pre-calculate Project Summaries
    if (combinedData.projects && combinedData.projects.projects) {
      combinedData.projects.projects.forEach(proj => {
        proj.summary = proj.description_raw ? proj.description_raw.split('\n\n')[0] : '';
      });
    }

    // Pre-calculate Education Summaries
    if (combinedData.education && combinedData.education.education) {
      combinedData.education.education.forEach(edu => {
        edu.summary = edu.description_raw ? edu.description_raw.split('\n\n')[0] : '';
      });
    }

    // Pre-calculate Radar Chart Data for Skills
    combinedData.radarValues = [0, 0, 0, 0, 0, 0]; // Default zeros
    combinedData.radarLabels = ['Cloud & DevOps', 'Backend', 'System Design', 'Frontend', 'Networking', 'AI & Testing'];
    
    // Check for both possible structures (wrapped or direct)
    const skillsData = combinedData.skills?.skills || combinedData.skills;
    if (skillsData && skillsData.categorized) {
      const cat = skillsData.categorized;
      const values = [
        (cat.cloud_devops || []).length * 10,
        (cat.backend_development || []).length * 12,
        (cat.system_design_architecture || []).length * 15,
        (cat.frontend_development || []).length * 15,
        (cat.networking || []).length * 15,
        (cat.ai_and_emerging || []).length * 25
      ];
      combinedData.radarValues = values.map(v => Math.min(v, 100));
    }

    // Pre-calculate Typed.js Strings
    const typedStrings = [];
    if (combinedData.profile && combinedData.profile.profile) {
      const p = combinedData.profile.profile;
      if (p.headline_structured && p.headline_structured.primary_role) {
        typedStrings.push(p.headline_structured.primary_role);
      }
      if (p.about_structured && p.about_structured.core_domains) {
        p.about_structured.core_domains.slice(0, 5).forEach(d => typedStrings.push(d));
      }
    }
    if (typedStrings.length === 0) typedStrings.push("Cloud Architect", "Full Stack Developer", "DevOps Engineer");
    combinedData.typedStrings = typedStrings;

    cachedResumeData = combinedData;
    lastDataLoadTime = now;
    console.log(`[DATA] Resume data loaded and optimized at ${new Date(now).toISOString()}`);
    return combinedData;
  } catch (err) {
    console.error("Error reading modular data directory:", err);
    return cachedResumeData;
  }
}

// Middleware to inject resume data into all views
app.use((req, res, next) => {
  const data = getResumeData();
  if (!data || !data.profile) {
    return next(createError(500, "Failed to load resume data. Site is currently offline."));
  }
  res.locals.data = data;
  next();
});

// --- Routes ---

app.get('/', (req, res) => {
  res.render('index', { pageTitle: 'My Resume' });
});

app.get('/personal-details', (req, res) => {
  res.render('personal-details', { pageTitle: 'Personal Details' });
});

app.get('/experience', (req, res) => {
  res.render('education-work', { pageTitle: 'Work Experience' });
});

app.get('/my-works', (req, res) => {
  res.render('my-works', { pageTitle: 'Projects & Works' });
});

app.get('/my-skills', (req, res) => {
  res.render('my-skills', { pageTitle: 'Technical & Soft Skills' });
});

app.get('/education', (req, res) => {
  res.render('education', { pageTitle: 'Education' });
});

app.get('/certifications', (req, res) => {
  res.render('certifications', { pageTitle: 'Certifications' });
});

app.get('/honors-awards', (req, res) => {
  res.render('honors-awards', { pageTitle: 'Honors & Awards' });
});

app.get('/recommendations', (req, res) => {
  res.render('recommendations', { pageTitle: 'Professional Recommendations' });
});

app.get('/publications', (req, res) => {
  res.render('publications', { pageTitle: 'Publications' });
});

app.get('/contact-me', (req, res) => {
  res.render('contact-me', { pageTitle: 'Contact Me' });
});

app.post('/contact-me', async (req, res) => {
  const { name, email, subject, message } = req.body;
  const formUrl = 'https://docs.google.com/forms/d/e/1FAIpQLSd1IAe_XPmBDZ3JFcp8me0fh9yFhHQj7dVU-_0Cqf_qu-8czg/formResponse';
  const formData = new URLSearchParams();
  
  formData.append('entry.1760114498', name);    // Full Name
  formData.append('entry.912588963', email);   // Email
  formData.append('entry.716766072', subject); // Subject
  formData.append('entry.797942613', message); // Message

  try {
    await fetch(formUrl, {
      method: 'POST',
      body: formData,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
  } catch (err) {
    console.error('Google Form Submission Error:', err);
  }

  res.render('contact-success', {
    pageTitle: 'Message Sent',
    userName: name
  });
});

// Secure Asset Serving Route
app.get('/view-asset/:category/:file', (req, res) => {
  const { category, file } = req.params;
  const allowedCategories = ['awards', 'certifications', 'profile', 'documents'];
  
  if (!allowedCategories.includes(category)) {
    return res.status(403).send('Access Denied');
  }

  const referer = req.get('Referer');
  const host = req.get('host');
  if (referer && !referer.includes(host)) {
    return res.status(403).send('Forbidden');
  }

  let assetPath;
  if (category === 'awards') {
    assetPath = path.join(__dirname, 'secure_assets', 'awards', file);
  } else if (category === 'profile') {
    assetPath = path.join(__dirname, 'secure_assets', 'images', file);
  } else if (category === 'certifications') {
    assetPath = path.join(__dirname, 'secure_assets', 'certifications', file);
  } else if (category === 'documents') {
    assetPath = path.join(__dirname, 'secure_assets', 'documents', file);
  }

  if (fs.existsSync(assetPath)) {
    const absolutePath = path.resolve(assetPath);
    const secureRoot = path.resolve(path.join(__dirname, 'secure_assets'));
    if (!absolutePath.startsWith(secureRoot)) {
        return res.status(403).send('Invalid Path');
    }
    res.sendFile(absolutePath);
  } else {
    res.status(404).send('Resource Not Found');
  }
});

// catch 404 and forward to error handler
app.use((req, res, next) => {
  next(createError(404));
});

// error handler
app.use((err, req, res, next) => {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  res.status(err.status || 500);
  res.render('error', { pageTitle: 'Error' });
});

module.exports = app;
