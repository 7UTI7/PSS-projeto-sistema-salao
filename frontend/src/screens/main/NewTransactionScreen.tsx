import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../navigation/types';
import { colors, typography, borderRadius, shadows } from '../../theme/theme';
import { LoadingState } from '../../components/ui/QueryState';
import { useCategoriesForType } from '../../hooks/useCategories';
import {
  useCreateTransaction,
  useTransactions,
  useUpdateTransaction,
} from '../../hooks/useTransactions';
import { useAuthStore } from '../../store/authStore';
import { getApiErrorMessage } from '../../services/api';
import { formatCurrency, parseAmountInput } from '../../utils/formatters';
import { costTypeLabels, paymentMethodLabels, transactionStatusLabels } from '../../utils/labels';
import {
  SELECTABLE_PAYMENT_METHODS,
  type CostType,
  type PaymentMethod,
  type Professional,
  type TransactionInput,
  type Transaction,
  type TransactionStatus,
  type TransactionType,
} from '../../types';

const PROFESSIONALS: Professional[] = ['Nicolle', 'Stefany'];
const STATUSES: TransactionStatus[] = ['pendente', 'liquidada', 'cancelada'];
const COST_TYPES: CostType[] = ['variavel', 'fixo'];

/** Campos do formulário. Texto nos numéricos porque o usuário digita "1.234,56". */
interface FormState {
  type: TransactionType;
  amount: string;
  discount: string;
  description: string;
  category: string;
  professional: Professional;
  paymentMethod: PaymentMethod;
  costType: CostType;
  status: TransactionStatus;
  occurredAt: string;
}

/** Data de hoje em YYYY-MM-DD, o formato que o campo de data aceita. */
function todayAsInput(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function emptyForm(): FormState {
  return {
    type: 'receita',
    amount: '',
    discount: '',
    description: '',
    category: '',
    professional: 'Nicolle',
    paymentMethod: 'pix',
    costType: 'variavel',
    status: 'liquidada',
    occurredAt: todayAsInput(),
  };
}

/**
 * Reconstrói o formulário a partir do lançamento salvo. Não há mais alíquota a
 * recuperar: lançamento manual não tem taxa nem comissão.
 */
function formFromTransaction(transaction: Transaction): FormState {
  return {
    type: transaction.type,
    amount: String(transaction.grossAmount),
    discount: transaction.discountAmount ? String(transaction.discountAmount) : '',
    description: transaction.description,
    category: transaction.category,
    professional: transaction.professional ?? 'Nicolle',
    paymentMethod: transaction.paymentMethod,
    costType: transaction.costType ?? 'variavel',
    status: transaction.status,
    occurredAt: transaction.occurredAt.slice(0, 10),
  };
}

/** Converte YYYY-MM-DD em ISO completo; a API exige data válida em occurredAt. */
function dateInputToIso(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12, 0, 0));
  return isNaN(date.getTime()) ? null : date.toISOString();
}

