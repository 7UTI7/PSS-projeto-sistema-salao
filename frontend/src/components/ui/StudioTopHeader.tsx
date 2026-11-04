import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store/authStore';
import { usePeriodStore } from '../../store/periodStore';
import { currentPeriodKey, periodLabel, recentPeriods } from '../../utils/period';
import { colors, typography, borderRadius, shadows } from '../../theme/theme';

interface StudioTopHeaderProps {
  subtitleTag?: string;
}

/** Quantos meses o seletor oferece: um ano cobre a comparação ano a ano. */
const SELECTABLE_MONTHS = 12;

export function StudioTopHeader({ subtitleTag = 'DASHBOARD' }: StudioTopHeaderProps) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const [pickerOpen, setPickerOpen] = useState(false);

  // O período é global: trocar aqui refaz os relatórios e refiltra as listas.
  const period = usePeriodStore((state) => state.period);
  const setPeriod = usePeriodStore((state) => state.setPeriod);
  const userName = useAuthStore((state) => state.user?.name);

  const options = recentPeriods(SELECTABLE_MONTHS);
  const initials = userName ? userName.trim().charAt(0).toUpperCase() : 'N';

  return (
    <View style={[styles.container, { paddingTop: insets.top + 10 }]}>
      <View style={styles.left}>
        {/* Monograma 'N' em degradê violeta */}
        <View style={styles.monogram}>
          <Text style={styles.monogramText}>N</Text>
        </View>

        <View style={styles.brandCol}>
          <Text style={styles.brandTitle}>Nicolle Neris Studio</Text>
          <View style={styles.badgeRow}>
            <View style={styles.tagPill}>
              <Text style={styles.tagText}>{subtitleTag}</Text>
            </View>
            <Text style={styles.dot}>•</Text>
            <TouchableOpacity
              style={styles.periodBtn}
              activeOpacity={0.7}
              onPress={() => setPickerOpen(true)}
            >
              <Text style={styles.periodText}>{periodLabel(period)}</Text>
              <Ionicons name="chevron-down" size={12} color={colors.violetRoyal} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.right}>
        <TouchableOpacity
          style={styles.avatarBtn}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('Settings')}
        >
          <Text style={styles.avatarText}>{initials}</Text>
        </TouchableOpacity>
      </View>

      {/* Seletor de mês: toca fora para fechar, como uma action sheet. */}
      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPickerOpen(false)}>
          <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.sheetTitle}>Período de referência</Text>
            <Text style={styles.sheetHelp}>
              Vale para o Dashboard, os lançamentos e os relatórios.
            </Text>

            {options.map((option) => {
              const isSelected = option === period;
              return (
                <TouchableOpacity
                  key={option}
                  style={[styles.sheetItem, isSelected && styles.sheetItemSelected]}
                  activeOpacity={0.7}
                  onPress={() => {
                    setPeriod(option);
                    setPickerOpen(false);
                  }}
                >
                  <Text style={[styles.sheetItemText, isSelected && styles.sheetItemTextSelected]}>
                    {periodLabel(option)}
                  </Text>
                  {option === currentPeriodKey() ? (
                    <Text style={styles.sheetItemBadge}>mês atual</Text>
                  ) : null}
                  {isSelected ? (
                    <Ionicons name="checkmark-circle" size={18} color={colors.violetRoyal} />
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: 'rgba(251, 248, 252, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderWhisper,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  monogram: {
    width: 38,
    height: 38,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  monogramText: {
    fontFamily: typography.fonts.headlineBold,
    fontSize: 20,
    color: '#FFFFFF',
  },
  brandCol: {
    flexDirection: 'column',
  },
  brandTitle: {
    fontFamily: typography.fonts.headline,
    fontSize: 16,
    color: colors.graphiteText,
    letterSpacing: -0.2,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  tagPill: {
    backgroundColor: colors.lavenderTint,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: borderRadius.xs,
  },
  tagText: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 7,
    color: colors.violetRoyal,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  dot: {
    color: colors.lavenderSubtle,
    fontSize: 10,
  },
  periodBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  periodText: {
    fontFamily: typography.fonts.bodyMedium,
    fontSize: 11,
    color: colors.graphiteMuted,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarBtn: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    backgroundColor: colors.lavenderTint,
    borderWidth: 1,
    borderColor: colors.lavenderSubtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 13,
    color: colors.primary,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(24, 24, 27, 0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
    ...shadows.elevated,
  },
  sheetTitle: {
    fontFamily: typography.fonts.headline,
    fontSize: 18,
    color: colors.graphiteText,
  },
  sheetHelp: {
    fontFamily: typography.fonts.body,
    fontSize: 12,
    color: colors.graphiteMuted,
    marginTop: 2,
    marginBottom: 14,
  },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: borderRadius.md,
  },
  sheetItemSelected: {
    backgroundColor: colors.lavenderTint,
  },
  sheetItemText: {
    fontFamily: typography.fonts.bodyMedium,
    fontSize: 14,
    color: colors.graphiteText,
    flex: 1,
  },
  sheetItemTextSelected: {
    fontFamily: typography.fonts.bodyBold,
    color: colors.primary,
  },
  sheetItemBadge: {
    fontFamily: typography.fonts.bodySemiBold,
    fontSize: 9,
    color: colors.violetRoyal,
    backgroundColor: colors.lavenderLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
