import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useAuthStore } from '../../store/authStore';

export default function SettingsScreen() {
  const { user, logout } = useAuthStore();

  function handleLogout() {
    Alert.alert('Sair', 'Tem certeza que deseja sair do aplicativo?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: () => logout() },
    ]);
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.name}>{user?.name || 'Usuário'}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <Text style={styles.role}>Perfil: {user?.role}</Text>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Encerrar Sessão</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 20,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f8fafc',
  },
  email: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 4,
  },
  role: {
    fontSize: 13,
    color: '#38bdf8',
    marginTop: 8,
    textTransform: 'uppercase',
  },
  logoutBtn: {
    marginTop: 24,
    backgroundColor: '#ef4444',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  logoutText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
});
