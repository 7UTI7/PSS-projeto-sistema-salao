import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { useAuthStore } from '../store/authStore';
import { useGoalStore } from '../store/goalStore';
import {
  AuthStackParamList,
  MainTabParamList,
  RootStackParamList,
} from './types';

// Telas Auth
import LoginScreen from '../screens/auth/LoginScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import ChangePasswordScreen from '../screens/auth/ChangePasswordScreen';

// Telas Main
import DashboardScreen from '../screens/main/DashboardScreen';
import TransactionsScreen from '../screens/main/TransactionsScreen';
import ReportsScreen from '../screens/main/ReportsScreen';
import ImportsScreen from '../screens/main/ImportsScreen';
import NewTransactionScreen from '../screens/main/NewTransactionScreen';
import ImportHistoryScreen from '../screens/main/ImportHistoryScreen';
import SettingsScreen from '../screens/main/SettingsScreen';

// Telas de Ajustes
import TeamScreen from '../screens/settings/TeamScreen';
import CategoriesScreen from '../screens/settings/CategoriesScreen';

import { colors, typography } from '../theme/theme';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const MainTab = createBottomTabNavigator<MainTabParamList>();

/** Ícone de cada aba, no par preenchido/contorno. */
const TAB_ICONS: Record<keyof MainTabParamList, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
  Dashboard: ['apps', 'apps-outline'],
  Transactions: ['receipt', 'receipt-outline'],
  Reports: ['analytics', 'analytics-outline'],
  Imports: ['cloud-upload', 'cloud-upload-outline'],
};

const stackHeaderOptions = {
  headerShown: true,
  headerTintColor: colors.primary,
  headerStyle: { backgroundColor: colors.background },
  headerTitleStyle: {
    fontFamily: typography.fonts.headline,
    fontSize: 18,
    color: colors.graphiteText,
  },
  headerShadowVisible: false,
} as const;

function AuthNavigator() {
  return (
    <AuthStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.primary,
        headerTitleStyle: {
          fontFamily: typography.fonts.headline,
          fontSize: 18,
          color: colors.graphiteText,
        },
        headerShadowVisible: false,
      }}
    >
      <AuthStack.Screen
        name="Login"
        component={LoginScreen}
        options={{ headerShown: false }}
      />
      <AuthStack.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreen}
        options={{ title: 'Recuperar Senha' }}
      />
      <AuthStack.Screen
        name="ChangePassword"
        component={ChangePasswordScreen}
        options={{ title: 'Alterar Senha' }}
      />
    </AuthStack.Navigator>
  );
}

function MainNavigator() {
  return (
    <MainTab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false, // O topo é controlado pelo StudioTopHeader dos protótipos
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: colors.borderWhisper,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 6,
          paddingTop: 6,
        },
        tabBarActiveTintColor: colors.violetRoyal,
        tabBarInactiveTintColor: colors.graphiteMuted,
        tabBarLabelStyle: {
          fontFamily: typography.fonts.bodySemiBold,
          fontSize: 10,
          marginTop: -2,
        },
        tabBarIcon: ({ focused }) => {
          const [filled, outline] = TAB_ICONS[route.name] ?? ['apps', 'apps-outline'];

          if (focused) {
            return (
              <View style={styles.activePill}>
                <Ionicons name={filled} size={19} color={colors.primary} />
              </View>
            );
          }

          return <Ionicons name={outline} size={21} color={colors.graphiteMuted} />;
        },
      })}
    >
      <MainTab.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Painel' }} />
      <MainTab.Screen
        name="Transactions"
        component={TransactionsScreen}
        options={{ title: 'Lançamentos' }}
      />
      <MainTab.Screen name="Reports" component={ReportsScreen} options={{ title: 'Relatórios' }} />
      <MainTab.Screen name="Imports" component={ImportsScreen} options={{ title: 'Importar' }} />
    </MainTab.Navigator>
  );
}

export default function AppNavigator() {
  const loadGoal = useGoalStore((state) => state.loadGoal);
  const { isAuthenticated, mustChangePassword, isLoading, loadSession } =
    useAuthStore();

  useEffect(() => {
    loadSession();
    // A meta mora no aparelho; ler junto da sessão evita a barra de progresso piscar o
    // valor padrão antes do que ela definiu.
    void loadGoal();
  }, [loadSession, loadGoal]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <RootStack.Screen name="Auth" component={AuthNavigator} />
        ) : mustChangePassword ? (
          // Com a troca pendente a API responde 403 em tudo, então nem vale abrir o app.
          <RootStack.Screen
            name="ChangePasswordMandatory"
            component={ChangePasswordScreen}
          />
        ) : (
          <>
            <RootStack.Screen name="Main" component={MainNavigator} />
            <RootStack.Screen
              name="NewTransaction"
              component={NewTransactionScreen}
              options={{
                presentation: 'modal',
                animation: 'slide_from_bottom',
              }}
            />
            <RootStack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{ ...stackHeaderOptions, title: 'Ajustes do Studio' }}
            />
            <RootStack.Screen
              name="Team"
              component={TeamScreen}
              options={{ ...stackHeaderOptions, title: 'Equipe' }}
            />
            <RootStack.Screen
              name="Categories"
              component={CategoriesScreen}
              options={{ ...stackHeaderOptions, title: 'Categorias' }}
            />
            <RootStack.Screen
              name="ImportHistory"
              component={ImportHistoryScreen}
              options={{ ...stackHeaderOptions, title: 'Importações' }}
            />
          </>
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activePill: {
    width: 40,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.lavenderTint,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
});
