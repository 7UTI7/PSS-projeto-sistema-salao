import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../../components/ui/Button';
import { colors, typography, borderRadius, shadows } from '../../theme/theme';
import { getApiErrorMessage } from '../../services/api';
import { authService } from '../../services/auth.service';
import type { RootStackParamList } from '../../navigation/types';
import { PASSWORD_HINT, passwordProblem } from '../../utils/password';

type Props = NativeStackScreenProps<RootStackParamList, 'ResetPassword'>;

export default function ResetPasswordScreen({ route }: Props) {
  const token = route.params?.token;
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  async function handleResetPassword() {
    if (!token) {
      setErrorMessage('Este link não contém um token válido. Solicite uma nova redefinição de senha.');
      return;
    }

    const problem = passwordProblem(password);
    if (problem) {
      setErrorMessage(problem);
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('A confirmação de senha não confere.');
      return;
    }

    setErrorMessage('');
    setLoading(true);
    try {
      await authService.resetPassword(token, password);
      setCompleted(true);
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title}>{completed ? 'Senha redefinida' : 'Criar nova senha'}</Text>
          <Text style={styles.subtitle}>
            {completed
              ? 'Sua senha foi alterada. Volte ao login e acesse sua conta com a nova senha.'
              : `Escolha uma senha forte (${PASSWORD_HINT}). O link é válido por 15 minutos e só pode ser usado uma vez.`}
          </Text>

          {!completed && token ? (
            <>
              <Text style={styles.label}>Nova senha</Text>
              <TextInput
                style={styles.input}
                placeholder={PASSWORD_HINT}
                placeholderTextColor={colors.graphiteMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={72}
                editable={!loading}
                returnKeyType="next"
              />

              <Text style={styles.label}>Confirmar nova senha</Text>
              <TextInput
                style={styles.input}
                placeholder="Digite a senha novamente"
                placeholderTextColor={colors.graphiteMuted}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={72}
                editable={!loading}
                returnKeyType="done"
                onSubmitEditing={() => void handleResetPassword()}
              />

              {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

              <Button
                title="Salvar nova senha"
                variant="primary"
                loading={loading}
                onPress={() => void handleResetPassword()}
                style={styles.button}
              />
            </>
          ) : null}

          {!completed && !token ? (
            <Text style={styles.error}>
              Este link é inválido. Solicite uma nova redefinição de senha pelo aplicativo.
            </Text>
          ) : null}
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
  button: {
    marginTop: 16,
  },
  error: {
    color: colors.statusError,
    fontFamily: typography.fonts.body,
    fontSize: 13,
    marginTop: 10,
  },
});
