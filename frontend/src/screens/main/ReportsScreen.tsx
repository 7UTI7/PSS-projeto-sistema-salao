// Relatórios gerenciais: DRE (competência) e Fluxo de Caixa (caixa).
//
// São os dois regimes que o sistema entrega e que o Booksy e a InfinitePay não dão:
// o DRE responde "quanto o negócio produziu no mês" (pela data do atendimento) e o
// Fluxo de Caixa responde "quanto entrou na conta" (pela data de liquidação). Os dois
// números serem diferentes é esperado, não um erro — a tela explica isso.
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, borderRadius, shadows } from '../../theme/theme';
import { StudioTopHeader } from '../../components/ui/StudioTopHeader';
import { FloatingActionButton } from '../../components/ui/FloatingActionButton';
import { AdminOnlyState, ErrorState, LoadingState } from '../../components/ui/QueryState';
import { useCashFlowReport, useDreReport, useIsAdmin } from '../../hooks/useReports';
import { usePeriodStore } from '../../store/periodStore';
import { profitMargin, summarizeCashFlow, totalExpenses } from '../../services/report.service';
import { formatCurrency, formatPercent } from '../../utils/formatters';
import { periodLabel } from '../../utils/period';
import type { DreReport } from '../../types';

export default function ReportsScreen() {
  const isAdmin = useIsAdmin();
  const period = usePeriodStore((state) => state.period);
  const dreQuery = useDreReport();
  const cashFlowQuery = useCashFlowReport();

  const cashFlow = useMemo(
    () => summarizeCashFlow(cashFlowQuery.data ?? []),
    [cashFlowQuery.data]
  );

  // Escala das barras do fluxo diário: o maior movimento do mês em módulo.
  const peak = useMemo(() => {
    const amounts = (cashFlowQuery.data ?? []).map((point) => Math.abs(point.amount));
    return amounts.length > 0 ? Math.max(...amounts) : 0;
  }, [cashFlowQuery.data]);

  function handleRefresh() {
    void dreQuery.refetch();
    void cashFlowQuery.refetch();
  }

  if (!isAdmin) {
    return (
      <View style={styles.screen}>
        <StudioTopHeader subtitleTag="RELATÓRIOS" />
        <AdminOnlyState />
      </View>
    );
  }

  if (dreQuery.isPending || cashFlowQuery.isPending) {
    return (
      <View style={styles.screen}>
        <StudioTopHeader subtitleTag="RELATÓRIOS" />
        <LoadingState label="Gerando relatórios do período..." />
      </View>
    );
  }

  if (dreQuery.isError || cashFlowQuery.isError) {
    return (
      <View style={styles.screen}>
        <StudioTopHeader subtitleTag="RELATÓRIOS" />
        <ErrorState error={dreQuery.error ?? cashFlowQuery.error} onRetry={handleRefresh} />
      </View>
    );
  }

  const dre = dreQuery.data as DreReport;
  const points = cashFlowQuery.data ?? [];

  return (
    <View style={styles.screen}>
      <StudioTopHeader subtitleTag="RELATÓRIOS" />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={dreQuery.isRefetching || cashFlowQuery.isRefetching}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Relatórios</Text>
          <Text style={styles.pageDesc}>
            Resultado gerencial de {periodLabel(period)}, nos dois regimes contábeis.
          </Text>
        </View>

        {/* DRE: regime de competência, linha a linha até o resultado. */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <View style={styles.iconBox}>
                <Ionicons name="document-text-outline" size={20} color={colors.primary} />
              </View>
              <View style={styles.cardTitleCol}>
                <Text style={styles.cardTitle}>DRE Gerencial</Text>
                <Text style={styles.cardSub}>Pela data do atendimento (competência)</Text>
              </View>
            </View>
          </View>

          <View style={styles.statement}>
            <StatementRow label="Receita bruta" value={dre.receitaBruta} />
            <StatementRow label="(−) Descontos concedidos" value={-dre.descontos} muted />
            <StatementRow label="(−) Taxas de pagamento" value={-dre.taxas} muted />
            <StatementRow label="(=) Receita líquida" value={dre.receitaLiquida} emphasis />

            <View style={styles.statementDivider} />

            <StatementRow
              label="(−) Custos variáveis"
              value={-dre.custosVariaveis}
              hint="Comissões das profissionais e insumos"
              muted
            />
            <StatementRow
              label="(−) Despesas fixas"
              value={-dre.despesasFixas}
              hint="Aluguel, internet, assinaturas"
              muted
            />

            <View style={styles.statementDivider} />

            <View style={styles.resultRow}>
              <View style={styles.resultLabelCol}>
                <Text style={styles.resultLabel}>Resultado do período</Text>
                <Text style={styles.resultHint}>
                  Margem de {formatPercent(profitMargin(dre), 1)} sobre a receita bruta
                </Text>
              </View>
              <Text
                style={[
                  styles.resultValue,
                  { color: dre.resultado >= 0 ? colors.statusSuccess : colors.statusError },
                ]}
              >
                {formatCurrency(dre.resultado)}
              </Text>
            </View>
          </View>

          <View style={styles.totalsFooter}>
            <Text style={styles.totalsFooterText}>
              Total de despesas no período: {formatCurrency(totalExpenses(dre))}
            </Text>
          </View>
        </View>

        {/* FLUXO DE CAIXA: regime de caixa, só o que foi liquidado. */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <View style={styles.iconBox}>
                <Ionicons name="trending-up-outline" size={20} color={colors.primary} />
              </View>
              <View style={styles.cardTitleCol}>
                <Text style={styles.cardTitle}>Fluxo de Caixa</Text>
                <Text style={styles.cardSub}>Pela data de liquidação (caixa)</Text>
              </View>
            </View>
          </View>

          <View style={styles.cashGrid}>
            <View style={styles.cashBox}>
              <Text style={styles.cashLabel}>Entradas</Text>
              <Text style={[styles.cashValue, { color: colors.statusSuccess }]}>
                {formatCurrency(cashFlow.inflow)}
              </Text>
            </View>
            <View style={styles.cashBox}>
              <Text style={styles.cashLabel}>Saídas</Text>
              <Text style={[styles.cashValue, { color: colors.statusError }]}>
                {formatCurrency(cashFlow.outflow)}
              </Text>
            </View>
            <View style={[styles.cashBox, styles.cashBoxHighlight]}>
              <Text style={styles.cashLabel}>Saldo</Text>
              <Text style={[styles.cashValue, { color: colors.violetRoyal }]}>
                {formatCurrency(cashFlow.balance)}
              </Text>
            </View>
          </View>

          {points.length === 0 ? (
            <Text style={styles.cashEmpty}>
              Nenhum lançamento liquidado em {periodLabel(period)}. Marque os lançamentos
              como liquidados para que entrem no caixa.
            </Text>
          ) : (
            <View style={styles.dailyList}>
              <Text style={styles.dailyTitle}>Movimento por dia</Text>
              {points.map((point) => {
                const positive = point.amount >= 0;
                const width = peak > 0 ? (Math.abs(point.amount) / peak) * 100 : 0;
                return (
                  <View key={point.date} style={styles.dailyRow}>
                    <Text style={styles.dailyDate}>{formatDayLabel(point.date)}</Text>
                    <View style={styles.dailyTrack}>
                      <View
                        style={[
                          styles.dailyFill,
                          {
                            width: `${width}%`,
                            backgroundColor: positive ? colors.violetRoyal : colors.statusError,
                          },
                        ]}
                      />
                    </View>
                    <Text
                      style={[
                        styles.dailyAmount,
                        { color: positive ? colors.violetRoyal : colors.statusError },
                      ]}
                    >
                      {formatCurrency(point.amount)}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Por que os dois números diferem: evita a dona achar que há erro. */}
        <View style={styles.tipCard}>
          <Ionicons name="bulb-outline" size={20} color={colors.primary} style={styles.tipIcon} />
          <View style={styles.tipCol}>
            <Text style={styles.tipTitle}>Por que os dois valores são diferentes?</Text>
            <Text style={styles.tipDesc}>
              O DRE conta o atendimento no dia em que foi prestado, mesmo que o dinheiro
              ainda não tenha caído. O Fluxo de Caixa conta só o que foi liquidado. Um
              atendimento feito dia 30 e recebido dia 2 aparece no DRE de um mês e no caixa
              do outro.
            </Text>
          </View>
        </View>
      </ScrollView>

      <FloatingActionButton />
    </View>
  );
}

/** "12/08" — rótulo curto do dia, a partir da data ISO (YYYY-MM-DD) do relatório. */
function formatDayLabel(isoDate: string): string {
  const [, month, day] = isoDate.split('-');
  return day && month ? `${day}/${month}` : isoDate;
}

interface StatementRowProps {
  label: string;
  value: number;
  hint?: string;
  muted?: boolean;
  emphasis?: boolean;
}

function StatementRow({ label, value, hint, muted, emphasis }: StatementRowProps) {
  return (
    <View style={styles.statementRow}>
      <View style={styles.statementLabelCol}>
        <Text style={[styles.statementLabel, emphasis && styles.statementLabelEmphasis]}>
          {label}
        </Text>
        {hint ? <Text style={styles.statementHint}>{hint}</Text> : null}
      </View>
      <Text
        style={[
          styles.statementValue,
          emphasis && styles.statementValueEmphasis,
          muted && styles.statementValueMuted,
        ]}
      >
        {formatCurrency(value)}
      </Text>
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
  },
  content: {
    padding: 16,
    paddingBottom: 110,
  },
  pageHeader: {
    marginBottom: 16,
  },
  pageTitle: {
    fontFamily: typography.fonts.headline,
    fontSize: 26,
    color: colors.graphiteText,
  },
  pageDesc: {
    fontFamily: typography.fonts.body,
    fontSize: 12,
    color: colors.graphiteMuted,
    marginTop: 2,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.borderWhisper,
    padding: 16,
    marginBottom: 14,
    ...shadows.card,
  },
  cardHeader: {
    marginBottom: 14,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  cardTitleCol: {
    flex: 1,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: borderRadius.md,
    backgroundColor: colors.lavenderTint,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    fontFamily: typography.fonts.headline,
    fontSize: 17,
    color: colors.graphiteText,
  },
  cardSub: {
    fontFamily: typography.fonts.body,
    fontSize: 11,
    color: colors.graphiteMuted,
    marginTop: 1,
  },
  statement: {
    gap: 2,
  },
  statementRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 6,
  },
  statementLabelCol: {
    flex: 1,
    marginRight: 10,
  },
  statementLabel: {
    fontFamily: typography.fonts.bodyMedium,
    fontSize: 13,
    color: colors.graphiteText,
  },
  statementLabelEmphasis: {
    fontFamily: typography.fonts.bodyBold,
  },
  statementHint: {
    fontFamily: typography.fonts.body,
    fontSize: 10,
    color: colors.graphiteMuted,
    marginTop: 1,
  },
  statementValue: {
    fontFamily: typography.fonts.bodySemiBold,
    fontSize: 13,
    color: colors.graphiteText,
  },
  statementValueEmphasis: {
    fontFamily: typography.fonts.bodyBold,
    color: colors.primary,
  },
  statementValueMuted: {
    color: colors.graphiteMuted,
  },
  statementDivider: {
    height: 1,
    backgroundColor: colors.borderWhisper,
    marginVertical: 7,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.lavenderTint,
    borderRadius: borderRadius.md,
    padding: 12,
    marginTop: 4,
  },
  resultLabelCol: {
    flex: 1,
    marginRight: 10,
  },
  resultLabel: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 13,
    color: colors.graphiteText,
  },
  resultHint: {
    fontFamily: typography.fonts.body,
    fontSize: 10,
    color: colors.graphiteMuted,
    marginTop: 2,
  },
  resultValue: {
    fontFamily: typography.fonts.headlineBold,
    fontSize: 20,
  },
  totalsFooter: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderWhisper,
  },
  totalsFooterText: {
    fontFamily: typography.fonts.body,
    fontSize: 11,
    color: colors.graphiteMuted,
  },
  cashGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  cashBox: {
    flex: 1,
    backgroundColor: colors.surfaceCanvas,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderWhisper,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  cashBoxHighlight: {
    backgroundColor: colors.lavenderTint,
    borderColor: colors.lavenderSubtle,
  },
  cashLabel: {
    fontFamily: typography.fonts.bodyMedium,
    fontSize: 10,
    color: colors.graphiteMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  cashValue: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 14,
    marginTop: 3,
  },
  cashEmpty: {
    fontFamily: typography.fonts.body,
    fontSize: 12,
    color: colors.graphiteMuted,
    lineHeight: 18,
  },
  dailyList: {
    marginTop: 4,
  },
  dailyTitle: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 0.8,
    color: colors.graphiteMuted,
    textTransform: 'uppercase',
    marginBottom: 9,
  },
  dailyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 8,
  },
  dailyDate: {
    width: 44,
    fontFamily: typography.fonts.bodyMedium,
    fontSize: 11,
    color: colors.graphiteMuted,
  },
  dailyTrack: {
    flex: 1,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.surfaceContainer,
    overflow: 'hidden',
  },
  dailyFill: {
    height: '100%',
    borderRadius: 3.5,
  },
  dailyAmount: {
    width: 92,
    textAlign: 'right',
    fontFamily: typography.fonts.bodySemiBold,
    fontSize: 11,
  },
  tipCard: {
    flexDirection: 'row',
    gap: 11,
    backgroundColor: colors.lavenderLight,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.lavenderSubtle,
    padding: 14,
  },
  tipIcon: {
    marginTop: 1,
  },
  tipCol: {
    flex: 1,
  },
  tipTitle: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 12,
    color: colors.primary,
  },
  tipDesc: {
    fontFamily: typography.fonts.body,
    fontSize: 11,
    color: colors.graphiteText,
    marginTop: 4,
    lineHeight: 17,
  },
});
