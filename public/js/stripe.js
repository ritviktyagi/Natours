
import axios from './axios'
import { showAlert } from './alerts';
// import Stripe from 'stripe';

const stripe = Stripe(
  'pk_test_51S0RN3DNMLLrYvgtKRnBjvHktnBDfwUydBvQTscsJWmMbrsx65RBhJeLv8PebOXt0zPSj4EPtmGNOArR6L0ZRi7c00PZtfYybT',
);

export const bookTour = async (tourId) => {
  try {
    // 1) Get checkout session from API
    const session = await axios.get(
      `/api/v1/bookings/checkout-session/${tourId}`,
    );

    // 2) Create checkout form + charge credit card
    await stripe.redirectToCheckout({
      sessionId: session.data.session.id,
    });
  } catch (error) {
    console.log(error);
    showAlert('error', error);
  }
};
