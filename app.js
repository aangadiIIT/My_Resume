var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

// var indexRouter = require('./routes/index');
// var usersRouter = require('./routes/users');

var app = express();

let messages = [];

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.render('index', {
    pageTitle: 'My Resume',
  });
});

app.get('/personal-details', (req, res) => {
  res.render('personal-details', {
    pageTitle: 'Personal Details',
  });
});

app.get('/contact-me', (req, res) => {
  res.render('contact-me', {
    pageTitle: 'Contact Me',
  });
});

app.post('/contact-me/submit-message', (req, res) => {
  const { name, email, message } = req.body;
  const newMessage = { name, email, message };
  messages.push(newMessage);
  res.redirect('/contact-me?thanks=true');
});

app.get('/view-messages', (req, res) => {
  res.render('view-messages', {
    pageTitle: 'View Messages',
    messages: messages,
  });
});

app.get('/my-works', (req, res) => {
  res.render('my-works', {
    pageTitle: 'My Works',
  });
});

app.get('/my-skills', (req, res) => {
  res.render('my-skills', {
    pageTitle: 'My Skills',
  });
});

app.get('/education-work', (req, res) => {
  res.render('education-work', {
    pageTitle: 'My Education and Work Experience',
  });
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
