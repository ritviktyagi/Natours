import axios from 'axios';

const axiosInstance = axios.create({
  baseURL: '/',
});

axiosInstance.interceptors.request.use(async (config) => {
  let accessToken = localStorage.getItem('jwt');
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  return config;
});

// Response interceptor to catch 401 and refresh token
axiosInstance.interceptors.response.use(
  (res) => res,
  async (error) => {
    console.log({ error });
    const originalRequest = error.config;

    if (error?.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const res = await axios.post(
          '/api/v1/users/refresh',
          {},
          { withCredentials: true },
        );

        const newAccessToken = res.data.accessToken;
        localStorage.setItem('jwt', newAccessToken);

        // retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return axios(originalRequest);
      } catch (error) {
        console.error('refresh failed, logging out...');
        location.reload(true);
      }
    }
    return Promise.reject(error);
  },
);

module.exports = axiosInstance;
