import { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  Login: undefined;
  ForgotPassword: { email?: string } | undefined;
  ChangePassword: { isMandatory?: boolean } | undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  Transactions: undefined;
  NewTransaction: { transactionId?: string } | undefined;
  Reports: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
  ChangePasswordMandatory: undefined;
};
