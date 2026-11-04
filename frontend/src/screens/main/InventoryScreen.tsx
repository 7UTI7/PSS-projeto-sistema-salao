import React from 'react';
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
import { INVENTORY_ITEMS, LOW_STOCK_ITEMS, stockStatus } from '../../data/inventory.mock';

export default function InventoryScreen() {
  const items = INVENTORY_ITEMS;
  const lowStockCount = LOW_STOCK_ITEMS.length;

  function handleReorder(name: string) {
    Alert.alert(
      'Módulo local',
      `O controle de insumos ainda não existe na API, então "${name}" não gera pedido de compra de verdade. `
        + 'Para registrar a compra no financeiro, lance uma despesa variável na categoria de insumos.'
    );
  }

  return (
    <View style={styles.screen}>
      <StudioTopHeader subtitleTag="ESTOQUE & INSUMOS" />

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

          {/* Deixa claro que esta tela não está ligada à API, ao contrário das outras. */}
          <View style={styles.localBadge}>
            <Ionicons name="information-circle-outline" size={14} color={colors.statusWarning} />
            <Text style={styles.localBadgeText}>
              Módulo local: o backend ainda não tem controle de insumos.
            </Text>
          </View>
        </View>

        {/* Resumo do Estoque */}
        <View style={styles.kpiRow}>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiNum}>{lowStockCount}</Text>
            <Text style={styles.kpiLabel}>Precisam Reposição</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={[styles.kpiNum, { color: colors.statusSuccess }]}>{items.length}</Text>
            <Text style={styles.kpiLabel}>Itens Monitorados</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={[styles.kpiNum, { color: colors.violetRoyal }]}>
              {items.length - lowStockCount}
            </Text>
            <Text style={styles.kpiLabel}>Em Nível Normal</Text>
          </View>
        </View>

        {/* Lista de Itens */}
        <Text style={styles.sectionTitle}>Materiais em Cabine</Text>

        {items.map((item) => {
          const status = stockStatus(item);
          const isCritical = status === 'critical';
          const isLow = status === 'low';

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
  localBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: borderRadius.md,
    backgroundColor: colors.statusWarningBg,
  },
  localBadgeText: {
    flex: 1,
    fontFamily: typography.fonts.bodyMedium,
    fontSize: 10,
    color: colors.statusWarning,
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
