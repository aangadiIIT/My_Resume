var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { pageTitle: 'Akhilesh Angadi' });
});

module.exports = router;