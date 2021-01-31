const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const cors = require('cors');

const indexRouter = require('./routes/index');
const imagesRouter = require('./routes/images');
const usersRouter = require('./routes/users');

const app = express();

// Config
require('./config/database');
require('dotenv').config()

// View engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

// Middlewares
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// CORS
const corsOptionsDelegate = async function (req, callback) {
  let corsOptions = { origin: true };
  let origin = req.header('Origin');
  if (process.env.CORS_WHITELIST.split(', ').indexOf(origin) === -1) corsOptions = { origin: false };
  callback(null, corsOptions);
}
app.use(cors(corsOptionsDelegate));
app.options('*', cors(corsOptionsDelegate));

// Routes
app.use('/', indexRouter);
app.use('/api/users', usersRouter);
app.use('/api/images', imagesRouter);
// app.use('/api/mail', require('./routes/mail'));

// Catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// Error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
