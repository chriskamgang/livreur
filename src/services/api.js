import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// URL de l'API selon l'environnement
const API_URL = __DEV__
  ? Platform.select({
      ios: 'http://localhost:8002/api',
      android: 'http://10.0.2.2:8002/api',
    })
  : 'https://restaurant.iues-insambot.com/api';

const BASE_URL = API_URL;

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('driver_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await AsyncStorage.multiRemove(['driver_token', 'driver_user']);
    }
    return Promise.reject(error);
  }
);

export default api;
