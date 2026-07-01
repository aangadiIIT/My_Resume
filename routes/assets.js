'use strict';

const router = require('express').Router();
const path   = require('path');
const fs     = require('fs');

const ALLOWED_CATEGORIES = ['awards', 'certifications', 'profile', 'documents'];
const SECURE_ROOT        = path.resolve(path.join(__dirname, '../secure_assets'));

router.get('/view-asset/:category/:file', (req, res) => {
  const { category, file } = req.params;

  if (!ALLOWED_CATEGORIES.includes(category)) {
    return res.status(403).send('Access Denied');
  }

  const referer = req.get('Referer');
  const host    = req.get('host');
  if (referer && !referer.includes(host)) {
    return res.status(403).send('Forbidden');
  }

  const categoryToDir = {
    awards:         path.join(SECURE_ROOT, 'awards'),
    certifications: path.join(SECURE_ROOT, 'certifications'),
    profile:        path.join(SECURE_ROOT, 'images'),
    documents:      path.join(SECURE_ROOT, 'documents'),
  };

  const assetPath    = path.join(categoryToDir[category], file);
  const absolutePath = path.resolve(assetPath);

  const rel = path.relative(SECURE_ROOT, absolutePath);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
    return res.status(403).send('Invalid Path');
  }

  if (fs.existsSync(absolutePath)) {
    // Allow PDFs to load inside same-origin iframes (pdf-viewer modal)
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.sendFile(absolutePath);
  } else {
    res.status(404).send('Resource Not Found');
  }
});

module.exports = router;
