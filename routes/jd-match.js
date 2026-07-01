'use strict';

const router = require('express').Router();
const { jdMatchRateLimit } = require('../middleware/rate-limits');
const { analyzeJD }        = require('../services/jd-analyzer');
const { getResumeData }    = require('../services/resume-data');
const { JD_TEXT_MIN_LEN, JD_TEXT_MAX_LEN } = require('../config');

router.get('/jd-match', (req, res) => res.render('jd-match', { pageTitle: 'JD Match | Akhilesh Angadi' }));

router.post('/api/jd-match', jdMatchRateLimit, async (req, res) => {
  const { jd_text } = req.body;
  if (typeof jd_text !== 'string' || jd_text.trim().length < JD_TEXT_MIN_LEN) {
    return res.status(400).json({ error: `Please provide a job description (at least ${JD_TEXT_MIN_LEN} characters).` });
  }
  if (jd_text.length > JD_TEXT_MAX_LEN) {
    return res.status(413).json({ error: `Job description is too long. Please trim it to under ${JD_TEXT_MAX_LEN} characters.` });
  }

  const data       = await getResumeData();
  const rawSkills  = data && data.skills;
  const skillsData = rawSkills?.skills || rawSkills;
  if (!skillsData) {
    return res.status(503).json({ error: 'Skills data not available yet. Please try again in a moment.' });
  }

  res.json(analyzeJD(jd_text, skillsData));
});

module.exports = router;
