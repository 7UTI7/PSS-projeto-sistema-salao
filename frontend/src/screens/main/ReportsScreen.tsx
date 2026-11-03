import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, borderRadius, shadows } from '../../theme/theme';
import { StudioTopHeader } from '../../components/ui/StudioTopHeader';
import { FloatingActionButton } from '../../components/ui/FloatingActionButton';

export default function ReportsScreen() {
  const [booksyFile, setBooksyFile] = useState<string | null>('atendimentos_agosto_2026.xlsx');
  const [infiniteFile, setInfiniteFile] = useState<string | null>('extrato_infinite_agosto.csv');
  const [processing, setProcessing] = useState(false);
  const [reconciled, setReconciled] = useState(true);

  function handleSelectFile(type: 'booksy' | 'infinite') {
    Alert.alert(
      type === 'booksy' ? 'Relatório Booksy' : 'Extrato InfinitePay',
      'Planilha mock selecionada com sucesso: atendimentos_studio.xlsx',
      [{ text: 'OK' }]
    );
  }

  function handleReconcile() {
    setProcessing(true);
    setTimeout(() => {
      setProcessing(false);
      setReconciled(true);
      Alert.alert(
        'Conciliação Concluída!',
        '100% dos 12 atendimentos conferidos com os 32 recebíveis da InfinitePay. Saldo disponível: R$ 1.345,00.'
      );
    }, 1200);
  }

  return (
    <View style={styles.screen}>
      {/* Top Header Oficial */}
      <StudioTopHeader
        subtitleTag="IMPORTAÇÃO"
        currentPeriod="Setembro 2024"
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Barra de Status e Conexão Bancária */}
        <View style={styles.topStatusRow}>
          <View style={styles.secureBadge}>
            <View style={styles.greenPulseDot} />
            <Text style={styles.secureBadgeText}>
              CONEXÃO ATIVA • CRIPTOGRAFIA BANCÁRIA
            </Text>
          </View>

          <TouchableOpacity style={styles.historyBtn} activeOpacity={0.7}>
            <Ionicons name="time-outline" size={15} color={colors.primary} />
            <Text style={styles.historyText}>Histórico</Text>
          </TouchableOpacity>
        </View>

        {/* Cabeçalho da Página */}
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Importar Relatórios</Text>
          <Text style={styles.pageDesc}>
            Sincronize seus dados do Booksy e InfinitePay sem complicação para auditar atendimentos e recebíveis.
          </Text>
        </View>

        {/* CARD 1: BOOKSY UPLOAD */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.serviceTitleRow}>
              <View style={styles.serviceIconBox}>
                <Ionicons name="calendar-outline" size={20} color={colors.primary} />
              </View>
              <View>
                <Text style={styles.serviceName}>Booksy</Text>
                <Text style={styles.serviceSub}>Agendamentos & Comissões</Text>
              </View>
            </View>
            <View style={styles.serviceTag}>
              <Text style={styles.serviceTagText}>Serviços</Text>
            </View>
          </View>

          {/* Dropzone Booksy */}
          <View style={styles.dropzoneContainer}>
            <TouchableOpacity
              style={styles.dropzone}
              activeOpacity={0.8}
              onPress={() => handleSelectFile('booksy')}
            >
              <View style={styles.uploadIconCircle}>
                <Ionicons name="cloud-upload-outline" size={24} color={colors.primary} />
              </View>
              <Text style={styles.uploadTitle}>
                {booksyFile ? `Arquivo: ${booksyFile}` : 'Upload do relatório (.xlsx ou .csv)'}
              </Text>
              <Text style={styles.uploadSub}>
                Arraste ou toque para selecionar a planilha de atendimentos
              </Text>
              <View style={styles.chooseFileBtn}>
                <Ionicons name="document-text-outline" size={15} color={colors.primary} />
                <Text style={styles.chooseFileText}>Selecionar Arquivo</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Footer Card Booksy */}
          <View style={styles.cardFooter}>
            <View style={styles.footerStatus}>
              <Ionicons name="checkmark-circle" size={16} color={colors.statusSuccess} />
              <Text style={styles.footerStatusText}>
                23/08/2026 • 12 atendimentos processados
              </Text>
            </View>
            <TouchableOpacity activeOpacity={0.7}>
              <Text style={styles.logsLink}>Ver logs</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* CARD 2: INFINITEPAY UPLOAD */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.serviceTitleRow}>
              <View style={styles.serviceIconBox}>
                <Ionicons name="card-outline" size={20} color={colors.primary} />
              </View>
              <View>
                <Text style={styles.serviceName}>InfinitePay</Text>
                <Text style={styles.serviceSub}>Maquininha, Taxas & Pix</Text>
              </View>
            </View>
            <View style={[styles.serviceTag, { backgroundColor: colors.statusSuccessBg }]}>
              <Text style={[styles.serviceTagText, { color: colors.statusSuccess }]}>Liquidação</Text>
            </View>
          </View>

          {/* Dropzone InfinitePay */}
          <View style={styles.dropzoneContainer}>
            <TouchableOpacity
              style={styles.dropzone}
              activeOpacity={0.8}
              onPress={() => handleSelectFile('infinite')}
            >
              <View style={styles.uploadIconCircle}>
                <Ionicons name="receipt-outline" size={24} color={colors.primary} />
              </View>
              <Text style={styles.uploadTitle}>
                {infiniteFile ? `Extrato: ${infiniteFile}` : 'Extrato de vendas/Pix (.csv ou .pdf)'}
              </Text>
              <Text style={styles.uploadSub}>
                Extrato financeiro com taxas deduzidas e prazos
              </Text>
              <View style={styles.chooseFileBtn}>
                <Ionicons name="receipt" size={15} color={colors.primary} />
                <Text style={styles.chooseFileText}>Selecionar Extrato</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Footer Card InfinitePay */}
          <View style={styles.cardFooter}>
            <View style={styles.footerStatus}>
              <Ionicons name="calendar-clear-outline" size={16} color={colors.primary} />
              <Text style={styles.footerStatusText}>
                24/08 a 29/08 • 32 transações
              </Text>
            </View>
            <View style={styles.downloadedBadge}>
              <Text style={styles.downloadedText}>100% Baixado</Text>
            </View>
          </View>
        </View>

        {/* CARD 3: RESUMO DA CONCILIAÇÃO */}
        <View style={styles.sectionHeaderRow}>
          <View style={styles.summaryTitleRow}>
            <Ionicons name="checkbox-outline" size={18} color={colors.primary} />
            <Text style={styles.summaryTitle}>Resumo da Conciliação</Text>
          </View>
          <Text style={styles.cycleText}>Ciclo 24–29 Ago</Text>
        </View>

        <View style={[styles.card, styles.reconcileCard]}>
          {/* Badge 100% Conciliado */}
          <View style={styles.conciliatedBanner}>
            <View style={styles.conciliatedLeft}>
              <Ionicons name="shield-checkmark" size={18} color={colors.statusSuccess} />
              <Text style={styles.conciliatedTitle}>100% Conciliado com extrato bancário</Text>
            </View>
            <View style={styles.noErrorsBadge}>
              <Text style={styles.noErrorsText}>Sem erros</Text>
            </View>
          </View>

          {/* Grid de Valores */}
          <View style={styles.reconcileGrid}>
            <View style={styles.reconcileCol}>
              <Text style={styles.metricLabel}>Vendas Brutas (Booksy)</Text>
              <Text style={styles.metricBig}>R$ 1.495,00</Text>
              <Text style={styles.metricSub}>12 serviços confirmados</Text>
            </View>

            <View style={[styles.reconcileCol, { backgroundColor: colors.statusErrorBg }]}>
              <Text style={[styles.metricLabel, { color: colors.statusError }]}>
                Taxas InfinitePay
              </Text>
              <Text style={[styles.metricBig, { color: colors.statusError }]}>
                - R$ 150,00
              </Text>
              <Text style={styles.metricSub}>Média efetiva 10,03%</Text>
            </View>
          </View>

          {/* Destaque: Líquido a Receber / Creditado */}
          <View style={styles.netReceivableBox}>
            <View>
              <Text style={styles.netTag}>LÍQUIDO A RECEBER / CREDITADO</Text>
              <Text style={styles.netAmount}>R$ 1.345,00</Text>
              <Text style={styles.netBankInfo}>Disponível em conta vinculada Nubank PJ</Text>
            </View>
            <View style={styles.bankIconCircle}>
              <Ionicons name="business-outline" size={20} color="#FFFFFF" />
            </View>
          </View>

          {/* Linha de Divergência */}
          <View style={styles.divergenceRow}>
            <View style={styles.divergenceLeft}>
              <Ionicons name="checkmark-done" size={16} color={colors.statusSuccess} />
              <Text style={styles.divergenceLabel}>Divergências ou pendências de saldos:</Text>
            </View>
            <Text style={styles.divergenceValue}>R$ 0,00</Text>
          </View>

          {/* Botões de Ação */}
          <TouchableOpacity
            style={[styles.primaryActionBtn, processing && { opacity: 0.7 }]}
            activeOpacity={0.85}
            onPress={handleReconcile}
            disabled={processing}
          >
            {processing ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Ionicons name="sync" size={18} color="#FFFFFF" />
                <Text style={styles.primaryActionText}>Processar & Conciliar Arquivos</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryActionBtn} activeOpacity={0.8}>
            <Ionicons name="download-outline" size={17} color={colors.primary} />
            <Text style={styles.secondaryActionText}>Exportar Relatório Consolidado (.xlsx)</Text>
          </TouchableOpacity>
        </View>

        {/* Dica de Gestão Studio */}
        <View style={styles.tipCard}>
          <Ionicons name="bulb-outline" size={20} color={colors.primary} style={styles.tipIcon} />
          <View style={styles.tipCol}>
            <Text style={styles.tipTitle}>Dica de Gestão Studio</Text>
            <Text style={styles.tipDesc}>
              Ao importar o extrato até as 18h, suas comissões de micropigmentação e estética são recalculadas automaticamente na folha dos especialistas.
            </Text>
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
  topStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  secureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.lavenderTint,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.lavenderSubtle,
  },
  greenPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.statusSuccess,
  },
  secureBadgeText: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 9,
    color: colors.primary,
    letterSpacing: 0.6,
  },
  historyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  historyText: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 12,
    color: colors.primary,
  },
  pageHeader: {
    marginBottom: 16,
  },
  pageTitle: {
    fontFamily: typography.fonts.headline,
    fontSize: 28,
    color: colors.graphiteText,
  },
  pageDesc: {
    fontFamily: typography.fonts.body,
    fontSize: 13,
    color: colors.graphiteMuted,
    lineHeight: 18,
    marginTop: 4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.borderWhisper,
    marginBottom: 16,
    overflow: 'hidden',
    ...shadows.card,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderWhisper,
  },
  serviceTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  serviceIconBox: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    backgroundColor: colors.lavenderTint,
    justifyContent: 'center',
    alignItems: 'center',
  },
  serviceName: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 15,
    color: colors.graphiteText,
  },
  serviceSub: {
    fontFamily: typography.fonts.body,
    fontSize: 11,
    color: colors.graphiteMuted,
  },
  serviceTag: {
    backgroundColor: colors.lavenderTint,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  serviceTagText: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 10,
    color: colors.primary,
  },
  dropzoneContainer: {
    padding: 14,
  },
  dropzone: {
    borderWidth: 1.5,
    borderColor: colors.lavenderAccent,
    borderStyle: 'dashed',
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surfaceCanvas,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.lavenderTint,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  uploadTitle: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 13,
    color: colors.graphiteText,
    textAlign: 'center',
  },
  uploadSub: {
    fontFamily: typography.fonts.body,
    fontSize: 11,
    color: colors.graphiteMuted,
    textAlign: 'center',
    marginTop: 2,
    maxWidth: 240,
  },
  chooseFileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.lavenderAccent,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: borderRadius.sm,
    marginTop: 12,
    ...shadows.card,
  },
  chooseFileText: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 11,
    color: colors.primary,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainer,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: colors.borderWhisper,
  },
  footerStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  footerStatusText: {
    fontFamily: typography.fonts.bodyMedium,
    fontSize: 11,
    color: colors.graphiteText,
  },
  logsLink: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 11,
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  downloadedBadge: {
    backgroundColor: colors.statusSuccessBg,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  downloadedText: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 10,
    color: colors.statusSuccess,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 4,
  },
  summaryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  summaryTitle: {
    fontFamily: typography.fonts.headlineBold,
    fontSize: 18,
    color: colors.graphiteText,
  },
  cycleText: {
    fontFamily: typography.fonts.bodyMedium,
    fontSize: 11,
    color: colors.graphiteMuted,
  },
  reconcileCard: {
    padding: 14,
    gap: 12,
  },
  conciliatedBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.statusSuccessBg,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    padding: 10,
    borderRadius: borderRadius.md,
  },
  conciliatedLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  conciliatedTitle: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 12,
    color: colors.statusSuccess,
  },
  noErrorsBadge: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  noErrorsText: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 10,
    color: colors.statusSuccess,
  },
  reconcileGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  reconcileCol: {
    flex: 1,
    backgroundColor: colors.surfaceCanvas,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderWhisper,
    padding: 12,
  },
  metricLabel: {
    fontFamily: typography.fonts.bodyMedium,
    fontSize: 11,
    color: colors.graphiteMuted,
  },
  metricBig: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 16,
    color: colors.graphiteText,
    marginVertical: 2,
  },
  metricSub: {
    fontFamily: typography.fonts.body,
    fontSize: 10,
    color: colors.graphiteMuted,
  },
  netReceivableBox: {
    backgroundColor: colors.lavenderTint,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.lavenderSubtle,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  netTag: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 10,
    color: colors.primary,
    letterSpacing: 0.8,
  },
  netAmount: {
    fontFamily: typography.fonts.headlineBold,
    fontSize: 24,
    color: colors.primary,
    marginTop: 2,
  },
  netBankInfo: {
    fontFamily: typography.fonts.body,
    fontSize: 11,
    color: colors.graphiteMuted,
    marginTop: 2,
  },
  bankIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  divergenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.borderWhisper,
  },
  divergenceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  divergenceLabel: {
    fontFamily: typography.fonts.body,
    fontSize: 11,
    color: colors.graphiteMuted,
  },
  divergenceValue: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 12,
    color: colors.graphiteText,
  },
  primaryActionBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: 13,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    ...shadows.card,
  },
  primaryActionText: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 13,
    color: '#FFFFFF',
  },
  secondaryActionBtn: {
    backgroundColor: colors.surfaceCanvas,
    borderWidth: 1,
    borderColor: colors.lavenderSubtle,
    borderRadius: borderRadius.md,
    paddingVertical: 11,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  secondaryActionText: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 12,
    color: colors.primary,
  },
  tipCard: {
    backgroundColor: 'rgba(237, 233, 254, 0.4)',
    borderWidth: 1,
    borderColor: colors.lavenderSubtle,
    borderRadius: borderRadius.lg,
    padding: 14,
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  tipIcon: {
    marginTop: 2,
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
    color: colors.graphiteMuted,
    lineHeight: 16,
    marginTop: 2,
  },
});
