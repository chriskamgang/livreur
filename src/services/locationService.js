import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import api from './api';

// ─────────────────────────────────────────────────────────────
// Suivi GPS du livreur
//  - Livraison active : tâche en arrière-plan (expo-task-manager) qui envoie
//    la position avec delivery_id → le client et l'admin suivent le livreur.
//    Si la permission "toujours" est refusée : repli sur watchPositionAsync
//    (fonctionne uniquement app ouverte).
//  - En ligne sans livraison : position légère (30 s / 50 m) sans delivery_id,
//    pour la carte admin des livreurs disponibles.
// Ce module DOIT être importé au démarrage (index.js) pour que la tâche
// existe quand l'OS réveille l'application.
// ─────────────────────────────────────────────────────────────

export const LOCATION_TASK_NAME = 'estuaire-driver-location';
export const ACTIVE_DELIVERY_KEY = 'driver_active_delivery_id';

// Statuts de livraison pendant lesquels on partage la position
export const ACTIVE_DELIVERY_STATUSES = [
  'assigned', 'going_to_restaurant', 'at_restaurant', 'picked_up', 'on_the_way', 'arrived',
];

const TRACKING_OPTIONS = {
  accuracy: Location.Accuracy.High,
  timeInterval: 5000,
  distanceInterval: 10,
};

async function sendPosition(coords, deliveryId) {
  const payload = {
    latitude: coords.latitude,
    longitude: coords.longitude,
    accuracy: coords.accuracy ?? null,
    speed: coords.speed != null && coords.speed >= 0 ? coords.speed : null,
    heading: coords.heading != null && coords.heading >= 0 ? coords.heading : null,
  };
  if (deliveryId) payload.delivery_id = Number(deliveryId);
  // api.js lit le token "driver_token" dans AsyncStorage : fonctionne aussi en tâche de fond
  return api.post('/driver/location', payload);
}

// Tâche en arrière-plan — définie au niveau du module (obligatoire)
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.warn('Tâche GPS en erreur:', error.message);
    return;
  }
  const locations = data?.locations;
  if (!locations || locations.length === 0) return;

  try {
    const token = await AsyncStorage.getItem('driver_token');
    if (!token) {
      // Déconnecté : plus rien à partager
      await AsyncStorage.removeItem(ACTIVE_DELIVERY_KEY);
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => {});
      return;
    }
    const deliveryId = await AsyncStorage.getItem(ACTIVE_DELIVERY_KEY);
    // On n'envoie que la position la plus récente du lot
    const last = locations[locations.length - 1];
    await sendPosition(last.coords, deliveryId);
  } catch (e) {
    // 403 : la livraison n'est plus à ce livreur → on arrête le partage
    if (e?.response?.status === 403) {
      await AsyncStorage.removeItem(ACTIVE_DELIVERY_KEY);
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => {});
    }
  }
});

let foregroundSubscription = null; // repli premier plan (livraison active)
let idleSubscription = null;       // position légère (en ligne, sans livraison)
let activeDeliveryId = null;
let startLock = Promise.resolve();

async function isBackgroundTaskRunning() {
  try {
    return await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  } catch (_) {
    return false;
  }
}

function removeForegroundWatch() {
  if (foregroundSubscription) {
    foregroundSubscription.remove();
    foregroundSubscription = null;
  }
}

function removeIdleWatch() {
  if (idleSubscription) {
    idleSubscription.remove();
    idleSubscription = null;
  }
}