export default function NewTransactionScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'NewTransaction'>>();
  const transactionId = route.params?.transactionId;
  const isEditing = Boolean(transactionId);

  const isAdmin = useAuthStore((state) => state.user?.role === 'admin');

  // A edição reusa a lista já em cache; não existe GET /transactions/:id na API.
  const { data: transactions, isPending: loadingTransactions } = useTransactions();
  const existing = useMemo(
    () => transactions?.find((item) => item._id === transactionId),
    [transactions, transactionId]
  );

  /**
   * O formulário é um único objeto que começa nulo. Em modo edição o lançamento chega
   * depois (vem da lista), e `draft ?? initialForm` resolve isso sem efeito de
   * sincronização: enquanto a dona não tocou em nada, o formulário acompanha o que a
   * API trouxe; no primeiro toque o rascunho passa a valer e revalidações em segundo
   * plano não apagam o que ela digitou.
   */
  const [draft, setDraft] = useState<FormState | null>(null);
  const initialForm = useMemo(
    () => (existing ? formFromTransaction(existing) : emptyForm()),
    [existing]
  );
  const form = draft ?? initialForm;

  const { categories, isPending: loadingCategories } = useCategoriesForType(form.type);
  const createMutation = useCreateTransaction();
  const updateMutation = useUpdateTransaction();
  const saving = createMutation.isPending || updateMutation.isPending;

  function update(changes: Partial<FormState>) {
    setDraft({ ...form, ...changes });
  }

  // A taxa não é mais sugerida aqui: campo vazio significa "usar o padrão da forma de
  // pagamento", que é resolvido no servidor. Antes o app preenchia 0% para Pix, o que
  // fazia parecer que a taxa digitada à mão tinha vindo de alguma configuração.
  function handleSelectPaymentMethod(method: PaymentMethod) {
    update({ paymentMethod: method });
  }

  // A categoria guardada pode não valer para o tipo atual (a dona alternou receita ->
  // despesa). Vale a derivada, não a guardada: assim nada é apagado do rascunho e o
  // formulário volta a mostrar a categoria original se ela alternar de volta.
  const category = categories.some((item) => item.name === form.category) ? form.category : '';

  const grossAmount = parseAmountInput(form.amount);
  const discountAmount = parseAmountInput(form.discount);
  const { type, description, professional, paymentMethod, costType, status, occurredAt } = form;

  // Prévia local, só para a dona conferir. O valor que vale é o que o servidor
  // calcula (CalculationService), que é a única fonte de verdade financeira.
  const preview = useMemo(() => {
    if (type === 'despesa') {
      return { baseAmount: grossAmount, feeAmount: 0, commissionAmount: 0, studioNetProfit: -grossAmount };
    }
    const baseAmount = Math.max(grossAmount - discountAmount, 0);
    return { baseAmount, feeAmount: 0, commissionAmount: 0, studioNetProfit: baseAmount };
  }, [type, grossAmount, discountAmount]);

  function validate(): string | null {
    if (!description.trim()) return 'Descreva o procedimento ou a despesa.';
    if (grossAmount <= 0) return 'Informe um valor maior que zero.';
    if (discountAmount > grossAmount) return 'O desconto não pode superar o valor bruto.';
    if (!category) return 'Escolha uma categoria do catálogo.';
    if (!dateInputToIso(occurredAt)) return 'Informe a data no formato AAAA-MM-DD.';
    return null;
  }

  function handleSave() {
    const validationError = validate();
    if (validationError) {
      Alert.alert('Confira os dados', validationError);
      return;
    }

    const occurredAtIso = dateInputToIso(occurredAt) as string;
    const input: TransactionInput = {
      type,
      description: description.trim(),
      grossAmount,
      discountAmount,
      // Lançamento manual não tem taxa: o que a maquininha retém já vem descontado no
      // extrato da InfinitePay. Mandar zero explicitamente impede o servidor de aplicar
      // o padrão da forma de pagamento e descontar de novo.
      paymentFeeRate: 0,
      // Sempre zero: o estúdio não trabalha com repasse por profissional.
      professionalCommissionRate: 0,
      category,
      paymentMethod,
      occurredAt: occurredAtIso,
      status,
      ...(isAdmin ? { professional } : {}),
      ...(type === 'despesa' ? { costType } : {}),
      // A API preenche settledAt com a data de hoje quando o status é liquidada e
      // nada é informado; em edição, manter a data original evita remexer no caixa.
      ...(status === 'liquidada' && existing?.settledAt ? { settledAt: existing.settledAt } : {}),
    };

    const onError = (mutationError: unknown) =>
      Alert.alert('Não foi possível salvar', getApiErrorMessage(mutationError));
    const onSuccess = () => navigation.goBack();

    if (isEditing && transactionId) {
      updateMutation.mutate({ id: transactionId, input }, { onError, onSuccess });
    } else {
      createMutation.mutate(input, { onError, onSuccess });
    }
  }

  if (isEditing && loadingTransactions) {
    return (
      <View style={styles.screen}>
        <LoadingState label="Carregando lançamento..." />
      </View>
    );
  }

  if (isEditing && !existing) {
    return (
      <View style={styles.screen}>
        <View style={styles.notFound}>
          <Ionicons name="alert-circle-outline" size={36} color={colors.statusWarning} />
          <Text style={styles.notFoundTitle}>Lançamento não encontrado</Text>
          <Text style={styles.notFoundText}>
            Ele pode ter sido excluído ou estar fora dos 500 registros mais recentes.
          </Text>
          <TouchableOpacity style={styles.notFoundBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.notFoundBtnText}>Voltar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const isIncome = type === 'receita';

  return (
    <View style={styles.screen}>
      <View style={styles.modalHeader}>
        <View style={styles.dragPill} />
        <View style={styles.headerBar}>
          <View>
            <Text style={styles.headerTitle}>
              {isEditing ? 'Editar lançamento' : 'Lançamento manual'}
            </Text>
            <Text style={styles.headerSubtitle}>Registro de procedimento ou despesa</Text>
          </View>
          <TouchableOpacity
            style={styles.closeBtn}
            activeOpacity={0.7}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="close" size={20} color={colors.graphiteMuted} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Só entrada: o estúdio não registra despesa à mão. O que sai da conta é o
            Saldo Retirado, lido do extrato, e as saídas da auditoria (taxa, estorno)
            são criadas por ela própria.

            Um lançamento de SAÍDA ainda pode chegar aqui pela edição — foi a auditoria
            que o criou. Nesse caso o tipo é preservado e apenas anunciado: trocá-lo em
            silêncio viraria o sinal do ajuste e reabriria o mês. */}
        {!isIncome ? (
          <View style={styles.outflowBanner}>
            <Ionicons name="arrow-down-circle" size={17} color={colors.statusError} />
            <Text style={styles.outflowText}>
              Lançamento de saída, criado pela auditoria do mês.
            </Text>
          </View>
        ) : null}

        {!isAdmin ? (
          <Text style={styles.roleHint}>
            Seu perfil registra apenas receitas dos próprios atendimentos.
          </Text>
        ) : null}

        <View style={styles.amountCard}>
          <Text style={styles.fieldLabel}>VALOR BRUTO DO LANÇAMENTO</Text>
          <View style={styles.amountInputRow}>
            <Text style={styles.currencyPrefix}>R$</Text>
            <TextInput
              style={styles.amountInput}
              value={form.amount}
              onChangeText={(value) => update({ amount: value })}
              keyboardType="decimal-pad"
              placeholder="0,00"
              placeholderTextColor={colors.lavenderSubtle}
            />
          </View>

          {isIncome ? (
            <View style={styles.inlineField}>
              <Text style={styles.fieldLabel}>DESCONTO CONCEDIDO (R$)</Text>
              <TextInput
                style={styles.textInput}
                value={form.discount}
                onChangeText={(value) => update({ discount: value })}
                keyboardType="decimal-pad"
                placeholder="0,00"
                placeholderTextColor={colors.graphiteMuted}
              />
            </View>
          ) : null}
        </View>

        <View style={styles.formCard}>
          <Text style={styles.fieldLabel}>PROCEDIMENTO / DESCRIÇÃO</Text>
          <TextInput
            style={styles.textInput}
            value={form.description}
            onChangeText={(value) => update({ description: value })}
            placeholder="Ex: Efeito Wispy, Fibra de Vidro..."
            placeholderTextColor={colors.graphiteMuted}
            maxLength={240}
          />

          <Text style={[styles.fieldLabel, styles.fieldSpacing]}>DATA DO ATENDIMENTO</Text>
          <TextInput
            style={styles.textInput}
            value={form.occurredAt}
            onChangeText={(value) => update({ occurredAt: value })}
            placeholder="AAAA-MM-DD"
            placeholderTextColor={colors.graphiteMuted}
            maxLength={10}
          />
          <Text style={styles.fieldHelp}>
            É a data que entra no DRE (regime de competência).
          </Text>

          {/* Categorias vêm do catálogo da API; o backend recusa o que não está nele. */}
          <Text style={[styles.fieldLabel, styles.fieldSpacing]}>CATEGORIA DO CATÁLOGO</Text>
          {loadingCategories ? (
            <ActivityIndicator color={colors.primary} style={styles.inlineLoader} />
          ) : categories.length === 0 ? (
            <Text style={styles.fieldHelp}>
              Nenhuma categoria de {isIncome ? 'receita' : 'despesa'} ativa no catálogo.
              A administradora cadastra em Ajustes → Categorias.
            </Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillsScroll}>
              {categories.map((item) => {
                const isSelected = category === item.name;
                return (
                  <TouchableOpacity
                    key={item._id}
                    onPress={() => update({ category: item.name })}
                    style={[styles.categoryPill, isSelected && styles.categoryPillSelected]}
                  >
                    <Text
                      style={[styles.categoryPillText, isSelected && styles.categoryPillTextSelected]}
                    >
                      {item.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {isAdmin ? (
            <>
              <Text style={[styles.fieldLabel, styles.fieldSpacing]}>ESPECIALISTA DESIGNADA</Text>
              <View style={styles.pillRow}>
                {PROFESSIONALS.map((item) => {
                  const isSelected = professional === item;
                  return (
                    <TouchableOpacity
                      key={item}
                      onPress={() => update({ professional: item })}
                      style={[styles.pill, isSelected && styles.pillSelectedDark]}
                    >
                      <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>
                        {item}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          ) : null}

          <Text style={[styles.fieldLabel, styles.fieldSpacing]}>MEIO DE PAGAMENTO</Text>
          <View style={styles.pillRow}>
            {SELECTABLE_PAYMENT_METHODS.map((method) => {
              const isSelected = paymentMethod === method;
              return (
                <TouchableOpacity
                  key={method}
                  onPress={() => handleSelectPaymentMethod(method)}
                  style={[styles.pill, isSelected && styles.pillSelectedDark]}
                >
                  <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>
                    {paymentMethodLabels[method]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {!isIncome ? (
            <>
              <Text style={[styles.fieldLabel, styles.fieldSpacing]}>NATUREZA DO CUSTO</Text>
              <View style={styles.pillRow}>
                {COST_TYPES.map((item) => {
                  const isSelected = costType === item;
                  return (
                    <TouchableOpacity
                      key={item}
                      onPress={() => update({ costType: item })}
                      style={[styles.pill, isSelected && styles.pillSelectedDark]}
                    >
                      <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>
                        {costTypeLabels[item]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={styles.fieldHelp}>
                Custo fixo (aluguel, internet) e variável (insumos) aparecem separados no DRE.
              </Text>
            </>
          ) : null}

          <Text style={[styles.fieldLabel, styles.fieldSpacing]}>SITUAÇÃO</Text>
          <View style={styles.pillRow}>
            {STATUSES.map((item) => {
              const isSelected = status === item;
              return (
                <TouchableOpacity
                  key={item}
                  onPress={() => update({ status: item })}
                  style={[styles.pill, isSelected && styles.pillSelectedDark]}
                >
                  <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>
                    {transactionStatusLabels[item]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.fieldHelp}>
            Liquidada entra no Fluxo de Caixa; pendente conta só no DRE.
          </Text>
        </View>

        {/* Prévia do cálculo: confere antes de salvar; o servidor recalcula ao gravar. */}
        {isIncome ? (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Prévia do cálculo</Text>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Base (bruto − desconto)</Text>
              <Text style={styles.summaryValue}>{formatCurrency(preview.baseAmount)}</Text>
            </View>
            <View style={[styles.summaryRow, styles.summaryTotalRow]}>
              <Text style={styles.summaryTotalLabel}>Entra na conta</Text>
              <Text style={styles.summaryTotalValue}>
                {formatCurrency(preview.studioNetProfit)}
              </Text>
            </View>

            <Text style={styles.summaryNote}>
              Valor conferido e recalculado no servidor ao salvar.
            </Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          activeOpacity={0.85}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
              <Text style={styles.saveBtnText}>
                {isEditing ? 'Salvar alterações' : 'Confirmar e salvar lançamento'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderWhisper,
    alignItems: 'center',
  },
  dragPill: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderWhisper,
    marginBottom: 8,
  },
  headerBar: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: typography.fonts.headlineBold,
    fontSize: 20,
    color: colors.graphiteText,
  },
  headerSubtitle: {
    fontFamily: typography.fonts.body,
    fontSize: 11,
    color: colors.graphiteMuted,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.lavenderTint,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.md,
    padding: 3,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.borderWhisper,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: borderRadius.sm,
  },
  segmentBtnActive: {
    backgroundColor: colors.primary,
  },
  segmentBtnActiveExpense: {
    backgroundColor: colors.statusError,
  },
  segmentBtnDisabled: {
    opacity: 0.45,
  },
  segmentIcon: {
    marginRight: 6,
  },
  segmentText: {
    fontFamily: typography.fonts.bodySemiBold,
    fontSize: 12,
    color: colors.graphiteMuted,
  },
  segmentTextActive: {
    color: '#FFFFFF',
  },
  roleHint: {
    fontFamily: typography.fonts.body,
    fontSize: 11,
    color: colors.graphiteMuted,
    marginBottom: 12,
    marginTop: -6,
  },
  amountCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.borderWhisper,
    marginBottom: 14,
    ...shadows.card,
  },
  fieldLabel: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 0.8,
    color: colors.graphiteMuted,
    marginBottom: 6,
  },
  fieldSpacing: {
    marginTop: 16,
  },
  fieldHelp: {
    fontFamily: typography.fonts.body,
    fontSize: 10,
    color: colors.graphiteMuted,
    marginTop: 5,
    lineHeight: 15,
  },
  inlineField: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderWhisper,
  },
  inlineLoader: {
    alignSelf: 'flex-start',
    marginVertical: 6,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencyPrefix: {
    fontFamily: typography.fonts.headlineBold,
    fontSize: 26,
    color: colors.primary,
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    fontFamily: typography.fonts.headlineBold,
    fontSize: 30,
    color: colors.graphiteText,
    padding: 0,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.borderWhisper,
    marginBottom: 14,
    ...shadows.card,
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
  pillsScroll: {
    flexDirection: 'row',
  },
  categoryPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceCanvas,
    borderWidth: 1,
    borderColor: colors.borderWhisper,
    marginRight: 6,
  },
  categoryPillSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryPillText: {
    fontFamily: typography.fonts.bodyMedium,
    fontSize: 12,
    color: colors.primary,
  },
  categoryPillTextSelected: {
    color: '#FFFFFF',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceCanvas,
    borderWidth: 1,
    borderColor: colors.borderWhisper,
  },
  pillSelectedDark: {
    backgroundColor: colors.graphiteText,
    borderColor: colors.graphiteText,
  },
  pillText: {
    fontFamily: typography.fonts.bodyMedium,
    fontSize: 12,
    color: colors.graphiteText,
  },
  pillTextSelected: {
    color: '#FFFFFF',
  },
  summaryCard: {
    backgroundColor: colors.lavenderTint,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.lavenderSubtle,
    marginBottom: 16,
    padding: 14,
  },
  summaryTitle: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 11,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 2,
  },
  summaryLabel: {
    fontFamily: typography.fonts.bodyMedium,
    fontSize: 12,
    color: colors.graphiteText,
  },
  summaryValue: {
    fontFamily: typography.fonts.bodySemiBold,
    fontSize: 12,
    color: colors.graphiteText,
  },
  summaryTotalRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.lavenderSubtle,
  },
  summaryTotalLabel: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 13,
    color: colors.graphiteText,
  },
  summaryTotalValue: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 14,
    color: colors.violetRoyal,
  },
  summaryNote: {
    fontFamily: typography.fonts.body,
    fontSize: 10,
    color: colors.graphiteMuted,
    marginTop: 8,
  },
  saveBtn: {
    backgroundColor: colors.violetRoyal,
    borderRadius: borderRadius.md,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    ...shadows.card,
  },
  saveBtnDisabled: {
    opacity: 0.7,
  },
  saveBtnText: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 8,
  },
  notFoundTitle: {
    fontFamily: typography.fonts.headline,
    fontSize: 17,
    color: colors.graphiteText,
  },
  notFoundText: {
    fontFamily: typography.fonts.body,
    fontSize: 12,
    color: colors.graphiteMuted,
    textAlign: 'center',
  },
  notFoundBtn: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
  },
  notFoundBtnText: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 13,
    color: '#FFFFFF',
  },
  outflowBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.statusErrorBg,
    borderRadius: borderRadius.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  outflowText: {
    flex: 1,
    fontFamily: typography.fonts.bodyMedium,
    fontSize: 12,
    color: colors.statusError,
  },
});
