import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { colors, typography, borderRadius, shadows } from '../../theme/theme';
import { StudioTopHeader } from '../../components/ui/StudioTopHeader';
import { FloatingActionButton } from '../../components/ui/FloatingActionButton';
import { SearchBar } from '../../components/ui/SearchBar';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/QueryState';
import {
  useDeleteTransaction,
  useFilteredTransactions,
  useSettleTransaction,
} from '../../hooks/useTransactions';
import { usePeriodStore } from '../../store/periodStore';
import { useAuthStore } from '../../store/authStore';
import { getApiErrorMessage } from '../../services/api';
import { formatCurrency, formatRelativeDateTime } from '../../utils/formatters';
import {
  paymentMethodLabels,
  transactionOriginLabels,
  transactionStatusLabels,
} from '../../utils/labels';
import { periodLabel } from '../../utils/period';
import type { Transaction, TransactionType } from '../../types';

type TypeFilter = 'todos' | TransactionType;

const TYPE_FILTERS: { key: TypeFilter; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'receita', label: 'Receitas' },
  { key: 'despesa', label: 'Despesas' },
];

export default function TransactionsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('todos');

  const period = usePeriodStore((state) => state.period);
  const isAdmin = useAuthStore((state) => state.user?.role === 'admin');

  const filters = useMemo(
    () => ({
      search,
      ...(typeFilter === 'todos' ? {} : { type: typeFilter }),
    }),
    [search, typeFilter]
  );

  const { transactions, isPending, isError, error, refetch, isRefetching } =
    useFilteredTransactions(filters);
  const settleMutation = useSettleTransaction();
  const deleteMutation = useDeleteTransaction();

  // Totais do que está na tela: muda junto com o filtro, como a dona espera.
  const totals = useMemo(() => {
    return transactions.reduce(
      (accumulator, transaction) => {
        if (transaction.status === 'cancelada') return accumulator;
        if (transaction.type === 'receita') {
          accumulator.revenue += transaction.grossAmount - transaction.discountAmount;
        } else {
          accumulator.expense += transaction.grossAmount;
        }
        return accumulator;
      },
      { revenue: 0, expense: 0 }
    );
  }, [transactions]);

  function handleSettle(transaction: Transaction) {
    Alert.alert(
      'Confirmar liquidação',
      `Marcar "${transaction.description}" como liquidada? A data de hoje entra no Fluxo de Caixa.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Liquidar',
          onPress: () =>
            settleMutation.mutate(transaction, {
              onError: (mutationError) => Alert.alert('Erro', getApiErrorMessage(mutationError)),
            }),
        },
      ]
    );
  }

  function handleDelete(transaction: Transaction) {
    Alert.alert(
      'Excluir lançamento',
      `"${transaction.description}" sairá das listas e dos relatórios. Confirma?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () =>
            deleteMutation.mutate(transaction._id, {
              onError: (mutationError) => Alert.alert('Erro', getApiErrorMessage(mutationError)),
            }),
        },
      ]
    );
  }

  function renderItem({ item }: { item: Transaction }) {
    const isIncome = item.type === 'receita';
    const amount = isIncome ? item.grossAmount - item.discountAmount : item.grossAmount;
    const isCancelled = item.status === 'cancelada';

    return (
      <TouchableOpacity
        style={[styles.transactionCard, isCancelled && styles.cardCancelled]}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('NewTransaction', { transactionId: item._id })}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardInfo}>
            <View style={styles.badgeRow}>
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryText}>{item.category}</Text>
              </View>
              <View style={styles.paymentPill}>
                <Text style={styles.paymentText}>{paymentMethodLabels[item.paymentMethod]}</Text>
              </View>
              <Text style={styles.dateText}>{formatRelativeDateTime(item.occurredAt)}</Text>
            </View>

            <Text style={[styles.itemTitle, isCancelled && styles.textCancelled]}>
              {item.description}
            </Text>

            <View style={styles.metaRow}>
              <Text style={styles.professionalText}>Por: {item.professional}</Text>
              {item.origin !== 'manual' ? (
                <View style={styles.originPill}>
                  <Text style={styles.originText}>{transactionOriginLabels[item.origin]}</Text>
                </View>
              ) : null}
            </View>
          </View>

          <View style={styles.amountBox}>
            <Text
              style={[
                styles.amountText,
                isIncome ? styles.incomeText : styles.expenseText,
                isCancelled && styles.textCancelled,
              ]}
            >
              {isIncome ? '+ ' : '- '}
              {formatCurrency(amount)}
            </Text>
            <View style={[styles.statusPill, statusPillStyle(item.status)]}>
              <Text style={[styles.statusText, statusTextStyle(item.status)]}>
                {transactionStatusLabels[item.status]}
              </Text>
            </View>
          </View>
        </View>

        {/* Comissão e lucro líquido só existem em receita e só interessam à admin. */}
        {isAdmin && isIncome && !isCancelled ? (
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownItem}>
              Taxa <Text style={styles.breakdownValue}>{formatCurrency(item.feeAmount)}</Text>
            </Text>
            <Text style={styles.breakdownItem}>
              Comissão{' '}
              <Text style={styles.breakdownValue}>{formatCurrency(item.commissionAmount)}</Text>
            </Text>
            <Text style={styles.breakdownItem}>
              Líquido studio{' '}
              <Text style={[styles.breakdownValue, styles.breakdownHighlight]}>
                {formatCurrency(item.studioNetProfit)}
              </Text>
            </Text>
          </View>
        ) : null}

        <View style={styles.actionRow}>
          {item.status === 'pendente' ? (
            <TouchableOpacity
              style={styles.actionBtn}
              activeOpacity={0.7}
              onPress={() => handleSettle(item)}
            >
              <Ionicons name="checkmark-circle-outline" size={15} color={colors.statusSuccess} />
              <Text style={[styles.actionText, { color: colors.statusSuccess }]}>Liquidar</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={styles.actionBtn}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('NewTransaction', { transactionId: item._id })}
          >
            <Ionicons name="create-outline" size={15} color={colors.primary} />
            <Text style={[styles.actionText, { color: colors.primary }]}>Editar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            activeOpacity={0.7}
            onPress={() => handleDelete(item)}
          >
            <Ionicons name="trash-outline" size={15} color={colors.statusError} />
            <Text style={[styles.actionText, { color: colors.statusError }]}>Excluir</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.screen}>
      <StudioTopHeader subtitleTag="TRANSAÇÕES" />

      <View style={styles.container}>
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar por serviço, categoria ou profissional..."
          containerStyle={styles.searchBar}
        />

        <View style={styles.filterRow}>
          {TYPE_FILTERS.map((filter) => {
            const isActive = typeFilter === filter.key;
            return (
              <TouchableOpacity
                key={filter.key}
                onPress={() => setTypeFilter(filter.key)}
                style={[styles.filterPill, isActive && styles.filterPillActive]}
              >
                <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>
                  {filter.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Resumo do que está filtrado, antes da lista. */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Receitas</Text>
            <Text style={[styles.summaryValue, { color: colors.violetRoyal }]}>
              {formatCurrency(totals.revenue)}
            </Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Despesas</Text>
            <Text style={[styles.summaryValue, { color: colors.statusError }]}>
              {formatCurrency(totals.expense)}
            </Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Saldo</Text>
            <Text style={styles.summaryValue}>
              {formatCurrency(totals.revenue - totals.expense)}
            </Text>
          </View>
        </View>

        {isPending ? (
          <LoadingState label="Carregando lançamentos..." />
        ) : isError ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : (
          <FlatList
            data={transactions}
            keyExtractor={(item) => item._id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            renderItem={renderItem}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={() => void refetch()}
                tintColor={colors.primary}
              />
            }
            ListEmptyComponent={
              <EmptyState
                icon="receipt-outline"
                title="Nenhum lançamento no período"
                description={`Não há registros em ${periodLabel(period)} com os filtros atuais. Troque o mês no cabeçalho ou registre um lançamento.`}
              />
            }
          />
        )}
      </View>

      <FloatingActionButton />
    </View>
  );
}

function statusPillStyle(status: Transaction['status']) {
  if (status === 'liquidada') return { backgroundColor: colors.statusSuccessBg };
  if (status === 'cancelada') return { backgroundColor: colors.statusErrorBg };
  return { backgroundColor: colors.statusWarningBg };
}

function statusTextStyle(status: Transaction['status']) {
  if (status === 'liquidada') return { color: colors.statusSuccess };
  if (status === 'cancelada') return { color: colors.statusError };
  return { color: colors.statusWarning };
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
    marginBottom: 12,
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
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  summaryBox: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderWhisper,
    paddingVertical: 9,
    paddingHorizontal: 10,
  },
  summaryLabel: {
    fontFamily: typography.fonts.bodyMedium,
    fontSize: 10,
    color: colors.graphiteMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  summaryValue: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 13,
    color: colors.graphiteText,
    marginTop: 2,
  },
  listContent: {
    paddingBottom: 100,
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
  cardCancelled: {
    opacity: 0.6,
  },
  textCancelled: {
    textDecorationLine: 'line-through',
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
    flexWrap: 'wrap',
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
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  professionalText: {
    fontFamily: typography.fonts.body,
    fontSize: 11,
    color: colors.graphiteMuted,
  },
  originPill: {
    backgroundColor: colors.lavenderLight,
    borderWidth: 1,
    borderColor: colors.lavenderSubtle,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: borderRadius.xs,
  },
  originText: {
    fontFamily: typography.fonts.bodySemiBold,
    fontSize: 8,
    color: colors.violetRoyal,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  amountBox: {
    alignItems: 'flex-end',
    gap: 4,
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
  statusPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
  },
  statusText: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  breakdownRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 10,
    paddingTop: 9,
    borderTopWidth: 1,
    borderTopColor: colors.borderWhisper,
  },
  breakdownItem: {
    fontFamily: typography.fonts.body,
    fontSize: 10,
    color: colors.graphiteMuted,
  },
  breakdownValue: {
    fontFamily: typography.fonts.bodySemiBold,
    color: colors.graphiteText,
  },
  breakdownHighlight: {
    color: colors.violetRoyal,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 10,
    paddingTop: 9,
    borderTopWidth: 1,
    borderTopColor: colors.borderWhisper,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    fontFamily: typography.fonts.bodySemiBold,
    fontSize: 11,
  },
});
