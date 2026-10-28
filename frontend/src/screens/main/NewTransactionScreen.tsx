import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function NewTransactionScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Novo Lançamento</Text>
      <Text style={styles.subtitle}>
        Lançamento Rápido (3 toques) — Receitas / Despesas com cálculo automático
        de comissão e taxas no servidor.
      </Text>
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
});
