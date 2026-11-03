import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/types';
import { authService } from '../../services/auth.service';
import { useAuthStore } from '../../store/authStore';
import { getApiErrorMessage } from '../../services/api';
import { colors, typography, borderRadius, shadows } from '../../theme/theme';
import { Button } from '../../components/ui/Button';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((state) => state.setAuth);

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Atenção', 'Informe seu e-mail e sua senha.');
      return;
    }

    setLoading(true);
    try {
      const data = await authService.login(email.trim(), password);
      await setAuth(data.token, data.user, data.mustChangePassword);
    } catch (error) {
      const msg = getApiErrorMessage(error);
      Alert.alert('Erro no Login', msg);
    } finally {
      setLoading(false);
    }
  }

  // Permite visualizar todas as telas sem depender do backend
  function handleEnterDemo() {
    setAuth('demo-token-123', {
      _id: 'demo-user-id',
      name: 'Nicolle Neris',
      email: 'nicolle@studio.com',
      role: 'admin',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <View style={styles.brandContainer}>
            <View style={styles.logoPill}>
              <Text style={styles.logoPillText}>N</Text>
            </View>
            <Text style={styles.title}>Nicolle Neris Studio</Text>
            <Text style={styles.studioLabel}>ATELIER DE BELEZA</Text>
            <Text style={styles.subtitle}>Gestão Financeira & Retaguarda</Text>
          </View>

          <View style={styles.form}>
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

            <Text style={styles.label}>Senha</Text>
            <TextInput
              style={styles.input}
              placeholder="Sua senha"
              placeholderTextColor={colors.graphiteMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!loading}
            />

            <TouchableOpacity
              style={styles.forgotBtn}
              onPress={() => navigation.navigate('ForgotPassword', { email })}
            >
              <Text style={styles.forgotText}>Esqueceu a senha?</Text>
            </TouchableOpacity>

            <Button
              title="Entrar"
              variant="primary"
              loading={loading}
              onPress={handleLogin}
              style={styles.submitBtn}
            />

            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OU MODO VISUAL</Text>
              <View style={styles.dividerLine} />
            </View>

            <Button
              title="Ver Telas (Modo Demonstração)"
              variant="secondary"
              onPress={handleEnterDemo}
            />
          </View>
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
  brandContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoPill: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  logoPillText: {
    fontFamily: typography.fonts.headlineBold,
    fontSize: 24,
    color: '#FFFFFF',
  },
  title: {
    fontFamily: typography.fonts.headline,
    fontSize: 24,
    color: colors.graphiteText,
    textAlign: 'center',
  },
  studioLabel: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 2,
    color: colors.violetRoyal,
    marginTop: 3,
  },
  subtitle: {
    fontFamily: typography.fonts.body,
    fontSize: 12,
    color: colors.graphiteMuted,
    textAlign: 'center',
    marginTop: 4,
  },
  form: {
    width: '100%',
  },
  label: {
    fontFamily: typography.fonts.bodySemiBold,
    fontSize: 12,
    color: colors.graphiteText,
    marginBottom: 5,
  },
  input: {
    backgroundColor: colors.surfaceCanvas,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderWhisper,
    color: colors.graphiteText,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontFamily: typography.fonts.body,
    fontSize: 14,
    marginBottom: 14,
  },
  forgotBtn: {
    alignSelf: 'flex-end',
    marginBottom: 18,
  },
  forgotText: {
    fontFamily: typography.fonts.bodyMedium,
    color: colors.primary,
    fontSize: 12,
  },
  submitBtn: {
    marginBottom: 12,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.borderWhisper,
  },
  dividerText: {
    fontFamily: typography.fonts.bodySemiBold,
    fontSize: 10,
    color: colors.graphiteMuted,
    letterSpacing: 1,
    marginHorizontal: 10,
  },
});
