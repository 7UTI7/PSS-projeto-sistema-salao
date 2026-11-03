import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { colors, typography, borderRadius, shadows } from '../../theme/theme';
import { StudioTopHeader } from '../../components/ui/StudioTopHeader';
import { FloatingActionButton } from '../../components/ui/FloatingActionButton';
import { SearchBar } from '../../components/ui/SearchBar';
import { formatCurrency } from '../../utils/formatters';

interface TransactionItem {
  id: string;
  type: 'INCOME' | 'EXPENSE';
  title: string;
  category: string;
  professional: string;
  date: string;
  amount: number;
  paymentMethod: string;
}

const MOCK_TRANSACTIONS: TransactionItem[] = [
  {
    id: '1',
    type: 'INCOME',
    title: 'Efeito Wispy',
    category: 'Cílios',
    professional: 'Nicolle Neris',
    date: 'Hoje, 15:40',
    amount: 180.0,
    paymentMethod: 'Cartão',
  },
  {
    id: '2',
    type: 'INCOME',
    title: 'Unhas Fibra de Vidro',
    category: 'Unhas',
    professional: 'Stephany',
    date: 'Hoje, 14:15',
    amount: 30.0,
    paymentMethod: 'Pix',
  },
  {
    id: '3',
    type: 'EXPENSE',
    title: 'Compra descartáveis',
    category: 'Insumos',
    professional: 'Fornecedor Local',
    date: 'Hoje, 11:20',
    amount: 34.5,
    paymentMethod: 'Débito',
  },
  {
    id: '4',
    type: 'INCOME',
    title: 'Mechas Criativas & Tonalização',
    category: 'Cabelo',
    professional: 'Nicolle Neris',
    date: 'Ontem, 16:30',
    amount: 480.0,
    paymentMethod: 'Cartão',
  },
  {
    id: '5',
    type: 'EXPENSE',
    title: 'Reposição Cola de Cílios',
    category: 'Insumos',
    professional: 'Estoque Studio',
    date: '28 Ago, 18:00',
    amount: 150.0,
    paymentMethod: 'Pix',
  },
];

export default function TransactionsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');

  const filteredTransactions = MOCK_TRANSACTIONS.filter((item) => {
    const matchesFilter =
      activeFilter === 'ALL' || item.type === activeFilter;
    const matchesSearch =
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.professional.toLowerCase().includes(search.toLowerCase()) ||
      item.category.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <View style={styles.screen}>
      <StudioTopHeader subtitleTag="TRANSAÇÕES" currentPeriod="Setembro 2024" />

      <View style={styles.container}>
        {/* Barra de Pesquisa */}
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar por serviço, cliente ou profissional..."
          containerStyle={styles.searchBar}
        />

        {/* Filtros em Pílula */}
        <View style={styles.filterRow}>
          <TouchableOpacity
            onPress={() => setActiveFilter('ALL')}
            style={[
              styles.filterPill,
              activeFilter === 'ALL' && styles.filterPillActive,
            ]}
          >
            <Text
              style={[
                styles.filterPillText,
                activeFilter === 'ALL' && styles.filterPillTextActive,
              ]}
            >
              Todos
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveFilter('INCOME')}
            style={[
              styles.filterPill,
              activeFilter === 'INCOME' && styles.filterPillActive,
            ]}
          >
            <Text
              style={[
                styles.filterPillText,
                activeFilter === 'INCOME' && styles.filterPillTextActive,
              ]}
            >
              Receitas
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveFilter('EXPENSE')}
            style={[
              styles.filterPill,
              activeFilter === 'EXPENSE' && styles.filterPillActive,
            ]}
          >
            <Text
              style={[
                styles.filterPillText,
                activeFilter === 'EXPENSE' && styles.filterPillTextActive,
              ]}
            >
              Despesas
            </Text>
          </TouchableOpacity>
        </View>

        {/* Listagem */}
        <FlatList
          data={filteredTransactions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const isIncome = item.type === 'INCOME';

            return (
              <View style={styles.transactionCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardInfo}>
                    <View style={styles.badgeRow}>
                      <View style={styles.categoryBadge}>
                        <Text style={styles.categoryText}>{item.category}</Text>
                      </View>
                      <View style={styles.paymentPill}>
                        <Text style={styles.paymentText}>{item.paymentMethod}</Text>
                      </View>
                      <Text style={styles.dateText}>{item.date}</Text>
                    </View>
                    <Text style={styles.itemTitle}>{item.title}</Text>
                    <Text style={styles.professionalText}>
                      Por: {item.professional}
                    </Text>
                  </View>

                  <View style={styles.amountBox}>
                    <Text
                      style={[
                        styles.amountText,
                        isIncome ? styles.incomeText : styles.expenseText,
                      ]}
                    >
                      {isIncome ? '+ ' : '- '}
                      {formatCurrency(item.amount)}
                    </Text>
                    <Ionicons
                      name={isIncome ? 'arrow-up-circle' : 'arrow-down-circle'}
                      size={16}
                      color={isIncome ? colors.violetRoyal : colors.statusError}
                      style={styles.amountIcon}
                    />
                  </View>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="search" size={40} color={colors.lavenderAccent} />
              <Text style={styles.emptyTitle}>Nenhum registro encontrado</Text>
              <Text style={styles.emptySubtitle}>
                Tente alterar os termos da busca ou filtro selecionado.
              </Text>
            </View>
          }
        />
      </View>

      <FloatingActionButton />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  searchBar: {
    marginBottom: 12,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.borderWhisper,
  },
  filterPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterPillText: {
    fontFamily: typography.fonts.bodySemiBold,
    fontSize: 12,
    color: colors.graphiteMuted,
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingBottom: 90,
  },
  transactionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.borderWhisper,
    marginBottom: 10,
    ...shadows.card,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardInfo: {
    flex: 1,
    marginRight: 10,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 5,
  },
  categoryBadge: {
    backgroundColor: colors.lavenderTint,
    paddingHorizontal: 7,
    paddingVertical: 1.5,
    borderRadius: borderRadius.xs,
  },
  categoryText: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 9,
    color: colors.primary,
  },
  paymentPill: {
    backgroundColor: colors.surfaceContainer,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: borderRadius.xs,
  },
  paymentText: {
    fontFamily: typography.fonts.bodyMedium,
    fontSize: 9,
    color: colors.graphiteMuted,
  },
  dateText: {
    fontFamily: typography.fonts.body,
    fontSize: 11,
    color: colors.graphiteMuted,
  },
  itemTitle: {
    fontFamily: typography.fonts.bodySemiBold,
    fontSize: 14,
    color: colors.graphiteText,
    marginBottom: 2,
  },
  professionalText: {
    fontFamily: typography.fonts.body,
    fontSize: 11,
    color: colors.graphiteMuted,
  },
  amountBox: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 14,
  },
  incomeText: {
    color: colors.violetRoyal,
  },
  expenseText: {
    color: colors.statusError,
  },
  amountIcon: {
    marginTop: 3,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    fontFamily: typography.fonts.headline,
    fontSize: 16,
    color: colors.graphiteText,
    marginTop: 12,
  },
  emptySubtitle: {
    fontFamily: typography.fonts.body,
    fontSize: 12,
    color: colors.graphiteMuted,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 240,
  },
});
