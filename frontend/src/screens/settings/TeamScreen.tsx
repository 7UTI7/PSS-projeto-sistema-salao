// Gestão de equipe: lista, cria e desativa contas (/auth/users). Só admin.
//
// A conta nasce com troca de senha obrigatória e só funciona depois que a pessoa
// confirma o e-mail — por isso a lista mostra "aguardando confirmação".
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, borderRadius, shadows } from '../../theme/theme';
import { AdminOnlyState, EmptyState, ErrorState, LoadingState } from '../../components/ui/QueryState';
import { useCreateUser, useDeactivateUser, useUsers } from '../../hooks/useUsers';
import { useIsAdmin } from '../../hooks/useReports';
import { useAuthStore } from '../../store/authStore';
import { getApiErrorMessage } from '../../services/api';
import { formatDate } from '../../utils/formatters';
import type { UserListItem, UserRole } from '../../types';

/** Mesma política do backend (passwordSchema em auth.controller.ts). */
const MIN_PASSWORD_LENGTH = 12;

const ROLES: { value: UserRole; label: string; hint: string }[] = [
  { value: 'colaborador', label: 'Colaboradora', hint: 'Registra apenas as próprias receitas' },
  { value: 'admin', label: 'Administradora', hint: 'Acesso total, relatórios e importações' },
];

