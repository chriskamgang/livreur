import { Platform } from 'react-native';
import api from './api';

let Notifications = null;

try {
  Notifications = require('expo-notifications');
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
} catch (e) {
  console.warn('expo-notifications not available (Expo Go?)', e.message);
}

export const pushNotificationService = {
  async registerForPushNotifications() {
    if (!Notifications) return null;

    try {
      const Device = require('expo-device');
      const Constants = require('expo-constants').default;

      if (!Device.isDevice) {
        console.log('Push notifications require a physical device');
        return null;
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Push notification permission denied');
        return null;
      }

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Livraisons',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF6B35',
        });
      }

      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
      const token = tokenData.data;
      console.log('Push token:', token);
      await api.post('/push-token', { push_token: token });
      return token;
    } catch (error) {
      console.warn('Error getting push token:', error.message);
      return null;
    }
  },

  async removePushToken() {
    try {
      await api.delete('/push-token');
    } catch (error) {
      console.warn('Error removing push token:', error.message);
    }
  },
};
