import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { deliveryService } from '../../services/deliveryService';
import { locationService } from '../../services/locationService';
import { useAuth } from '../../context/AuthContext';
import { useFocusEffect } from '@react-navigation/native';

const COLORS = { primary: '#FF6B35', bg: '#f8f8f8', card: '#fff', text: '#1a1a1a', gray: '#888' };

const STATUS_CONFIG = {
  preparing: { label: 'En préparation',    color: '#d97706', bg: '#fef3c7', iconName: 'flame-outline', badge: 'En préparation' },
  ready:     { label: 'Prête à récupérer', color: '#10b981', bg: '#d1fae5', iconName: 'cube-outline', badge: 'Prête' },
  assigned:            { label: 'Vers le restaurant', color: '#3b82f6', bg: '#EFF6FF', iconName: 'walk-outline' },
  going_to_restaurant: { label: 'Vers le restaurant', color: '#3b82f6', bg: '#EFF6FF', iconName: 'walk-outline' },
  at_restaurant:       { label: 'Au restaurant',      color: '#3b82f6', bg: '#EFF6FF', iconName: 'restaurant-outline' },
  picked_up:  { label: 'Vers le client', color: '#FF6B35', bg: '#FFF3E0', iconName: 'car-outline' },
  on_the_way: { label: 'Vers le client', color: '#FF6B35', bg: '#FFF3E0', iconName: 'car-outline' },
  arrived:    { label: 'Chez le client', color: '#FF6B35', bg: '#FFF3E0', iconName: 'home-outline' },
};

