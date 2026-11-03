import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { colors, typography, borderRadius, shadows } from '../../theme/theme';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';

export default function SettingsScreen() {
  const { user, logout } = useAuthStore();

  function handleLogout() {
    Alert.alert('Sair da Conta', 'Deseja realmente encerrar sua sessão?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: () => logout() },
    ]);
  }

  function handleFeatureInfo(title: string) {
    Alert.alert(title, 'Configuração disponível na versão final do sistema.');
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
            {user?.name ? user.name.slice(0, 2).toUpperCase() : 'NN'}
          </Text>
        </View>

        <Text style={styles.userName}>{user?.name || 'Nicolle Neris'}</Text>
        <Text style={styles.userEmail}>{user?.email || 'contato@nicolle.com'}</Text>

        <Badge
          label={user?.role === 'admin' ? 'ADMINISTRADORA DO STUDIO' : 'COLABORADORA'}
          variant="secondary"
          style={styles.roleBadge}
        />
      </Card>

      {/* Grupo de Configurações Operacionais */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Gestão do Atelier</Text>
      </View>

      <Card style={styles.menuCard}>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => handleFeatureInfo('Taxas de Maquininha')}
        >
          <View style={styles.menuIconBox}>
            <Ionicons name="card-outline" size={20} color={colors.primary} />
          </View>
          <View style={styles.menuContent}>
            <Text style={styles.menuLabel}>Taxas de Maquininhas & Cartão</Text>
            <Text style={styles.menuSub}>Débito, crédito à vista e parcelado</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.graphiteMuted} />
        </TouchableOpacity>

        <View style={styles.menuDivider} />

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => handleFeatureInfo('Regras de Comissão')}
        >
          <View style={styles.menuIconBox}>
            <Ionicons name="pie-chart-outline" size={20} color={colors.primary} />
          </View>
          <View style={styles.menuContent}>
            <Text style={styles.menuLabel}>Regras de Comissionamento</Text>
            <Text style={styles.menuSub}>Percentual padrão e por serviço</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.graphiteMuted} />
        </TouchableOpacity>

        <View style={styles.menuDivider} />

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => handleFeatureInfo('Equipe & Especialistas')}
        >
          <View style={styles.menuIconBox}>
            <Ionicons name="people-outline" size={20} color={colors.primary} />
          </View>
          <View style={styles.menuContent}>
            <Text style={styles.menuLabel}>Equipe & Especialistas</Text>
            <Text style={styles.menuSub}>Cadastrar colaboradoras e permissões</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.graphiteMuted} />
        </TouchableOpacity>
      </Card>

      {/* Botão de Logout */}
      <View style={styles.logoutContainer}>
        <Button
          title="Encerrar Sessão"
          variant="danger"
          icon={<Ionicons name="log-out-outline" size={18} color="#FFFFFF" />}
          onPress={handleLogout}
        />
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
});
