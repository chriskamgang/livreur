import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, ActivityIndicator, Alert, Linking,
} from 'react-native';
import { deliveryService } from '../../services/deliveryService';
import { locationService } from '../../services/locationService';

const COLORS = { primary: '#FF6B35', bg: '#f8f8f8', card: '#fff', text: '#1a1a1a', gray: '#888' };

const PAYMENT_LABELS = { cash: '💵 Espèces', mtn: '📱 MTN Mobile Money', orange: '🍊 Orange Money' };

export default function DeliveryDetailScreen({ route, navigation }) {
  const { orderId } = route.params;
  const [order,   setOrder]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [acting,  setActing]  = useState(false);

  useEffect(() => {
    loadOrder();

    // Nettoyer le tracking GPS quand on quitte l'écran
    return () => {
      locationService.stopTracking();
    };
  }, [orderId]);

  const loadOrder = async () => {
    try {
      const data = await deliveryService.getDelivery(orderId);
      setOrder(data);
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de charger la commande.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = () => {
    Alert.alert(
      'Accepter la livraison',
      'Voulez-vous prendre en charge cette commande ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Accepter', onPress: async () => {
          setActing(true);
          try {
            await deliveryService.acceptDelivery(orderId);
            await loadOrder();
          } catch (e) {
            Alert.alert('Erreur', e.response?.data?.message || 'Impossible d\'accepter.');
          } finally { setActing(false); }
        }},
      ]
    );
  };

  const handlePickup = () => {
    Alert.alert(
      'Confirmer la récupération',
      'Avez-vous récupéré la commande au restaurant ?',
      [
        { text: 'Non', style: 'cancel' },
        { text: 'Oui, récupérée', onPress: async () => {
          setActing(true);
          try {
            const deliveryId = order.delivery?.id || orderId;
            await deliveryService.pickupDelivery(deliveryId);

            // Démarrer le tracking GPS automatiquement
            try {
              await locationService.startTracking(deliveryId);
              Alert.alert('📍 Tracking GPS activé', 'Votre position sera partagée avec le client en temps réel.');
            } catch (locationError) {
              console.error('Erreur tracking GPS:', locationError);
              Alert.alert('Attention', 'Le tracking GPS n\'a pas pu démarrer. Vérifiez les permissions de localisation.');
            }

            await loadOrder();
          } catch (e) {
            Alert.alert('Erreur', e.response?.data?.message || 'Erreur.');
          } finally { setActing(false); }
        }},
      ]
    );
  };

  const handleComplete = () => {
    Alert.alert(
      'Confirmer la livraison',
      'La commande a-t-elle bien été livrée au client ?',
      [
        { text: 'Non', style: 'cancel' },
        { text: 'Oui, livrée ✅', onPress: async () => {
          setActing(true);
          try {
            await deliveryService.completeDelivery(order.delivery?.id || orderId);

            // Arrêter le tracking GPS
            locationService.stopTracking();

            Alert.alert('🎉 Livraison terminée !', 'Bravo ! La commande a été livrée avec succès.', [
              { text: 'OK', onPress: () => navigation.goBack() }
            ]);
          } catch (e) {
            Alert.alert('Erreur', e.response?.data?.message || 'Erreur.');
          } finally { setActing(false); }
        }},
      ]
    );
  };

  const callClient = () => {
    console.log('callClient appelé - order.client:', order?.client);
    const phone = order?.client?.phone;

    if (!phone) {
      Alert.alert('Erreur', 'Numéro de téléphone non disponible. Vérifiez les données de la commande.');
      return;
    }

    // Nettoyer le numéro (enlever espaces, tirets, etc.)
    const cleanPhone = phone.replace(/[\s-]/g, '');
    console.log('Appel du numéro:', cleanPhone);

    Linking.openURL(`tel:${cleanPhone}`).catch((error) => {
      console.error('Erreur lors de l\'appel:', error);
      Alert.alert('Erreur', 'Impossible de lancer l\'appel téléphonique.');
    });
  };

  const navigateToClient = () => {
    const address = order?.delivery_address?.full_address;
    if (!address) {
      Alert.alert('Erreur', 'Adresse de livraison non disponible');
      return;
    }

    // Ouvrir l'application de navigation (Google Maps / Apple Maps)
    Alert.alert(
      'Navigation',
      'Ouvrir la navigation vers le client ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Google Maps',
          onPress: () => {
            const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
            Linking.openURL(url).catch(() => Alert.alert('Erreur', 'Impossible d\'ouvrir Google Maps'));
          }
        },
        {
          text: 'Apple Maps',
          onPress: () => {
            const url = `http://maps.apple.com/?daddr=${encodeURIComponent(address)}`;
            Linking.openURL(url).catch(() => Alert.alert('Erreur', 'Impossible d\'ouvrir Apple Maps'));
          }
        }
      ]
    );
  };

  if (loading) return <View style={styles.loader}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  if (!order)  return null;

  const delivery    = order.delivery;
  const deliveryId  = delivery?.id;
  const canAccept   = order.status === 'ready' && (!delivery || delivery.status === 'searching');
  const canPickup   = delivery?.status === 'assigned'; // assigned to this driver, not picked up yet
  const canDeliver  = delivery?.status === 'picked_up' || delivery?.status === 'on_the_way';

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Commande #{order.order_number}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        {/* Statut actuel */}
        <View style={[styles.statusBanner, { backgroundColor: canDeliver ? '#FFF3E0' : canPickup ? '#EFF6FF' : '#d1fae5' }]}>
          <Text style={styles.statusBannerIcon}>{canDeliver ? '🚚' : canPickup ? '📦' : '⏳'}</Text>
          <Text style={[styles.statusBannerText, { color: canDeliver ? COLORS.primary : canPickup ? '#3b82f6' : '#10b981' }]}>
            {canDeliver ? 'En cours de livraison' : canPickup ? 'À récupérer au restaurant' : 'En attente d\'acceptation'}
          </Text>
        </View>

        {/* Client */}
        <Text style={styles.sectionTitle}>👤 Client</Text>
        <View style={styles.card}>
          <View style={styles.clientRow}>
            <View style={styles.clientAvatar}>
              <Text style={styles.clientAvatarText}>{order.client?.name?.charAt(0)?.toUpperCase() || '?'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.clientName}>{order.client?.name || 'Client'}</Text>
              <Text style={styles.clientPhone}>{order.client?.phone || 'Téléphone non disponible'}</Text>
            </View>
          </View>
          {/* Bouton d'appel en grand - toujours visible */}
          <TouchableOpacity
            style={[styles.callBtnLarge, !order.client?.phone && styles.callBtnDisabled]}
            onPress={callClient}
            activeOpacity={order.client?.phone ? 0.7 : 1}
          >
            <Text style={styles.callBtnLargeIcon}>📞</Text>
            <Text style={styles.callBtnLargeText}>Appeler le client</Text>
          </TouchableOpacity>
        </View>

        {/* Adresse de livraison */}
        <Text style={styles.sectionTitle}>📍 Livraison</Text>
        <View style={styles.card}>
          <Text style={styles.addressText}>{order.delivery_address?.full_address || 'Adresse non spécifiée'}</Text>
          {order.note && (
            <View style={styles.noteBox}>
              <Text style={styles.noteLabel}>Note du client :</Text>
              <Text style={styles.noteText}>{order.note}</Text>
            </View>
          )}
          {/* Bouton de navigation GPS */}
          {(canPickup || canDeliver) && order.delivery_address?.full_address && (
            <TouchableOpacity style={styles.navBtn} onPress={navigateToClient}>
              <Text style={styles.navBtnIcon}>🧭</Text>
              <Text style={styles.navBtnText}>Démarrer la navigation GPS</Text>
              <Text style={styles.navBtnArrow}>→</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Articles commandés */}
        <Text style={styles.sectionTitle}>📦 Articles à récupérer ({order.items?.length || 0})</Text>
        <View style={styles.card}>
          {/* Restaurant info */}
          {order.restaurant && (
            <View style={styles.restaurantBox}>
              <Text style={styles.restaurantIcon}>🍽️</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.restaurantLabel}>À récupérer chez :</Text>
                <Text style={styles.restaurantName}>{order.restaurant.name}</Text>
                {order.restaurant.address && (
                  <Text style={styles.restaurantAddress}>{order.restaurant.address}</Text>
                )}
              </View>
            </View>
          )}

          {/* Liste des articles */}
          {order.items && order.items.length > 0 ? (
            <View style={{ marginTop: order.restaurant ? 12 : 0 }}>
              {order.items.map((item, idx) => (
                <View key={idx} style={[styles.itemRow, idx < order.items.length - 1 && styles.itemRowBorder]}>
                  <View style={styles.itemQtyBadge}>
                    <Text style={styles.itemQty}>{item.quantity}×</Text>
                  </View>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemPrice}>
                    {(Number(item.unit_price) * item.quantity).toLocaleString('fr-FR')} XAF
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.noItems}>Aucun article</Text>
          )}
        </View>

        {/* Paiement */}
        <Text style={styles.sectionTitle}>💳 Paiement</Text>
        <View style={styles.card}>
          <View style={styles.payRow}>
            <Text style={styles.payLabel}>{PAYMENT_LABELS[order.payment_method] || order.payment_method}</Text>
            <Text style={styles.payTotal}>{Number(order.total_amount).toLocaleString('fr-FR')} XAF</Text>
          </View>
          {order.payment_method === 'cash' && (
            <View style={styles.cashWarning}>
              <Text style={styles.cashWarningText}>⚠️ Encaissez {Number(order.total_amount).toLocaleString('fr-FR')} XAF en espèces</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bouton d'action principal */}
      <View style={styles.footer}>
        {acting ? (
          <View style={styles.actionBtn}>
            <ActivityIndicator color="#fff" />
          </View>
        ) : canAccept ? (
          <TouchableOpacity style={styles.actionBtn} onPress={handleAccept}>
            <Text style={styles.actionBtnText}>✅ Accepter la livraison</Text>
          </TouchableOpacity>
        ) : canPickup ? (
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#10b981' }]} onPress={handlePickup}>
            <Text style={styles.actionBtnText}>📦 Confirmer la récupération</Text>
          </TouchableOpacity>
        ) : canDeliver ? (
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#22c55e' }]} onPress={handleComplete}>
            <Text style={styles.actionBtnText}>🏠 Confirmer la livraison</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  loader:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  backBtn:     { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  backText:    { fontSize: 24, color: COLORS.text },
  headerTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.text },

  statusBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 16, padding: 14, marginBottom: 16,
  },
  statusBannerIcon: { fontSize: 24 },
  statusBannerText: { fontSize: 15, fontWeight: '700' },

  sectionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.gray, marginBottom: 8, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  card: {
    backgroundColor: COLORS.card, borderRadius: 16, padding: 16, marginBottom: 16,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },

  clientRow:        { flexDirection: 'row', alignItems: 'center', gap: 12 },
  clientAvatar:     { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  clientAvatarText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  clientName:       { fontSize: 15, fontWeight: '700', color: COLORS.text },
  clientPhone:      { fontSize: 13, color: COLORS.gray, marginTop: 2 },

  // Bouton d'appel grand format
  callBtnLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
    gap: 8,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  callBtnDisabled: {
    backgroundColor: '#d1d5db',
    shadowColor: '#000',
    shadowOpacity: 0.1,
  },
  callBtnLargeIcon: { fontSize: 20 },
  callBtnLargeText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  addressText: { fontSize: 14, color: COLORS.text, lineHeight: 20 },
  noteBox:     { backgroundColor: '#FFF3E0', borderRadius: 10, padding: 10, marginTop: 10 },
  noteLabel:   { fontSize: 12, fontWeight: '700', color: COLORS.primary, marginBottom: 4 },
  noteText:    { fontSize: 13, color: COLORS.text },

  // Bouton de navigation GPS
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
    gap: 8,
  },
  navBtnIcon:  { fontSize: 20 },
  navBtnText:  { flex: 1, color: '#fff', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  navBtnArrow: { fontSize: 18, color: '#fff', fontWeight: 'bold' },

  // Info restaurant
  restaurantBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderRadius: 10,
    padding: 12,
    gap: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#10b981',
  },
  restaurantIcon:    { fontSize: 24 },
  restaurantLabel:   { fontSize: 11, color: '#059669', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  restaurantName:    { fontSize: 15, fontWeight: '700', color: COLORS.text, marginTop: 2 },
  restaurantAddress: { fontSize: 12, color: COLORS.gray, marginTop: 2 },

  itemRow:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  itemRowBorder: { borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  itemQtyBadge:  {
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 10,
    minWidth: 36,
    alignItems: 'center',
  },
  itemQty:       { fontSize: 13, color: COLORS.primary, fontWeight: '800' },
  itemName:      { flex: 1, fontSize: 14, color: COLORS.text, fontWeight: '500' },
  itemPrice:     { fontSize: 14, fontWeight: '700', color: COLORS.text },
  noItems:       { fontSize: 13, color: COLORS.gray, textAlign: 'center', fontStyle: 'italic' },

  payRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  payLabel:     { fontSize: 15, color: COLORS.text, fontWeight: '600' },
  payTotal:     { fontSize: 18, fontWeight: '800', color: COLORS.primary },
  cashWarning:  { backgroundColor: '#fef9c3', borderRadius: 10, padding: 10, marginTop: 10 },
  cashWarningText: { fontSize: 13, color: '#854d0e', fontWeight: '600' },

  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 16, paddingBottom: 32, backgroundColor: COLORS.card,
    borderTopWidth: 1, borderTopColor: '#f0f0f0',
  },
  actionBtn: {
    backgroundColor: COLORS.primary, borderRadius: 16, paddingVertical: 16,
    alignItems: 'center',
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  actionBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
