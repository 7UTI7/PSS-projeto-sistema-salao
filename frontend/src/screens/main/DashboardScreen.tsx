import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { MainTabParamList } from '../../navigation/types';
import { colors, typography, borderRadius, shadows } from '../../theme/theme';
import { StudioTopHeader } from '../../components/ui/StudioTopHeader';
import { FloatingActionButton } from '../../components/ui/FloatingActionButton';

export default function DashboardScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const [balanceVisible, setBalanceVisible] = useState(true);

  return (
    <View style={styles.screen}>
      {/* Top Bar Oficial com Monograma N e período */}
      <StudioTopHeader subtitleTag="DASHBOARD" currentPeriod="Setembro 2024" />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* TOPO: Saudação e Perfil */}
        <View style={styles.greetingSection}>
          <View style={styles.greetingTextCol}>
            <Text style={styles.atelierLabel}>ATELIER DE BELEZA</Text>
            <Text style={styles.greetingTitle}>Olá, Nicolle</Text>
            <Text style={styles.greetingSub}>Visão consolidada do seu atelier</Text>
          </View>

          <View style={styles.greetingActions}>
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

            <View style={styles.avatarBorder}>
              <View style={styles.avatarInner}>
                <Ionicons name="sparkles" size={16} color="#FFFFFF" />
              </View>
              <View style={styles.onlineBadge} />
            </View>
          </View>
        </View>

        {/* CARD PRINCIPAL: Saldo Atual em Caixa (Deep Violet) */}
        <View style={styles.bannerCard}>
          {/* Círculos decorativos de luz translúcida */}
          <View style={styles.glowTopRight} />
          <View style={styles.glowBottomLeft} />

          <View style={styles.bannerHeader}>
            <View style={styles.bannerTagRow}>
              <View style={styles.pulseDot} />
              <Text style={styles.bannerTagText}>SALDO ATUAL EM CAIXA</Text>
            </View>
            <View style={styles.consolidatedBadge}>
              <Text style={styles.consolidatedText}>Consolidado</Text>
            </View>
          </View>

          <View style={styles.balanceRow}>
            <Text style={styles.balanceCurrency}>R$</Text>
            <Text style={styles.balanceNumber}>
              {balanceVisible ? '2.980,50' : '••••••••'}
            </Text>
          </View>

          <View style={styles.bannerFooter}>
            <View style={styles.growthBadge}>
              <Ionicons name="trending-up" size={15} color={colors.lavenderSubtle} />
              <Text style={styles.growthText}>+12,4% este mês</Text>
            </View>

            <TouchableOpacity
              style={styles.statementLink}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('Transactions')}
            >
              <Text style={styles.statementText}>Extrato detalhado</Text>
              <Ionicons name="arrow-forward" size={14} color={colors.lavenderTint} />
            </TouchableOpacity>
          </View>
        </View>

        {/* CARDS DE RESUMO FINANCEIRO (Grid 2x2) */}
        <View style={styles.sectionHeadingRow}>
          <Text style={styles.sectionHeading}>DESEMPENHO MENSAL</Text>
          <Text style={styles.sectionHeadingRight}>Setembro 2024</Text>
        </View>

        <View style={styles.grid2x2}>
          {/* Faturamento */}
          <View style={styles.kpiCard}>
            <View style={styles.kpiTopRow}>
              <Text style={styles.kpiLabel}>Faturamento</Text>
              <View style={[styles.kpiIconCircle, { backgroundColor: colors.lavenderTint }]}>
                <Ionicons name="wallet-outline" size={16} color={colors.violetRoyal} />
              </View>
            </View>
            <Text style={styles.kpiValue}>R$ 1.495,00</Text>
            <Text style={[styles.kpiSub, { color: colors.violetRoyal, fontWeight: '700' }]}>
              +18% vs ago
            </Text>
          </View>

          {/* Receita Líquida */}
          <View style={styles.kpiCard}>
            <View style={styles.kpiTopRow}>
              <Text style={styles.kpiLabel}>Receita Líquida</Text>
              <View style={[styles.kpiIconCircle, { backgroundColor: colors.lavenderTint }]}>
                <Ionicons name="calculator-outline" size={16} color={colors.tertiary} />
              </View>
            </View>
            <Text style={styles.kpiValue}>R$ 1.345,00</Text>
            <Text style={styles.kpiSub}>Margem: 90%</Text>
          </View>

          {/* Despesas */}
          <View style={styles.kpiCard}>
            <View style={styles.kpiTopRow}>
              <Text style={styles.kpiLabel}>Despesas</Text>
              <View style={[styles.kpiIconCircle, { backgroundColor: colors.statusErrorBg }]}>
                <Ionicons name="bag-outline" size={16} color={colors.statusError} />
              </View>
            </View>
            <Text style={[styles.kpiValue, { color: colors.statusError }]}>R$ 858,18</Text>
            <Text style={styles.kpiSub}>Controlado</Text>
          </View>

          {/* Lucro Estimado */}
          <View style={styles.kpiCard}>
            <View style={styles.kpiTopRow}>
              <Text style={styles.kpiLabel}>Lucro Estimado</Text>
              <View style={[styles.kpiIconCircle, { backgroundColor: colors.statusSuccessBg }]}>
                <Ionicons name="cash-outline" size={16} color={colors.statusSuccess} />
              </View>
            </View>
            <Text style={[styles.kpiValue, { color: colors.statusSuccess }]}>R$ 486,82</Text>
            <Text style={[styles.kpiSub, { color: colors.statusSuccess, fontWeight: '700' }]}>
              32,5% líquido
            </Text>
          </View>
        </View>

        {/* META MENSAL */}
        <View style={styles.metaCard}>
          <View style={styles.metaTop}>
            <View style={styles.metaLeft}>
              <View style={[styles.kpiIconCircle, { backgroundColor: colors.lavenderTint }]}>
                <Ionicons name="flag-outline" size={16} color={colors.violetRoyal} />
              </View>
              <View>
                <Text style={styles.metaLabel}>META MENSAL</Text>
                <Text style={styles.metaTarget}>R$ 5.000,00</Text>
              </View>
            </View>
            <View style={styles.metaRight}>
              <Text style={styles.metaPercent}>30% atingido</Text>
              <Text style={styles.metaDays}>14 dias restantes</Text>
            </View>
          </View>

          {/* Barra Roxa com Gradiente */}
          <View style={styles.trackBar}>
            <View style={[styles.fillBar, { width: '30%' }]} />
          </View>

          <View style={styles.metaBottom}>
            <Text style={styles.metaSubText}>R$ 1.495,00 faturado</Text>
            <Text style={styles.metaSubText}>Falta: R$ 3.505,00</Text>
          </View>
        </View>

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

          <View style={styles.chartContainer}>
            {/* Donut representation */}
            <View style={styles.donutCircle}>
              <View style={styles.donutArcPrimary} />
              <View style={styles.donutArcSecondary} />
              <View style={styles.donutCenter}>
                <Text style={styles.donutSmall}>TOTAL</Text>
                <Text style={styles.donutBig}>100%</Text>
              </View>
            </View>

            <View style={styles.legendCol}>
              <View style={styles.legendRow}>
                <View style={styles.legendItemLeft}>
                  <View style={[styles.legendDot, { backgroundColor: colors.violetRoyal }]} />
                  <View>
                    <Text style={styles.legendName}>Nicolle</Text>
                    <Text style={styles.legendShare}>68% do total</Text>
                  </View>
                </View>
                <Text style={styles.legendAmount}>R$ 1.016,60</Text>
              </View>

              <View style={styles.legendRow}>
                <View style={styles.legendItemLeft}>
                  <View style={[styles.legendDot, { backgroundColor: colors.lavenderAccent }]} />
                  <View>
                    <Text style={styles.legendName}>Stephany</Text>
                    <Text style={styles.legendShare}>32% do total</Text>
                  </View>
                </View>
                <Text style={styles.legendAmount}>R$ 478,40</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ALERTA DE REPOSIÇÃO */}
        <View style={styles.alertCard}>
          <View style={styles.alertIconBox}>
            <Ionicons name="warning-outline" size={20} color={colors.statusWarning} />
          </View>
          <View style={styles.alertCol}>
            <View style={styles.alertHeader}>
              <Text style={styles.alertTitle}>Alerta de Reposição</Text>
              <View style={styles.alertBadge}>
                <Text style={styles.alertBadgeText}>2 ITENS</Text>
              </View>
            </View>
            <Text style={styles.alertDesc}>
              Estoque Baixo: <Text style={styles.boldText}>Cola de Cílios</Text> e{' '}
              <Text style={styles.boldText}>Luvas descartáveis</Text>.
            </Text>
            <TouchableOpacity
              style={styles.alertAction}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('Inventory')}
            >
              <Text style={styles.alertLink}>Ver Estoque</Text>
              <Ionicons name="arrow-forward" size={14} color={colors.violetRoyal} />
            </TouchableOpacity>
          </View>
        </View>

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
              onPress={() => navigation.navigate('Transactions')}
            >
              <Text style={styles.viewAllText}>Ver todos</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.violetRoyal} />
            </TouchableOpacity>
          </View>

          {/* Item 1 */}
          <View style={styles.transactionItem}>
            <View style={styles.txLeft}>
              <View style={styles.txIconCircle}>
                <Ionicons name="brush-outline" size={18} color={colors.violetRoyal} />
              </View>
              <View>
                <Text style={styles.txTitle}>Efeito Wispy</Text>
                <View style={styles.txMetaRow}>
                  <Text style={styles.txCategory}>Cílios por Nicolle</Text>
                  <Text style={styles.txDot}>•</Text>
                  <View style={styles.paymentPill}>
                    <Text style={styles.paymentText}>Cartão</Text>
                  </View>
                </View>
              </View>
            </View>
            <View style={styles.txRight}>
              <Text style={styles.incomeText}>+R$ 180,00</Text>
              <Text style={styles.txTime}>15:40</Text>
            </View>
          </View>

          {/* Item 2 */}
          <View style={styles.transactionItem}>
            <View style={styles.txLeft}>
              <View style={styles.txIconCircle}>
                <Ionicons name="flower-outline" size={18} color={colors.violetRoyal} />
              </View>
              <View>
                <Text style={styles.txTitle}>Unhas Fibra de Vidro</Text>
                <View style={styles.txMetaRow}>
                  <Text style={styles.txCategory}>Stephany</Text>
                  <Text style={styles.txDot}>•</Text>
                  <View style={styles.paymentPill}>
                    <Text style={styles.paymentText}>Pix</Text>
                  </View>
                </View>
              </View>
            </View>
            <View style={styles.txRight}>
              <Text style={styles.incomeText}>+R$ 30,00</Text>
              <Text style={styles.txTime}>14:15</Text>
            </View>
          </View>

          {/* Item 3 */}
          <View style={styles.transactionItem}>
            <View style={styles.txLeft}>
              <View style={[styles.txIconCircle, { backgroundColor: colors.statusErrorBg }]}>
                <Ionicons name="bag-handle-outline" size={18} color={colors.statusError} />
              </View>
              <View>
                <Text style={styles.txTitle}>Compra descartáveis</Text>
                <View style={styles.txMetaRow}>
                  <Text style={styles.txCategory}>Fornecedor Local</Text>
                  <Text style={styles.txDot}>•</Text>
                  <View style={[styles.paymentPill, { backgroundColor: colors.statusErrorBg }]}>
                    <Text style={[styles.paymentText, { color: colors.statusError }]}>Débito</Text>
                  </View>
                </View>
              </View>
            </View>
            <View style={styles.txRight}>
              <Text style={styles.expenseText}>-R$ 34,50</Text>
              <Text style={styles.txTime}>11:20</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Floating Action Button (+ Novo Lançamento) */}
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
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  greetingSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingTop: 4,
  },
  greetingTextCol: {
    flex: 1,
  },
  atelierLabel: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 10,
    color: colors.violetRoyal,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  greetingTitle: {
    fontFamily: typography.fonts.headline,
    fontSize: 26,
    color: colors.graphiteText,
    marginTop: 2,
  },
  greetingSub: {
    fontFamily: typography.fonts.body,
    fontSize: 12,
    color: colors.graphiteMuted,
  },
  greetingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
  avatarBorder: {
    position: 'relative',
    width: 42,
    height: 42,
    borderRadius: borderRadius.full,
    padding: 2,
    backgroundColor: colors.violetRoyal,
  },
  avatarInner: {
    flex: 1,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.violetRoyal,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  bannerCard: {
    position: 'relative',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.xl,
    padding: 20,
    overflow: 'hidden',
    marginBottom: 20,
    ...shadows.banner,
  },
  glowTopRight: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(196, 181, 253, 0.25)',
  },
  glowBottomLeft: {
    position: 'absolute',
    bottom: -30,
    left: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(109, 40, 217, 0.35)',
  },
  bannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  bannerTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.lavenderSubtle,
  },
  bannerTagText: {
    fontFamily: typography.fonts.bodySemiBold,
    fontSize: 10,
    color: colors.lavenderSubtle,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  consolidatedBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  consolidatedText: {
    fontFamily: typography.fonts.bodyMedium,
    fontSize: 10,
    color: '#FFFFFF',
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginVertical: 4,
  },
  balanceCurrency: {
    fontFamily: typography.fonts.bodySemiBold,
    fontSize: 18,
    color: colors.lavenderSubtle,
  },
  balanceNumber: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 32,
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  bannerFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  growthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  growthText: {
    fontFamily: typography.fonts.bodySemiBold,
    fontSize: 11,
    color: '#FFFFFF',
  },
  statementLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statementText: {
    fontFamily: typography.fonts.bodyMedium,
    fontSize: 11,
    color: colors.lavenderTint,
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionHeading: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 11,
    color: colors.graphiteMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  sectionHeadingRight: {
    fontFamily: typography.fonts.bodySemiBold,
    fontSize: 11,
    color: colors.violetRoyal,
  },
  grid2x2: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  kpiCard: {
    width: '48.5%',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.borderWhisper,
    ...shadows.card,
  },
  kpiTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  kpiLabel: {
    fontFamily: typography.fonts.bodyMedium,
    fontSize: 12,
    color: colors.graphiteMuted,
  },
  kpiIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  kpiValue: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 16,
    color: colors.graphiteText,
    marginBottom: 2,
  },
  kpiSub: {
    fontFamily: typography.fonts.body,
    fontSize: 11,
    color: colors.graphiteMuted,
  },
  metaCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.borderWhisper,
    marginBottom: 16,
    ...shadows.card,
  },
  metaTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  metaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaLabel: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 10,
    color: colors.graphiteMuted,
    letterSpacing: 0.8,
  },
  metaTarget: {
    fontFamily: typography.fonts.headlineBold,
    fontSize: 16,
    color: colors.graphiteText,
  },
  metaRight: {
    alignItems: 'flex-end',
  },
  metaPercent: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 13,
    color: colors.violetRoyal,
  },
  metaDays: {
    fontFamily: typography.fonts.body,
    fontSize: 11,
    color: colors.graphiteMuted,
  },
  trackBar: {
    height: 8,
    backgroundColor: colors.lavenderTint,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    marginVertical: 4,
  },
  fillBar: {
    height: '100%',
    backgroundColor: colors.violetRoyal,
    borderRadius: borderRadius.full,
  },
  metaBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  metaSubText: {
    fontFamily: typography.fonts.body,
    fontSize: 11,
    color: colors.graphiteMuted,
  },
  breakdownCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.borderWhisper,
    marginBottom: 16,
    ...shadows.card,
  },
  breakdownTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  atelierTag: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 10,
    color: colors.violetRoyal,
    letterSpacing: 1.2,
  },
  breakdownTitle: {
    fontFamily: typography.fonts.headlineBold,
    fontSize: 16,
    color: colors.graphiteText,
    marginTop: 2,
  },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  donutCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 8,
    borderColor: colors.violetRoyal,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  donutArcPrimary: {
    position: 'absolute',
    top: -8,
    left: -8,
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 8,
    borderColor: colors.violetRoyal,
    borderTopColor: 'transparent',
    borderLeftColor: 'transparent',
  },
  donutArcSecondary: {
    position: 'absolute',
    top: -8,
    left: -8,
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 8,
    borderColor: colors.lavenderAccent,
    borderBottomColor: 'transparent',
    borderRightColor: 'transparent',
  },
  donutCenter: {
    alignItems: 'center',
  },
  donutSmall: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 8,
    color: colors.graphiteMuted,
  },
  donutBig: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 13,
    color: colors.graphiteText,
  },
  legendCol: {
    flex: 1,
    gap: 10,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  legendItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
    fontSize: 11,
    color: colors.graphiteMuted,
  },
  legendAmount: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 13,
    color: colors.graphiteText,
  },
  alertCard: {
    backgroundColor: '#FFFDF9',
    borderRadius: borderRadius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.statusWarningBg,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 20,
    ...shadows.card,
  },
  alertIconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.statusWarningBg,
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
    marginBottom: 4,
  },
  alertTitle: {
    fontFamily: typography.fonts.headlineBold,
    fontSize: 14,
    color: '#78350F',
  },
  alertBadge: {
    backgroundColor: colors.statusWarningBg,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: borderRadius.full,
  },
  alertBadgeText: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 9,
    color: colors.statusWarning,
  },
  alertDesc: {
    fontFamily: typography.fonts.body,
    fontSize: 12,
    color: colors.graphiteMuted,
    lineHeight: 17,
  },
  boldText: {
    fontFamily: typography.fonts.bodySemiBold,
    color: colors.graphiteText,
  },
  alertAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 6,
  },
  alertLink: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 12,
    color: colors.violetRoyal,
  },
  recentSection: {
    marginBottom: 10,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  recentTitle: {
    fontFamily: typography.fonts.headlineBold,
    fontSize: 18,
    color: colors.graphiteText,
  },
  recentSub: {
    fontFamily: typography.fonts.body,
    fontSize: 11,
    color: colors.graphiteMuted,
  },
  viewAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewAllText: {
    fontFamily: typography.fonts.bodySemiBold,
    fontSize: 12,
    color: colors.violetRoyal,
  },
  transactionItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.borderWhisper,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    ...shadows.card,
  },
  txLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  txIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.lavenderTint,
    justifyContent: 'center',
    alignItems: 'center',
  },
  txTitle: {
    fontFamily: typography.fonts.bodySemiBold,
    fontSize: 14,
    color: colors.graphiteText,
  },
  txMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  txCategory: {
    fontFamily: typography.fonts.body,
    fontSize: 11,
    color: colors.graphiteMuted,
  },
  txDot: {
    color: colors.borderWhisper,
    fontSize: 10,
  },
  paymentPill: {
    backgroundColor: colors.lavenderTint,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: borderRadius.xs,
  },
  paymentText: {
    fontFamily: typography.fonts.bodySemiBold,
    fontSize: 9,
    color: colors.violetDeep,
  },
  txRight: {
    alignItems: 'flex-end',
  },
  incomeText: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 14,
    color: colors.violetRoyal,
  },
  expenseText: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 14,
    color: colors.statusError,
  },
  txTime: {
    fontFamily: typography.fonts.body,
    fontSize: 10,
    color: colors.graphiteMuted,
    marginTop: 2,
  },
});
