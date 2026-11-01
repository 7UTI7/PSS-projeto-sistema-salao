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
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/types';
import { authService } from '../../services/auth.service';
import { getApiErrorMessage } from '../../services/api';
import { colors, typography, borderRadius, shadows } from '../../theme/theme';
import { Button } from '../../components/ui/Button';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export default function ForgotPasswordScreen({ route, navigation }: Props) {
  const [email, setEmail] = useState(route.params?.email || '');
  const [loading, setLoading] = useState(false);

  async function handleResetRequest() {
    if (!email.trim()) {
      Alert.alert('Atenção', 'Informe seu e-mail cadastrado.');
      return;
    }

    setLoading(true);
    try {
      const message = await authService.forgotPassword(email.trim());
      Alert.alert('Sucesso', message, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
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
      <View style={styles.card}>
        <Text style={styles.title}>Recuperar Senha</Text>
        <Text style={styles.subtitle}>
          Enviaremos um link seguro para o seu e-mail para redefinição da sua senha.
        </Text>

        <Text style={styles.label}>E-mail</Text>
        <TextInput
          style={styles.input}
          placeholder="seu.email@exemplo.com"
          placeholderTextColor={colors.graphiteMuted}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          editable={!loading}
        />

        <Button
          title="Enviar link de recuperação"
          variant="primary"
          loading={loading}
          onPress={handleResetRequest}
          style={styles.btn}
        />

        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backText}>Voltar para o Login</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
    marginBottom: 20,
  },
  btn: {
    marginBottom: 12,
  },
  backBtn: {
    alignSelf: 'center',
    marginTop: 12,
  },
  backText: {
    fontFamily: typography.fonts.bodySemiBold,
    color: colors.primary,
    fontSize: 14,
  },
});
