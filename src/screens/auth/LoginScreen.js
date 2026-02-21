import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';

const COLORS = { primary: '#FF6B35', bg: '#FF6B35', text: '#fff' };

export default function LoginScreen() {
  const { login }  = useAuth();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs.');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (error) {
      const msg = error.message || error.response?.data?.message || 'Email ou mot de passe incorrect.';
      Alert.alert('Connexion échouée', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.emoji}>🛵</Text>
            <Text style={styles.title}>Espace Livreur</Text>
            <Text style={styles.subtitle}>Connectez-vous pour commencer vos livraisons</Text>
          </View>

          {/* Formulaire */}
          <View style={styles.formCard}>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="vous@exemple.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                placeholderTextColor="#bbb"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Mot de passe</Text>
              <View style={styles.passRow}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  secureTextEntry={!showPass}
                  placeholderTextColor="#bbb"
                />
                <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPass(!showPass)}>
                  <Text>{showPass ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.loginBtn, loading && { opacity: 0.7 }]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#FF6B35" />
                : <Text style={styles.loginBtnText}>Se connecter</Text>
              }
            </TouchableOpacity>
          </View>

          <Text style={styles.footer}>
            Contactez l'administrateur pour créer votre compte livreur.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content:   { flexGrow: 1, padding: 24, justifyContent: 'center' },

  header:   { alignItems: 'center', marginBottom: 36 },
  emoji:    { fontSize: 72, marginBottom: 12 },
  title:    { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 6 },
  subtitle: { fontSize: 15, color: 'rgba(255,255,255,0.8)', textAlign: 'center' },

  formCard: {
    backgroundColor: '#fff', borderRadius: 24, padding: 24,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 16, elevation: 8,
    gap: 16,
  },
  fieldGroup: { gap: 6 },
  label:      { fontSize: 14, fontWeight: '600', color: '#333' },
  input: {
    borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: '#1a1a1a', backgroundColor: '#fafafa',
  },
  passRow: { flexDirection: 'row', gap: 8 },
  eyeBtn:  { padding: 14, borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 12, backgroundColor: '#fafafa' },

  loginBtn: {
    backgroundColor: '#FF6B35', borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginTop: 4,
  },
  loginBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  footer: { color: 'rgba(255,255,255,0.7)', fontSize: 13, textAlign: 'center', marginTop: 24 },
});
