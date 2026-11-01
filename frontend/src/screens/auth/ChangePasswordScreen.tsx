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

export default function ChangePasswordScreen() {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const { setMustChangePassword, logout } = useAuthStore();

  async function handleChangePassword() {
    if (!oldPassword || !newPassword || !confirmPassword) {
      Alert.alert('Atenção', 'Preencha todos os campos.');
      return;
    }

    if (newPassword.length < 8) {
      Alert.alert('Atenção', 'A nova senha deve ter no mínimo 8 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Atenção', 'A confirmação de senha não confere.');
      return;
    }

    setLoading(true);
    try {
      await authService.changePassword(oldPassword, newPassword);
      setMustChangePassword(false);
      Alert.alert('Sucesso', 'Senha alterada com sucesso!');
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
            value={oldPassword}
            onChangeText={setOldPassword}
            secureTextEntry
            editable={!loading}
          />

          <Text style={styles.label}>Nova Senha</Text>
          <TextInput
            style={styles.input}
            placeholder="Mínimo 8 caracteres"
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
