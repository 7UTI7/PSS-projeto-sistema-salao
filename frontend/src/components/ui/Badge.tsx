import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { colors, typography, borderRadius } from '../../theme/theme';

export type BadgeVariant = 'primary' | 'secondary' | 'tertiary' | 'neutral' | 'success' | 'danger';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}

export function Badge({
  label,
  variant = 'secondary',
  style,
  textStyle,
  icon,
}: BadgeProps) {
  return (
    <View style={[styles.badge, styles[variant], style]}>
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text style={[styles.text, styles[`${variant}Text` as keyof typeof styles], textStyle]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
  },
  icon: {
    marginRight: 4,
  },
  text: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: typography.sizes.labelSm,
  },
  primary: {
    backgroundColor: colors.primary,
  },
  primaryText: {
    color: '#FFFFFF',
  },
  secondary: {
    backgroundColor: colors.lavenderTint,
    borderWidth: 1,
    borderColor: colors.lavenderSubtle,
  },
  secondaryText: {
    color: colors.primary,
  },
  tertiary: {
    backgroundColor: colors.lavenderLight,
  },
  tertiaryText: {
    color: colors.violetRoyal,
  },
  neutral: {
    backgroundColor: colors.surfaceContainer,
  },
  neutralText: {
    color: colors.graphiteText,
  },
  success: {
    backgroundColor: colors.statusSuccessBg,
  },
  successText: {
    color: colors.statusSuccess,
  },
  danger: {
    backgroundColor: colors.statusErrorBg,
  },
  dangerText: {
    color: colors.statusError,
  },
});
