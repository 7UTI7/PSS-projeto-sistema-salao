import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { authService } from '../../services/auth.service';
import { getApiErrorMessage } from '../../services/api';

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
    <View style={styles.container}>
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
          value={oldPassword}
          onChangeText={setOldPassword}
          secureTextEntry
          editable={!loading}
        />

        <Text style={styles.label}>Nova Senha</Text>
        <TextInput
          style={styles.input}
          placeholder="Mínimo 8 caracteres"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          editable={!loading}
        />

        <Text style={styles.label}>Confirmar Nova Senha</Text>
        <TextInput
          style={styles.input}
          placeholder="Repita a nova senha"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          editable={!loading}
        />

        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleChangePassword}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>Salvar nova senha</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutText}>Sair da conta</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f8fafc',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    marginVertical: 12,
    lineHeight: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#cbd5e1',
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    color: '#f8fafc',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 10,
  },
  btn: {
    backgroundColor: '#0284c7',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  logoutBtn: {
    alignSelf: 'center',
    marginTop: 18,
  },
  logoutText: {
    color: '#ef4444',
    fontSize: 14,
  },
});
