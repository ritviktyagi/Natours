import '@babel/polyfill';
import { login, logout } from './login';
import { updateSettings } from './updateSettings';
import { bookTour } from './stripe';

// DOM elements
const formElement = document.querySelector('.form--login');
const logoutBtn = document.querySelector('.nav__el--logout');
const formElementMe = document.querySelector('.form-user-data');
const userPasswordData = document.querySelector('.form-user-password');
const bookBtn = document.getElementById('book-tour');

if (formElement) {
  formElement.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    login(email, password);
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener('click', logout);
}

if (formElementMe) {
  formElementMe.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = new FormData();
    form.append('name', document.getElementById('name-account').value);
    form.append('email', document.getElementById('email-account').value);
    form.append('photo', document.getElementById('photo').files[0]);

    await updateSettings(form, 'data');
  });
}

if (userPasswordData) {
  userPasswordData.addEventListener('submit', async (e) => {
    e.preventDefault();
    document.querySelector('.btn--save-password').innerHTML = 'Updating...';
    const currentPassword = document.getElementById('password-current').value;
    const updatedPassword = document.getElementById('password').value;
    const updatedConfirmPassword =
      document.getElementById('password-confirm').value;

    await updateSettings(
      { currentPassword, updatedPassword, updatedConfirmPassword },
      'password',
    );

    document.querySelector('.btn--save-password').innerHTML = 'Save password';
    document.getElementById('password-current').value = '';
    document.getElementById('password').value = '';
    document.getElementById('password-confirm').value = '';
  });
}

if (bookBtn) {
  bookBtn.addEventListener('click', (e) => {
    try {
      console.log(e.target.dataset.tourId, "target")
      e.target.innerHTML = 'Processing...';
      const { tourId } = e.target.dataset;
      bookTour(tourId);
    } catch (error) {
      console.log(error)
    }
  });
}
