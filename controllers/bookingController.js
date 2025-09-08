const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Booking = require('../models/bookingModel');
const Tour = require('../models/tourModel');
const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const factory = require('./factoryHandler');

exports.getCheckoutSession = catchAsync(async (req, res, next) => {
  // 1) Get the currently booked tour
  try {
    console.log(req.params.tourId, 'req.params');
    const tour = await Tour.findById(req.params.tourId);

    // 2) Create checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      success_url: `${req.protocol}://${req.get('host')}/?tour=${req.params.tourId}&user=${req.user.id}&price=${tour.price}`,
      cancel_url: `${req.protocol}://${req.get('host')}/tour/${tour.slug}`,
      customer_email: req.user.email,
      client_reference_id: req.params.tourId,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${tour.name} Tour`,
              description: tour.summary,
              images: [`https://natours.dev/img/tours/${tour.imageCover}`],
            },
            unit_amount: tour.price * 100,
          },
          quantity: 1,
        },
      ],
    });

    // 3) Create session as response
    res.status(200).json({
      status: 'success',
      session,
    });
  } catch (error) {
    console.log(error);
  }
});

exports.createBookingCheckout = catchAsync(async (req, res, next) => {
  // This is only TEMPORARY solution, not secure
  const { tour, user, price } = req.query;

  if (!tour && !user && !price) return next();

  await Booking.create({ tour, user, price });
  const userDetails = await User.findById(user);
  console.log({userDetails})
  const toursBooked = userDetails.toursBooked || [];
  toursBooked.push(tour);
  await User.findByIdAndUpdate(user, { toursBooked: toursBooked });

  res.redirect(req.originalUrl.split('?')[0]);
});

exports.getBookingsOnATour = catchAsync(async (req, res, next) => {
  console.log(req.params.tourId, 'tourid');
  if (!req.originalUrl.includes('/tours/')) return next();

  const bookings = await Booking.find({ tour: req.params.tourId });
  console.log({ bookings });
  res.status(200).json({
    status: 'success',
    results: bookings.length,
    data: {
      data: bookings,
    },
  });
});

exports.getBookingsForAUser = catchAsync(async (req, res, next) => {
  if (!req.originalUrl.includes('/users/')) return next();

  const bookings = await Booking.find({ user: req.params.userId });
  res.status(200).json({
    status: 'success',
    results: bookings.length,
    data: {
      data: bookings,
    },
  });
});

exports.createBooking = factory.createOne(Booking);
exports.getBooking = factory.getOne(Booking);
exports.getAllBookings = factory.getAll(Booking);
exports.updateBooking = factory.updateOne(Booking);
exports.deleteBooking = factory.deleteOne(Booking);
