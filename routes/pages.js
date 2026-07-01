'use strict';

const router = require('express').Router();

// pageType drives conditional CDN loading in head.ejs and footer.ejs,
// saving ~88KB gzipped per page for resources not needed on that page.
router.get('/',                (req, res) => res.render('index',          { pageTitle: 'Akhilesh Angadi | Cloud & DevOps Engineer', pageType: 'index' }));
router.get('/personal-details',(req, res) => res.render('personal-details',{ pageTitle: 'About | Akhilesh Angadi',                pageType: 'default' }));
router.get('/experience',      (req, res) => res.render('education-work', { pageTitle: 'Work Experience | Akhilesh Angadi',        pageType: 'experience' }));
router.get('/my-works',        (req, res) => res.render('my-works',       { pageTitle: 'Projects | Akhilesh Angadi',               pageType: 'default' }));
router.get('/my-skills',       (req, res) => res.render('my-skills',      { pageTitle: 'Skills | Akhilesh Angadi',                 pageType: 'skills' }));
router.get('/education',       (req, res) => res.render('education',      { pageTitle: 'Education | Akhilesh Angadi',              pageType: 'default' }));
router.get('/certifications',  (req, res) => res.render('certifications', { pageTitle: 'Certifications | Akhilesh Angadi',         pageType: 'default' }));
router.get('/honors-awards',   (req, res) => res.render('honors-awards',  { pageTitle: 'Awards & Honors | Akhilesh Angadi',        pageType: 'default' }));
router.get('/recommendations', (req, res) => res.render('recommendations',{ pageTitle: 'Recommendations | Akhilesh Angadi',        pageType: 'default' }));
router.get('/publications',    (req, res) => res.render('publications',   { pageTitle: 'Publications | Akhilesh Angadi',           pageType: 'default' }));
router.get('/contact-me',      (req, res) => res.render('contact-me',     { pageTitle: 'Contact | Akhilesh Angadi',                pageType: 'default' }));
router.get('/for-recruiters',  (req, res) => res.render('for-recruiters', { pageTitle: 'Recruiter Brief | Akhilesh Angadi',        pageType: 'default' }));
router.get('/jd-match',        (req, res) => res.render('jd-match',       { pageTitle: 'JD Match | Akhilesh Angadi',               pageType: 'default' }));

module.exports = router;
