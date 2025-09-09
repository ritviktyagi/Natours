const AppError = require('../utils/appError');

const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400);
};

const handleDuplicateFieldsDB = (err) => {
  const value = err.errorResponse.errmsg.match(/"([^"]+)"/)[1];
  const message = `Duplicate field value: \"${value}"\. Please use another value!`;
  return new AppError(message, 400);
};

const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map((el) => el.message);
  const message = `Invalid input data. ${errors.join('. ')}`;
  return new AppError(message, 400);
};

const handleJWTError = () => new AppError('Invalid token!', 401);

const handleJWTExpiredError = () =>
  new AppError('Your token has expired!', 401);

const sendErrorDev = (res, req, err) => {
  // console.log(req, "req")
  // API
  if (req.originalUrl.startsWith('/api')) {
    if (err.name === 'TokenExpiredError') {
      const newErr = {
        ...err,
        statusCode: 401,
      };
      res.status(401).json({
        status: err.status,
        error: newErr,
        message: err.message,
        stack: err.stack,
      });
    } else {
      res.status(err.statusCode).json({
        status: err.status,
        error: err,
        message: err.message,
        stack: err.stack,
      });
    }
  } else {
    //B) Rendered website
    console.error(err);
    res.status(err.statusCode).render('error.pug', {
      title: 'Something went wrong!',
      message: err.message,
    });
  }
};

const sendErrorProd = (res, req, err) => {
  // A) Operational trusted error: send message to client
  if (req.originalUrl.startsWith('/api')) {
    // A) Operational trusted error: send message to client
    if (err.isOperational) {
      res.status(err.statusCode).json({
        status: err.status,
        message: err.message,
      });
    } else {
      // Unknown error
      // console.error('error 💥', err);
      res.status(500).json({
        status: 'error',
        message: 'Something went wrong',
      });
    }
  } else {
    //B) Rendered website
    if (err.isOperational) {
      console.log(err.message, 'err inside ');
      // A) Operational trusted error: send message to client
      res.status(err.statusCode).render('error.pug', {
        status: err.status,
        message: err.message,
      });
    } else {
      // Unknown error
      // console.error('error 💥', err);
      res.status(500).render('error.pug', {
        status: 'error',
        message: 'Something went wrong',
      });
    }
  }
};

module.exports = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(res, req, err);
  } else if (process.env.NODE_ENV === 'production') {
    let error = { ...err };
    error.message = err.message;
    if (err.name === 'CastError') {
      error = handleCastErrorDB(error);
    }
    if (err.code === 11000) {
      error = handleDuplicateFieldsDB(error);
    }
    if (err.name === 'ValidationError') error = handleValidationErrorDB(error);
    if (err.name === 'JsonWebTokenError') error = handleJWTError();
    if (err.name === 'TokenExpiredError') error = handleJWTExpiredError();

    sendErrorProd(res, req, error);
  }
};
