const express = require('express');
const path = require('path');
const pug = require('pug');
const morgan = require('morgan');
const { rateLimit } = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const sanitizeHtml = require('sanitize-html');
const hpp = require('hpp');
// const os = require("os");
const AppError = require('./utils/appError');
const globalErrorHandler = require('./controllers/errorController');
const tourRouter = require('./routes/tourRoutes');
const userRouter = require('./routes/userRoutes');
const reviewRouter = require('./routes/reviewRoutes');
const viewRouter = require('./routes/viewRoutes');
const bookingRouter = require('./routes/bookingRoutes');

const app = express();

app.set('views engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

// Middlewares

// set security http headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],

        scriptSrc: [
          "'self'",
          'https://unpkg.com',
          'https://unpkg.com/axios@1.11.0/dist/axios.min.js',
          'https://js.stripe.com',
        ],

        styleSrc: [
          "'self'",

          "'unsafe-inline'",

          'https://unpkg.com',

          'https://fonts.googleapis.com',
        ],

        fontSrc: ["'self'", 'https://fonts.gstatic.com'],

        imgSrc: [
          "'self'",

          'data:',

          'https://res.cloudinary.com',

          'https://unpkg.com',

          'https://a.tile.openstreetmap.org',

          'https://b.tile.openstreetmap.org',

          'https://c.tile.openstreetmap.org',
        ],

        connectSrc: ["'self'", 'https://api.stripe.com', 'ws://localhost:*'],
        frameSrc: ["'self'", 'https://js.stripe.com'],
      },
    },
  }),
);

// Seving static files
app.use(express.static(path.join(__dirname, 'public')));

// Development logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Limit requests from same API
const limiter = rateLimit({
  limit: 100,
  windowMs: 60 * 60 * 1000,
  message: 'Too many requests from this IP, please try again in an hour!',
});
app.use(limiter);

// Body parser, reading data from body into req.body
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Data sanitization against NOSQL query injection
app.use(mongoSanitize());

// Data Sanitization Against XSS (Cross-Site-Scripting)
app.use((req, res, next) => {
  if (req.body) {
    // Sanitize each field in req.body
    for (const key in req.body) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = sanitizeHtml(req.body[key], {
          allowedTags: [],
          allowedAttributes: {},
        });
      }
    }
  }
  next();
});

// Prevent parameter pollution
app.use(
  hpp({
    whitelist: [
      'duration',
      'ratingsQuantity',
      'ratingsAverage',
      'maxGroupSize',
      'difficulty',
      'price',
    ],
  }),
);

// Test middleware
app.use((req, res, next) => {
  // const computerName = os.hostname();
  // console.log(computerName, "computerName")
  req.requestTime = new Date().toISOString();
  next();
});

// Routes
app.use('/', viewRouter);
app.use('/api/v1/tours', tourRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/reviews', reviewRouter);
app.use('/api/v1/bookings', bookingRouter);

app.all('*', (req, res, next) => {
  // const err = new Error(`Can't find ${req.originalUrl} on this server!`);
  // err.statusCode = 404;x
  // err.status = 'fail';

  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

app.use(globalErrorHandler);

module.exports = app;
