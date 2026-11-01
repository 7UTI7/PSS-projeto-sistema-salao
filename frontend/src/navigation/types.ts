import { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  Login: undefined;
  ForgotPassword: { email?: string } | undefined;
  ChangePassword: { isMandatory?: boolean } | undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  Transactions: undefined;
  Inventory: undefined;
  Reports: undefined;
};

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
  NewTransaction: { transactionId?: string } | undefined;
  Settings: undefined;
  ChangePasswordMandatory: undefined;
};
