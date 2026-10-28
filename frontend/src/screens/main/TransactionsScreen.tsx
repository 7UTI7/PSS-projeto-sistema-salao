import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { MainTabParamList } from '../../navigation/types';

export default function TransactionsScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Lançamentos</Text>
        <TouchableOpacity
          style={styles.newBtn}
          onPress={() => navigation.navigate('NewTransaction')}
        >
          <Text style={styles.newBtnText}>+ Novo</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>Nenhum lançamento exibido</Text>
        <Text style={styles.emptySubtitle}>
          Integre aqui a listagem consumindo `transactionService.list()` ou substitua
          pela sua tela customizada.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f8fafc',
  },
  newBtn: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  newBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f8fafc',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 280,
  },
});