export default function TeamScreen() {
  const isAdmin = useIsAdmin();
  const currentUserId = useAuthStore((state) => state.user?.id);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('colaborador');

  const usersQuery = useUsers();
  const createMutation = useCreateUser();
  const deactivateMutation = useDeactivateUser();

  function resetForm() {
    setName('');
    setEmail('');
    setPassword('');
    setRole('colaborador');
    setShowForm(false);
  }

  function handleCreate() {
    if (!name.trim() || name.trim().length < 2) {
      Alert.alert('Confira os dados', 'Informe o nome completo.');
      return;
    }
    if (!email.trim().includes('@')) {
      Alert.alert('Confira os dados', 'Informe um e-mail válido.');
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      Alert.alert(
        'Confira os dados',
        `A senha provisória precisa de no mínimo ${MIN_PASSWORD_LENGTH} caracteres.`
      );
      return;
    }

    createMutation.mutate(
      { name: name.trim(), email: email.trim(), password, role },
      {
        onSuccess: (message) => {
          resetForm();
          Alert.alert('Conta criada', message);
        },
        onError: (error) => Alert.alert('Não foi possível criar', getApiErrorMessage(error)),
      }
    );
  }

  function handleDeactivate(user: UserListItem) {
    Alert.alert(
      'Desativar conta',
      `${user.name} perderá o acesso ao app. Confirma?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desativar',
          style: 'destructive',
          onPress: () =>
            deactivateMutation.mutate(user.id, {
              onError: (error) => Alert.alert('Erro', getApiErrorMessage(error)),
            }),
        },
      ]
    );
  }

  if (!isAdmin) return <AdminOnlyState style={styles.fill} />;
  if (usersQuery.isPending) return <LoadingState label="Carregando a equipe..." style={styles.fill} />;
  if (usersQuery.isError) {
    return <ErrorState error={usersQuery.error} onRetry={usersQuery.refetch} style={styles.fill} />;
  }

  const users = usersQuery.data ?? [];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={usersQuery.isRefetching}
          onRefresh={() => void usersQuery.refetch()}
          tintColor={colors.primary}
        />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>Equipe & Especialistas</Text>
        <Text style={styles.subtitle}>
          Contas com acesso ao app. A colaboradora só enxerga e registra os próprios
          atendimentos.
        </Text>
      </View>

      {showForm ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Nova conta</Text>

          <Text style={styles.label}>Nome completo</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Ex: Stefany Mendes"
            placeholderTextColor={colors.graphiteMuted}
            maxLength={120}
          />

          <Text style={styles.label}>E-mail</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="nome@exemplo.com"
            placeholderTextColor={colors.graphiteMuted}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.label}>Senha provisória</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`}
            placeholderTextColor={colors.graphiteMuted}
            secureTextEntry
          />
          <Text style={styles.help}>
            Será exigida a troca no primeiro acesso. Combine a senha pessoalmente.
          </Text>

          <Text style={styles.label}>Perfil</Text>
          {ROLES.map((option) => {
            const isSelected = role === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                style={[styles.roleOption, isSelected && styles.roleOptionSelected]}
                activeOpacity={0.8}
                onPress={() => setRole(option.value)}
              >
                <Ionicons
                  name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                  size={18}
                  color={isSelected ? colors.primary : colors.graphiteMuted}
                />
                <View style={styles.roleTextCol}>
                  <Text style={styles.roleLabel}>{option.label}</Text>
                  <Text style={styles.roleHint}>{option.hint}</Text>
                </View>
              </TouchableOpacity>
            );
          })}

          <View style={styles.formActions}>
            <TouchableOpacity
              style={[styles.primaryBtn, createMutation.isPending && styles.btnDisabled]}
              activeOpacity={0.85}
              disabled={createMutation.isPending}
              onPress={handleCreate}
            >
              {createMutation.isPending ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.primaryBtnText}>Criar conta</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryBtn} activeOpacity={0.8} onPress={resetForm}>
              <Text style={styles.secondaryBtnText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.addBtn}
          activeOpacity={0.85}
          onPress={() => setShowForm(true)}
        >
          <Ionicons name="person-add-outline" size={18} color="#FFFFFF" />
          <Text style={styles.addBtnText}>Adicionar integrante</Text>
        </TouchableOpacity>
      )}

      {users.length === 0 ? (
        <EmptyState icon="people-outline" title="Nenhuma conta ativa" />
      ) : (
        users.map((user) => {
          const isCurrentUser = user.id === currentUserId;
          return (
            <View key={user.id} style={styles.userCard}>
              <View style={styles.userRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {user.name.trim().charAt(0).toUpperCase()}
                  </Text>
                </View>

                <View style={styles.userInfo}>
                  <Text style={styles.userName}>
                    {user.name}
                    {isCurrentUser ? ' (você)' : ''}
                  </Text>
                  <Text style={styles.userEmail}>{user.email}</Text>
                  <Text style={styles.userMeta}>Desde {formatDate(user.createdAt)}</Text>
                </View>

                <View
                  style={[
                    styles.rolePill,
                    user.role === 'admin' ? styles.rolePillAdmin : styles.rolePillStaff,
                  ]}
                >
                  <Text
                    style={[
                      styles.rolePillText,
                      { color: user.role === 'admin' ? colors.primary : colors.graphiteMuted },
                    ]}
                  >
                    {user.role === 'admin' ? 'Admin' : 'Colaboradora'}
                  </Text>
                </View>
              </View>

              <View style={styles.flagsRow}>
                {!user.emailVerified ? (
                  <View style={styles.flag}>
                    <Ionicons name="mail-unread-outline" size={13} color={colors.statusWarning} />
                    <Text style={[styles.flagText, { color: colors.statusWarning }]}>
                      Aguardando confirmação de e-mail
                    </Text>
                  </View>
                ) : null}

                {user.mustChangePassword ? (
                  <View style={styles.flag}>
                    <Ionicons name="key-outline" size={13} color={colors.graphiteMuted} />
                    <Text style={styles.flagText}>Trocará a senha no próximo acesso</Text>
                  </View>
                ) : null}
              </View>

              {/* A API recusa desativar a própria conta e o último admin. */}
              {!isCurrentUser ? (
                <TouchableOpacity
                  style={styles.deactivateBtn}
                  activeOpacity={0.7}
                  disabled={deactivateMutation.isPending}
                  onPress={() => handleDeactivate(user)}
                >
                  <Ionicons name="close-circle-outline" size={15} color={colors.statusError} />
                  <Text style={styles.deactivateText}>Desativar conta</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontFamily: typography.fonts.headline,
    fontSize: 22,
    color: colors.graphiteText,
  },
  subtitle: {
    fontFamily: typography.fonts.body,
    fontSize: 12,
    color: colors.graphiteMuted,
    marginTop: 4,
    lineHeight: 18,
  },
  addBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: 13,
    marginBottom: 16,
  },
  addBtnText: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 13,
    color: '#FFFFFF',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.borderWhisper,
    padding: 16,
    marginBottom: 16,
    ...shadows.card,
  },
  cardTitle: {
    fontFamily: typography.fonts.headline,
    fontSize: 16,
    color: colors.graphiteText,
    marginBottom: 12,
  },
  label: {
    fontFamily: typography.fonts.bodySemiBold,
    fontSize: 12,
    color: colors.graphiteText,
    marginBottom: 5,
    marginTop: 10,
  },
  input: {
    backgroundColor: colors.surfaceCanvas,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderWhisper,
    color: colors.graphiteText,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontFamily: typography.fonts.body,
    fontSize: 13,
  },
  help: {
    fontFamily: typography.fonts.body,
    fontSize: 10,
    color: colors.graphiteMuted,
    marginTop: 5,
    lineHeight: 15,
  },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.borderWhisper,
    borderRadius: borderRadius.md,
    padding: 11,
    marginBottom: 7,
  },
  roleOptionSelected: {
    borderColor: colors.lavenderSubtle,
    backgroundColor: colors.lavenderTint,
  },
  roleTextCol: {
    flex: 1,
  },
  roleLabel: {
    fontFamily: typography.fonts.bodySemiBold,
    fontSize: 13,
    color: colors.graphiteText,
  },
  roleHint: {
    fontFamily: typography.fonts.body,
    fontSize: 10,
    color: colors.graphiteMuted,
    marginTop: 1,
  },
  formActions: {
    marginTop: 14,
    gap: 8,
  },
  primaryBtn: {
    backgroundColor: colors.violetRoyal,
    borderRadius: borderRadius.md,
    paddingVertical: 13,
    alignItems: 'center',
  },
  primaryBtnText: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 13,
    color: '#FFFFFF',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  secondaryBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderWhisper,
    paddingVertical: 11,
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontFamily: typography.fonts.bodySemiBold,
    fontSize: 12,
    color: colors.graphiteMuted,
  },
  userCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.borderWhisper,
    padding: 13,
    marginBottom: 9,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.lavenderTint,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontFamily: typography.fonts.headlineBold,
    fontSize: 16,
    color: colors.primary,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontFamily: typography.fonts.bodySemiBold,
    fontSize: 13,
    color: colors.graphiteText,
  },
  userEmail: {
    fontFamily: typography.fonts.body,
    fontSize: 11,
    color: colors.graphiteMuted,
    marginTop: 1,
  },
  userMeta: {
    fontFamily: typography.fonts.body,
    fontSize: 10,
    color: colors.graphiteMuted,
    marginTop: 1,
  },
  rolePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.xs,
  },
  rolePillAdmin: {
    backgroundColor: colors.lavenderTint,
  },
  rolePillStaff: {
    backgroundColor: colors.surfaceContainer,
  },
  rolePillText: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  flagsRow: {
    gap: 5,
    marginTop: 9,
  },
  flag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  flagText: {
    fontFamily: typography.fonts.body,
    fontSize: 10,
    color: colors.graphiteMuted,
  },
  deactivateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 10,
    paddingTop: 9,
    borderTopWidth: 1,
    borderTopColor: colors.borderWhisper,
  },
  deactivateText: {
    fontFamily: typography.fonts.bodySemiBold,
    fontSize: 11,
    color: colors.statusError,
  },
});
