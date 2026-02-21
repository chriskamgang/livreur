import * as Location from 'expo-location';
import api from './api';

let locationSubscription = null;
let isTracking = false;

export const locationService = {
  // Démarrer le tracking GPS
  async startTracking(deliveryId) {
    if (isTracking) {
      console.log('Tracking déjà actif');
      return;
    }

    try {
      // Demander la permission de localisation
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Permission de localisation refusée');
      }

      console.log('📍 Démarrage du tracking GPS pour livraison', deliveryId);
      isTracking = true;

      // Envoyer la position toutes les 5 secondes
      locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000, // 5 secondes
          distanceInterval: 10, // ou tous les 10 mètres
        },
        async (location) => {
          try {
            const { latitude, longitude, coords } = location;

            await api.post('/driver/location', {
              latitude: coords.latitude,
              longitude: coords.longitude,
              accuracy: coords.accuracy,
              speed: coords.speed,
              heading: coords.heading,
              delivery_id: deliveryId,
            });

            console.log(`📍 Position envoyée: ${coords.latitude}, ${coords.longitude}`);
          } catch (error) {
            console.error('Erreur envoi position:', error);
          }
        }
      );
    } catch (error) {
      console.error('Erreur démarrage tracking:', error);
      isTracking = false;
      throw error;
    }
  },

  // Arrêter le tracking GPS
  stopTracking() {
    if (locationSubscription) {
      locationSubscription.remove();
      locationSubscription = null;
      isTracking = false;
      console.log('📍 Tracking GPS arrêté');
    }
  },

  // Obtenir la position actuelle une seule fois
  async getCurrentPosition() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Permission de localisation refusée');
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
      };
    } catch (error) {
      console.error('Erreur obtention position:', error);
      throw error;
    }
  },

  // Vérifier si le tracking est actif
  isTracking() {
    return isTracking;
  },
};
