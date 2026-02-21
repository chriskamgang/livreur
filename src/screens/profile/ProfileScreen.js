import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, ScrollView, Alert, Switch, ActivityIndicator,
  TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { deliveryService } from '../../services/deliveryService';

const COLORS = { primary: '#FF6B35', bg: '#f8f8f8', card: '#fff', text: '#1a1a1a', gray: '#888' };

export default function ProfileScreen() {
  const { user, logout, updateUser } = useAuth();
  const [editing,  setEditing]  = useState(false);
  const [name,     setName]     = useState(user?.name    || '');
  const [phone,    setPhone]    = useState(user?.phone   || '');
  const [loading,  setLoading]  = useState(false);

  const initial = user?.name?.charAt(0)?.toUpperCase() || '?';

  const handleLogout = () => {
    Alert.alert(
      'Déconnexion',
      'Voulez-vous vraiment vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Se déconnecter', style: 'destructive', onPress: logout },
      ]
    );
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Erreur', 'Le nom est obligatoire.');
      return;
    }
    setLoading(true);
    try {
      const updated = await deliveryService.updateProfile({ name: name.trim(), phone: phone.trim() });
      updateUser(updated);
      setEditing(false);
      Alert.alert('Succès', 'Profil mis à jour !');
    } catch (e) {
      Alert.alert('Erreur', e.response?.data?.message || 'Impossible de mettre à jour.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setName(user?.name || '');
    setPhone(user?.phone || '');
    setEditing(false);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Mon profil</Text>
          {!editing && (
            <TouchableOpacity onPress={() => setEditing(true)}>
              <Text style={styles.editBtn}>Modifier</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Avatar */}
          <View style={styles.avatarSection}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
            <Text style={styles.avatarName}>{user?.name}</Text>
            <View style={[styles.roleBadge, { backgroundColor: '#FFF3E0' }]}>
              <Text style={styles.roleText}>🛵 Livreur</Text>
            </View>
          </View>

          {/* Formulaire / Infos */}
          <View style={styles.section}>
            {editing ? (
              <View style={styles.card}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Nom complet</Text>
                  <TextInput
                    style={styles.input}
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                    placeholderTextColor="#aaa"
                  />
                </View>
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Email</Text>
                  <TextInput
                    style={[styles.input, styles.inputDisabled]}
                    value={user?.email || ''}
                    editable={false}
                  />
                </View>
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Téléphone</Text>
                  <TextInput
                    style={styles.input}
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    placeholderTextColor="#aaa"
                  />
                </View>

                <View style={styles.editActions}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={handleCancelEdit}>
                    <Text style={styles.cancelBtnText}>Annuler</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.saveBtn, loading && { opacity: 0.7 }]}
                    onPress={handleSave}
                    disabled={loading}
                  >
                    {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>Enregistrer</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.card}>
                <InfoRow icon="👤" label="Nom"       value={user?.name} />
                <View style={styles.divider} />
                <InfoRow icon="✉️"  label="Email"     value={user?.email} />
                <View style={styles.divider} />
                <InfoRow icon="📞" label="Téléphone" value={user?.phone || 'Non renseigné'} />
              </View>
            )}
          </View>

          {/* Statut du compte */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Statut du compte</Text>
            <View style={styles.card}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Compte</Text>
                <View style={[styles.chip, { backgroundColor: user?.status === 'active' ? '#d1fae5' : '#fee2e2' }]}>
                  <Text style={{ color: user?.status === 'active' ? '#16a34a' : '#ef4444', fontWeight: '700', fontSize: 13 }}>
                    {user?.status === 'active' ? '✅ Actif' : '⚠️ Suspendu'}
                  </Text>
                </View>
              </View>
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Vérification</Text>
                <View style={[styles.chip, { backgroundColor: user?.is_verified ? '#d1fae5' : '#fef9c3' }]}>
                  <Text style={{ color: user?.is_verified ? '#16a34a' : '#854d0e', fontWeight: '700', fontSize: 13 }}>
                    {user?.is_verified ? '✅ Vérifié' : '⏳ En attente'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Déconnexion */}
          <View style={[styles.section, { marginTop: 8 }]}>
            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <Text style={styles.logoutText}>🚪 Se déconnecter</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 }}>
      <Text style={{ fontSize: 18, width: 28, textAlign: 'center' }}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 12, color: '#888', marginBottom: 2 }}>{label}</Text>
        <Text style={{ fontSize: 15, color: '#1a1a1a', fontWeight: '500' }}>{value || '—'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.text },
  editBtn:     { color: COLORS.primary, fontSize: 15, fontWeight: '600' },

  avatarSection: { alignItems: 'center', paddingVertical: 28, backgroundColor: COLORS.card, marginBottom: 8 },
  avatar:      { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  avatarText:  { fontSize: 36, fontWeight: 'bold', color: '#fff' },
  avatarName:  { fontSize: 20, fontWeight: 'bold', color: COLORS.text, marginBottom: 6 },
  roleBadge:   { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20 },
  roleText:    { fontSize: 13, color: COLORS.primary, fontWeight: '700' },

  section:      { marginHorizontal: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: COLORS.gray, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  card:         { backgroundColor: COLORS.card, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  divider:      { height: 1, backgroundColor: '#f0f0f0', marginVertical: 2 },

  infoRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  infoLabel: { fontSize: 14, color: COLORS.gray },
  chip:      { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },

  fieldGroup: { gap: 6, marginBottom: 12 },
  label:      { fontSize: 14, fontWeight: '600', color: COLORS.text },
  input: {
    borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: COLORS.text, backgroundColor: '#fafafa',
  },
  inputDisabled: { backgroundColor: '#f5f5f5', color: COLORS.gray },
  editActions:   { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn:     { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1.5, borderColor: '#e0e0e0' },
  cancelBtnText: { color: COLORS.gray, fontWeight: '600' },
  saveBtn:       { flex: 1, backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  saveBtnText:   { color: '#fff', fontWeight: 'bold' },

  logoutBtn:  { backgroundColor: '#fff', borderRadius: 16, paddingVertical: 16, alignItems: 'center', borderWidth: 1.5, borderColor: '#fee2e2' },
  logoutText: { color: '#ef4444', fontSize: 15, fontWeight: '600' },
});
