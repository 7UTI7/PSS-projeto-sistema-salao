import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { colors, typography, borderRadius, shadows } from '../../theme/theme';
import { StudioTopHeader } from '../../components/ui/StudioTopHeader';
import { FloatingActionButton } from '../../components/ui/FloatingActionButton';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/QueryState';
import { useCashFlowReport, useDreReport, useIsAdmin } from '../../hooks/useReports';
import { useFilteredTransactions } from '../../hooks/useTransactions';
import { useAuthStore } from '../../store/authStore';
import { usePeriodStore } from '../../store/periodStore';
import { profitMargin, summarizeCashFlow, totalExpenses } from '../../services/report.service';
import { MONTHLY_REVENUE_GOAL } from '../../config/studio.config';
import { LOW_STOCK_ITEMS } from '../../data/inventory.mock';
import {
  formatCurrency,
  formatPercent,
  formatRelativeDateTime,
  shareOf,
} from '../../utils/formatters';
import { daysLeftInPeriod, periodLabel } from '../../utils/period';
import type { Professional, Transaction } from '../../types';

const PROFESSIONALS: Professional[] = ['Nicolle', 'Stefany'];
const RECENT_COUNT = 5;

export default function DashboardScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [balanceVisible, setBalanceVisible] = useState(true);

  const period = usePeriodStore((state) => state.period);
  const userName = useAuthStore((state) => state.user?.name);
  const isAdmin = useIsAdmin();

  const dreQuery = useDreReport();
  const cashFlowQuery = useCashFlowReport();
  const { transactions, isPending: loadingTransactions, isError, error, refetch } =
    useFilteredTransactions();

  const cashFlow = useMemo(
    () => summarizeCashFlow(cashFlowQuery.data ?? []),
    [cashFlowQuery.data]
  );

  /**
   * Divisão por profissional: o DRE não quebra por pessoa, então soma-se a base de
   * cálculo (bruto − desconto) das receitas não canceladas do período.
   */
  const byProfessional = useMemo(() => {
    const totals = new Map<Professional, number>(PROFESSIONALS.map((name) => [name, 0]));
    for (const transaction of transactions) {
      if (transaction.type !== 'receita' || transaction.status === 'cancelada') continue;
      const current = totals.get(transaction.professional) ?? 0;
      totals.set(transaction.professional, current + transaction.grossAmount - transaction.discountAmount);
    }
    const total = [...totals.values()].reduce((sum, value) => sum + value, 0);
    return { totals, total };
  }, [transactions]);

  const recent = useMemo(
    () =>
      [...transactions]
        .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
        .slice(0, RECENT_COUNT),
    [transactions]
  );

  const dre = dreQuery.data;
  const expenses = dre ? totalExpenses(dre) : 0;
  const goalProgress = dre ? Math.min(shareOf(dre.receitaBruta, MONTHLY_REVENUE_GOAL), 1) : 0;
  const refreshing = dreQuery.isRefetching || cashFlowQuery.isRefetching;

  function handleRefresh() {
    void refetch();
    void dreQuery.refetch();
    void cashFlowQuery.refetch();
  }

  if (loadingTransactions || (isAdmin && dreQuery.isPending)) {
    return (
      <View style={styles.screen}>
        <StudioTopHeader subtitleTag="DASHBOARD" />
        <LoadingState label="Carregando o painel do studio..." />
      </View>
    );
  }

  if (isError || (isAdmin && dreQuery.isError)) {
    return (
      <View style={styles.screen}>
        <StudioTopHeader subtitleTag="DASHBOARD" />
        <ErrorState error={error ?? dreQuery.error} onRetry={handleRefresh} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StudioTopHeader subtitleTag="DASHBOARD" />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
      >
        <View style={styles.greetingSection}>
          <View style={styles.greetingTextCol}>
            <Text style={styles.atelierLabel}>ATELIER DE BELEZA</Text>
            <Text style={styles.greetingTitle}>
              Olá, {userName ? userName.split(' ')[0] : 'bem-vinda'}
            </Text>
            <Text style={styles.greetingSub}>Visão consolidada do seu atelier</Text>
          </View>

          <TouchableOpacity
            style={styles.eyeBtn}
            activeOpacity={0.7}
            onPress={() => setBalanceVisible(!balanceVisible)}
          >
            <Ionicons
              name={balanceVisible ? 'eye-outline' : 'eye-off-outline'}
              size={20}
              color={colors.graphiteMuted}
            />
          </TouchableOpacity>
        </View>

        {/* SALDO EM CAIXA: regime de caixa, só o que foi liquidado no período. */}
        <View style={styles.bannerCard}>
          <View style={styles.glowTopRight} />
          <View style={styles.glowBottomLeft} />

          <View style={styles.bannerHeader}>
            <View style={styles.bannerTagRow}>
              <View style={styles.pulseDot} />
              <Text style={styles.bannerTagText}>SALDO LIQUIDADO NO PERÍODO</Text>
            </View>
            <View style={styles.consolidatedBadge}>
              <Text style={styles.consolidatedText}>{periodLabel(period)}</Text>
            </View>
          </View>

          <View style={styles.balanceRow}>
            <Text style={styles.balanceCurrency}>R$</Text>
            <Text style={styles.balanceNumber}>
              {balanceVisible
                ? formatCurrency(cashFlow.balance).replace('R$', '').trim()
                : '••••••••'}
            </Text>
          </View>

          <View style={styles.bannerFooter}>
            <View style={styles.growthBadge}>
              <Ionicons name="trending-up" size={15} color={colors.lavenderSubtle} />
              <Text style={styles.growthText}>
                {cashFlow.days} {cashFlow.days === 1 ? 'dia com movimento' : 'dias com movimento'}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.statementLink}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('Main', { screen: 'Transactions' })}
            >
              <Text style={styles.statementText}>Extrato detalhado</Text>
              <Ionicons name="arrow-forward" size={14} color={colors.lavenderTint} />
            </TouchableOpacity>
          </View>
        </View>

        {/* KPIs do DRE. Sem eles (colaboradora), mostra o aviso de área restrita. */}
        <View style={styles.sectionHeadingRow}>
          <Text style={styles.sectionHeading}>DESEMPENHO MENSAL</Text>
          <Text style={styles.sectionHeadingRight}>{periodLabel(period)}</Text>
        </View>

        {!isAdmin ? (
          <View style={styles.restrictedCard}>
            <Ionicons name="lock-closed-outline" size={18} color={colors.primary} />
            <Text style={styles.restrictedText}>
              O resumo financeiro do studio é visível apenas para a administradora.
            </Text>
          </View>
        ) : dre ? (
          <>
            <View style={styles.grid2x2}>
              <KpiCard
                label="Faturamento bruto"
                value={formatCurrency(dre.receitaBruta)}
                hint={`Descontos: ${formatCurrency(dre.descontos)}`}
                icon="wallet-outline"
                iconColor={colors.violetRoyal}
                iconBackground={colors.lavenderTint}
              />
              <KpiCard
                label="Receita líquida"
                value={formatCurrency(dre.receitaLiquida)}
                hint={`Taxas: ${formatCurrency(dre.taxas)}`}
                icon="calculator-outline"
                iconColor={colors.tertiary}
                iconBackground={colors.lavenderTint}
              />
              <KpiCard
                label="Despesas"
                value={formatCurrency(expenses)}
                hint={`Fixas: ${formatCurrency(dre.despesasFixas)}`}
                icon="bag-outline"
                iconColor={colors.statusError}
                iconBackground={colors.statusErrorBg}
                valueColor={colors.statusError}
              />
              <KpiCard
                label="Resultado"
                value={formatCurrency(dre.resultado)}
                hint={`Margem: ${formatPercent(profitMargin(dre), 1)}`}
                icon="cash-outline"
                iconColor={dre.resultado >= 0 ? colors.statusSuccess : colors.statusError}
                iconBackground={dre.resultado >= 0 ? colors.statusSuccessBg : colors.statusErrorBg}
                valueColor={dre.resultado >= 0 ? colors.statusSuccess : colors.statusError}
              />
            </View>

            {/* META MENSAL: valor local (studio.config.ts), a API não tem cadastro de metas. */}
            <View style={styles.metaCard}>
              <View style={styles.metaTop}>
                <View style={styles.metaLeft}>
                  <View style={[styles.kpiIconCircle, { backgroundColor: colors.lavenderTint }]}>
                    <Ionicons name="flag-outline" size={16} color={colors.violetRoyal} />
                  </View>
                  <View>
                    <Text style={styles.metaLabel}>META MENSAL</Text>
                    <Text style={styles.metaTarget}>{formatCurrency(MONTHLY_REVENUE_GOAL)}</Text>
                  </View>
                </View>
                <View style={styles.metaRight}>
                  <Text style={styles.metaPercent}>{formatPercent(goalProgress, 0)} atingido</Text>
                  <Text style={styles.metaDays}>{daysLeftInPeriod(period)} dias restantes</Text>
                </View>
              </View>

              <View style={styles.trackBar}>
                <View style={[styles.fillBar, { width: `${goalProgress * 100}%` }]} />
              </View>

              <View style={styles.metaBottom}>
                <Text style={styles.metaSubText}>{formatCurrency(dre.receitaBruta)} faturado</Text>
                <Text style={styles.metaSubText}>
                  Falta: {formatCurrency(Math.max(MONTHLY_REVENUE_GOAL - dre.receitaBruta, 0))}
                </Text>
              </View>
            </View>
          </>
        ) : null}

        {/* DIVISÃO DE RECEITAS POR PROFISSIONAL */}
        <View style={styles.breakdownCard}>
          <View style={styles.breakdownTop}>
            <View>
              <Text style={styles.atelierTag}>PRODUÇÃO EM ATELIER</Text>
              <Text style={styles.breakdownTitle}>Divisão de Receitas</Text>
            </View>
            <View style={[styles.kpiIconCircle, { backgroundColor: colors.lavenderTint }]}>
              <Ionicons name="pie-chart-outline" size={18} color={colors.violetRoyal} />
            </View>
          </View>

          {byProfessional.total === 0 ? (
            <Text style={styles.breakdownEmpty}>
              Nenhuma receita registrada em {periodLabel(period)}.
            </Text>
          ) : (
            <View style={styles.legendCol}>
              {PROFESSIONALS.map((name, index) => {
                const amount = byProfessional.totals.get(name) ?? 0;
                const share = shareOf(amount, byProfessional.total);
                return (
                  <View key={name} style={styles.legendBlock}>
                    <View style={styles.legendRow}>
                      <View style={styles.legendItemLeft}>
                        <View
                          style={[
                            styles.legendDot,
                            { backgroundColor: index === 0 ? colors.violetRoyal : colors.lavenderAccent },
                          ]}
                        />
                        <View>
                          <Text style={styles.legendName}>{name}</Text>
                          <Text style={styles.legendShare}>
                            {formatPercent(share, 0)} do total
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.legendAmount}>{formatCurrency(amount)}</Text>
                    </View>

                    {/* Barra em vez de donut: mais legível e sem dependência de gráfico. */}
                    <View style={styles.shareTrack}>
                      <View
                        style={[
                          styles.shareFill,
                          {
                            width: `${share * 100}%`,
                            backgroundColor:
                              index === 0 ? colors.violetRoyal : colors.lavenderAccent,
                          },
                        ]}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* ALERTA DE REPOSIÇÃO: dados locais — não há módulo de estoque na API. */}
        {LOW_STOCK_ITEMS.length > 0 ? (
          <View style={styles.alertCard}>
            <View style={styles.alertIconBox}>
              <Ionicons name="warning-outline" size={20} color={colors.statusWarning} />
            </View>
            <View style={styles.alertCol}>
              <View style={styles.alertHeader}>
                <Text style={styles.alertTitle}>Alerta de Reposição</Text>
                <View style={styles.alertBadge}>
                  <Text style={styles.alertBadgeText}>{LOW_STOCK_ITEMS.length} ITENS</Text>
                </View>
              </View>
              <Text style={styles.alertDesc}>
                Estoque baixo:{' '}
                <Text style={styles.boldText}>
                  {LOW_STOCK_ITEMS.map((item) => item.name).join(', ')}
                </Text>
                .
              </Text>
              <TouchableOpacity
                style={styles.alertAction}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('Main', { screen: 'Inventory' })}
              >
                <Text style={styles.alertLink}>Ver Estoque</Text>
                <Ionicons name="arrow-forward" size={14} color={colors.violetRoyal} />
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {/* LANÇAMENTOS RECENTES */}
        <View style={styles.recentSection}>
          <View style={styles.recentHeader}>
            <View>
              <Text style={styles.recentTitle}>Lançamentos Recentes</Text>
              <Text style={styles.recentSub}>Últimas movimentações registradas</Text>
            </View>
            <TouchableOpacity
              style={styles.viewAllRow}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('Main', { screen: 'Transactions' })}
            >
              <Text style={styles.viewAllText}>Ver todos</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.violetRoyal} />
            </TouchableOpacity>
          </View>

          {recent.length === 0 ? (
            <EmptyState
              icon="receipt-outline"
              title="Nada lançado neste mês"
              description="Use o botão Novo Lançamento ou importe o relatório do Booksy."
              style={styles.recentEmpty}
            />
          ) : (
            recent.map((transaction) => (
              <RecentItem
                key={transaction._id}
                transaction={transaction}
                onPress={() =>
                  navigation.navigate('NewTransaction', { transactionId: transaction._id })
                }
              />
            ))
          )}
        </View>
      </ScrollView>

      <FloatingActionButton />
    </View>
  );
}

interface KpiCardProps {
  label: string;
  value: string;
  hint: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBackground: string;
  valueColor?: string;
}

function KpiCard({ label, value, hint, icon, iconColor, iconBackground, valueColor }: KpiCardProps) {
  return (
    <View style={styles.kpiCard}>
      <View style={styles.kpiTopRow}>
        <Text style={styles.kpiLabel}>{label}</Text>
        <View style={[styles.kpiIconCircle, { backgroundColor: iconBackground }]}>
          <Ionicons name={icon} size={16} color={iconColor} />
        </View>
      </View>
      <Text style={[styles.kpiValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
      <Text style={styles.kpiSub}>{hint}</Text>
    </View>
  );
}

function RecentItem({
  transaction,
  onPress,
}: {
  transaction: Transaction;
  onPress: () => void;
}) {
  const isIncome = transaction.type === 'receita';
  const amount = isIncome
    ? transaction.grossAmount - transaction.discountAmount
    : transaction.grossAmount;

  return (
    <TouchableOpacity style={styles.transactionItem} activeOpacity={0.8} onPress={onPress}>
      <View style={styles.txLeft}>
        <View style={styles.txIconCircle}>
          <Ionicons
            name={isIncome ? 'sparkles-outline' : 'bag-outline'}
            size={18}
            color={colors.violetRoyal}
          />
        </View>
        <View style={styles.txTextCol}>
          <Text style={styles.txTitle} numberOfLines={1}>
            {transaction.description}
          </Text>
          <View style={styles.txMetaRow}>
            <Text style={styles.txCategory} numberOfLines={1}>
              {transaction.category} • {transaction.professional}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.txRight}>
        <Text style={isIncome ? styles.incomeText : styles.expenseText}>
          {isIncome ? '+' : '−'}
          {formatCurrency(amount)}
        </Text>
        <Text style={styles.txTime}>{formatRelativeDateTime(transaction.occurredAt)}</Text>
      </View>
    </TouchableOpacity>
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
  greetingSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  greetingTextCol: {
    flex: 1,
  },
  atelierLabel: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 1.6,
    color: colors.violetRoyal,
  },
  greetingTitle: {
    fontFamily: typography.fonts.headlineBold,
    fontSize: 26,
    color: colors.graphiteText,
    marginTop: 2,
  },
  greetingSub: {
    fontFamily: typography.fonts.body,
    fontSize: 12,
    color: colors.graphiteMuted,
    marginTop: 2,
  },
  eyeBtn: {
    width: 38,
    height: 38,
    borderRadius: borderRadius.full,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.borderWhisper,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerCard: {
    backgroundColor: colors.violetDeep,
    borderRadius: borderRadius.xl,
    padding: 20,
    overflow: 'hidden',
    marginBottom: 20,
    ...shadows.banner,
  },
  glowTopRight: {
    position: 'absolute',
    top: -40,
    right: -30,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(196, 181, 253, 0.18)',
  },
  glowBottomLeft: {
    position: 'absolute',
    bottom: -50,
    left: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(124, 58, 237, 0.25)',
  },
  bannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bannerTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  pulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.lavenderAccent,
  },
  bannerTagText: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 1,
    color: colors.lavenderSubtle,
  },
  consolidatedBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  consolidatedText: {
    fontFamily: typography.fonts.bodySemiBold,
    fontSize: 9,
    color: '#FFFFFF',
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    marginTop: 14,
  },
  balanceCurrency: {
    fontFamily: typography.fonts.bodySemiBold,
    fontSize: 16,
    color: colors.lavenderSubtle,
    marginBottom: 5,
  },
  balanceNumber: {
    fontFamily: typography.fonts.headlineBold,
    fontSize: 34,
    color: '#FFFFFF',
  },
  bannerFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  growthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  growthText: {
    fontFamily: typography.fonts.bodySemiBold,
    fontSize: 11,
    color: colors.lavenderSubtle,
  },
  statementLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statementText: {
    fontFamily: typography.fonts.bodySemiBold,
    fontSize: 11,
    color: colors.lavenderTint,
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionHeading: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 1.2,
    color: colors.graphiteMuted,
  },
  sectionHeadingRight: {
    fontFamily: typography.fonts.bodyMedium,
    fontSize: 10,
    color: colors.graphiteMuted,
  },
  restrictedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.lavenderTint,
    borderWidth: 1,
    borderColor: colors.lavenderSubtle,
    borderRadius: borderRadius.lg,
    padding: 14,
    marginBottom: 20,
  },
  restrictedText: {
    flex: 1,
    fontFamily: typography.fonts.body,
    fontSize: 12,
    color: colors.primary,
    lineHeight: 17,
  },
  grid2x2: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  kpiCard: {
    flexGrow: 1,
    flexBasis: '47%',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.borderWhisper,
    padding: 13,
    ...shadows.card,
  },
  kpiTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  kpiLabel: {
    flex: 1,
    fontFamily: typography.fonts.bodyMedium,
    fontSize: 11,
    color: colors.graphiteMuted,
    marginRight: 6,
  },
  kpiIconCircle: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  kpiValue: {
    fontFamily: typography.fonts.headlineBold,
    fontSize: 17,
    color: colors.graphiteText,
  },
  kpiSub: {
    fontFamily: typography.fonts.body,
    fontSize: 10,
    color: colors.graphiteMuted,
    marginTop: 3,
  },
  metaCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.borderWhisper,
    padding: 14,
    marginBottom: 20,
    ...shadows.card,
  },
  metaTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  metaLabel: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 1,
    color: colors.graphiteMuted,
  },
  metaTarget: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 15,
    color: colors.graphiteText,
  },
  metaRight: {
    alignItems: 'flex-end',
  },
  metaPercent: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 12,
    color: colors.violetRoyal,
  },
  metaDays: {
    fontFamily: typography.fonts.body,
    fontSize: 10,
    color: colors.graphiteMuted,
  },
  trackBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceContainer,
    marginTop: 12,
    overflow: 'hidden',
  },
  fillBar: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: colors.violetRoyal,
  },
  metaBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  metaSubText: {
    fontFamily: typography.fonts.body,
    fontSize: 10,
    color: colors.graphiteMuted,
  },
  breakdownCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.borderWhisper,
    padding: 14,
    marginBottom: 20,
    ...shadows.card,
  },
  breakdownTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  atelierTag: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 1.2,
    color: colors.violetRoyal,
  },
  breakdownTitle: {
    fontFamily: typography.fonts.headline,
    fontSize: 16,
    color: colors.graphiteText,
    marginTop: 2,
  },
  breakdownEmpty: {
    fontFamily: typography.fonts.body,
    fontSize: 12,
    color: colors.graphiteMuted,
  },
  legendCol: {
    gap: 14,
  },
  legendBlock: {
    gap: 7,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  legendItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendName: {
    fontFamily: typography.fonts.bodySemiBold,
    fontSize: 13,
    color: colors.graphiteText,
  },
  legendShare: {
    fontFamily: typography.fonts.body,
    fontSize: 10,
    color: colors.graphiteMuted,
  },
  legendAmount: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 13,
    color: colors.graphiteText,
  },
  shareTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceContainer,
    overflow: 'hidden',
  },
  shareFill: {
    height: '100%',
    borderRadius: 3,
  },
  alertCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: colors.statusWarningBg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 14,
    marginBottom: 20,
  },
  alertIconBox: {
    width: 38,
    height: 38,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(180, 83, 9, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertCol: {
    flex: 1,
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  alertTitle: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 13,
    color: colors.statusWarning,
  },
  alertBadge: {
    backgroundColor: 'rgba(180, 83, 9, 0.14)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
  },
  alertBadgeText: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 8,
    color: colors.statusWarning,
    letterSpacing: 0.5,
  },
  alertDesc: {
    fontFamily: typography.fonts.body,
    fontSize: 11,
    color: colors.graphiteText,
    marginTop: 4,
    lineHeight: 16,
  },
  boldText: {
    fontFamily: typography.fonts.bodyBold,
  },
  alertAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  alertLink: {
    fontFamily: typography.fonts.bodySemiBold,
    fontSize: 11,
    color: colors.violetRoyal,
  },
  recentSection: {
    marginBottom: 8,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  recentTitle: {
    fontFamily: typography.fonts.headline,
    fontSize: 16,
    color: colors.graphiteText,
  },
  recentSub: {
    fontFamily: typography.fonts.body,
    fontSize: 11,
    color: colors.graphiteMuted,
    marginTop: 2,
  },
  recentEmpty: {
    paddingVertical: 28,
  },
  viewAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewAllText: {
    fontFamily: typography.fonts.bodySemiBold,
    fontSize: 11,
    color: colors.violetRoyal,
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.borderWhisper,
    padding: 12,
    marginBottom: 8,
  },
  txLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 10,
  },
  txTextCol: {
    flex: 1,
  },
  txIconCircle: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    backgroundColor: colors.lavenderTint,
    justifyContent: 'center',
    alignItems: 'center',
  },
  txTitle: {
    fontFamily: typography.fonts.bodySemiBold,
    fontSize: 13,
    color: colors.graphiteText,
  },
  txMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  txCategory: {
    fontFamily: typography.fonts.body,
    fontSize: 10,
    color: colors.graphiteMuted,
  },
  txRight: {
    alignItems: 'flex-end',
  },
  incomeText: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 13,
    color: colors.violetRoyal,
  },
  expenseText: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 13,
    color: colors.statusError,
  },
  txTime: {
    fontFamily: typography.fonts.body,
    fontSize: 10,
    color: colors.graphiteMuted,
    marginTop: 2,
  },
});
