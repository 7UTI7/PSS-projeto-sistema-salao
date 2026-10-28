import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { formatCurrency } from '../../utils/formatters';

export default function DashboardScreen() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Olá, {user?.name || 'Profissional'} 👋</Text>
          <Text style={styles.roleBadge}>
            Perfil: {isAdmin ? 'Administrador' : 'Colaborador'}
          </Text>
        </View>
      </View>

      {/* Cards de Resumo */}
      <View style={styles.kpiGrid}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Entradas no Mês</Text>
          <Text style={[styles.kpiValue, styles.inflowText]}>
            {formatCurrency(0)}
          </Text>
        </View>

        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Saídas / Custos</Text>
          <Text style={[styles.kpiValue, styles.outflowText]}>
            {formatCurrency(0)}
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Nicolle Neris Studio</Text>
        <Text style={styles.cardDescription}>
          Esta tela é um scaffold inicial pronto para você conectar seus componentes
          visuais e gráficos de faturamento.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  content: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f8fafc',
  },
  roleBadge: {
    fontSize: 13,
    color: '#38bdf8',
    marginTop: 4,
  },
  kpiGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  kpiLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 6,
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  inflowText: {
    color: '#22c55e',
  },
  outflowText: {
    color: '#f43f5e',
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f8fafc',
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 20,
  },
});
