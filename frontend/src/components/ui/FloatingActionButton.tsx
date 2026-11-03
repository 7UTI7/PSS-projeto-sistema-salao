import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { colors, typography, borderRadius, shadows } from '../../theme/theme';

export function FloatingActionButton() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      style={styles.fab}
      onPress={() => navigation.navigate('NewTransaction')}
    >
      <Ionicons name="add" size={22} color="#FFFFFF" />
      <Text style={styles.fabText}>Novo Lançamento</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 84,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.violetRoyal,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: borderRadius.full,
    ...shadows.fab,
    zIndex: 99,
  },
  fabText: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 13,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});
