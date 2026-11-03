export const colors = {
  // Paleta Oficial - Nicolle Neris Studio (Protótipo Figma)
  primary: '#5B21B6',               // Deep Violet
  primaryContainer: '#5B21B6',
  onPrimary: '#FFFFFF',
  
  violetDeep: '#4C1D95',            // Início do gradiente escuro
  violetRoyal: '#6D28D9',           // Meio do gradiente e destaques
  violetAccent: '#7C3AED',          // Acento vibrante
  
  secondary: '#5F5A7C',
  secondaryContainer: '#DCD5FD',
  
  tertiary: '#362866',
  tertiaryContainer: '#4D407F',
  
  // Tons de Lavanda
  lavenderTint: '#EDE9FE',          // Fundos de ícones e chips
  lavenderSubtle: '#DDD6FE',        // Bordas e destaques delicados
  lavenderAccent: '#C4B5FD',        // Gráfico e pips ativos
  lavenderLight: '#F5F3FF',
  
  // Superfícies & Backgrounds
  background: '#FBF8FC',            // Fundo da aplicação
  surface: '#FBF8FC',
  surfaceCanvas: '#FAF7FD',         // Camada de fundo de dropzones e áreas internas
  surfacePure: '#FFFFFF',           // Fundo de cards elevados
  surfaceContainer: '#F5F3FF',
  surfaceContainerLow: '#F6F2F7',
  surfaceContainerHigh: '#EAE7EB',
  surfaceContainerHighest: '#E4E1E6',
  
  // Textos & Neutros
  graphiteText: '#18181B',          // Texto principal (headings, números)
  graphiteMuted: '#52525B',         // Texto secundário (legendas, rótulos)
  onSurface: '#18181B',
  onSurfaceVariant: '#52525B',
  
  // Bordas Estruturais
  borderWhisper: '#E4DEF4',         // Bordas refinadas translúcidas
  lavenderBorder: '#E4DEF4',
  outlineVariant: '#E4DEF4',
  
  // Tons Semânticos
  statusSuccess: '#15803D',
  statusSuccessBg: '#DCFCE7',
  statusWarning: '#B45309',
  statusWarningBg: '#FEF3C7',
  statusError: '#B91C1C',
  statusErrorBg: '#FEE2E2',
};

export const typography = {
  fonts: {
    headline: 'BodoniModa_600SemiBold',
    headlineBold: 'BodoniModa_700Bold',
    headlineRegular: 'BodoniModa_400Regular',
    body: 'Manrope_400Regular',
    bodyMedium: 'Manrope_500Medium',
    bodySemiBold: 'Manrope_600SemiBold',
    bodyBold: 'Manrope_700Bold',
  },
  sizes: {
    labelSm: 11,
    labelLg: 13,
    bodySm: 12,
    bodyMd: 14,
    bodyLg: 16,
    titleMd: 16,
    titleLg: 18,
    headlineSm: 20,
    headlineMd: 24,
    headlineLg: 28,
    displayLg: 36,
  },
};

export const borderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
};

export const shadows = {
  card: {
    shadowColor: '#5B21B6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 2,
  },
  elevated: {
    shadowColor: '#5B21B6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 4,
  },
  fab: {
    shadowColor: '#6D28D9',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 6,
  },
  banner: {
    shadowColor: '#4C1D95',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 6,
  },
};
