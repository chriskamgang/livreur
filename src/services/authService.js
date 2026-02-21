import api from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const authService = {
  async login(email, password) {
    const response = await api.post('/auth/login', { email, password });
    const { token, user } = response.data;
    if (user.role !== 'driver') {
      throw new Error('Accès réservé aux livreurs.');
    }
    await AsyncStorage.setItem('driver_token', token);
    await AsyncStorage.setItem('driver_user', JSON.stringify(user));
    return { token, user };
  },

  async logout() {
    try { await api.post('/auth/logout'); } catch (_) {}
    await AsyncStorage.multiRemove(['driver_token', 'driver_user']);
  },

  async me() {
    const response = await api.get('/auth/me');
    return response.data;
  },

  async getStoredUser() {
    const user  = await AsyncStorage.getItem('driver_user');
    const token = await AsyncStorage.getItem('driver_token');
    return { user: user ? JSON.parse(user) : null, token };
  },
};
