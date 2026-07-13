import axios from 'axios';
import { auth } from '../firebase.js';
import { API_URL, API_TIMEOUT } from '../constants/index.js';

const apiClient = axios.create({
  baseURL: API_URL,
  timeout: API_TIMEOUT,
  headers: { 'Content-Type': 'application/json' },
});

// Attach fresh Firebase ID token on every request
apiClient.interceptors.request.use(async (config) => {
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Do not automatically redirect to login on 401.
    // Manual logout should be the only way to sign the user out.
    return Promise.reject(error);
  },
);

export default apiClient;
