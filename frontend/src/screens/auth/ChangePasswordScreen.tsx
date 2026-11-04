import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { authService } from '../../services/auth.service';
import { getApiErrorMessage } from '../../services/api';
import { colors, typography, borderRadius, shadows } from '../../theme/theme';
import { Button } from '../../components/ui/Button';

/** Mínimo exigido pelo backend (passwordSchema em auth.controller.ts). */
const MIN_PASSWORD_LENGTH = 12;

export default function ChangePasswordScreen() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const { setMustChangePassword, logout } = useAuthStore();

  async function handleChangePassword() {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Atenção', 'Preencha todos os campos.');
      return;
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      Alert.alert('Atenção', `A nova senha deve ter no mínimo ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }

    if (newPassword === currentPassword) {
      Alert.alert('Atenção', 'A nova senha precisa ser diferente da atual.');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Atenção', 'A confirmação de senha não confere.');
      return;
    }

    setLoading(true);
    try {
      const message = await authService.changePassword(currentPassword, newPassword);
      // Libera a navegação: enquanto a flag estiver ligada, a API responde 403 em
      // todas as rotas de negócio e o app fica preso nesta tela.
      setMustChangePassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Sucesso', message || 'Senha alterada.');
    } catch (error) {
      const msg = getApiErrorMessage(error);
      Alert.alert('Erro', msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.title}>Alteração de Senha</Text>
          <Text style={styles.subtitle}>
            Por motivos de segurança (política periódica de 90 dias ou primeiro acesso),
            defina uma nova senha para continuar.
          </Text>

          <Text style={styles.label}>Senha Atual</Text>
          <TextInput
            style={styles.input}
            placeholder="Sua senha atual"
            placeholderTextColor={colors.graphiteMuted}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
            editable={!loading}
          />

          <Text style={styles.label}>Nova Senha</Text>
          <TextInput
            style={styles.input}
            placeholder={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`}
            placeholderTextColor={colors.graphiteMuted}
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            editable={!loading}
          />

          <Text style={styles.label}>Confirmar Nova Senha</Text>
          <TextInput
            style={styles.input}
            placeholder="Repita a nova senha"
            placeholderTextColor={colors.graphiteMuted}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            editable={!loading}
          />

          <Button
            title="Salvar nova senha"
            variant="primary"
            loading={loading}
            onPress={handleChangePassword}
            style={styles.btn}
          />

          <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
            <Text style={styles.logoutText}>Sair da conta</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    padding: 28,
    borderWidth: 1,
    borderColor: colors.borderWhisper,
    ...shadows.card,
  },
  title: {
    fontFamily: typography.fonts.headlineBold,
    fontSize: 24,
    color: colors.graphiteText,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: typography.fonts.body,
    fontSize: 13,
    color: colors.graphiteMuted,
    textAlign: 'center',
    marginVertical: 14,
    lineHeight: 20,
  },
  label: {
    fontFamily: typography.fonts.bodySemiBold,
    fontSize: 13,
    color: colors.graphiteText,
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    backgroundColor: colors.surfaceCanvas,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderWhisper,
    color: colors.graphiteText,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: typography.fonts.body,
    fontSize: 14,
    marginBottom: 10,
  },
  btn: {
    marginTop: 16,
    marginBottom: 12,
  },
  logoutBtn: {
    alignSelf: 'center',
    marginTop: 12,
  },
  logoutText: {
    fontFamily: typography.fonts.bodySemiBold,
    color: colors.statusError,
    fontSize: 14,
  },
});