async function doStartTracking(deliveryId, { silent }) {
  const id = String(deliveryId);

  // Déjà actif pour cette livraison ?
  if (activeDeliveryId === id && (foregroundSubscription || (await isBackgroundTaskRunning()))) {
    return true;
  }

  activeDeliveryId = id;
  await AsyncStorage.setItem(ACTIVE_DELIVERY_KEY, id);

  // 1. Permission premier plan
  let fg;
  try {
    // En mode silencieux (reprise auto, rafraîchissement) : ne jamais afficher d'invite système
    fg = silent
      ? await Location.getForegroundPermissionsAsync()
      : await Location.requestForegroundPermissionsAsync();
  } catch (_) {
    fg = { status: 'denied' };
  }
  if (fg.status !== 'granted') {
    if (!silent) {
      Alert.alert(
        'Localisation désactivée',
        "Sans accès à votre position, le client ne pourra pas vous suivre pendant la livraison. Activez la localisation pour Express Estuaire dans les réglages du téléphone."
      );
    }
    activeDeliveryId = null;
    await AsyncStorage.removeItem(ACTIVE_DELIVERY_KEY).catch(() => {});
    return false;
  }
  removeIdleWatch();

  // 2. Permission arrière-plan
  let bgGranted = false;
  try {
    const bg = silent
      ? await Location.getBackgroundPermissionsAsync()
      : await Location.requestBackgroundPermissionsAsync();
    bgGranted = bg.status === 'granted';
  } catch (_) {
    bgGranted = false;
  }

  if (bgGranted) {
    try {
      removeForegroundWatch();
      if (!(await isBackgroundTaskRunning())) {
        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          ...TRACKING_OPTIONS,
          activityType: Location.ActivityType.AutomotiveNavigation,
          pausesUpdatesAutomatically: false,
          showsBackgroundLocationIndicator: true,
          foregroundService: {
            notificationTitle: 'Estuaire Eat – livraison en cours',
            notificationBody: 'Votre position est partagée avec le client',
            notificationColor: '#FF6B35',
            killServiceOnDestroy: false,
          },
        });
      }
      // Envoi immédiat d'une première position
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
        .then(loc => sendPosition(loc.coords, id))
        .catch(() => {});
      return true;
    } catch (e) {
      console.warn('Suivi arrière-plan impossible, repli premier plan:', e?.message);
    }
  } else if (!silent) {
    Alert.alert(
      'Position en arrière-plan refusée',
      "Le client ne vous verra que lorsque l'application est ouverte. Pour un suivi continu, autorisez la localisation « Toujours » dans les réglages."
    );
  }

  // 3. Repli : suivi premier plan
  try {
    removeForegroundWatch();
    foregroundSubscription = await Location.watchPositionAsync(TRACKING_OPTIONS, (loc) => {
      sendPosition(loc.coords, activeDeliveryId).catch(() => {});
    });
    return true;
  } catch (e) {
    console.warn('Erreur démarrage suivi GPS:', e?.message);
    if (!silent) {
      Alert.alert('Attention', "Le suivi GPS n'a pas pu démarrer. Le client ne pourra pas vous suivre.");
    }
    activeDeliveryId = null;
    await AsyncStorage.removeItem(ACTIVE_DELIVERY_KEY).catch(() => {});
    return false;
  }
}

export const locationService = {
  /**
   * Démarre le partage de position pour une livraison (ne lève jamais d'erreur).
   * @returns {Promise<boolean>} true si un suivi est actif
   */
  startTracking(deliveryId, { silent = false } = {}) {
    if (!deliveryId) return Promise.resolve(false);
    const run = startLock.then(() => doStartTracking(deliveryId, { silent })).catch(() => false);
    startLock = run.then(() => {}, () => {});
    return run;
  },

  /** Arrête le partage de position de la livraison (livrée, échouée, annulée, déconnexion). */
  async stopTracking() {
    activeDeliveryId = null;
    removeForegroundWatch();
    try { await AsyncStorage.removeItem(ACTIVE_DELIVERY_KEY); } catch (_) {}
    if (await isBackgroundTaskRunning()) {
      try { await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME); } catch (_) {}
    }
  },

  /** Position légère pour la carte admin quand le livreur est en ligne sans livraison. */
  async startIdleTracking() {
    if (idleSubscription || activeDeliveryId) return;
    try {
      let perm = await Location.getForegroundPermissionsAsync();
      if (perm.status !== 'granted' && perm.canAskAgain) {
        perm = await Location.requestForegroundPermissionsAsync();
      }
      if (perm.status !== 'granted' || idleSubscription || activeDeliveryId) return;
      idleSubscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 30000, distanceInterval: 50 },
        (loc) => { sendPosition(loc.coords, null).catch(() => {}); }
      );
    } catch (e) {
      console.warn('Erreur position en ligne:', e?.message);
    }
  },

  stopIdleTracking() {
    removeIdleWatch();
  },

  /** Arrête tout (déconnexion). */
  async stopAll() {
    removeIdleWatch();
    await this.stopTracking();
  },

  /**
   * Reprend automatiquement le suivi si le livreur a une livraison en cours
   * (démarrage de l'app / restauration de session).
   */
  async resumeActiveDelivery() {
    try {
      const response = await api.get('/driver/deliveries');
      const list = response.data?.data || response.data || [];
      const active = Array.isArray(list)
        ? list.find(d => ACTIVE_DELIVERY_STATUSES.includes(d.status))
        : null;
      if (active) {
        await this.startTracking(active.id, { silent: true });
        return active.id;
      }
      // Plus de livraison active : nettoyer un éventuel suivi orphelin
      if (activeDeliveryId || (await isBackgroundTaskRunning())) {
        await this.stopTracking();
      }
    } catch (_) {}
    return null;
  },

  // Obtenir la position actuelle une seule fois
  async getCurrentPosition() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Permission de localisation refusée');
    }
    const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy,
    };
  },

  isTracking() {
    return !!activeDeliveryId;
  },

  getActiveDeliveryId() {
    return activeDeliveryId;
  },
};
