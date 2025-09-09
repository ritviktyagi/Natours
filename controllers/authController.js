const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const speakeasy = require('speakeasy');
const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const jwt = require('jsonwebtoken');
const AppError = require('./../utils/appError');
const Email = require('../utils/email');
const { showAlert } = require('../public/js/alerts');

const signToken = (id) => {
  return jwt.sign({ id: id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

// Generate Access Token (short life)
function generateAccessToken(id) {
  return jwt.sign({ id: id }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_TOKEN_EXPIRES_IN,
  });
}

// Generate Refresh Token (longer life)
function generateRefreshToken(id) {
  return jwt.sign(
    { id: id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_TOKEN_EXPIRES_IN }, // long-lived
  );
}

const createAndSendToken = async (
  res,
  req,
  status,
  id,
  user,
  url,
  sendEmail = false,
) => {
  // Generate tokens
  let secret = {};
  const accessToken = generateAccessToken(id);
  const refreshToken = generateRefreshToken(id);

  // Save refresh token in DB (optional, for revocation support)
  user.refreshToken = refreshToken;

  if (sendEmail) {
    secret = speakeasy.generateSecret({ length: 20 });
    await User.findOneAndUpdate(
      { _id: id },
      {
        twoFactorSecret: secret.base32,
        isTwoFactorEnabled: true,
      },
    );

    const updatedUrl = `${url}?token=${accessToken}`;
    await new Email(user, updatedUrl).sendWelcome();
  }

  const cookieOptions = {
    expires: new Date(
      Date.now() +
        process.env.JWT_REFRESH_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000,
    ),
    httpOnly: true,
  };

  const accessCookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_ACCESS_COOKIE_EXPIRES_IN * 60 * 60 * 1000,
    ),
    httpOnly: true,
    secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
  };

  res.cookie('refreshToken', refreshToken, cookieOptions);
  res.cookie('jwt', accessToken, accessCookieOptions);

  // user.password = undefined;

  if (secret.base32) {
    return res.status(status).json({
      status: 'success',
      token: accessToken,
      user,
      secret: secret.base32,
    });
  } else {
    res.status(status).json({
      status: 'success',
      token: accessToken,
      user,
    });
  }
};

exports.verifyEmail = catchAsync(async (req, res, next) => {
  try {
    const { token } = req.query;
    // console.log({ token });

    // Verify JWT
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    // Find user
    const user = await User.findById(decoded.id);
    if (!user) return res.status(400).send('User not found');

    // Mark user as verified
    if (!user.isVerified) {
      await User.findByIdAndUpdate(decoded.id, { isVerified: true });
      // user.isVerified = true;
      // await user.save();
    }

    res.send('Email verified successfully! You can now log in.');
  } catch (err) {
    console.log(err, 'err');
    res.status(400).send('Invalid or expired token');
  }
});

exports.refreshToken = catchAsync(async (req, res, next) => {
  const tokens = req.headers.cookie.split('refreshToken=')[1];
  const refreshToken = tokens?.split(';')[0];
  if (!refreshToken) return res.status(401).send('No refresh token');

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    // Optional: check against DB if you store refresh tokens
    const user = await User.findById(decoded.id);
    if (!user || user.refreshToken !== refreshToken) {
      return res.status(403).send('Invalid refresh token');
    }

    const newAccessToken = generateAccessToken(decoded.id);
    const newRefreshToken = generateRefreshToken(decoded.id);

    // Update DB with new refresh token (rotation)
    user.refreshToken = newRefreshToken;
    await User.findByIdAndUpdate(decoded.id, { refreshToken: newRefreshToken });

    res
      .cookie('refreshToken', newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
      })
      .json({ accessToken: newAccessToken });
  } catch (err) {
    console.log({ err });
    return res.status(403).send('Invalid or expired refresh token');
  }
});

exports.signup = catchAsync(async (req, res, next) => {
  const user = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
    role: req.body?.role ? req.body.role : req.body.role,
  });

  const url = `${req.protocol}://${req.get('host')}/api/v1/users/verify-email`;
  // await new Email(user, url).sendWelcome();
  createAndSendToken(res, req, 201, user._id, user, url, 'true');
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new AppError('Please provide email or password!', 400));
  }

  const user = await User.findOne({ email: email }).select('+password');

  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError('Incorrect email or password!', 401));
  }

  if (user.isTwoFactorEnabled) {
    return res.status(200).json({
      status: '2fa_required',
      userId: user._id, // send so frontend can use it in step 2
    });
  }

  createAndSendToken(res, req, 200, user._id, user);
});

