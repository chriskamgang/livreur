import api from './api';

export const deliveryService = {
  // Livraisons en cours assignées au livreur (assigned, picked_up, on_the_way)
  async getPendingDeliveries() {
    const response = await api.get('/driver/deliveries');
    // Filtrer uniquement les livraisons en cours (pas delivered, pas failed)
    const deliveries = response.data?.data || response.data || [];
    return deliveries.filter(d =>
      d.status === 'assigned' ||
      d.status === 'picked_up' ||
      d.status === 'on_the_way'
    );
  },

  // Livraison active en cours (assigned to this driver)
  async getActiveDelivery() {
    const response = await api.get('/driver/available-orders');
    const list = Array.isArray(response.data) ? response.data : [];
    return list.find(o => o.delivery?.status === 'on_the_way' || o.delivery?.status === 'picked_up') || null;
  },

  // Historique des livraisons
  async getHistory() {
    const response = await api.get('/driver/deliveries');
    return response.data;
  },

  // Détail d'une commande pour le livreur
  async getDelivery(orderId) {
    const response = await api.get(`/driver/orders/${orderId}`);
    return response.data;
  },

  // Accepter une commande
  async acceptDelivery(orderId) {
    const response = await api.post(`/driver/orders/${orderId}/accept`);
    return response.data;
  },

  // Marquer comme récupérée (pickup → en livraison)
  async pickupDelivery(deliveryId) {
    const response = await api.post(`/driver/deliveries/${deliveryId}/update-status`, {
      status: 'picked_up',
    });
    return response.data;
  },

  // Marquer en route vers client
  async startDelivery(deliveryId) {
    const response = await api.post(`/driver/deliveries/${deliveryId}/update-status`, {
      status: 'on_the_way',
    });
    return response.data;
  },

  // Marquer comme livrée
  async completeDelivery(deliveryId) {
    const response = await api.post(`/driver/deliveries/${deliveryId}/update-status`, {
      status: 'delivered',
    });
    return response.data;
  },

  // Basculer online/offline
  async updateOnlineStatus(isOnline) {
    const response = await api.post('/driver/toggle-online', { is_online: isOnline });
    return response.data;
  },

  // Statistiques du livreur
  async getStats() {
    const response = await api.get('/driver/stats');
    return response.data;
  },

  // Mettre à jour le profil
  async updateProfile(data) {
    const response = await api.put('/profile', data);
    return response.data;
  },
};
