import React, { useMemo } from 'react';
import { View, TextInput, StyleSheet, ViewStyle, TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { typography, borderRadius, useAppTheme } from '../../theme/theme';

interface SearchBarProps extends TextInputProps {
  containerStyle?: ViewStyle;
}

export function SearchBar({
  value,
  onChangeText,
  placeholder = 'Buscar...',
  containerStyle,
  ...rest
}: SearchBarProps) {
  const theme = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={[styles.container, containerStyle]}>
      <Ionicons name="search-outline" size={18} color={colors.graphiteMuted} style={styles.icon} />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.graphiteMuted}
        {...rest}
      />
    </View>
  );
}

const createStyles = ({ colors, borderWidth, s }: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfacePure,
      borderWidth,
      borderColor: colors.borderWhisper,
      borderRadius: borderRadius.md,
      paddingHorizontal: 12,
      height: 44,
    },
    icon: {
      marginRight: 8,
    },
    input: {
      flex: 1,
      height: '100%',
      fontFamily: typography.fonts.body,
      fontSize: s(typography.sizes.bodyMd),
      color: colors.graphiteText,
    },
  });