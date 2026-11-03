import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors, typography, borderRadius, shadows } from '../../theme/theme';
import { formatCurrency } from '../../utils/formatters';

const CATEGORIES = ['Cílios', 'Unhas', 'Micropigmentação', 'Estética', 'Insumos'];
const PROFESSIONALS = ['Nicolle Neris', 'Stephany', 'Camila Santos'];
const PAYMENT_METHODS = ['Pix', 'Cartão Crédito', 'Cartão Débito', 'Dinheiro'];

export default function NewTransactionScreen() {
  const navigation = useNavigation();
  const [type, setType] = useState<'INCOME' | 'EXPENSE'>('INCOME');
  const [amount, setAmount] = useState('180');
  const [description, setDescription] = useState('Efeito Wispy - Cílios');
  const [selectedCategory, setSelectedCategory] = useState('Cílios');
  const [selectedProf, setSelectedProf] = useState('Nicolle Neris');
  const [selectedPayment, setSelectedPayment] = useState('Cartão');

  const numericAmount = parseFloat(amount.replace(',', '.')) || 0;
  const estimatedCommission = numericAmount * 0.4; // 40% comissão padrão

  function handleSave() {
    Alert.alert(
      'Lançamento Registrado!',
      `Serviço: ${description}\nValor: ${formatCurrency(numericAmount)}\nProfissional: ${selectedProf}\nForma: ${selectedPayment}`,
      [{ text: 'OK', onPress: () => navigation.goBack() }]
    );
  }

  return (
    <View style={styles.screen}>
      {/* Modal Top Header com botão Fechar */}
      <View style={styles.modalHeader}>
        <View style={styles.dragPill} />
        <View style={styles.headerBar}>
          <View>
            <Text style={styles.headerTitle}>Novo Lançamento</Text>
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
      >
        {/* Controle Segmentado (Receita x Despesa) */}
        <View style={styles.segmentedContainer}>
          <TouchableOpacity
            style={[styles.segmentBtn, type === 'INCOME' && styles.segmentBtnActive]}
            onPress={() => setType('INCOME')}
          >
            <Ionicons
              name="arrow-up-circle"
              size={17}
              color={type === 'INCOME' ? '#FFFFFF' : colors.graphiteMuted}
              style={styles.segmentIcon}
            />
            <Text
              style={[
                styles.segmentText,
                type === 'INCOME' && styles.segmentTextActive,
              ]}
            >
              Receita (Atendimento)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.segmentBtn,
              type === 'EXPENSE' && styles.segmentBtnActiveExpense,
            ]}
            onPress={() => setType('EXPENSE')}
          >
            <Ionicons
              name="arrow-down-circle"
              size={17}
              color={type === 'EXPENSE' ? '#FFFFFF' : colors.graphiteMuted}
              style={styles.segmentIcon}
            />
            <Text
              style={[
                styles.segmentText,
                type === 'EXPENSE' && styles.segmentTextActive,
              ]}
            >
              Despesa (Insumo)
            </Text>
          </TouchableOpacity>
        </View>

        {/* Card de Valor com R$ */}
        <View style={styles.amountCard}>
          <Text style={styles.fieldLabel}>VALOR TOTAL DO LANÇAMENTO</Text>
          <View style={styles.amountInputRow}>
            <Text style={styles.currencyPrefix}>R$</Text>
            <TextInput
              style={styles.amountInput}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="0,00"
              placeholderTextColor={colors.lavenderSubtle}
            />
          </View>
        </View>

        {/* Formulário de Detalhes */}
        <View style={styles.formCard}>
          <Text style={styles.fieldLabel}>PROCEDIMENTO / DESCRIÇÃO</Text>
          <TextInput
            style={styles.textInput}
            value={description}
            onChangeText={setDescription}
            placeholder="Ex: Efeito Wispy, Fibra de Vidro..."
            placeholderTextColor={colors.graphiteMuted}
          />

          {/* Categoria */}
          <Text style={[styles.fieldLabel, { marginTop: 16 }]}>CATEGORIA DE ATELIER</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.pillsScroll}
          >
            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setSelectedCategory(cat)}
                  style={[
                    styles.categoryPill,
                    isSelected && styles.categoryPillSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.categoryPillText,
                      isSelected && styles.categoryPillTextSelected,
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Profissional Responsável */}
          <Text style={[styles.fieldLabel, { marginTop: 16 }]}>ESPECIALISTA DESIGNADA</Text>
          <View style={styles.profRow}>
            {PROFESSIONALS.map((prof) => {
              const isSelected = selectedProf === prof;
              return (
                <TouchableOpacity
                  key={prof}
                  onPress={() => setSelectedProf(prof)}
                  style={[styles.profPill, isSelected && styles.profPillSelected]}
                >
                  <Text
                    style={[
                      styles.profPillText,
                      isSelected && styles.profPillTextSelected,
                    ]}
                  >
                    {prof}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Meio de Pagamento */}
          <Text style={[styles.fieldLabel, { marginTop: 16 }]}>MEIO DE PAGAMENTO</Text>
          <View style={styles.profRow}>
            {PAYMENT_METHODS.map((pm) => {
              const isSelected = selectedPayment === pm;
              return (
                <TouchableOpacity
                  key={pm}
                  onPress={() => setSelectedPayment(pm)}
                  style={[styles.profPill, isSelected && styles.profPillSelected]}
                >
                  <Text
                    style={[
                      styles.profPillText,
                      isSelected && styles.profPillTextSelected,
                    ]}
                  >
                    {pm}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Resumo da Operação com Cálculo de Comissão */}
        {type === 'INCOME' && (
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Comissão Estimada (40%):</Text>
              <Text style={styles.summaryValue}>
                {formatCurrency(estimatedCommission)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Líquido Atelier (60%):</Text>
              <Text style={[styles.summaryValue, { color: colors.violetRoyal, fontWeight: '700' }]}>
                {formatCurrency(numericAmount - estimatedCommission)}
              </Text>
            </View>
          </View>
        )}

        {/* Botão de Confirmação */}
        <TouchableOpacity
          style={styles.saveBtn}
          activeOpacity={0.85}
          onPress={handleSave}
        >
          <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
          <Text style={styles.saveBtnText}>Confirmar e Salvar Lançamento</Text>
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
    paddingBottom: 40,
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
  profRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  profPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceCanvas,
    borderWidth: 1,
    borderColor: colors.borderWhisper,
  },
  profPillSelected: {
    backgroundColor: colors.graphiteText,
    borderColor: colors.graphiteText,
  },
  profPillText: {
    fontFamily: typography.fonts.bodyMedium,
    fontSize: 12,
    color: colors.graphiteText,
  },
  profPillTextSelected: {
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
    fontFamily: typography.fonts.bodyBold,
    fontSize: 13,
    color: colors.graphiteText,
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
  saveBtnText: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
});
