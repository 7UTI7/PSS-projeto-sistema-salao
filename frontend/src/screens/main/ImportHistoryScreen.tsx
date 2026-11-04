// Histórico completo das importações, com filtro por ano e mês.
//
// Separada da tela de Importar de propósito: lá o assunto é conferir o mês, e uma lista
// que só cresce competia com isso. Aqui a lista é o assunto, e é também de onde se
// desfaz um lote.
//
// O filtro oferece apenas os anos e meses que têm lote. Um seletor de data livre
// deixaria escolher um mês vazio e dar a impressão de que algo sumiu.
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, borderRadius } from '../../theme/theme';
import { AdminOnlyState, ErrorState, LoadingState } from '../../components/ui/QueryState';
import { useImportBatches, useRollbackImport } from '../../hooks/useImports';
import { useIsAdmin } from '../../hooks/useReports';
import { getApiErrorMessage } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { parsePeriodKey, periodKeyOf } from '../../utils/period';
import { importBatchStatusLabels, importSourceLabels } from '../../utils/labels';
import type { ImportBatch } from '../../types';

const ALL = 'todos';

const MONTH_NAMES = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
];

/** O mês a que o ARQUIVO se refere, não a data em que ela o enviou. */
function monthOf(batch: ImportBatch) {
  return parsePeriodKey(periodKeyOf(batch.periodStart ?? batch.createdAt));
}

