import React from 'react';
import { View, TextInput, StyleSheet, ViewStyle, TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, borderRadius } from '../../theme/theme';

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

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
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
    fontSize: typography.sizes.bodyMd,
    color: colors.graphiteText,
  },
});
