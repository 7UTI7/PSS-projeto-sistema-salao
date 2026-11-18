import React from 'react';
import { View, StyleSheet, ViewStyle, ViewProps } from 'react-native';
import { colors, borderRadius, shadows } from '../../theme/theme';
import { useA11yStore } from '../../store/a11yStore';

interface CardProps extends ViewProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function Card({ children, style, ...rest }: CardProps) {
  const isDarkMode = useA11yStore((state) => state.isDarkMode);
  const highContrast = useA11yStore((state) => state.highContrast);

  return (
    <View
      style={[
        styles.card,
        isDarkMode && styles.cardDark,
        highContrast && styles.cardHighContrast,
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.borderWhisper,
    ...shadows.card,
  },
  cardDark: {
    backgroundColor: '#1E1E24',
    borderColor: '#2E284A',
  },
  cardHighContrast: {
    borderWidth: 2,
    borderColor: colors.graphiteText,
  },
});
