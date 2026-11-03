import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, borderRadius, shadows } from '../../theme/theme';
import { StudioTopHeader } from '../../components/ui/StudioTopHeader';
import { FloatingActionButton } from '../../components/ui/FloatingActionButton';

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  minQuantity: number;
  unit: string;
  status: 'critical' | 'low' | 'ok';
}

const INITIAL_INVENTORY: InventoryItem[] = [
  {
    id: '1',
    name: 'Cola de Cílios Premium',
    category: 'Cílios / Micropigmentação',
    quantity: 2,
    minQuantity: 5,
    unit: 'unidades',
    status: 'critical',
  },
  {
    id: '2',
    name: 'Luvas descartáveis Nitrílica (M)',
    category: 'Biossegurança & Insumos',
    quantity: 1,
    minQuantity: 3,
    unit: 'caixas',
    status: 'low',
  },
  {
    id: '3',
    name: 'Pigmento Labial Rose Nude',
    category: 'Dermopigmentação',
    quantity: 6,
    minQuantity: 4,
    unit: 'frascos',
    status: 'ok',
  },
  {
    id: '4',
    name: 'Fios para Extensão 0.07 D',
    category: 'Cílios / Lash',
    quantity: 8,
    minQuantity: 4,
    unit: 'bandejas',
    status: 'ok',
  },
  {
    id: '5',
    name: 'Anestésico Tópico Pomada',
    category: 'Procedimentos Estéticos',
    quantity: 4,
    minQuantity: 3,
    unit: 'bisnagas',
    status: 'ok',
  },
];

export default function InventoryScreen() {
  const [items, setItems] = useState<InventoryItem[]>(INITIAL_INVENTORY);

  function handleReorder(name: string) {
    Alert.alert(
      'Pedido de Compra',
      `Solicitação de reposição para "${name}" gerada no módulo de compras.`
    );
  }

  return (
    <View style={styles.screen}>
      <StudioTopHeader subtitleTag="ESTOQUE & INSUMOS" currentPeriod="Setembro 2024" />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Controle de Insumos</Text>
          <Text style={styles.pageDesc}>
            Monitore o estoque mínimo de materiais, cabines e biossegurança do atelier.
          </Text>
        </View>

        {/* Resumo do Estoque */}
        <View style={styles.kpiRow}>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiNum}>2</Text>
            <Text style={styles.kpiLabel}>Precisam Reposição</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={[styles.kpiNum, { color: colors.statusSuccess }]}>5</Text>
            <Text style={styles.kpiLabel}>Itens Monitorados</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={[styles.kpiNum, { color: colors.violetRoyal }]}>100%</Text>
            <Text style={styles.kpiLabel}>Auditado Hoje</Text>
          </View>
        </View>

        {/* Lista de Itens */}
        <Text style={styles.sectionTitle}>Materiais em Cabine</Text>

        {items.map((item) => {
          const isCritical = item.status === 'critical';
          const isLow = item.status === 'low';

          return (
            <View key={item.id} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <View style={styles.itemTitleRow}>
                  <View
                    style={[
                      styles.iconCircle,
                      isCritical
                        ? { backgroundColor: colors.statusErrorBg }
                        : isLow
                        ? { backgroundColor: colors.statusWarningBg }
                        : { backgroundColor: colors.lavenderTint },
                    ]}
                  >
                    <Ionicons
                      name={isCritical ? 'alert-circle' : isLow ? 'warning' : 'cube'}
                      size={18}
                      color={
                        isCritical
                          ? colors.statusError
                          : isLow
                          ? colors.statusWarning
                          : colors.primary
                      }
                    />
                  </View>
                  <View>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemCat}>{item.category}</Text>
                  </View>
                </View>

                <View
                  style={[
                    styles.statusPill,
                    isCritical
                      ? { backgroundColor: colors.statusErrorBg }
                      : isLow
                      ? { backgroundColor: colors.statusWarningBg }
                      : { backgroundColor: colors.statusSuccessBg },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusPillText,
                      isCritical
                        ? { color: colors.statusError }
                        : isLow
                        ? { color: colors.statusWarning }
                        : { color: colors.statusSuccess },
                    ]}
                  >
                    {isCritical ? 'Crítico' : isLow ? 'Baixo' : 'Normal'}
                  </Text>
                </View>
              </View>

              <View style={styles.itemFooter}>
                <Text style={styles.qtyText}>
                  Disponível: <Text style={styles.qtyBold}>{item.quantity} {item.unit}</Text>{' '}
                  (Mínimo: {item.minQuantity})
                </Text>

                {(isCritical || isLow) && (
                  <TouchableOpacity
                    style={styles.reorderBtn}
                    activeOpacity={0.7}
                    onPress={() => handleReorder(item.name)}
                  >
                    <Text style={styles.reorderText}>Pedir Reposição</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>

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
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  kpiBox: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.borderWhisper,
    alignItems: 'center',
    ...shadows.card,
  },
  kpiNum: {
    fontFamily: typography.fonts.headlineBold,
    fontSize: 22,
    color: colors.statusError,
  },
  kpiLabel: {
    fontFamily: typography.fonts.body,
    fontSize: 10,
    color: colors.graphiteMuted,
    textAlign: 'center',
    marginTop: 2,
  },
  sectionTitle: {
    fontFamily: typography.fonts.headlineBold,
    fontSize: 16,
    color: colors.graphiteText,
    marginBottom: 10,
  },
  itemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.borderWhisper,
    marginBottom: 10,
    ...shadows.card,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemName: {
    fontFamily: typography.fonts.bodySemiBold,
    fontSize: 14,
    color: colors.graphiteText,
  },
  itemCat: {
    fontFamily: typography.fonts.body,
    fontSize: 11,
    color: colors.graphiteMuted,
    marginTop: 1,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  statusPillText: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 10,
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.borderWhisper,
  },
  qtyText: {
    fontFamily: typography.fonts.body,
    fontSize: 11,
    color: colors.graphiteMuted,
  },
  qtyBold: {
    fontFamily: typography.fonts.bodyBold,
    color: colors.graphiteText,
  },
  reorderBtn: {
    backgroundColor: colors.lavenderTint,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  reorderText: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 11,
    color: colors.primary,
  },
});
