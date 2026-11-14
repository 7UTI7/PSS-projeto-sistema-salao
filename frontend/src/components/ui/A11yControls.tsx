import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useA11yStore } from '../../store/a11yStore';
import { typography, borderRadius, useAppTheme } from '../../theme/theme';

export function A11yControls() {
  const {
    isDarkMode,
    fontScale,
    highContrast,
    toggleDarkMode,
    increaseFontSize,
    decreaseFontSize,
    resetFontSize,
    toggleHighContrast,
  } = useA11yStore();

  const theme = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);

  const fontPercent = Math.round(fontScale * 100);

  return (
    <View style={styles.container}>
      {/* 1. Modo Escuro */}
      <View style={styles.row}>
        <View style={styles.rowInfo}>
          <Ionicons
            name={isDarkMode ? 'moon' : 'sunny-outline'}
            size={20}
            color={isDarkMode ? colors.violetRoyal : colors.graphiteMuted}
          />
          <View style={styles.textCol}>
            <Text style={styles.rowTitle}>Modo Escuro</Text>
            <Text style={styles.rowSubtitle}>Tema escuro para conforto visual</Text>
          </View>
        </View>
        <Switch
          value={isDarkMode}
          onValueChange={toggleDarkMode}
          trackColor={{ false: colors.surfaceContainerHigh, true: colors.violetRoyal }}
          ios_backgroundColor={colors.surfaceContainerHigh}
          thumbColor="#FFFFFF"
        />
      </View>

      <View style={styles.divider} />

      {/* 2. Tamanho da Fonte */}
      <View style={styles.fontSection}>
        <View style={styles.fontHeader}>
          <Ionicons name="text-outline" size={20} color={colors.graphiteMuted} />
          <View style={styles.textCol}>
            <Text style={styles.rowTitle}>Tamanho do Texto ({fontPercent}%)</Text>
            <Text style={styles.rowSubtitle}>Ajuste a escala tipográfica do app</Text>
          </View>
        </View>

        <View style={styles.fontButtons}>
          <TouchableOpacity
            style={[styles.btn, fontScale <= 0.9 && styles.btnDisabled]}
            disabled={fontScale <= 0.9}
            onPress={decreaseFontSize}
            activeOpacity={0.7}
          >
            <Ionicons name="remove" size={18} color={colors.graphiteText} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.btn} onPress={resetFontSize} activeOpacity={0.7}>
            <Ionicons name="refresh" size={16} color={colors.graphiteMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, fontScale >= 1.3 && styles.btnDisabled]}
            disabled={fontScale >= 1.3}
            onPress={increaseFontSize}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={18} color={colors.graphiteText} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.divider} />

      {/* 3. Alto Contraste */}
      <View style={styles.row}>
        <View style={styles.rowInfo}>
          <Ionicons name="eye-outline" size={20} color={colors.graphiteMuted} />
          <View style={styles.textCol}>
            <Text style={styles.rowTitle}>Alto Contraste</Text>
            <Text style={styles.rowSubtitle}>Bordas e textos com maior nitidez</Text>
          </View>
        </View>
        <Switch
          value={highContrast}
          onValueChange={toggleHighContrast}
          trackColor={{ false: colors.surfaceContainerHigh, true: colors.violetRoyal }}
          ios_backgroundColor={colors.surfaceContainerHigh}
          thumbColor="#FFFFFF"
        />
      </View>
    </View>
  );
}

const createStyles = ({ colors, borderWidth, s }: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    container: {
      gap: 12,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 4,
    },
    rowInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
      marginRight: 12,
    },
    fontHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      width: '100%',
    },
    textCol: {
      flex: 1,
    },
    rowTitle: {
      fontFamily: typography.fonts.bodySemiBold,
      fontSize: s(14),
      color: colors.graphiteText,
    },
    rowSubtitle: {
      fontFamily: typography.fonts.body,
      fontSize: s(11),
      color: colors.graphiteMuted,
      marginTop: 1,
    },
    divider: {
      height: 1,
      backgroundColor: colors.borderWhisper,
    },
    fontSection: {
      gap: 10,
      paddingVertical: 4,
    },
    fontButtons: {
      flexDirection: 'row',
      gap: 8,
      alignSelf: 'flex-start',
      marginLeft: 32,
    },
    btn: {
      width: 38,
      height: 38,
      borderRadius: borderRadius.md,
      backgroundColor: colors.surfaceCanvas,
      borderWidth,
      borderColor: colors.borderWhisper,
      justifyContent: 'center',
      alignItems: 'center',
    },
    btnDisabled: {
      opacity: 0.4,
    },
  });