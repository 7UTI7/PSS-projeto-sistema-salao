// Importação dos relatórios do Booksy e do extrato da InfinitePay.
//
// É a porta de entrada dos dados do studio: a dona exporta das duas plataformas e sobe
// aqui. Cada origem entra de um jeito diferente, de propósito:
//   Booksy      -> receitas (serviço, profissional, valor bruto e desconto)
//   InfinitePay -> caixa recebido (Pix e repasses da maquininha, já líquidos de tarifa)
// Importar as duas não duplica faturamento; o detalhe está em services/import.service.ts.
//
// O fluxo é: escolher arquivo -> conferir a prévia -> confirmar. A prévia existe porque
// importar errado mexe no resultado do mês, e desfazer depois dá mais trabalho.
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, borderRadius, shadows } from '../../theme/theme';
import { StudioTopHeader } from '../../components/ui/StudioTopHeader';
import { AdminOnlyState, ErrorState } from '../../components/ui/QueryState';
import {
  useFilePicker,
  useImportBatches,
  usePreviewImport,
  useProcessImport,
  useRollbackImport,
} from '../../hooks/useImports';
import { useIsAdmin } from '../../hooks/useReports';
import { getApiErrorMessage } from '../../services/api';
import { ACCEPTED_EXTENSIONS_LABEL } from '../../services/import.service';
import { DEFAULT_COMMISSION_RATE } from '../../config/studio.config';
import { formatCurrency, formatDate, formatPercent, parseAmountInput } from '../../utils/formatters';
import { importBatchStatusLabels, importSourceLabels } from '../../utils/labels';
import type { ImportBatch, ImportPreview, ImportSource, PickedFile } from '../../types';

interface SourceCard {
  source: ImportSource;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  tag: string;
  explanation: string;
  hint: string;
}

const SOURCES: SourceCard[] = [
  {
    source: 'booksy',
    title: 'Booksy',
    subtitle: 'Agendamentos & Comissões',
    icon: 'calendar-outline',
    tag: 'Receitas',
    explanation:
      'Vira receita: um lançamento por atendimento, com serviço, profissional, valor e desconto.',
    hint: 'No Booksy: Relatórios → Desempenho do negócio → Exportar (.xlsx). A aba usada é "Lista de agendamentos".',
  },
  {
    source: 'infinitepay',
    title: 'InfinitePay',
    subtitle: 'Extrato: Pix & Maquininha',
    icon: 'card-outline',
    tag: 'Caixa',
    explanation:
      'Vira caixa: os Pix recebidos e os repasses da maquininha, que já chegam líquidos de tarifa. O faturamento continua sendo o do Booksy, então a venda não é contada duas vezes.',
    hint: 'No app da InfinitePay: Relatório de movimentações → exportar (.pdf).',
  },
];

