const express = require('express');
const { protect, restrictTo } = require('../controllers/authController');
const {
  getCheckoutSession,
  getAllBookings,
  createBooking,
  getBooking,
  updateBooking,
  deleteBooking,
  getBookingsOnATour,
  getBookingsForAUser,
} = require('../controllers/bookingController');

const router = express.Router({ mergeParams: true });

router.use(protect);

router.get('/checkout-session/:tourId', getCheckoutSession);

router.get('/', getBookingsForAUser)

router.use(restrictTo('admin', 'lead-guide'));

router.route('/').get(getBookingsOnATour, getAllBookings).post(createBooking);

router.route('/:id').get(getBooking).patch(updateBooking).delete(deleteBooking);

module.exports = router;
