import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAuthStore } from '../../store/authStore';

export default function ReportsScreen() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Relatórios Analíticos</Text>
      {isAdmin ? (
        <Text style={styles.subtitle}>
          DRE Simplificada (Competência) & Fluxo de Caixa (Regime de Caixa via liquidação).
        </Text>
      ) : (
        <Text style={styles.blockedText}>
          Acesso restrito ao perfil Administrador. Como colaboradora, você tem acesso às
          suas comissões na aba de Lançamentos.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f8fafc',
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 300,
  },
  blockedText: {
    fontSize: 14,
    color: '#f43f5e',
    textAlign: 'center',
    marginTop: 12,
    maxWidth: 300,
  },
});
