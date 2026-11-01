import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList } from '../../navigation/types';
import { colors, typography, borderRadius } from '../../theme/theme';

interface StudioTopHeaderProps {
  subtitleTag?: string;
  currentPeriod?: string;
}

export function StudioTopHeader({
  subtitleTag = 'DASHBOARD',
  currentPeriod = 'Setembro 2024',
}: StudioTopHeaderProps) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();

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
            <TouchableOpacity style={styles.periodBtn} activeOpacity={0.7}>
              <Text style={styles.periodText}>{currentPeriod}</Text>
              <Ionicons name="chevron-down" size={12} color={colors.violetRoyal} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.right}>
        <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7}>
          <Ionicons name="notifications-outline" size={20} color={colors.graphiteMuted} />
          <View style={styles.notifDot} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.avatarBtn}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('Settings')}
        >
          <Ionicons name="person" size={16} color={colors.primary} />
        </TouchableOpacity>
      </View>
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
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  notifDot: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.violetRoyal,
    borderWidth: 1.5,
    borderColor: colors.surface,
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
});
