import axios from 'axios';

const axiosInstance = axios.create({
  baseURL: process.env.API_URL || '/', // fallback for local + prod
});

axiosInstance.interceptors.request.use((config) => {
  const accessToken = localStorage.getItem('jwt');
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

axiosInstance.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config;

    if (error?.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const res = await axiosInstance.post('/api/v1/users/refresh', {}, { withCredentials: true });
        const newAccessToken = res.data.accessToken;
        localStorage.setItem('jwt', newAccessToken);

        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return axiosInstance(originalRequest); // ✅ use instance, not raw axios
      } catch (err) {
        console.error('refresh failed, logging out...');
        localStorage.removeItem('jwt');
        location.reload(true);
      }
    }
    return Promise.reject(error);
  },
);

export default axiosInstance;