export default function ImportHistoryScreen() {
  const isAdmin = useIsAdmin();
  const batchesQuery = useImportBatches();
  const rollbackMutation = useRollbackImport();

  const [year, setYear] = useState<number | typeof ALL>(ALL);
  const [monthIndex, setMonthIndex] = useState<number | typeof ALL>(ALL);

  const batches = useMemo(() => batchesQuery.data ?? [], [batchesQuery.data]);

  const years = useMemo(() => {
    const found = new Set<number>();
    for (const batch of batches) found.add(monthOf(batch).year);
    return [...found].sort((a, b) => b - a);
  }, [batches]);

  /** Meses do ano escolhido — ou de todos os anos, quando nenhum está escolhido. */
  const months = useMemo(() => {
    const found = new Set<number>();
    for (const batch of batches) {
      const item = monthOf(batch);
      if (year === ALL || item.year === year) found.add(item.monthIndex);
    }
    return [...found].sort((a, b) => b - a);
  }, [batches, year]);

  const filtered = useMemo(
    () =>
      batches.filter((batch) => {
        const item = monthOf(batch);
        if (year !== ALL && item.year !== year) return false;
        if (monthIndex !== ALL && item.monthIndex !== monthIndex) return false;
        return true;
      }),
    [batches, year, monthIndex],
  );

  function handleRollback(batch: ImportBatch) {
    Alert.alert(
      'Desfazer importação',
      `Os ${batch.importedCount} lançamento(s) de "${batch.fileName}" sairão das listas e dos relatórios. Confirma?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desfazer',
          style: 'destructive',
          onPress: () =>
            rollbackMutation.mutate(batch._id, {
              onSuccess: (result) =>
                Alert.alert('Lote desfeito', `${result.removedCount} lançamento(s) removido(s).`),
              onError: (error) => Alert.alert('Erro', getApiErrorMessage(error)),
            }),
        },
      ],
    );
  }

  if (!isAdmin) {
    return (
      <View style={styles.screen}>
        <AdminOnlyState />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={batchesQuery.isRefetching}
            onRefresh={() => void batchesQuery.refetch()}
            tintColor={colors.primary}
          />
        }
      >
        <Text style={styles.filterLabel}>ANO</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillRow}
        >
          <FilterPill
            label="Todos"
            active={year === ALL}
            onPress={() => {
              setYear(ALL);
              setMonthIndex(ALL);
            }}
          />
          {years.map((item) => (
            <FilterPill
              key={item}
              label={String(item)}
              active={year === item}
              onPress={() => {
                setYear(item);
                // O mês escolhido pode não existir no ano novo; recomeçar evita a lista
                // vazia sem explicação.
                setMonthIndex(ALL);
              }}
            />
          ))}
        </ScrollView>

        <Text style={[styles.filterLabel, styles.filterSpacing]}>MÊS</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillRow}
        >
          <FilterPill
            label="Todos"
            active={monthIndex === ALL}
            onPress={() => setMonthIndex(ALL)}
          />
          {months.map((item) => (
            <FilterPill
              key={item}
              label={MONTH_NAMES[item] ?? ''}
              active={monthIndex === item}
              onPress={() => setMonthIndex(item)}
            />
          ))}
        </ScrollView>

        <Text style={styles.resultCount}>
          {filtered.length} {filtered.length === 1 ? 'importação' : 'importações'}
        </Text>

        {batchesQuery.isPending ? (
          <LoadingState label="Carregando importações..." />
        ) : batchesQuery.isError ? (
          <ErrorState error={batchesQuery.error} onRetry={batchesQuery.refetch} />
        ) : filtered.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.empty}>
              {batches.length === 0
                ? 'Nenhum arquivo importado ainda.'
                : 'Nenhuma importação com esse filtro.'}
            </Text>
          </View>
        ) : (
          filtered.map((batch) => (
            <View key={batch._id} style={styles.batchCard}>
              <View style={styles.batchHeader}>
                <View style={styles.batchTitleCol}>
                  <Text style={styles.batchFile} numberOfLines={1}>
                    {batch.fileName}
                  </Text>
                  <Text style={styles.batchMeta}>
                    {importSourceLabels[batch.source]} · enviado em {formatDate(batch.createdAt)}
                  </Text>
                  {batch.periodStart && batch.periodEnd ? (
                    <Text style={styles.batchMeta}>
                      Cobre {formatDate(batch.periodStart)} a {formatDate(batch.periodEnd)}
                    </Text>
                  ) : null}
                </View>
                <View style={[styles.batchStatusPill, statusStyle(batch.status)]}>
                  <Text style={[styles.batchStatusText, statusTextStyle(batch.status)]}>
                    {importBatchStatusLabels[batch.status]}
                  </Text>
                </View>
              </View>

              <View style={styles.batchStats}>
                <Text style={styles.batchStat}>{batch.importedCount} importado(s)</Text>
                {batch.duplicateCount > 0 ? (
                  <Text style={styles.batchStat}>{batch.duplicateCount} repetido(s)</Text>
                ) : null}
                {batch.skippedCount > 0 ? (
                  <Text style={styles.batchStat}>{batch.skippedCount} ignorada(s)</Text>
                ) : null}
                <Text style={[styles.batchStat, styles.batchStatStrong]}>
                  {formatCurrency(batch.totals.grossAmount)}
                </Text>
              </View>

              {batch.errorMessage ? (
                <Text style={styles.batchError}>{batch.errorMessage}</Text>
              ) : null}

              {batch.status === 'processed' ? (
                <TouchableOpacity
                  style={styles.rollbackBtn}
                  activeOpacity={0.7}
                  disabled={rollbackMutation.isPending}
                  onPress={() => handleRollback(batch)}
                >
                  <Ionicons name="arrow-undo-outline" size={15} color={colors.statusError} />
                  <Text style={styles.rollbackText}>Desfazer este lote</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function FilterPill({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.pill, active && styles.pillActive]}
      activeOpacity={0.8}
      onPress={onPress}
    >
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function statusStyle(status: ImportBatch['status']) {
  if (status === 'processed') return { backgroundColor: colors.statusSuccessBg };
  if (status === 'failed') return { backgroundColor: colors.statusErrorBg };
  if (status === 'rolled_back') return { backgroundColor: colors.surfaceContainerHigh };
  return { backgroundColor: colors.statusWarningBg };
}

function statusTextStyle(status: ImportBatch['status']) {
  if (status === 'processed') return { color: colors.statusSuccess };
  if (status === 'failed') return { color: colors.statusError };
  if (status === 'rolled_back') return { color: colors.graphiteMuted };
  return { color: colors.statusWarning };
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surfaceCanvas,
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  filterLabel: {
    fontFamily: typography.fonts.bodySemiBold,
    fontSize: 10,
    letterSpacing: 0.8,
    color: colors.graphiteMuted,
    marginBottom: 8,
  },
  filterSpacing: {
    marginTop: 16,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 8,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.surfaceContainer,
    backgroundColor: colors.surfacePure,
  },
  pillActive: {
    borderColor: colors.primary,
    backgroundColor: colors.lavenderTint,
  },
  pillText: {
    fontFamily: typography.fonts.bodyMedium,
    fontSize: 12,
    color: colors.graphiteMuted,
  },
  pillTextActive: {
    color: colors.violetRoyal,
  },
  resultCount: {
    fontFamily: typography.fonts.body,
    fontSize: 11,
    color: colors.graphiteMuted,
    marginTop: 20,
    marginBottom: 10,
  },
  card: {
    backgroundColor: colors.surfacePure,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.borderWhisper,
    padding: 18,
  },
  empty: {
    fontFamily: typography.fonts.body,
    fontSize: 13,
    color: colors.graphiteMuted,
    textAlign: 'center',
  },
  batchCard: {
    backgroundColor: colors.surfacePure,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.borderWhisper,
    padding: 16,
    marginBottom: 12,
  },
  batchHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  batchTitleCol: {
    flex: 1,
  },
  batchFile: {
    fontFamily: typography.fonts.bodySemiBold,
    fontSize: 13,
    color: colors.graphiteText,
  },
  batchMeta: {
    fontFamily: typography.fonts.body,
    fontSize: 11,
    color: colors.graphiteMuted,
    marginTop: 2,
  },
  batchStatusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  batchStatusText: {
    fontFamily: typography.fonts.bodySemiBold,
    fontSize: 10,
  },
  batchStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  batchStat: {
    fontFamily: typography.fonts.body,
    fontSize: 11,
    color: colors.graphiteMuted,
  },
  batchStatStrong: {
    fontFamily: typography.fonts.bodySemiBold,
    color: colors.graphiteText,
  },
  batchError: {
    fontFamily: typography.fonts.body,
    fontSize: 11,
    color: colors.statusError,
    marginTop: 10,
  },
  rollbackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceContainer,
  },
  rollbackText: {
    fontFamily: typography.fonts.bodyMedium,
    fontSize: 12,
    color: colors.statusError,
  },
});
