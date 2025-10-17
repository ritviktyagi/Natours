const express = require('express');
const {
  getOverview,
  getTour,
  getLogin,
  getAccount,
  submitUserData,
  getMyTours,
} = require('../controllers/viewsController');
const { isLoggedIn, protect } = require('../controllers/authController');

const router = express.Router();

router.get('/', isLoggedIn, getOverview);
router.get('/tour/:slug', isLoggedIn, getTour);
router.get('/login', isLoggedIn, getLogin);
router.get('/me', protect, getAccount);
router.post('/submit-user-data', protect, submitUserData);
router.get('/my-tours', protect, getMyTours);

module.exports = router;
