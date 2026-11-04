import { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  Login: undefined;
  ForgotPassword: { email?: string } | undefined;
  ChangePassword: { isMandatory?: boolean } | undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  Transactions: undefined;
  Reports: undefined;
  Imports: undefined;
  Inventory: undefined;
};

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
  /** Sem transactionId é um lançamento novo; com, é edição do existente. */
  NewTransaction: { transactionId?: string } | undefined;
  Settings: undefined;
  Team: undefined;
  Categories: undefined;
  ChangePasswordMandatory: undefined;
};