function DeliveryCard({ delivery, onPress }) {
  const order = delivery.order || {};
  const statusKey = delivery.status;
  const status = STATUS_CONFIG[statusKey] || { label: delivery.status, color: COLORS.gray, bg: '#f0f0f0', iconName: 'document-text-outline' };
  const date = new Date(delivery.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const deliveryAddress = delivery.delivery_address || order.restaurant?.address || 'Adresse inconnue';
  const total = order.total || order.total_amount || 0;
  const pickupAddress = delivery.pickup_address || order.restaurant?.address || 'Restaurant';

  return (
    <TouchableOpacity style={styles.modernCard} onPress={() => onPress(delivery)} activeOpacity={0.9}>
      {/* Badge de statut en haut à droite */}
      <View style={[styles.statusCorner, { backgroundColor: status.bg }]}>
        <Ionicons name={status.iconName} size={20} color={status.color} />
      </View>

      {/* En-tête avec numéro et montant */}
      <View style={styles.cardTop}>
        <View style={styles.orderInfo}>
          <Text style={styles.orderLabel}>COMMANDE</Text>
          <Text style={styles.orderNumber}>#{order.order_number || delivery.id}</Text>
          <Text style={styles.orderTimestamp}><Ionicons name="time-outline" size={12} color={COLORS.gray} /> {date}</Text>
          {status.badge && (
            <View style={[styles.stateBadge, { backgroundColor: status.bg }]}>
              <Ionicons name={status.iconName} size={12} color={status.color} />
              <Text style={[styles.stateBadgeText, { color: status.color }]}>{status.badge}</Text>
            </View>
          )}
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
            <Text style={styles.pointLabel}><Ionicons name="cube-outline" size={12} color={COLORS.gray} /> RÉCUPÉRATION</Text>
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
            <Text style={styles.pointLabel}><Ionicons name="home-outline" size={12} color={COLORS.gray} /> LIVRAISON</Text>
            <Text style={styles.pointTitle} numberOfLines={1}>{order.user?.name || 'Client'}</Text>
            <Text style={styles.pointAddress} numberOfLines={2}>{deliveryAddress}</Text>
          </View>
        </View>
      </View>

      {/* Bouton d'action */}
      <View style={styles.actionButton}>
        <Text style={styles.actionButtonText}>{status.label}</Text>
        <Ionicons name="chevron-forward" size={18} color={COLORS.primary} />
      </View>
    </TouchableOpacity>
  );
}

export default function DashboardScreen({ navigation }) {
  const { user }  = useAuth();
  const [deliveries,  setDeliveries]  = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [isOnline,    setIsOnline]    = useState(user?.is_online === true || user?.is_online === 1 || user?.is_online === '1');
  const [stats,       setStats]       = useState(null);
  const [togglingOnline, setTogglingOnline] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const statsData = await deliveryService.getStats().catch(() => null);
      if (statsData) setStats(statsData);

      // Sync online status from server
      const rawOnline = statsData?.is_online ?? isOnline;
      const currentlyOnline = rawOnline === true || rawOnline === 1 || rawOnline === '1';
      setIsOnline(currentlyOnline);

      if (currentlyOnline) {
        // Charger les livraisons actives ET les commandes disponibles en parallèle
        const [active, available] = await Promise.all([
          deliveryService.getActiveDeliveries().catch(() => null),
          deliveryService.getAvailableOrders().catch(() => []),
        ]);
        // GPS : suivi de la livraison en cours, sinon position légère pour la carte admin
        const activeList = Array.isArray(active) ? active : [];
        if (activeList.length > 0) {
          locationService.startTracking(activeList[0].id, { silent: true });
        } else if (active !== null) { // ne rien arrêter si la requête a échoué
          if (locationService.isTracking()) await locationService.stopTracking();
          locationService.startIdleTracking();
        }
        // Livraisons actives en premier, puis commandes disponibles
        setDeliveries([...(Array.isArray(active) ? active : []), ...(Array.isArray(available) ? available : [])]);
      } else {
        locationService.stopIdleTracking();
        setDeliveries([]);
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
    const interval = setInterval(loadData, 15000); // Rafraîchir toutes les 15s
    return () => clearInterval(interval);
  }, [loadData]));

  const handleToggleOnline = async (value) => {
    setTogglingOnline(true);
    try {
      await deliveryService.updateOnlineStatus(value);
      setIsOnline(value);
      if (value) locationService.startIdleTracking();
      else locationService.stopIdleTracking();
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
            <Text style={styles.greeting}>Bonjour, {user?.name?.split(' ')[0]}</Text>
            <Text style={styles.subGreeting}>Livreur</Text>
          </View>
        </View>
        {/* Toggle en ligne */}
        <View style={styles.onlineToggle}>
          <Text style={[styles.onlineLabel, { color: isOnline ? '#22c55e' : COLORS.gray }]}>
            <Ionicons name={isOnline ? 'radio-button-on' : 'radio-button-off'} size={12} color={isOnline ? '#22c55e' : COLORS.gray} /> {isOnline ? 'En ligne' : 'Hors ligne'}
          </Text>
          <TouchableOpacity
            style={[styles.toggleTrack, isOnline && styles.toggleTrackOn]}
            onPress={() => !togglingOnline && handleToggleOnline(!isOnline)}
            activeOpacity={0.7}
          >
            <View style={[styles.toggleThumb, isOnline && styles.toggleThumbOn]} />
          </TouchableOpacity>
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
            <Text style={styles.statValue}><Ionicons name="star" size={16} color={COLORS.primary} /> {Number(stats.rating ?? 0).toFixed(1)}</Text>
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
          <Ionicons name="moon-outline" size={70} color={COLORS.gray} style={{ marginBottom: 16 }} />
          <Text style={styles.offlineTitle}>Vous êtes hors ligne</Text>
          <Text style={styles.offlineSubtitle}>Activez le bouton "En ligne" pour recevoir des commandes</Text>
        </View>
      ) : deliveries.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="bicycle-outline" size={70} color={COLORS.gray} style={{ marginBottom: 16 }} />
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
              onPress={delivery => navigation.navigate('DeliveryDetail', { orderId: delivery.order_id || delivery.order?.id })}
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
  onlineToggle:{ alignItems: 'flex-end', gap: 6 },
  onlineLabel: { fontSize: 12, fontWeight: '600' },
  toggleTrack: {
    width: 50, height: 28, borderRadius: 14,
    backgroundColor: '#e0e0e0', justifyContent: 'center', paddingHorizontal: 3,
  },
  toggleTrackOn: { backgroundColor: '#86efac' },
  toggleThumb: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#ccc',
  },
  toggleThumbOn: { backgroundColor: '#22c55e', alignSelf: 'flex-end' },

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
  stateBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, marginTop: 6,
  },
  stateBadgeText: { fontSize: 11, fontWeight: '700' },

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
