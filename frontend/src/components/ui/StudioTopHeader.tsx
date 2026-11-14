import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store/authStore';
import { usePeriodStore } from '../../store/periodStore';
import { currentPeriodKey, periodLabel, recentPeriods } from '../../utils/period';
import { typography, borderRadius, useAppTheme } from '../../theme/theme';
import { A11yControls } from './A11yControls';

interface StudioTopHeaderProps {
  subtitleTag?: string;
}

/** Quantos meses o seletor oferece: um ano cobre a comparação ano a ano. */
const SELECTABLE_MONTHS = 12;

export function StudioTopHeader({ subtitleTag = 'DASHBOARD' }: StudioTopHeaderProps) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [a11yOpen, setA11yOpen] = useState(false);

  const theme = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);

  // Exibe o atalho do modal rápido apenas a partir do tamanho médio (375px)
  const showA11yButton = width >= 375;

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
        {showA11yButton && (
          <TouchableOpacity
            style={styles.a11yBtn}
            activeOpacity={0.7}
            onPress={() => setA11yOpen(true)}
            accessibilityLabel="Opções de Acessibilidade e Tema"
          >
            <Ionicons name="color-palette-outline" size={17} color={colors.violetRoyal} />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.avatarBtn}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('Settings')}
        >
          <Text style={styles.avatarText}>{initials}</Text>
        </TouchableOpacity>
      </View>

      {/* Modal rápido de Acessibilidade & Tema (ativo a partir de 375px) */}
      <Modal
        visible={a11yOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setA11yOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setA11yOpen(false)}>
          <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>Acessibilidade & Tema</Text>
                <Text style={styles.sheetHelp}>Preferências visuais rápidas</Text>
              </View>
              <TouchableOpacity
                onPress={() => setA11yOpen(false)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={22} color={colors.graphiteMuted} />
              </TouchableOpacity>
            </View>

            <A11yControls />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Seletor de mês: toca fora para fechar, como uma action sheet. */}
      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerOpen(false)}
      >
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

const createStyles = ({
  colors,
  shadows,
  borderWidth,
  isDarkMode,
  highContrast,
  s,
}: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingBottom: 10,
      backgroundColor: colors.surfacePure,
      borderBottomWidth: borderWidth,
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
      fontSize: s(20),
      color: colors.onPrimary,
    },
    brandCol: {
      flexDirection: 'column',
    },
    brandTitle: {
      fontFamily: typography.fonts.headline,
      fontSize: s(16),
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
      fontSize: s(7),
      color: colors.violetRoyal,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    dot: {
      color: colors.lavenderSubtle,
      fontSize: s(10),
    },
    periodBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    periodText: {
      fontFamily: typography.fonts.bodyMedium,
      fontSize: s(11),
      color: colors.graphiteMuted,
    },
    right: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    a11yBtn: {
      width: 32,
      height: 32,
      borderRadius: borderRadius.full,
      backgroundColor: colors.lavenderTint,
      borderWidth,
      borderColor: colors.lavenderSubtle,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarBtn: {
      width: 32,
      height: 32,
      borderRadius: borderRadius.full,
      backgroundColor: colors.lavenderTint,
      borderWidth,
      borderColor: colors.lavenderSubtle,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarText: {
      fontFamily: typography.fonts.bodyBold,
      fontSize: s(13),
      color: colors.primary,
    },
    backdrop: {
      flex: 1,
      backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.72)' : 'rgba(24, 24, 27, 0.35)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.surfacePure,
      borderTopWidth: borderWidth,
      borderColor: colors.borderWhisper,
      borderTopLeftRadius: borderRadius.xl,
      borderTopRightRadius: borderRadius.xl,
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 32,
      ...shadows.elevated,
    },
    sheetHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 8,
    },
    sheetTitle: {
      fontFamily: typography.fonts.headline,
      fontSize: s(18),
      color: colors.graphiteText,
    },
    sheetHelp: {
      fontFamily: typography.fonts.body,
      fontSize: s(12),
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
      borderWidth: highContrast ? borderWidth : 0,
      borderColor: colors.borderWhisper,
      marginBottom: highContrast ? 6 : 0,
    },
    sheetItemSelected: {
      backgroundColor: colors.lavenderTint,
      borderWidth: highContrast ? borderWidth : 0,
      borderColor: colors.primary,
    },
    sheetItemText: {
      fontFamily: typography.fonts.bodyMedium,
      fontSize: s(14),
      color: colors.graphiteText,
      flex: 1,
    },
    sheetItemTextSelected: {
      fontFamily: typography.fonts.bodyBold,
      color: colors.primary,
    },
    sheetItemBadge: {
      fontFamily: typography.fonts.bodySemiBold,
      fontSize: s(9),
      color: colors.violetRoyal,
      backgroundColor: colors.lavenderLight,
      borderWidth: highContrast ? borderWidth : 0,
      borderColor: colors.lavenderSubtle,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: borderRadius.xs,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
  });