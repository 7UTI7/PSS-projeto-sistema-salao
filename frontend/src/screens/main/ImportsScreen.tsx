// Importação dos dois relatórios e auditoria do mês.
//
// É a porta de entrada dos dados do studio, e o fluxo é uma auditoria, não um upload:
//   1. os DOIS relatórios são escolhidos e enviados juntos, num só evento;
//   2. o servidor compara o faturamento do Booksy com as entradas da InfinitePay;
//   3. se bate, os resultados do mês são liberados;
//   4. se não bate, a tela barra e pede o motivo da diferença, com um Lançamento Manual
//      que a zere (pago em dinheiro, taxa retida, gorjeta).
//
// Por que os dois juntos: um mês só faz sentido conferido dos dois lados. Importar um de
// cada vez permitia ver meio mês e concluir que o arquivo tinha sido lido errado.
//
// Nenhum número é somado aqui. A diferença, o desfecho e os três saldos vêm do servidor
// a cada leitura — é a mesma conta que o Painel exibe.
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
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
import { useImportBatches, useRollbackImport } from '../../hooks/useImports';
import { useAddAuditEntry, useAudit, useAuditFilePicker, useSubmitAudit } from '../../hooks/useAudit';
import { useIsAdmin } from '../../hooks/useReports';
import { getApiErrorMessage } from '../../services/api';
import { ACCEPTED_EXTENSIONS_LABEL } from '../../services/import.service';
import { AUDIT_REASON_LABELS } from '../../services/audit.service';
import { DEFAULT_COMMISSION_RATE } from '../../config/studio.config';
import { formatCurrency, formatDate, formatPercent, parseAmountInput } from '../../utils/formatters';
import { periodKeyOf, periodLabel } from '../../utils/period';
import { usePeriodStore } from '../../store/periodStore';
import { importBatchStatusLabels, importSourceLabels } from '../../utils/labels';
import type { AuditReason, AuditSummary, ImportBatch, ImportSource } from '../../types';

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
    subtitle: 'O que foi atendido',
    icon: 'calendar-outline',
    tag: 'Faturamento',
    explanation:
      'Diz quanto foi prestado de serviço: um lançamento por atendimento, com serviço, profissional, valor e desconto.',
    hint: 'No Booksy: Relatórios → Desempenho do negócio → Exportar (.xlsx).',
  },
  {
    source: 'infinitepay',
    title: 'InfinitePay',
    subtitle: 'O que entrou na conta',
    icon: 'card-outline',
    tag: 'Entradas',
    explanation:
      'Diz quanto de dinheiro entrou: os Pix recebidos e os repasses da maquininha. As retiradas para a sua conta viram o Saldo Retirado.',
    hint: 'No app da InfinitePay: Relatório de movimentações → exportar (.pdf).',
  },
];

/** Os motivos na ordem em que aparecem na tela de correção. */
const REASONS: AuditReason[] = ['dinheiro', 'taxa', 'gorjeta', 'estorno', 'outro'];