exports.loginStep2 = catchAsync(async (req, res, next) => {
  try {
    const { userId, token } = req.body;

    const user = await User.findById(userId);
    if (!user || !user.isTwoFactorEnabled) {
      return res.status(400).json({ message: '2FA not enabled' });
    }

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token,
      window: 1,
    });

    if (!verified) {
      res.status(401).json({ message: 'Invalid 2FA code' });
    }

    createAndSendToken(res, req, 200, user._id, user);
  } catch (error) {
    console.log(error);
    res.status(500).json('Something went wrong with 2 factor authentication');
  }
});

exports.disable2FA = catchAsync(async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user.id, {
      twoFactorSecret: undefined,
      isTwoFactorEnabled: false,
    });

    res.status(200).json({ status: 'success', message: '2FA disabled' });
  } catch (err) {
    console.log(err);
  }
});

exports.logout = catchAsync(async (req, res, next) => {
  const tokens = req.headers.cookie.split('refreshToken=')[1];
  const refreshToken = tokens?.split(';')[0];

  if (refreshToken) {
    // Optional: clear from DB
    await User.updateOne({ refreshToken }, { $unset: { refreshToken: 1 } });
  }

  res.clearCookie('jwt');
  res.clearCookie('refreshToken');
  // res.status(200).clearCookie('refreshToken').send('Logged out');

  res.status(200).json({ status: 'success' });
});

exports.protect = catchAsync(async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies?.jwt) {
    token = req.cookies.jwt;
  } else if (req.headers.cookie.split('jwt=')[1]) {
    token = req.headers.cookie.split('jwt=')[1];
  }

  if (!token) {
    return next(new AppError("You're not logged in.", 401));
  }

  //token verification
  const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

  // check if user still exists
  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    return next(
      new AppError('The user belonging to this token does not exist!', 401),
    );
  }

  // check if the user changed password after the token was issued
  // console.log(currentUser)
  const passwordChanged = await currentUser.changedPasswordAfter(decoded.iat);
  if (passwordChanged) {
    return next(
      new AppError(
        'User recently changed password! You need to login again.',
        401,
      ),
    );
  }

  //  Grant access to protected to protected route
  req.user = currentUser;
  res.locals.user = currentUser;
  next();
});

exports.isLoggedIn = async (req, res, next) => {
  try {
    if (req.cookies?.jwt || req.headers?.cookie?.split('jwt=')[1]) {
      const token = req.cookies?.jwt || req.headers?.cookie?.split('jwt=')[1];

      //token verification
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

      // check if user still exists
      const currentUser = await User.findById(decoded.id);
      if (!currentUser) {
        return next();
      }

      // check if the user changed password after the token was issued
      // console.log(currentUser)
      const passwordChanged = await currentUser.changedPasswordAfter(
        decoded.iat,
      );
      if (passwordChanged) {
        return next();
      }

      res.locals.user = currentUser;
      return next();
    }
    next();
  } catch (error) {
    console.error(error);
    return next();
  }
};

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action', 403),
      );
    }

    next();
  };
};

exports.forgotPassword = catchAsync(async (req, res, next) => {
  // Get user based on posted email
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new AppError('There is no user with email address', 404));
  }
  // Generate the random reset token
  const resetToken = user.createPasswordResetToken();
  // console.log({ resetToken });
  await user.save({ validateBeforeSave: false });

  // send it to user's email
  try {
    const resetUrl = `${req.protocol}://${req.get('host')}/api/v1/resetPassword/${resetToken}`;

    await new Email(user, resetUrl).sendPasswordReset();

    res.status(200).json({
      status: 'success',
      message: 'Token sent to email!',
    });
  } catch (error) {
    console.log(error);
    passwordResetToken = undefined;
    passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });
    return next(
      new AppError(
        'Some error occurred while sending email. Please try again later!',
        500,
      ),
    );
  }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on the token
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });
  // 2) If the token has not expired, and there is a user, set the new password
  if (!user) return next(new AppError('Invalid token or token expired!', 400));
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;

  await user.save();

  // 3) Update changePasswordAt property for the user

  // 4) Log the user in, send JWT
  createAndSendToken(res, req, 200, user._id, user);
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  // 1) Get user from collection
  const user = await User.findById(req.user._id).select('+password');
  // 2) Check if current posted password is correct
  if (!(await user.correctPassword(req.body.currentPassword, user.password))) {
    return next(new AppError('Your current password is wrong!', 401));
  }

  // 3) If so, update password
  user.password = req.body.updatedPassword;
  user.passwordConfirm = req.body.updatedConfirmPassword;

  await user.save();
  // 4) Log user in, send JWT
  createAndSendToken(res, req, 200, user._id, user);
});