export default function ImportsScreen() {
  const isAdmin = useIsAdmin();
  const { file, pickFile, clearFile } = useFilePicker();
  const [source, setSource] = useState<ImportSource | null>(null);
  const [commissionPercent, setCommissionPercent] = useState(String(DEFAULT_COMMISSION_RATE * 100));
  const [preview, setPreview] = useState<ImportPreview | null>(null);

  const batchesQuery = useImportBatches();
  const previewMutation = usePreviewImport();
  const processMutation = useProcessImport();
  const rollbackMutation = useRollbackImport();

  const commissionRate = parseAmountInput(commissionPercent) / 100;

  function resetSelection() {
    clearFile();
    setSource(null);
    setPreview(null);
  }

  /** Escolher o arquivo e já pedir a prévia: são uma única ação para a dona. */
  async function handlePick(selected: ImportSource) {
    try {
      const picked = await pickFile(selected);
      if (!picked) return;

      setSource(selected);
      setPreview(null);
      requestPreview(selected, picked);
    } catch (error) {
      Alert.alert('Erro ao abrir o arquivo', getApiErrorMessage(error));
    }
  }

  function requestPreview(selected: ImportSource, picked: PickedFile) {
    previewMutation.mutate(
      { source: selected, file: picked, defaultCommissionRate: commissionRate },
      {
        onSuccess: setPreview,
        onError: (error) => {
          setPreview(null);
          Alert.alert('Não foi possível ler o arquivo', getApiErrorMessage(error));
        },
      }
    );
  }

  function handleConfirm() {
    if (!file || !source || !preview) return;

    if (preview.alreadyImported) {
      Alert.alert(
        'Arquivo já importado',
        'Este mesmo arquivo já foi processado antes. Desfaça o lote no histórico antes de reenviar.'
      );
      return;
    }

    processMutation.mutate(
      { source, file, defaultCommissionRate: commissionRate },
      {
        onSuccess: (result) => {
          resetSelection();
          Alert.alert(
            'Importação concluída',
            [
              `${result.importedCount} lançamento(s) criado(s).`,
              result.duplicateCount > 0
                ? `${result.duplicateCount} já existiam e foram ignorados.`
                : null,
              result.skipped.length > 0
                ? `${result.skipped.length} linha(s) ignorada(s) — veja o histórico.`
                : null,
              result.createdCategories.length > 0
                ? `Categorias criadas: ${result.createdCategories.join(', ')}.`
                : null,
            ]
              .filter(Boolean)
              .join('\n')
          );
        },
        onError: (error) => Alert.alert('Falha na importação', getApiErrorMessage(error)),
      }
    );
  }

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
      ]
    );
  }

  if (!isAdmin) {
    return (
      <View style={styles.screen}>
        <StudioTopHeader subtitleTag="IMPORTAÇÃO" />
        <AdminOnlyState />
      </View>
    );
  }

  const batches = batchesQuery.data ?? [];
  const busy = previewMutation.isPending || processMutation.isPending;

  return (
    <View style={styles.screen}>
      <StudioTopHeader subtitleTag="IMPORTAÇÃO" />

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
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Importar Relatórios</Text>
          <Text style={styles.pageDesc}>
            Suba o que você já exporta do Booksy e da InfinitePay. O sistema transforma em
            lançamentos, calcula taxas e comissões e monta o resultado do mês.
          </Text>
        </View>

        {/* Comissão padrão: o Booksy não exporta o percentual, então vem daqui. */}
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>COMISSÃO PADRÃO DAS RECEITAS DO BOOKSY</Text>
          <View style={styles.commissionRow}>
            <TouchableOpacity
              style={styles.stepBtn}
              activeOpacity={0.7}
              onPress={() =>
                setCommissionPercent(String(Math.max(parseAmountInput(commissionPercent) - 5, 0)))
              }
            >
              <Ionicons name="remove" size={18} color={colors.primary} />
            </TouchableOpacity>

            <View style={styles.commissionValueBox}>
              <Text style={styles.commissionValue}>{formatPercent(commissionRate, 0)}</Text>
            </View>

            <TouchableOpacity
              style={styles.stepBtn}
              activeOpacity={0.7}
              onPress={() =>
                setCommissionPercent(String(Math.min(parseAmountInput(commissionPercent) + 5, 100)))
              }
            >
              <Ionicons name="add" size={18} color={colors.primary} />
            </TouchableOpacity>
          </View>
          <Text style={styles.fieldHelp}>
            Aplicada a cada atendimento importado do Booksy, que não traz o percentual no
            arquivo. Dá para editar lançamento por lançamento depois.
          </Text>
        </View>

        {SOURCES.map((card) => {
          const isSelected = source === card.source;
          return (
            <View key={card.source} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.serviceTitleRow}>
                  <View style={styles.serviceIconBox}>
                    <Ionicons name={card.icon} size={20} color={colors.primary} />
                  </View>
                  <View style={styles.serviceTitleCol}>
                    <Text style={styles.serviceName}>{card.title}</Text>
                    <Text style={styles.serviceSub}>{card.subtitle}</Text>
                  </View>
                </View>
                <View style={styles.serviceTag}>
                  <Text style={styles.serviceTagText}>{card.tag}</Text>
                </View>
              </View>

              <Text style={styles.explanation}>{card.explanation}</Text>

              <TouchableOpacity
                style={[styles.dropzone, isSelected && styles.dropzoneSelected]}
                activeOpacity={0.8}
                disabled={busy}
                onPress={() => handlePick(card.source)}
              >
                <View style={styles.uploadIconCircle}>
                  <Ionicons
                    name={isSelected && file ? 'document-text' : 'cloud-upload-outline'}
                    size={24}
                    color={colors.primary}
                  />
                </View>

                <Text style={styles.uploadTitle} numberOfLines={2}>
                  {isSelected && file
                    ? file.name
                    : `Selecionar arquivo (${ACCEPTED_EXTENSIONS_LABEL[card.source]})`}
                </Text>
                <Text style={styles.uploadSub}>
                  {isSelected && file?.size
                    ? `${(file.size / 1024).toFixed(0)} KB · toque para trocar`
                    : card.hint}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}

        {previewMutation.isPending ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Lendo a planilha...</Text>
          </View>
        ) : null}

        {/* PRÉVIA: o que entraria se confirmar. Nada foi gravado ainda. */}
        {preview && source ? (
          <View style={[styles.card, styles.previewCard]}>
            <View style={styles.previewHeader}>
              <View style={styles.previewTitleRow}>
                <Ionicons name="eye-outline" size={18} color={colors.primary} />
                <Text style={styles.previewTitle}>Prévia da importação</Text>
              </View>
              <Text style={styles.previewSource}>{importSourceLabels[preview.source]}</Text>
            </View>

            {preview.alreadyImported ? (
              <View style={styles.warnBanner}>
                <Ionicons name="alert-circle" size={16} color={colors.statusWarning} />
                <Text style={styles.warnText}>
                  Este arquivo já foi importado antes. Desfaça o lote no histórico para reenviar.
                </Text>
              </View>
            ) : null}

            <View style={styles.previewGrid}>
              <View style={styles.previewBox}>
                <Text style={styles.previewLabel}>Linhas a importar</Text>
                <Text style={styles.previewValue}>{preview.rowCount}</Text>
              </View>
              <View style={styles.previewBox}>
                <Text style={styles.previewLabel}>
                  {preview.source === 'booksy' ? 'Receita bruta' : 'Total de taxas'}
                </Text>
                <Text style={styles.previewValue}>{formatCurrency(preview.totals.grossAmount)}</Text>
              </View>
            </View>

            {preview.source === 'booksy' ? (
              <View style={styles.previewGrid}>
                <View style={styles.previewBox}>
                  <Text style={styles.previewLabel}>Comissões</Text>
                  <Text style={styles.previewValue}>
                    {formatCurrency(preview.totals.commissionAmount)}
                  </Text>
                </View>
                <View style={[styles.previewBox, styles.previewBoxHighlight]}>
                  <Text style={styles.previewLabel}>Líquido do studio</Text>
                  <Text style={[styles.previewValue, { color: colors.violetRoyal }]}>
                    {formatCurrency(preview.totals.studioNetProfit)}
                  </Text>
                </View>
              </View>
            ) : null}

            {preview.periodStart && preview.periodEnd ? (
              <Text style={styles.previewPeriod}>
                Período do arquivo: {formatDate(preview.periodStart)} a{' '}
                {formatDate(preview.periodEnd)}
              </Text>
            ) : null}

            {preview.missingCategories.length > 0 ? (
              <View style={styles.infoBanner}>
                <Ionicons name="pricetags-outline" size={15} color={colors.primary} />
                <Text style={styles.infoText}>
                  Serão criadas no catálogo: {preview.missingCategories.join(', ')}.
                </Text>
              </View>
            ) : null}

            {/* Linhas ignoradas com o motivo: é onde se descobre nome de profissional
                fora do cadastro ou coluna que mudou no relatório da plataforma. */}
            {preview.skipped.length > 0 ? (
              <View style={styles.skippedBox}>
                <Text style={styles.skippedTitle}>
                  {preview.skipped.length} linha(s) será(ão) ignorada(s)
                </Text>
                {preview.skipped.slice(0, 5).map((row) => (
                  <Text key={`${row.line}-${row.reason}`} style={styles.skippedItem}>
                    • Linha {row.line}: {row.reason}
                  </Text>
                ))}
                {preview.skipped.length > 5 ? (
                  <Text style={styles.skippedItem}>
                    • ... e outras {preview.skipped.length - 5}.
                  </Text>
                ) : null}
              </View>
            ) : null}

            <View style={styles.previewActions}>
              <TouchableOpacity
                style={[
                  styles.primaryActionBtn,
                  (processMutation.isPending || preview.alreadyImported || preview.rowCount === 0) &&
                    styles.btnDisabled,
                ]}
                activeOpacity={0.85}
                disabled={processMutation.isPending || preview.alreadyImported || preview.rowCount === 0}
                onPress={handleConfirm}
              >
                {processMutation.isPending ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                    <Text style={styles.primaryActionText}>
                      Confirmar e importar {preview.rowCount} lançamento(s)
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryActionBtn}
                activeOpacity={0.8}
                onPress={resetSelection}
              >
                <Text style={styles.secondaryActionText}>Descartar</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {/* HISTÓRICO: de onde se desfaz um lote. */}
        <View style={styles.sectionHeaderRow}>
          <View style={styles.summaryTitleRow}>
            <Ionicons name="time-outline" size={18} color={colors.primary} />
            <Text style={styles.summaryTitle}>Histórico de importações</Text>
          </View>
        </View>

        {batchesQuery.isPending ? (
          <ActivityIndicator color={colors.primary} style={styles.historyLoader} />
        ) : batchesQuery.isError ? (
          <ErrorState error={batchesQuery.error} onRetry={batchesQuery.refetch} />
        ) : batches.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.historyEmpty}>
              Nenhum arquivo importado ainda. Comece pelo relatório do Booksy do mês.
            </Text>
          </View>
        ) : (
          batches.map((batch) => (
            <View key={batch._id} style={styles.batchCard}>
              <View style={styles.batchHeader}>
                <View style={styles.batchTitleCol}>
                  <Text style={styles.batchFile} numberOfLines={1}>
                    {batch.fileName}
                  </Text>
                  <Text style={styles.batchMeta}>
                    {importSourceLabels[batch.source]} · {formatDate(batch.createdAt)}
                  </Text>
                </View>
                <View style={[styles.batchStatusPill, batchStatusStyle(batch.status)]}>
                  <Text style={[styles.batchStatusText, batchStatusTextStyle(batch.status)]}>
                    {importBatchStatusLabels[batch.status]}
                  </Text>
                </View>
              </View>

              <View style={styles.batchStats}>
                <Text style={styles.batchStat}>
                  {batch.importedCount} importado(s)
                </Text>
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

        <View style={styles.tipCard}>
          <Ionicons name="bulb-outline" size={20} color={colors.primary} style={styles.tipIcon} />
          <View style={styles.tipCol}>
            <Text style={styles.tipTitle}>Como manter o mês correto</Text>
            <Text style={styles.tipDesc}>
              Suba o Booksy primeiro (gera as receitas) e depois a InfinitePay (gera as
              taxas). O mesmo arquivo não entra duas vezes: o sistema reconhece pelo
              conteúdo e, se os períodos se sobrepuserem, só importa os atendimentos novos.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function batchStatusStyle(status: ImportBatch['status']) {
  if (status === 'processed') return { backgroundColor: colors.statusSuccessBg };
  if (status === 'failed') return { backgroundColor: colors.statusErrorBg };
  if (status === 'rolled_back') return { backgroundColor: colors.surfaceContainerHigh };
  return { backgroundColor: colors.statusWarningBg };
}

function batchStatusTextStyle(status: ImportBatch['status']) {
  if (status === 'processed') return { color: colors.statusSuccess };
  if (status === 'failed') return { color: colors.statusError };
  if (status === 'rolled_back') return { color: colors.graphiteMuted };
  return { color: colors.statusWarning };
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
    paddingBottom: 48,
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
    marginTop: 4,
    lineHeight: 18,
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
  fieldLabel: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 0.8,
    color: colors.graphiteMuted,
    marginBottom: 10,
  },
  fieldHelp: {
    fontFamily: typography.fonts.body,
    fontSize: 10,
    color: colors.graphiteMuted,
    marginTop: 9,
    lineHeight: 15,
  },
  commissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepBtn: {
    width: 38,
    height: 38,
    borderRadius: borderRadius.full,
    backgroundColor: colors.lavenderTint,
    borderWidth: 1,
    borderColor: colors.lavenderSubtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  commissionValueBox: {
    flex: 1,
    alignItems: 'center',
  },
  commissionValue: {
    fontFamily: typography.fonts.headlineBold,
    fontSize: 24,
    color: colors.primary,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  serviceTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    flex: 1,
  },
  serviceTitleCol: {
    flex: 1,
  },
  serviceIconBox: {
    width: 38,
    height: 38,
    borderRadius: borderRadius.md,
    backgroundColor: colors.lavenderTint,
    justifyContent: 'center',
    alignItems: 'center',
  },
  serviceName: {
    fontFamily: typography.fonts.headline,
    fontSize: 16,
    color: colors.graphiteText,
  },
  serviceSub: {
    fontFamily: typography.fonts.body,
    fontSize: 11,
    color: colors.graphiteMuted,
    marginTop: 1,
  },
  serviceTag: {
    backgroundColor: colors.lavenderTint,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  serviceTagText: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 9,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  explanation: {
    fontFamily: typography.fonts.body,
    fontSize: 11,
    color: colors.graphiteText,
    lineHeight: 17,
    marginBottom: 12,
  },
  dropzone: {
    backgroundColor: colors.surfaceCanvas,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.lavenderSubtle,
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  dropzoneSelected: {
    borderStyle: 'solid',
    borderColor: colors.violetRoyal,
    backgroundColor: colors.lavenderLight,
  },
  uploadIconCircle: {
    width: 46,
    height: 46,
    borderRadius: borderRadius.full,
    backgroundColor: colors.lavenderTint,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 9,
  },
  uploadTitle: {
    fontFamily: typography.fonts.bodySemiBold,
    fontSize: 13,
    color: colors.graphiteText,
    textAlign: 'center',
  },
  uploadSub: {
    fontFamily: typography.fonts.body,
    fontSize: 10,
    color: colors.graphiteMuted,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 15,
  },
  loadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.borderWhisper,
    padding: 16,
    marginBottom: 14,
  },
  loadingText: {
    fontFamily: typography.fonts.bodyMedium,
    fontSize: 12,
    color: colors.graphiteMuted,
  },
  previewCard: {
    borderColor: colors.lavenderSubtle,
    backgroundColor: colors.lavenderLight,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  previewTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  previewTitle: {
    fontFamily: typography.fonts.headline,
    fontSize: 16,
    color: colors.graphiteText,
  },
  previewSource: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 9,
    color: colors.primary,
    backgroundColor: colors.lavenderTint,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  previewGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  previewBox: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderWhisper,
    paddingVertical: 10,
    paddingHorizontal: 11,
  },
  previewBoxHighlight: {
    borderColor: colors.lavenderSubtle,
    backgroundColor: colors.lavenderTint,
  },
  previewLabel: {
    fontFamily: typography.fonts.bodyMedium,
    fontSize: 9,
    color: colors.graphiteMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  previewValue: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 15,
    color: colors.graphiteText,
    marginTop: 3,
  },
  previewPeriod: {
    fontFamily: typography.fonts.body,
    fontSize: 11,
    color: colors.graphiteMuted,
    marginTop: 4,
    marginBottom: 4,
  },
  warnBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    backgroundColor: colors.statusWarningBg,
    borderRadius: borderRadius.md,
    padding: 10,
    marginBottom: 10,
  },
  warnText: {
    flex: 1,
    fontFamily: typography.fonts.bodyMedium,
    fontSize: 11,
    color: colors.statusWarning,
    lineHeight: 16,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderWhisper,
    padding: 10,
    marginTop: 6,
  },
  infoText: {
    flex: 1,
    fontFamily: typography.fonts.body,
    fontSize: 11,
    color: colors.graphiteText,
    lineHeight: 16,
  },
  skippedBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderWhisper,
    padding: 11,
    marginTop: 8,
  },
  skippedTitle: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 11,
    color: colors.statusWarning,
    marginBottom: 5,
  },
  skippedItem: {
    fontFamily: typography.fonts.body,
    fontSize: 10,
    color: colors.graphiteMuted,
    lineHeight: 16,
  },
  previewActions: {
    marginTop: 14,
    gap: 9,
  },
  primaryActionBtn: {
    backgroundColor: colors.violetRoyal,
    borderRadius: borderRadius.md,
    paddingVertical: 13,
    paddingHorizontal: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  primaryActionText: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 13,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  secondaryActionBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderWhisper,
    paddingVertical: 11,
    alignItems: 'center',
  },
  secondaryActionText: {
    fontFamily: typography.fonts.bodySemiBold,
    fontSize: 12,
    color: colors.graphiteMuted,
  },
  sectionHeaderRow: {
    marginTop: 6,
    marginBottom: 10,
  },
  summaryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  summaryTitle: {
    fontFamily: typography.fonts.headline,
    fontSize: 17,
    color: colors.graphiteText,
  },
  historyLoader: {
    marginVertical: 20,
  },
  historyEmpty: {
    fontFamily: typography.fonts.body,
    fontSize: 12,
    color: colors.graphiteMuted,
    lineHeight: 18,
  },
  batchCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.borderWhisper,
    padding: 13,
    marginBottom: 9,
  },
  batchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 9,
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
    fontSize: 10,
    color: colors.graphiteMuted,
    marginTop: 2,
  },
  batchStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.xs,
  },
  batchStatusText: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  batchStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 9,
  },
  batchStat: {
    fontFamily: typography.fonts.body,
    fontSize: 10,
    color: colors.graphiteMuted,
  },
  batchStatStrong: {
    fontFamily: typography.fonts.bodyBold,
    color: colors.graphiteText,
  },
  batchError: {
    fontFamily: typography.fonts.body,
    fontSize: 10,
    color: colors.statusError,
    marginTop: 7,
    lineHeight: 15,
  },
  rollbackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 10,
    paddingTop: 9,
    borderTopWidth: 1,
    borderTopColor: colors.borderWhisper,
  },
  rollbackText: {
    fontFamily: typography.fonts.bodySemiBold,
    fontSize: 11,
    color: colors.statusError,
  },
  tipCard: {
    flexDirection: 'row',
    gap: 11,
    backgroundColor: colors.lavenderLight,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.lavenderSubtle,
    padding: 14,
    marginTop: 8,
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
