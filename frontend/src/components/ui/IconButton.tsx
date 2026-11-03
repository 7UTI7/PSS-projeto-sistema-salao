import React from 'react';
import { TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { colors, borderRadius } from '../../theme/theme';

export type IconButtonVariant = 'primary' | 'secondary' | 'dark' | 'danger';

interface IconButtonProps {
  icon: React.ReactNode;
  onPress?: () => void;
  variant?: IconButtonVariant;
  size?: number;
  style?: ViewStyle;
  shape?: 'circle' | 'rounded';
}

export function IconButton({
  icon,
  onPress,
  variant = 'primary',
  size = 40,
  style,
  shape = 'circle',
}: IconButtonProps) {
  const getBackgroundColor = () => {
    switch (variant) {
      case 'primary':
        return colors.primary;
      case 'secondary':
        return colors.lavenderTint;
      case 'dark':
        return colors.graphiteText;
      case 'danger':
        return colors.statusError;
      default:
        return colors.primary;
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: shape === 'circle' ? borderRadius.full : borderRadius.sm,
          backgroundColor: getBackgroundColor(),
        },
        style,
      ]}
    >
      {icon}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
