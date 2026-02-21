import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  SafeAreaView, ActivityIndicator, RefreshControl, Switch, Alert,
} from 'react-native';
import { deliveryService } from '../../services/deliveryService';
import { useAuth } from '../../context/AuthContext';
import { useFocusEffect } from '@react-navigation/native';

const COLORS = { primary: '#FF6B35', bg: '#f8f8f8', card: '#fff', text: '#1a1a1a', gray: '#888' };

const STATUS_CONFIG = {
  ready:     { label: 'Prête à récupérer', color: '#10b981', bg: '#d1fae5', icon: '📦' },
  assigned:  { label: 'À récupérer',       color: '#3b82f6', bg: '#EFF6FF', icon: '🏃' },
  picked_up: { label: 'En route',          color: '#FF6B35', bg: '#FFF3E0', icon: '🚚' },
  on_the_way:{ label: 'En livraison',      color: '#FF6B35', bg: '#FFF3E0', icon: '🚚' },
};

function DeliveryCard({ delivery, onPress }) {
  const order = delivery.order || {};
  const statusKey = delivery.status;
  const status = STATUS_CONFIG[statusKey] || { label: delivery.status, color: COLORS.gray, bg: '#f0f0f0', icon: '📋' };
  const date = new Date(delivery.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const deliveryAddress = delivery.delivery_address || order.restaurant?.address || 'Adresse inconnue';
  const total = order.total || order.total_amount || 0;
  const pickupAddress = delivery.pickup_address || order.restaurant?.address || 'Restaurant';

  return (
    <TouchableOpacity style={styles.modernCard} onPress={() => onPress(delivery)} activeOpacity={0.9}>
      {/* Badge de statut en haut à droite */}
      <View style={[styles.statusCorner, { backgroundColor: status.bg }]}>
        <Text style={[styles.statusCornerText, { color: status.color }]}>{status.icon}</Text>
      </View>

      {/* En-tête avec numéro et montant */}
      <View style={styles.cardTop}>
        <View style={styles.orderInfo}>
          <Text style={styles.orderLabel}>COMMANDE</Text>
          <Text style={styles.orderNumber}>#{order.order_number || delivery.id}</Text>
          <Text style={styles.orderTimestamp}>🕐 {date}</Text>
        </View>
        <View style={styles.amountBox}>
          <Text style={styles.amountLabel}>MONTANT</Text>
          <Text style={styles.amountValue}>{Number(total).toLocaleString('fr-FR')}</Text>
          <Text style={styles.amountCurrency}>XAF</Text>
        </View>
      </View>

      <View style={styles.thinDivider} />

      {/* Trajet: Récupération → Livraison */}
      <View style={styles.routeContainer}>
        {/* Point A: Récupération */}
        <View style={styles.routePoint}>
          <View style={styles.pointDotPickup}>
            <Text style={styles.pointDotText}>A</Text>
          </View>
          <View style={styles.pointContent}>
            <Text style={styles.pointLabel}>📦 RÉCUPÉRATION</Text>
            {order.restaurant && (
              <Text style={styles.pointTitle} numberOfLines={1}>{order.restaurant.name}</Text>
            )}
            <Text style={styles.pointAddress} numberOfLines={2}>{pickupAddress}</Text>
          </View>
        </View>

        {/* Ligne de trajet */}
        <View style={styles.routeLine} />

        {/* Point B: Livraison */}
        <View style={styles.routePoint}>
          <View style={styles.pointDotDelivery}>
            <Text style={styles.pointDotText}>B</Text>
          </View>
          <View style={styles.pointContent}>
            <Text style={styles.pointLabel}>🏠 LIVRAISON</Text>
            <Text style={styles.pointTitle} numberOfLines={1}>{order.user?.name || 'Client'}</Text>
            <Text style={styles.pointAddress} numberOfLines={2}>{deliveryAddress}</Text>
          </View>
        </View>
      </View>

      {/* Bouton d'action */}
      <View style={styles.actionButton}>
        <Text style={styles.actionButtonText}>{status.label}</Text>
        <Text style={styles.actionArrow}>→</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function DashboardScreen({ navigation }) {
  const { user }  = useAuth();
  const [deliveries,  setDeliveries]  = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [isOnline,    setIsOnline]    = useState(user?.is_online ?? false);
  const [stats,       setStats]       = useState(null);
  const [togglingOnline, setTogglingOnline] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const statsData = await deliveryService.getStats().catch(() => null);
      if (statsData) setStats(statsData);

      // Si hors ligne, on ne charge pas les commandes (l'API renvoie 403)
      const currentlyOnline = statsData?.is_online ?? isOnline;
      if (currentlyOnline) {
        const pending = await deliveryService.getPendingDeliveries().catch(() => []);
        const list = Array.isArray(pending) ? pending : [];
        setDeliveries(list);
      } else {
        setDeliveries([]);
        setIsOnline(false);
      }
    } catch (e) {
      console.error('Erreur chargement livraisons:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isOnline]);

  useFocusEffect(useCallback(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Rafraîchir toutes les 30s
    return () => clearInterval(interval);
  }, [loadData]));

  const handleToggleOnline = async (value) => {
    setTogglingOnline(true);
    try {
      await deliveryService.updateOnlineStatus(value);
      setIsOnline(value);
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de modifier votre statut.');
    } finally {
      setTogglingOnline(false);
    }
  };

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const initial = user?.name?.charAt(0)?.toUpperCase() || '?';

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View>
            <Text style={styles.greeting}>Bonjour, {user?.name?.split(' ')[0]} 👋</Text>
            <Text style={styles.subGreeting}>Livreur</Text>
          </View>
        </View>
        {/* Toggle en ligne */}
        <View style={styles.onlineToggle}>
          <Text style={[styles.onlineLabel, { color: isOnline ? '#22c55e' : COLORS.gray }]}>
            {isOnline ? '🟢 En ligne' : '⚫ Hors ligne'}
          </Text>
          <Switch
            value={isOnline}
            onValueChange={handleToggleOnline}
            disabled={togglingOnline}
            trackColor={{ false: '#e0e0e0', true: '#86efac' }}
            thumbColor={isOnline ? '#22c55e' : '#ccc'}
          />
        </View>
      </View>

      {/* Stats rapides */}
      {stats && (
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.today_deliveries ?? 0}</Text>
            <Text style={styles.statLabel}>Aujourd'hui</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.total_deliveries ?? 0}</Text>
            <Text style={styles.statLabel}>Total livraisons</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>⭐ {Number(stats.rating ?? 0).toFixed(1)}</Text>
            <Text style={styles.statLabel}>Votre note</Text>
          </View>
        </View>
      )}

      {/* Liste */}
      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>
          {isOnline ? 'Commandes disponibles' : 'Passez en ligne pour recevoir des commandes'}
        </Text>
        {deliveries.length > 0 && (
          <Text style={styles.listCount}>{deliveries.length}</Text>
        )}
      </View>

      {loading ? (
        <View style={styles.loader}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      ) : !isOnline ? (
        <View style={styles.offlineContainer}>
          <Text style={styles.offlineEmoji}>😴</Text>
          <Text style={styles.offlineTitle}>Vous êtes hors ligne</Text>
          <Text style={styles.offlineSubtitle}>Activez le bouton "En ligne" pour recevoir des commandes</Text>
        </View>
      ) : deliveries.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>🛵</Text>
          <Text style={styles.emptyTitle}>Aucune commande disponible</Text>
          <Text style={styles.emptySubtitle}>Les nouvelles commandes apparaîtront ici automatiquement</Text>
        </View>
      ) : (
        <FlatList
          data={deliveries}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => (
            <DeliveryCard
              delivery={item}
              onPress={delivery => navigation.navigate('DeliveryDetail', { orderId: delivery.order_id })}
            />
          )}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  headerLeft:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar:      { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  avatarText:  { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  greeting:    { fontSize: 15, fontWeight: 'bold', color: COLORS.text },
  subGreeting: { fontSize: 12, color: COLORS.gray },
  onlineToggle:{ alignItems: 'flex-end', gap: 2 },
  onlineLabel: { fontSize: 12, fontWeight: '600' },

  statsRow: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  statCard:  { flex: 1, alignItems: 'center', padding: 10, backgroundColor: '#FFF3E0', borderRadius: 14 },
  statValue: { fontSize: 18, fontWeight: 'bold', color: COLORS.primary },
  statLabel: { fontSize: 10, color: COLORS.gray, marginTop: 2, textAlign: 'center' },

  listHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12,
  },
  listTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  listCount: {
    backgroundColor: COLORS.primary, color: '#fff',
    fontSize: 12, fontWeight: 'bold',
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, overflow: 'hidden',
  },

  loader:           { flex: 1, justifyContent: 'center', alignItems: 'center' },
  offlineContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  offlineEmoji:     { fontSize: 70, marginBottom: 16 },
  offlineTitle:     { fontSize: 20, fontWeight: 'bold', color: COLORS.text, marginBottom: 8 },
  offlineSubtitle:  { fontSize: 15, color: COLORS.gray, textAlign: 'center', lineHeight: 22 },
  emptyContainer:   { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyEmoji:       { fontSize: 70, marginBottom: 16 },
  emptyTitle:       { fontSize: 20, fontWeight: 'bold', color: COLORS.text, marginBottom: 8 },
  emptySubtitle:    { fontSize: 15, color: COLORS.gray, textAlign: 'center', lineHeight: 22 },

  // Nouvelle carte moderne
  modernCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 0,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  statusCorner: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  statusCornerText: { fontSize: 20 },

  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    paddingRight: 60,
  },
  orderInfo: { flex: 1 },
  orderLabel: { fontSize: 10, fontWeight: '700', color: COLORS.gray, letterSpacing: 0.5 },
  orderNumber: { fontSize: 18, fontWeight: '800', color: COLORS.text, marginTop: 4 },
  orderTimestamp: { fontSize: 12, color: COLORS.gray, marginTop: 4 },

  amountBox: { alignItems: 'flex-end' },
  amountLabel: { fontSize: 10, fontWeight: '700', color: COLORS.gray, letterSpacing: 0.5 },
  amountValue: { fontSize: 20, fontWeight: '800', color: COLORS.primary, marginTop: 4 },
  amountCurrency: { fontSize: 11, color: COLORS.gray, marginTop: 2 },

  thinDivider: { height: 1, backgroundColor: '#f0f0f0', marginHorizontal: 16 },

  routeContainer: { padding: 16, paddingTop: 12 },
  routePoint: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  pointDotPickup: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  pointDotDelivery: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  pointDotText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  pointContent: { flex: 1, paddingTop: 2 },
  pointLabel: { fontSize: 10, fontWeight: '700', color: COLORS.gray, letterSpacing: 0.5 },
  pointTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginTop: 4 },
  pointAddress: { fontSize: 12, color: COLORS.gray, marginTop: 2, lineHeight: 16 },

  routeLine: {
    width: 2,
    height: 20,
    backgroundColor: '#e0e0e0',
    marginLeft: 15,
    marginBottom: 12,
  },

  actionButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 14,
    marginTop: 4,
  },
  actionButtonText: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  actionArrow: { fontSize: 18, color: COLORS.primary, fontWeight: 'bold' },
});
