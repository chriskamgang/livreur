import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  SafeAreaView, ActivityIndicator, RefreshControl,
} from 'react-native';
import { deliveryService } from '../../services/deliveryService';
import { useFocusEffect } from '@react-navigation/native';

const COLORS = { primary: '#FF6B35', bg: '#f8f8f8', card: '#fff', text: '#1a1a1a', gray: '#888' };

function HistoryCard({ delivery }) {
  const order = delivery.order || {};
  const date = new Date(delivery.delivered_at || delivery.updated_at || delivery.created_at).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
  const time = new Date(delivery.delivered_at || delivery.updated_at || delivery.created_at).toLocaleTimeString('fr-FR', {
    hour: '2-digit', minute: '2-digit',
  });
  const isFailed = delivery.status === 'failed';
  const earnings = Number(delivery.driver_earnings || 0);

  // Fonction pour obtenir le badge de statut
  const getStatusBadge = () => {
    switch (delivery.status) {
      case 'assigned':
        return { bg: '#fef3c7', color: '#f59e0b', text: '📦 Assignée', emoji: '📦' };
      case 'picked_up':
        return { bg: '#dbeafe', color: '#3b82f6', text: '🚗 Récupérée', emoji: '🚗' };
      case 'on_the_way':
        return { bg: '#e0e7ff', color: '#6366f1', text: '🚚 En route', emoji: '🚚' };
      case 'delivered':
        return { bg: '#d1fae5', color: '#16a34a', text: '✅ Livrée', emoji: '✅' };
      case 'failed':
        return { bg: '#fee2e2', color: '#ef4444', text: '❌ Échouée', emoji: '❌' };
      default:
        return { bg: '#f3f4f6', color: '#6b7280', text: '❓ Inconnu', emoji: '❓' };
    }
  };

  const statusBadge = getStatusBadge();

  return (
    <View style={[styles.card, isFailed && styles.cardCancelled]}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.orderNum}>#{order.order_number || delivery.id}</Text>
          <Text style={styles.orderDate}>{date} à {time}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusBadge.bg }]}>
          <Text style={[styles.statusText, { color: statusBadge.color }]}>
            {statusBadge.text}
          </Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.infoRow}>
        <Text style={styles.infoIcon}>🏠</Text>
        <Text style={styles.infoText} numberOfLines={1}>
          {delivery.delivery_address || order.delivery_address?.full_address || 'Adresse inconnue'}
        </Text>
      </View>

      {order.restaurant && (
        <View style={styles.infoRow}>
          <Text style={styles.infoIcon}>🍽️</Text>
          <Text style={styles.infoText} numberOfLines={1}>{order.restaurant.name}</Text>
        </View>
      )}

      <View style={styles.cardFooter}>
        <Text style={styles.itemsCount}>
          {order.user?.name || 'Client'}
        </Text>
        <Text style={[styles.amount, isFailed && { color: COLORS.gray }]}>
          {isFailed ? '—' : `+${earnings.toLocaleString('fr-FR')} XAF`}
        </Text>
      </View>
    </View>
  );
}

export default function HistoryScreen() {
  const [deliveries,    setDeliveries]    = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [totalEarnings, setTotalEarnings] = useState(0);

  const loadHistory = useCallback(async () => {
    try {
      const data = await deliveryService.getHistory();
      // La réponse est paginée: { data: [...], total, ... }
      const list = Array.isArray(data) ? data : (data.data || []);
      setDeliveries(list);
      const earnings = list
        .filter(d => d.status === 'delivered')
        .reduce((sum, d) => sum + Number(d.driver_earnings || 0), 0);
      setTotalEarnings(earnings);
    } catch (e) {
      console.error('Erreur historique:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadHistory(); }, [loadHistory]));

  const onRefresh = () => { setRefreshing(true); loadHistory(); };

  if (loading) return <View style={styles.loader}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

  const delivered = deliveries.filter(d => d.status === 'delivered').length;
  const failed    = deliveries.filter(d => d.status === 'failed').length;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Historique des livraisons</Text>
      </View>

      {/* Résumé gains */}
      {deliveries.length > 0 && (
        <View style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{delivered}</Text>
            <Text style={styles.summaryLabel}>Livraisons</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{failed}</Text>
            <Text style={styles.summaryLabel}>Échouées</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: COLORS.primary }]}>
              {totalEarnings.toLocaleString('fr-FR')}
            </Text>
            <Text style={styles.summaryLabel}>XAF gagnés</Text>
          </View>
        </View>
      )}

      {deliveries.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>📋</Text>
          <Text style={styles.emptyTitle}>Aucune livraison</Text>
          <Text style={styles.emptySubtitle}>Votre historique apparaîtra ici après vos premières livraisons</Text>
        </View>
      ) : (
        <FlatList
          data={deliveries}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => <HistoryCard delivery={item} />}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  loader:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:    { paddingHorizontal: 20, paddingVertical: 16, backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.text },

  summaryCard: {
    flexDirection: 'row', backgroundColor: COLORS.card,
    marginHorizontal: 16, marginTop: 16, borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  summaryItem:    { flex: 1, alignItems: 'center' },
  summaryValue:   { fontSize: 20, fontWeight: 'bold', color: COLORS.text },
  summaryLabel:   { fontSize: 12, color: COLORS.gray, marginTop: 2 },
  summaryDivider: { width: 1, backgroundColor: '#f0f0f0', marginHorizontal: 8 },

  card: {
    backgroundColor: COLORS.card, borderRadius: 16, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  cardCancelled: { opacity: 0.7 },
  cardHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  orderNum:      { fontSize: 15, fontWeight: '700', color: COLORS.text },
  orderDate:     { fontSize: 12, color: COLORS.gray, marginTop: 2 },
  statusBadge:   { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText:    { fontSize: 12, fontWeight: '700' },
  divider:       { height: 1, backgroundColor: '#f0f0f0', marginVertical: 12 },
  infoRow:       { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  infoIcon:      { fontSize: 14 },
  infoText:      { fontSize: 13, color: COLORS.gray, flex: 1 },
  cardFooter:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  itemsCount:    { fontSize: 13, color: COLORS.gray },
  amount:        { fontSize: 16, fontWeight: '800', color: '#22c55e' },

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyEmoji:     { fontSize: 70, marginBottom: 16 },
  emptyTitle:     { fontSize: 20, fontWeight: 'bold', color: COLORS.text, marginBottom: 8 },
  emptySubtitle:  { fontSize: 15, color: COLORS.gray, textAlign: 'center', lineHeight: 22 },
});
