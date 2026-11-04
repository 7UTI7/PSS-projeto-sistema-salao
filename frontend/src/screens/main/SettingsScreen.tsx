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
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store/authStore';
import { DEFAULT_API_URL } from '../../services/api';
import { DEFAULT_COMMISSION_RATE, MONTHLY_REVENUE_GOAL } from '../../config/studio.config';
import { formatCurrency, formatPercent } from '../../utils/formatters';
import { colors, typography } from '../../theme/theme';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';

export default function SettingsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, logout } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  function handleLogout() {
    Alert.alert('Sair da Conta', 'Deseja realmente encerrar sua sessão?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: () => logout() },
    ]);
  }

  /**
   * Taxas e comissão ainda não tem cadastro na API: os valores sugeridos vivem em
   * src/config/studio.config.ts, e cada lançamento pode sobrescrevê-los na hora.
   */
  function handleLocalSetting(title: string, body: string) {
    Alert.alert(title, body);
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

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() =>
            handleLocalSetting(
              'Taxas de Maquininha',
              'As taxas sugeridas por forma de pagamento ficam em src/config/studio.config.ts. '
                + 'Em cada lançamento de receita você confirma ou ajusta a taxa, e o servidor '
                + 'recalcula os valores. Um cadastro de taxas na API ainda não existe.'
            )
          }
        >
          <View style={styles.menuIconBox}>
            <Ionicons name="card-outline" size={20} color={colors.primary} />
          </View>
          <View style={styles.menuContent}>
            <Text style={styles.menuLabel}>Taxas de Maquininhas & Cartão</Text>
            <Text style={styles.menuSub}>Sugestões locais · ajustáveis por lançamento</Text>
          </View>
          <Ionicons name="information-circle-outline" size={18} color={colors.graphiteMuted} />
        </TouchableOpacity>

        <View style={styles.menuDivider} />

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() =>
            handleLocalSetting(
              'Regras de Comissionamento',
              `A comissão padrão é de ${formatPercent(DEFAULT_COMMISSION_RATE, 0)} e a meta mensal `
                + `é de ${formatCurrency(MONTHLY_REVENUE_GOAL)}. Os dois valores ficam em `
                + 'src/config/studio.config.ts. Comissão por serviço e meta cadastrável '
                + 'dependem de um módulo que a API ainda não tem.'
            )
          }
        >
          <View style={styles.menuIconBox}>
            <Ionicons name="pie-chart-outline" size={20} color={colors.primary} />
          </View>
          <View style={styles.menuContent}>
            <Text style={styles.menuLabel}>Comissão & Meta do Mês</Text>
            <Text style={styles.menuSub}>
              {formatPercent(DEFAULT_COMMISSION_RATE, 0)} · meta de {formatCurrency(MONTHLY_REVENUE_GOAL)}
            </Text>
          </View>
          <Ionicons name="information-circle-outline" size={18} color={colors.graphiteMuted} />
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
});
