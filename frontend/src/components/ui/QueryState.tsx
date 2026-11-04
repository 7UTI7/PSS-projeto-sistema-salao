// Estados de carregamento, erro e vazio de uma tela ligada à API.
//
// Com dados reais toda tela precisa dos três; sem um componente comum, cada uma
// inventava seu próprio spinner e sua própria mensagem de erro.
import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getApiErrorMessage } from '../../services/api';
import { colors, typography, borderRadius } from '../../theme/theme';

interface LoadingStateProps {
  label?: string;
  style?: ViewStyle;
}

export function LoadingState({ label = 'Carregando...', style }: LoadingStateProps) {
  return (
    <View style={[styles.center, style]}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.subtitle}>{label}</Text>
    </View>
  );
}

interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
  style?: ViewStyle;
}

export function ErrorState({ error, onRetry, style }: ErrorStateProps) {
  return (
    <View style={[styles.center, style]}>
      <View style={styles.errorIcon}>
        <Ionicons name="cloud-offline-outline" size={26} color={colors.statusError} />
      </View>
      <Text style={styles.title}>Não foi possível carregar</Text>
      <Text style={styles.subtitle}>{getApiErrorMessage(error)}</Text>

      {onRetry ? (
        <TouchableOpacity style={styles.retryBtn} activeOpacity={0.8} onPress={onRetry}>
          <Ionicons name="refresh" size={16} color={colors.primary} />
          <Text style={styles.retryText}>Tentar novamente</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  style?: ViewStyle;
}

export function EmptyState({ icon = 'documents-outline', title, description, style }: EmptyStateProps) {
  return (
    <View style={[styles.center, style]}>
      <Ionicons name={icon} size={40} color={colors.lavenderAccent} />
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.subtitle}>{description}</Text> : null}
    </View>
  );
}

/** Aviso de área restrita: as rotas de relatório e importação são só para admin. */
export function AdminOnlyState({ style }: { style?: ViewStyle }) {
  return (
    <View style={[styles.center, style]}>
      <View style={styles.lockIcon}>
        <Ionicons name="lock-closed-outline" size={24} color={colors.primary} />
      </View>
      <Text style={styles.title}>Área restrita</Text>
      <Text style={styles.subtitle}>
        Relatórios e importações ficam disponíveis apenas para o perfil de administradora do studio.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  title: {
    fontFamily: typography.fonts.headline,
    fontSize: 16,
    color: colors.graphiteText,
    marginTop: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: typography.fonts.body,
    fontSize: 12,
    color: colors.graphiteMuted,
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 280,
    lineHeight: 18,
  },
  errorIcon: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.full,
    backgroundColor: colors.statusErrorBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockIcon: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.full,
    backgroundColor: colors.lavenderTint,
    justifyContent: 'center',
    alignItems: 'center',
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.lavenderSubtle,
    backgroundColor: colors.lavenderTint,
  },
  retryText: {
    fontFamily: typography.fonts.bodySemiBold,
    fontSize: 12,
    color: colors.primary,
  },
});