export default function ImportsScreen() {
  const isAdmin = useIsAdmin();
  const period = usePeriodStore((state) => state.period);
  const setPeriod = usePeriodStore((state) => state.setPeriod);

  const { files, pickFile, clearFiles, ready } = useAuditFilePicker();
  const [commissionPercent, setCommissionPercent] = useState(String(DEFAULT_COMMISSION_RATE * 100));
  // Formulário de correção: aberto só quando ela decide justificar a diferença.
  const [reason, setReason] = useState<AuditReason | null>(null);
  const [entryAmount, setEntryAmount] = useState('');
  const [entryDescription, setEntryDescription] = useState('');
  const [entryDirection, setEntryDirection] = useState<'faltou_entrar' | 'entrou_a_mais'>('faltou_entrar');

  const batchesQuery = useImportBatches();
  const auditQuery = useAudit();
  const submitMutation = useSubmitAudit();
  const entryMutation = useAddAuditEntry();
  const rollbackMutation = useRollbackImport();

  const audit = auditQuery.data;
  const commissionRate = parseAmountInput(commissionPercent) / 100;

  /**
   * Período que cada origem já cobre, somando os lotes processados. É o que responde
   * "onde estão meus dados": os arquivos quase nunca são do mês corrente.
   */
  const coverage = useMemo(() => {
    const ranges = new Map<ImportSource, { start: string; end: string }>();
    for (const batch of batchesQuery.data ?? []) {
      if (batch.status !== 'processed' || !batch.periodStart || !batch.periodEnd) continue;
      const current = ranges.get(batch.source);
      ranges.set(batch.source, {
        start: !current || batch.periodStart < current.start ? batch.periodStart : current.start,
        end: !current || batch.periodEnd > current.end ? batch.periodEnd : current.end,
      });
    }
    return [...ranges.entries()];
  }, [batchesQuery.data]);

  const periodCovered = coverage.some(
    ([, range]) => periodKeyOf(range.start) <= period && period <= periodKeyOf(range.end),
  );

  function resetEntryForm() {
    setReason(null);
    setEntryAmount('');
    setEntryDescription('');
    setEntryDirection('faltou_entrar');
  }

  async function handlePick(source: ImportSource) {
    try {
      await pickFile(source);
    } catch (error) {
      Alert.alert('Erro ao abrir o arquivo', getApiErrorMessage(error));
    }
  }

  /** Envia os dois de uma vez e posiciona o mês no que os arquivos cobrem. */
  function handleSubmit() {
    if (!files.booksy || !files.infinitepay) return;

    submitMutation.mutate(
      {
        booksy: files.booksy,
        infinitepay: files.infinitepay,
        defaultCommissionRate: commissionRate,
      },
      {
        onSuccess: (result) => {
          clearFiles();
          resetEntryForm();

          // Os arquivos quase nunca são do mês corrente, e o app abre no mês corrente:
          // sem mover o seletor, a auditoria "não aparece" e parece que nada foi lido.
          const target = result.infinitepay.periodEnd ?? result.booksy.periodEnd;
          if (target) setPeriod(periodKeyOf(target));

          Alert.alert('Relatórios importados', summarizeSubmission(result.audits));
        },
        onError: (error) => Alert.alert('Falha na importação', getApiErrorMessage(error)),
      },
    );
  }

  /** O Lançamento Manual que zera a diferença do mês. */
  function handleAddEntry() {
    if (!reason) return;
    const amount = parseAmountInput(entryAmount);
    if (amount <= 0) {
      Alert.alert('Valor inválido', 'Informe um valor maior que zero.');
      return;
    }
    if (entryDescription.trim().length === 0) {
      Alert.alert('Falta a descrição', 'Escreva o que aconteceu, para você lembrar depois.');
      return;
    }

    entryMutation.mutate(
      {
        period,
        entry: {
          amount,
          reason,
          description: entryDescription.trim(),
          ...(reason === 'outro' ? { direction: entryDirection } : {}),
        },
      },
      {
        onSuccess: (result) => {
          resetEntryForm();
          Alert.alert(
            result.outcome === 'aprovada' ? 'Auditoria fechada' : 'Lançamento registrado',
            result.outcome === 'aprovada'
              ? 'O faturamento do Booksy agora bate com o que entrou na conta.'
              : `Ainda faltam ${formatCurrency(Math.abs(result.diferenca))} para fechar.`,
          );
        },
        onError: (error) => Alert.alert('Não foi possível lançar', getApiErrorMessage(error)),
      },
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
      ],
    );
  }

  if (!isAdmin) {
    return (
      <View style={styles.screen}>
        <StudioTopHeader subtitleTag="AUDITORIA" />
        <AdminOnlyState />
      </View>
    );
  }

  const batches = batchesQuery.data ?? [];
  const busy = submitMutation.isPending;

  return (
    <View style={styles.screen}>
      <StudioTopHeader subtitleTag="AUDITORIA" />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={batchesQuery.isRefetching || auditQuery.isRefetching}
            onRefresh={() => {
              void batchesQuery.refetch();
              void auditQuery.refetch();
            }}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Conferir o mês</Text>
          <Text style={styles.pageDesc}>
            Suba os dois relatórios juntos. O sistema confere se o que foi atendido no
            Booksy bate com o que entrou na conta da InfinitePay, e só libera os
            resultados quando a conta fecha.
          </Text>
        </View>

        {/* ===================== 1. OS DOIS ARQUIVOS ===================== */}
        {SOURCES.map((card) => {
          const picked = files[card.source];
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
                style={[styles.dropzone, picked && styles.dropzoneSelected]}
                activeOpacity={0.8}
                disabled={busy}
                onPress={() => void handlePick(card.source)}
              >
                <View style={styles.uploadIconCircle}>
                  <Ionicons
                    name={picked ? 'document-text' : 'cloud-upload-outline'}
                    size={24}
                    color={colors.primary}
                  />
                </View>

                <Text style={styles.uploadTitle} numberOfLines={2}>
                  {picked ? picked.name : `Selecionar arquivo (${ACCEPTED_EXTENSIONS_LABEL[card.source]})`}
                </Text>
                <Text style={styles.uploadSub}>
                  {picked?.size
                    ? `${(picked.size / 1024).toFixed(0)} KB · toque para trocar`
                    : card.hint}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}

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
            arquivo. Não entra na conta da auditoria: comissão é repasse, não deixa de ser
            dinheiro que entrou.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.primaryActionBtn, (!ready || busy) && styles.btnDisabled]}
          activeOpacity={0.85}
          disabled={!ready || busy}
          onPress={handleSubmit}
        >
          {busy ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Ionicons name="git-compare" size={18} color="#FFFFFF" />
              <Text style={styles.primaryActionText}>Conferir e importar</Text>
            </>
          )}
        </TouchableOpacity>

        {!ready ? (
          <Text style={styles.fieldHelp}>
            Escolha os dois arquivos para conferir. O mês só fecha com os dois lados.
          </Text>
        ) : null}

        {/* ===================== 2. A AUDITORIA DO MÊS ===================== */}
        <View style={styles.sectionHeaderRow}>
          <View style={styles.summaryTitleRow}>
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />
            <Text style={styles.summaryTitle}>Auditoria de {periodLabel(period)}</Text>
          </View>
        </View>

        {auditQuery.isPending ? (
          <ActivityIndicator color={colors.primary} style={styles.historyLoader} />
        ) : auditQuery.isError ? (
          <ErrorState error={auditQuery.error} onRetry={auditQuery.refetch} />
        ) : audit ? (
          <View style={styles.card}>
            <AuditVerdict audit={audit} />

            {/* A comparação, sempre visível: é o que explica o veredito. */}
            <View style={styles.previewGrid}>
              <View style={styles.previewBox}>
                <Text style={styles.previewLabel}>Atendido (Booksy)</Text>
                <Text style={styles.previewValue}>{formatCurrency(audit.faturamentoBooksy)}</Text>
              </View>
              <View style={styles.previewBox}>
                <Text style={styles.previewLabel}>Entrou (InfinitePay)</Text>
                <Text style={styles.previewValue}>{formatCurrency(audit.entradasInfinitepay)}</Text>
              </View>
            </View>

            {audit.ajusteManual !== 0 ? (
              <View style={styles.previewGrid}>
                <View style={styles.previewBox}>
                  <Text style={styles.previewLabel}>Justificado à mão</Text>
                  <Text style={styles.previewValue}>{formatCurrency(audit.ajusteManual)}</Text>
                </View>
                <View style={styles.previewBox}>
                  <Text style={styles.previewLabel}>Ainda a explicar</Text>
                  <Text style={styles.previewValue}>{formatCurrency(audit.diferenca)}</Text>
                </View>
              </View>
            ) : null}

            {/* Os três saldos: só fazem sentido com a conta fechada. */}
            {audit.outcome === 'aprovada' ? (
              <>
                <Text style={styles.fieldHelp}>Resultado do mês</Text>
                <View style={styles.previewGrid}>
                  <View style={styles.previewBox}>
                    <Text style={styles.previewLabel}>Saldo bruto</Text>
                    <Text style={styles.previewValue}>{formatCurrency(audit.saldoBruto)}</Text>
                  </View>
                  <View style={styles.previewBox}>
                    <Text style={styles.previewLabel}>Saldo retirado</Text>
                    <Text style={styles.previewValue}>{formatCurrency(audit.saldoRetirado)}</Text>
                  </View>
                </View>
                <View style={[styles.previewBox, styles.previewBoxHighlight]}>
                  <Text style={styles.previewLabel}>Saldo líquido · ainda na conta</Text>
                  <Text style={[styles.previewValue, { color: colors.violetRoyal }]}>
                    {formatCurrency(audit.saldoLiquido)}
                  </Text>
                </View>
              </>
            ) : null}

            {/* Os ajustes já lançados, para ela ver o que justificou. */}
            {audit.adjustments.length > 0 ? (
              <View style={styles.skippedBox}>
                <Text style={styles.skippedTitle}>
                  {audit.adjustments.length} lançamento(s) manual(is) neste mês
                </Text>
                {audit.adjustments.map((entry) => (
                  <Text key={entry.id} style={styles.skippedItem}>
                    • {formatCurrency(entry.signedAmount)} —{' '}
                    {entry.reason ? AUDIT_REASON_LABELS[entry.reason].label : 'Ajuste'}:{' '}
                    {entry.description}
                  </Text>
                ))}
              </View>
            ) : null}

            {/* ========== 3. A CORREÇÃO, só quando faz sentido ========== */}
            {audit.outcome === 'divergente' ? (
              reason === null ? (
                <TouchableOpacity
                  style={styles.primaryActionBtn}
                  activeOpacity={0.85}
                  onPress={() => {
                    // Já vem preenchido com o que falta: é o caso comum.
                    setEntryAmount(Math.abs(audit.diferenca).toFixed(2).replace('.', ','));
                    setEntryDirection(audit.diferenca > 0 ? 'faltou_entrar' : 'entrou_a_mais');
                    setReason('dinheiro');
                  }}
                >
                  <Ionicons name="create-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.primaryActionText}>Explicar a diferença</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.correctionBox}>
                  <Text style={styles.fieldLabel}>O QUE ACONTECEU?</Text>
                  {REASONS.map((option) => (
                    <TouchableOpacity
                      key={option}
                      style={[styles.reasonRow, reason === option && styles.reasonRowActive]}
                      activeOpacity={0.8}
                      onPress={() => setReason(option)}
                    >
                      <Ionicons
                        name={reason === option ? 'radio-button-on' : 'radio-button-off'}
                        size={18}
                        color={reason === option ? colors.primary : colors.graphiteMuted}
                      />
                      <View style={styles.reasonCol}>
                        <Text style={styles.reasonLabel}>{AUDIT_REASON_LABELS[option].label}</Text>
                        <Text style={styles.reasonHelp}>{AUDIT_REASON_LABELS[option].help}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}

                  {/* Só "outro" pergunta a direção: os outros motivos já a determinam. */}
                  {reason === 'outro' ? (
                    <>
                      <Text style={[styles.fieldLabel, styles.fieldSpacing]}>DE QUE LADO?</Text>
                      <View style={styles.directionRow}>
                        {([
                          ['faltou_entrar', 'Faltou entrar'],
                          ['entrou_a_mais', 'Entrou a mais'],
                        ] as const).map(([value, label]) => (
                          <TouchableOpacity
                            key={value}
                            style={[
                              styles.directionBtn,
                              entryDirection === value && styles.directionBtnActive,
                            ]}
                            activeOpacity={0.8}
                            onPress={() => setEntryDirection(value)}
                          >
                            <Text
                              style={[
                                styles.directionText,
                                entryDirection === value && styles.directionTextActive,
                              ]}
                            >
                              {label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </>
                  ) : null}

                  <Text style={[styles.fieldLabel, styles.fieldSpacing]}>VALOR (R$)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={entryAmount}
                    onChangeText={setEntryAmount}
                    keyboardType="decimal-pad"
                    placeholder="0,00"
                    placeholderTextColor={colors.graphiteMuted}
                  />

                  <Text style={[styles.fieldLabel, styles.fieldSpacing]}>DESCRIÇÃO</Text>
                  <TextInput
                    style={styles.textInput}
                    value={entryDescription}
                    onChangeText={setEntryDescription}
                    placeholder="Ex.: cliente pagou a unha em dinheiro"
                    placeholderTextColor={colors.graphiteMuted}
                    maxLength={240}
                  />

                  <View style={styles.previewActions}>
                    <TouchableOpacity
                      style={[styles.primaryActionBtn, entryMutation.isPending && styles.btnDisabled]}
                      activeOpacity={0.85}
                      disabled={entryMutation.isPending}
                      onPress={handleAddEntry}
                    >
                      {entryMutation.isPending ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <>
                          <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                          <Text style={styles.primaryActionText}>Lançar e fechar</Text>
                        </>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.secondaryActionBtn}
                      activeOpacity={0.8}
                      onPress={resetEntryForm}
                    >
                      <Text style={styles.secondaryActionText}>Cancelar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )
            ) : null}
          </View>
        ) : null}

        {/* COBERTURA: de que período é cada arquivo já importado. */}
        {coverage.length > 0 ? (
          <View style={styles.card}>
            <View style={styles.summaryTitleRow}>
              <Ionicons name="calendar-outline" size={16} color={colors.primary} />
              <Text style={styles.summaryTitle}>Períodos importados</Text>
            </View>

            {coverage.map(([src, range]) => (
              <Text key={src} style={styles.previewPeriod}>
                {importSourceLabels[src]}: {formatDate(range.start)} a {formatDate(range.end)}
              </Text>
            ))}

            {!periodCovered ? (
              <View style={styles.warnBanner}>
                <Ionicons name="alert-circle" size={16} color={colors.statusWarning} />
                <Text style={styles.warnText}>
                  O mês selecionado ({periodLabel(period)}) não está coberto por nenhum
                  arquivo importado. Troque o mês no cabeçalho para ver os números.
                </Text>
              </View>
            ) : null}
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


/**
 * O veredito em uma frase, pelo desfecho que o servidor mandou.
 *
 * `fonte_ausente` tem texto próprio de propósito: não é divergência a justificar, é
 * arquivo faltando. Oferecer "explique a diferença" aí pediria para ela justificar o
 * valor inteiro do extrato, e um ajuste desse tamanho falsearia a auditoria.
 */
function AuditVerdict({ audit }: { audit: AuditSummary }) {
  if (audit.outcome === 'aprovada') {
    return (
      <View style={styles.infoBanner}>
        <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
        <Text style={styles.infoText}>
          Conta fechada: o que foi atendido bate com o que entrou na conta
          {audit.approvedAt ? ` (conferido em ${formatDate(audit.approvedAt)})` : ''}.
        </Text>
      </View>
    );
  }

  if (audit.outcome === 'fonte_ausente') {
    const faltando =
      audit.fonteFaltante === 'ambas'
        ? 'os dois relatórios'
        : audit.fonteFaltante === 'booksy'
          ? 'o relatório do Booksy'
          : 'o extrato da InfinitePay';
    return (
      <View style={styles.warnBanner}>
        <Ionicons name="document-attach-outline" size={16} color={colors.statusWarning} />
        <Text style={styles.warnText}>
          Falta {faltando} deste mês para conferir. Veja em &quot;Períodos importados&quot; de
          que mês é cada arquivo que já entrou — pode ser só o mês selecionado.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.warnBanner}>
      <Ionicons name="alert-circle" size={16} color={colors.statusWarning} />
      <Text style={styles.warnText}>
        {audit.diferenca > 0
          ? `Faltam ${formatCurrency(audit.diferenca)} para fechar: foi atendido mais do que entrou na conta.`
          : `Sobram ${formatCurrency(Math.abs(audit.diferenca))}: entrou na conta mais do que foi atendido.`}{' '}
        Diga o motivo para liberar os resultados do mês.
      </Text>
    </View>
  );
}

/** Uma linha por mês tocado pela submissão, para o alerta de conclusão. */
function summarizeSubmission(audits: AuditSummary[]): string {
  if (audits.length === 0) return 'Arquivos importados.';

  return audits
    .map((item) => {
      if (item.outcome === 'aprovada') return `${item.period}: conta fechada.`;
      if (item.outcome === 'fonte_ausente') return `${item.period}: falta o outro relatório.`;
      return `${item.period}: faltam ${formatCurrency(Math.abs(item.diferenca))} a explicar.`;
    })
    .join('\n');
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
  correctionBox: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceContainer,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: borderRadius.md,
  },
  reasonRowActive: {
    backgroundColor: colors.surfaceContainer,
  },
  reasonCol: {
    flex: 1,
  },
  reasonLabel: {
    fontFamily: typography.fonts.bodySemiBold,
    fontSize: 13,
    color: colors.graphiteText,
  },
  reasonHelp: {
    fontFamily: typography.fonts.body,
    fontSize: 11,
    color: colors.graphiteMuted,
    marginTop: 2,
    lineHeight: 15,
  },
  directionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  directionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.surfaceContainer,
    alignItems: 'center',
  },
  directionBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceContainer,
  },
  directionText: {
    fontFamily: typography.fonts.bodyMedium,
    fontSize: 12,
    color: colors.graphiteMuted,
  },
  directionTextActive: {
    color: colors.primary,
  },
  fieldSpacing: {
    marginTop: 16,
  },
  textInput: {
    backgroundColor: colors.surfaceCanvas,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderWhisper,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: typography.fonts.body,
    fontSize: 13,
    color: colors.graphiteText,
  },
});
