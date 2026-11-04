import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store/authStore';
import { useGoalStore } from '../../store/goalStore';
import { DEFAULT_API_URL } from '../../services/api';
import { formatCurrency, parseAmountInput } from '../../utils/formatters';
import { colors, typography } from '../../theme/theme';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';

export default function SettingsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, logout } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const monthlyGoal = useGoalStore((state) => state.goal);
  const setGoal = useGoalStore((state) => state.setGoal);
  // null = mostrando o valor; string = ela está editando.
  const [goalDraft, setGoalDraft] = useState<string | null>(null);

  function handleLogout() {
    Alert.alert('Sair da Conta', 'Deseja realmente encerrar sua sessão?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: () => logout() },
    ]);
  }

  function handleSaveGoal() {
    const parsed = parseAmountInput(goalDraft ?? '');
    if (parsed <= 0) {
      Alert.alert('Meta inválida', 'Informe um valor maior que zero.');
      return;
    }
    setGoal(parsed);
    setGoalDraft(null);
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Ajustes & Perfil</Text>
        <Text style={styles.subtitle}>Preferências da conta e do atelier</Text>
      </View>

      {/* Card de Perfil */}
      <Card style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.name ? user.name.slice(0, 2).toUpperCase() : '--'}
          </Text>
        </View>

        <Text style={styles.userName}>{user?.name ?? '-'}</Text>
        <Text style={styles.userEmail}>{user?.email ?? '-'}</Text>

        <Badge
          label={isAdmin ? 'ADMINISTRADORA DO STUDIO' : 'COLABORADORA'}
          variant="secondary"
          style={styles.roleBadge}
        />
      </Card>

      {/* Grupo de Configurações Operacionais */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Gestão do Atelier</Text>
      </View>

      <Card style={styles.menuCard}>
        {isAdmin ? (
          <>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => navigation.navigate('Categories')}
            >
              <View style={styles.menuIconBox}>
                <Ionicons name="pricetags-outline" size={20} color={colors.primary} />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuLabel}>Catálogo de Categorias</Text>
                <Text style={styles.menuSub}>O que pode ser lançado como receita e despesa</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.graphiteMuted} />
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Team')}>
              <View style={styles.menuIconBox}>
                <Ionicons name="people-outline" size={20} color={colors.primary} />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuLabel}>Equipe & Especialistas</Text>
                <Text style={styles.menuSub}>Cadastrar colaboradoras e permissões</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.graphiteMuted} />
            </TouchableOpacity>

            <View style={styles.menuDivider} />
          </>
        ) : null}

        {/* META DO MÊS: o único parâmetro que ela edita. Fica guardada no aparelho. */}
        <View style={styles.menuItem}>
          <View style={styles.menuIconBox}>
            <Ionicons name="flag-outline" size={20} color={colors.primary} />
          </View>
          <View style={styles.menuContent}>
            <Text style={styles.menuLabel}>Meta do mês</Text>

            {goalDraft === null ? (
              <Text style={styles.menuSub}>
                {formatCurrency(monthlyGoal)} de faturamento
              </Text>
            ) : (
              <View style={styles.goalEditRow}>
                <TextInput
                  style={styles.goalInput}
                  value={goalDraft}
                  onChangeText={setGoalDraft}
                  keyboardType="decimal-pad"
                  placeholder="5.000,00"
                  placeholderTextColor={colors.graphiteMuted}
                  autoFocus
                />
                <TouchableOpacity
                  style={styles.goalSaveBtn}
                  activeOpacity={0.8}
                  onPress={handleSaveGoal}
                >
                  <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.goalCancelBtn}
                  activeOpacity={0.8}
                  onPress={() => setGoalDraft(null)}
                >
                  <Ionicons name="close" size={16} color={colors.graphiteMuted} />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {goalDraft === null ? (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setGoalDraft(String(monthlyGoal).replace('.', ','))}
            >
              <Ionicons name="create-outline" size={20} color={colors.primary} />
            </TouchableOpacity>
          ) : null}
        </View>
      </Card>

      {/* Botão de Logout */}
      <View style={styles.logoutContainer}>
        <Button
          title="Encerrar Sessão"
          variant="danger"
          icon={<Ionicons name="log-out-outline" size={18} color="#FFFFFF" />}
          onPress={handleLogout}
        />

        <Text style={styles.apiFooter}>API: {DEFAULT_API_URL}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
    fontFamily: typography.fonts.headlineBold,
    fontSize: 24,
    color: colors.graphiteText,
  },
  subtitle: {
    fontFamily: typography.fonts.body,
    fontSize: 12,
    color: colors.graphiteMuted,
    marginTop: 2,
  },
  profileCard: {
    alignItems: 'center',
    paddingVertical: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.borderWhisper,
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontFamily: typography.fonts.headlineBold,
    fontSize: 24,
    color: '#FFFFFF',
  },
  userName: {
    fontFamily: typography.fonts.headlineBold,
    fontSize: 20,
    color: colors.graphiteText,
  },
  userEmail: {
    fontFamily: typography.fonts.body,
    fontSize: 13,
    color: colors.graphiteMuted,
    marginTop: 2,
  },
  roleBadge: {
    marginTop: 12,
  },
  sectionHeader: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontFamily: typography.fonts.headline,
    fontSize: 16,
    color: colors.graphiteText,
  },
  menuCard: {
    padding: 6,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.borderWhisper,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  menuIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.lavenderTint,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  menuContent: {
    flex: 1,
  },
  menuLabel: {
    fontFamily: typography.fonts.bodySemiBold,
    fontSize: 14,
    color: colors.graphiteText,
  },
  menuSub: {
    fontFamily: typography.fonts.body,
    fontSize: 11,
    color: colors.graphiteMuted,
    marginTop: 2,
  },
  menuDivider: {
    height: 1,
    backgroundColor: colors.borderWhisper,
    marginHorizontal: 12,
  },
  logoutContainer: {
    marginTop: 4,
  },
  apiFooter: {
    fontFamily: typography.fonts.body,
    fontSize: 10,
    color: colors.graphiteMuted,
    textAlign: 'center',
    marginTop: 14,
  },
  goalEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  goalInput: {
    flex: 1,
    backgroundColor: colors.surfaceCanvas,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontFamily: typography.fonts.body,
    fontSize: 13,
    color: colors.graphiteText,
  },
  goalSaveBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalCancelBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
