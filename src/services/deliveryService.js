import api from './api';
import { ACTIVE_DELIVERY_STATUSES } from './locationService';

export const deliveryService = {
  // Commandes disponibles (en préparation ou prêtes, en attente d'un livreur)
  async getAvailableOrders() {
    const response = await api.get('/driver/available-orders');
    const orders = Array.isArray(response.data) ? response.data : [];
    // Transformer les Orders en format compatible DeliveryCard
    return orders.map(order => ({
      id: order.delivery?.id || order.id,
      order_id: order.id,
      status: order.status === 'preparing' ? 'preparing' : 'ready',
      order_status: order.status,
      created_at: order.created_at,
      order: {
        id: order.id,
        order_number: order.order_number,
        total: order.total,
        total_amount: order.total_amount,
        restaurant: order.restaurant,
        user: order.user,
      },
      delivery_address: order.address?.address || order.delivery_address || '',
      pickup_address: order.restaurant?.address || '',
    }));
  },

  // Livraisons en cours assignées au livreur (assigned → arrived)
  async getActiveDeliveries() {
    const response = await api.get('/driver/deliveries');
    const deliveries = response.data?.data || response.data || [];
    return deliveries.filter(d => ACTIVE_DELIVERY_STATUSES.includes(d.status));
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

  // Annuler/refuser une livraison
  async rejectDelivery(orderId) {
    const response = await api.post(`/driver/orders/${orderId}/reject`);
    return response.data;
  },

  // Mettre à jour le statut de livraison (going_to_restaurant, at_restaurant, picked_up, …)
  async updateStatus(deliveryId, status, notes) {
    const body = { status };
    if (notes) body.notes = notes;
    const response = await api.post(`/driver/deliveries/${deliveryId}/update-status`, body);
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
