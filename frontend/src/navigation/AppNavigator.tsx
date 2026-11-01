import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { useAuthStore } from '../store/authStore';
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
import InventoryScreen from '../screens/main/InventoryScreen';
import ReportsScreen from '../screens/main/ReportsScreen';
import NewTransactionScreen from '../screens/main/NewTransactionScreen';
import SettingsScreen from '../screens/main/SettingsScreen';

import { colors, typography } from '../theme/theme';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const MainTab = createBottomTabNavigator<MainTabParamList>();

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
          fontSize: 11,
          marginTop: -2,
        },
        tabBarIcon: ({ focused }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'apps-outline';

          if (route.name === 'Dashboard') {
            iconName = focused ? 'apps' : 'apps-outline';
          } else if (route.name === 'Transactions') {
            iconName = focused ? 'receipt' : 'receipt-outline';
          } else if (route.name === 'Inventory') {
            iconName = focused ? 'cube' : 'cube-outline';
          } else if (route.name === 'Reports') {
            iconName = focused ? 'analytics' : 'analytics-outline';
          }

          if (focused) {
            return (
              <View style={styles.activePill}>
                <Ionicons name={iconName} size={19} color={colors.primary} />
              </View>
            );
          }

          return (
            <Ionicons name={iconName} size={21} color={colors.graphiteMuted} />
          );
        },
      })}
    >
      <MainTab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ title: 'Dashboard' }}
      />
      <MainTab.Screen
        name="Transactions"
        component={TransactionsScreen}
        options={{ title: 'Transações' }}
      />
      <MainTab.Screen
        name="Inventory"
        component={InventoryScreen}
        options={{ title: 'Estoque' }}
      />
      <MainTab.Screen
        name="Reports"
        component={ReportsScreen}
        options={{ title: 'Relatórios' }}
      />
    </MainTab.Navigator>
  );
}

export default function AppNavigator() {
  const { isAuthenticated, mustChangePassword, isLoading, loadSession } =
    useAuthStore();

  useEffect(() => {
    loadSession();
  }, [loadSession]);

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
              options={{
                headerShown: true,
                title: 'Ajustes do Studio',
                headerTintColor: colors.primary,
                headerStyle: { backgroundColor: colors.background },
                headerTitleStyle: {
                  fontFamily: typography.fonts.headline,
                  fontSize: 18,
                  color: colors.graphiteText,
                },
              }}
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
