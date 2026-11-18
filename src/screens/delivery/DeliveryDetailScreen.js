import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Linking, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { deliveryService } from '../../services/deliveryService';
import { locationService } from '../../services/locationService';

const COLORS = { primary: '#FF6B35', bg: '#f8f8f8', card: '#fff', text: '#1a1a1a', gray: '#888' };

// Étapes côté livreur
const TO_RESTAURANT_STATUSES = ['assigned', 'going_to_restaurant', 'at_restaurant'];
const TO_CLIENT_STATUSES     = ['picked_up', 'on_the_way', 'arrived'];

const PAYMENT_LABELS = { cash: 'Especes', mtn: 'MTN Mobile Money', orange: 'Orange Money', mtn_money: 'MTN Mobile Money', orange_money: 'Orange Money' };

export default function DeliveryDetailScreen({ route, navigation }) {
  const { orderId } = route.params;
  const [order,   setOrder]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [acting,  setActing]  = useState(false);

  useEffect(() => {
    // Le suivi GPS continue quand on quitte l'écran : il s'arrête à la livraison / l'annulation
    loadOrder({ syncTracking: true });
  }, [orderId]);

  const loadOrder = async ({ syncTracking = false } = {}) => {
    try {
      const data = await deliveryService.getDelivery(orderId);
      setOrder(data);
      if (syncTracking) syncDeliveryState(data);
      return data;
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de charger la commande.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  // À la réouverture : rattraper un statut intermédiaire et relancer le GPS si besoin
  const syncDeliveryState = async (data) => {
    const d = data?.delivery;
    if (!d?.id) return;
    if (TO_RESTAURANT_STATUSES.includes(d.status) || TO_CLIENT_STATUSES.includes(d.status)) {
      locationService.startTracking(d.id, { silent: true });
      try {
        if (d.status === 'assigned') {
          await deliveryService.updateStatus(d.id, 'going_to_restaurant');
          await loadOrder();
        } else if (d.status === 'picked_up') {
          await deliveryService.updateStatus(d.id, 'on_the_way');
          await loadOrder();
        }
      } catch (_) {}
    } else if (['delivered', 'failed'].includes(d.status) && locationService.getActiveDeliveryId() === String(d.id)) {
      locationService.stopTracking();
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
            const res = await deliveryService.acceptDelivery(orderId);
            const deliveryId = res?.delivery?.id || order?.delivery?.id;
            if (deliveryId) {
              // Partage de position dès l'acceptation (trajet vers le restaurant)
              await locationService.startTracking(deliveryId);
              try {
                await deliveryService.updateStatus(deliveryId, 'going_to_restaurant');
              } catch (err) {
                console.warn('going_to_restaurant:', err?.response?.data?.message || err?.message);
              }
            }
            await loadOrder();
          } catch (e) {
            Alert.alert('Erreur', e.response?.data?.message || 'Impossible d\'accepter.');
          } finally { setActing(false); }
        }},
      ]
    );
  };

  // Au restaurant : un seul bouton → récupérée puis en route vers le client
  const handleTakeOrder = () => {
    Alert.alert(
      'Commande récupérée ?',
      'Confirmez que la commande est prête et que vous l\'avez en main.',
      [
        { text: 'Non', style: 'cancel' },
        { text: 'Oui, je la récupère', onPress: async () => {
          setActing(true);
          const deliveryId = order.delivery?.id;
          try {
            await deliveryService.updateStatus(deliveryId, 'picked_up');
            await deliveryService.updateStatus(deliveryId, 'on_the_way');
            locationService.startTracking(deliveryId);
          } catch (e) {
            Alert.alert('Erreur', e.response?.data?.message || 'Erreur.');
          } finally {
            await loadOrder();
            setActing(false);
          }
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
        { text: 'Oui, livrée', onPress: async () => {
          setActing(true);
          try {
            await deliveryService.completeDelivery(order.delivery?.id);

            // Arrêter le tracking GPS
            await locationService.stopTracking();

            Alert.alert('Livraison terminée !', 'Bravo ! La commande a été livrée avec succès.', [
              { text: 'OK', onPress: () => navigation.goBack() }
            ]);
          } catch (e) {
            Alert.alert('Erreur', e.response?.data?.message || 'Erreur.');
          } finally { setActing(false); }
        }},
      ]
    );
  };

  const handleReject = () => {
    Alert.alert(
      'Annuler la livraison',
      'Voulez-vous vraiment annuler cette livraison ? Elle sera proposée aux autres livreurs.',
      [
        { text: 'Non', style: 'cancel' },
        { text: 'Oui, annuler', style: 'destructive', onPress: async () => {
          setActing(true);
          try {
            await deliveryService.rejectDelivery(orderId);
            // Le backend ne libère la livraison que si elle est encore "assigned" : vérifier
            let fresh = null;
            try { fresh = (await deliveryService.getDelivery(orderId))?.delivery; } catch (_) {}
            if (fresh && fresh.status !== 'searching') {
              setOrder(prev => (prev ? { ...prev, delivery: fresh } : prev));
              Alert.alert('Annulation impossible', 'Cette livraison ne peut plus être annulée depuis l\'application. Contactez le support.');
              return;
            }
            await locationService.stopTracking();
            Alert.alert('Livraison annulée', 'La commande a été remise en disponibilité.', [
              { text: 'OK', onPress: () => navigation.goBack() }
            ]);
          } catch (e) {
            Alert.alert('Erreur', e.response?.data?.message || 'Impossible d\'annuler.');
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

  // Ouvre Google Maps / Apple Maps vers des coordonnées (ou à défaut une adresse)
  const openNavigation = (lat, lng, address, label) => {
    const hasCoords = lat != null && lng != null && !isNaN(Number(lat)) && !isNaN(Number(lng));
    if (!hasCoords && !address) {
      Alert.alert('Erreur', 'Adresse non disponible');
      return;
    }
    const dest = hasCoords ? `${Number(lat)},${Number(lng)}` : encodeURIComponent(address);
    const google = () => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`)
      .catch(() => Alert.alert('Erreur', 'Impossible d\'ouvrir Google Maps'));
    const apple = () => Linking.openURL(`http://maps.apple.com/?daddr=${dest}&dirflg=d`)
      .catch(() => Alert.alert('Erreur', 'Impossible d\'ouvrir Apple Maps'));

    const buttons = [{ text: 'Annuler', style: 'cancel' }, { text: 'Google Maps', onPress: google }];
    if (Platform.OS === 'ios') buttons.push({ text: 'Apple Maps', onPress: apple });
    Alert.alert('Navigation', `Ouvrir la navigation vers ${label} ?`, buttons);
  };

  const navigateToRestaurant = () => {
    const r = order?.restaurant;
    openNavigation(r?.latitude, r?.longitude, r?.address, 'le restaurant');
  };

  const navigateToClient = () => {
    const a = order?.address;
    openNavigation(a?.latitude, a?.longitude, order?.delivery_address?.full_address, 'le client');
  };

  if (loading) return <View style={styles.loader}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  if (!order)  return null;

  const delivery    = order.delivery;
  const deliveryId  = delivery?.id;
  const isPickable  = order.status === 'preparing' || order.status === 'ready';
  const canAccept   = isPickable && (!delivery || delivery.status === 'searching');
  const toRestaurant = TO_RESTAURANT_STATUSES.includes(delivery?.status);
  const toClient     = TO_CLIENT_STATUSES.includes(delivery?.status);
  const isPreparing  = order.status === 'preparing';

  const banner = toClient
    ? { text: 'En route vers le client', icon: 'car-outline', color: COLORS.primary, bg: '#FFF3E0' }
    : toRestaurant
      ? { text: 'En route vers le restaurant', icon: 'walk-outline', color: '#3b82f6', bg: '#EFF6FF' }
      : canAccept
        ? (isPreparing
          ? { text: 'En préparation au restaurant', icon: 'flame-outline', color: '#d97706', bg: '#fef3c7' }
          : { text: 'Prête — en attente d\'un livreur', icon: 'cube-outline', color: '#10b981', bg: '#d1fae5' })
        : { text: 'Commande terminée', icon: 'checkmark-done-outline', color: '#10b981', bg: '#d1fae5' };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Commande #{order.order_number}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        {/* Statut actuel */}
        <View style={[styles.statusBanner, { backgroundColor: banner.bg }]}>
          <Ionicons name={banner.icon} size={24} color={banner.color} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.statusBannerText, { color: banner.color }]}>{banner.text}</Text>
            {toRestaurant && (
              <Text style={styles.statusBannerSub}>
                {isPreparing ? 'Le restaurant prépare encore la commande.' : 'La commande est prête au restaurant.'}
              </Text>
            )}
            {(toRestaurant || toClient) && (
              <Text style={styles.statusBannerSub}>
                <Ionicons name="locate-outline" size={12} color={COLORS.gray} /> Votre position est partagée avec le client
              </Text>
            )}
          </View>
        </View>

        {toRestaurant && order.restaurant && (
          <TouchableOpacity style={[styles.navBtn, { backgroundColor: '#10b981', marginTop: 0, marginBottom: 16 }]} onPress={navigateToRestaurant}>
            <Ionicons name="restaurant-outline" size={20} color="#fff" />
            <Text style={styles.navBtnText}>Naviguer vers le restaurant</Text>
            <Ionicons name="chevron-forward" size={18} color="#fff" />
          </TouchableOpacity>
        )}

        {/* Client */}
        <Text style={styles.sectionTitle}><Ionicons name="person-outline" size={14} color={COLORS.gray} /> Client</Text>
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
            <Ionicons name="call-outline" size={20} color="#fff" />
            <Text style={styles.callBtnLargeText}>Appeler le client</Text>
          </TouchableOpacity>
        </View>

        {/* Adresse de livraison */}
        <Text style={styles.sectionTitle}><Ionicons name="location-outline" size={14} color={COLORS.gray} /> Livraison</Text>
        <View style={styles.card}>
          <Text style={styles.addressText}>{order.delivery_address?.full_address || 'Adresse non spécifiée'}</Text>
          {order.note && (
            <View style={styles.noteBox}>
              <Text style={styles.noteLabel}>Note du client :</Text>
              <Text style={styles.noteText}>{order.note}</Text>
            </View>
          )}
          {/* Bouton de navigation GPS */}
          {toClient && (order.delivery_address?.full_address || order.address?.latitude) && (
            <TouchableOpacity style={styles.navBtn} onPress={navigateToClient}>
              <Ionicons name="navigate-outline" size={20} color="#fff" />
              <Text style={styles.navBtnText}>Naviguer vers le client</Text>
              <Ionicons name="chevron-forward" size={18} color="#fff" />
            </TouchableOpacity>
          )}
        </View>

        {/* Articles commandés */}
        <Text style={styles.sectionTitle}><Ionicons name="cube-outline" size={14} color={COLORS.gray} /> Articles a recuperer ({order.items?.length || 0})</Text>
        <View style={styles.card}>
          {/* Restaurant info */}
          {order.restaurant && (
            <View style={styles.restaurantBox}>
              <Ionicons name="restaurant-outline" size={24} color="#10b981" />
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
        <Text style={styles.sectionTitle}><Ionicons name="card-outline" size={14} color={COLORS.gray} /> Paiement</Text>
        <View style={styles.card}>
          <View style={styles.payRow}>
            <Text style={styles.payLabel}>{PAYMENT_LABELS[order.payment_method] || order.payment_method}</Text>
            <Text style={styles.payTotal}>{Number(order.total_amount).toLocaleString('fr-FR')} XAF</Text>
          </View>
          {order.payment_method === 'cash' && (
            <View style={styles.cashWarning}>
              <Text style={styles.cashWarningText}><Ionicons name="alert-circle-outline" size={14} color="#854d0e" /> Encaissez {Number(order.total_amount).toLocaleString('fr-FR')} XAF en especes</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Boutons d'action */}
      <View style={styles.footer}>
        {acting ? (
          <View style={styles.actionBtn}>
            <ActivityIndicator color="#fff" />
          </View>
        ) : canAccept ? (
          <TouchableOpacity style={styles.actionBtn} onPress={handleAccept}>
            <Text style={styles.actionBtnText}><Ionicons name="checkmark-circle-outline" size={18} color="#fff" /> Accepter la livraison</Text>
          </TouchableOpacity>
        ) : toRestaurant ? (
          <>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#3b82f6' }]} onPress={handleTakeOrder}>
              <Text style={styles.actionBtnText}><Ionicons name="bag-check-outline" size={18} color="#fff" /> Commande prête — je la récupère</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.rejectBtn} onPress={handleReject}>
              <Text style={styles.rejectBtnText}><Ionicons name="close-circle-outline" size={16} color="#ef4444" /> Annuler la livraison</Text>
            </TouchableOpacity>
          </>
        ) : toClient ? (
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#22c55e' }]} onPress={handleComplete}>
            <Text style={styles.actionBtnText}><Ionicons name="home-outline" size={18} color="#fff" /> Commande livrée</Text>
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
  statusBannerSub:  { fontSize: 12, color: COLORS.gray, marginTop: 2 },

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
  rejectBtn: {
    borderWidth: 1.5, borderColor: '#ef4444', borderRadius: 16, paddingVertical: 14,
    alignItems: 'center', marginTop: 10,
  },
  rejectBtnText: { color: '#ef4444', fontSize: 15, fontWeight: '700' },
});
