import axios from 'axios';
import { showAlert } from './alerts';

export const updateSettings = async (data, type) => {
  try {
    const url = type === 'password' ? '/api/v1/users/updatePassword' : '/api/v1/users/updateMe'
    const res = await axios.patch(url, data);

    if (res.data.status === 'success') {
      showAlert('success', `${type.toUpperCase()} updated successfully!`);
    }
  } catch (error) {
    console.error(error);
    showAlert('error', error.response.data.message);
  }
};
