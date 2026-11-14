import { useMemo } from 'react';
import { useA11yStore } from '../store/a11yStore';

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

export type AppColors = typeof colors;

export const darkColors: AppColors = {
  // Paleta Noturna Oficial - Nicolle Neris Studio
  primary: '#8B5CF6',               // Violeta suave luminoso
  primaryContainer: '#3B1477',
  onPrimary: '#FFFFFF',

  violetDeep: '#381272',            // Fundo do banner do saldo (roxo bem nobre e escuro)
  violetRoyal: '#7C3AED',           // Destaques e gradientes elegantes
  violetAccent: '#A78BFA',          // Acentos vibrantes

  secondary: '#A1A1AA',
  secondaryContainer: '#27272A',

  tertiary: '#C4B5FD',
  tertiaryContainer: '#3B1477',

  lavenderTint: '#241A3D',          // Fundos de ícones e chips escuros
  lavenderSubtle: '#372F54',        // Bordas e detalhes delicados
  lavenderAccent: '#7C3AED',
  lavenderLight: '#181128',

  background: '#0B0914',            // Fundo geral do app (Dark Studio)
  surface: '#0B0914',
  surfaceCanvas: '#12101C',         // Dropzones e fundos secundários
  surfacePure: '#171424',           // Fundo dos cards (elegante, roxo-ardósia escuro)
  surfaceContainer: '#221D38',
  surfaceContainerLow: '#151322',
  surfaceContainerHigh: '#282342',
  surfaceContainerHighest: '#322C52',

  graphiteText: '#F5F3FF',          // Texto principal (branco lavanda suave)
  graphiteMuted: '#9E97B3',         // Texto secundário (legível, não apagado)
  onSurface: '#F5F3FF',
  onSurfaceVariant: '#9E97B3',

  borderWhisper: '#2A243D',         // Bordas refinadas escuras
  lavenderBorder: '#372F54',
  outlineVariant: '#2A243D',

  statusSuccess: '#34D399',
  statusSuccessBg: '#064E3B',
  statusWarning: '#FBBF24',
  statusWarningBg: '#291C07',
  statusError: '#F87171',
  statusErrorBg: '#450A0A',
};

export const highContrastLightColors: AppColors = {
  ...colors,
  primary: '#3B0764',
  primaryContainer: '#3B0764',
  onPrimary: '#FFFFFF',
  violetDeep: '#2E054E',
  violetRoyal: '#4C1D95',
  violetAccent: '#5B21B6',
  lavenderTint: '#EDE9FE',
  lavenderSubtle: '#4C1D95',
  background: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceCanvas: '#FFFFFF',
  surfacePure: '#FFFFFF',
  surfaceContainer: '#F3E8FF',
  graphiteText: '#000000',
  graphiteMuted: '#18181B',
  onSurface: '#000000',
  onSurfaceVariant: '#18181B',
  borderWhisper: '#000000',
  lavenderBorder: '#000000',
  outlineVariant: '#000000',
  statusSuccess: '#064E3B',
  statusWarning: '#78350F',
  statusError: '#7F1D1D',
};

export const highContrastDarkColors: AppColors = {
  ...darkColors,
  primary: '#E9D5FF',
  primaryContainer: '#581C87',
  onPrimary: '#000000',
  violetDeep: '#2E054E',
  violetRoyal: '#D8B4FE',
  violetAccent: '#F3E8FF',
  lavenderTint: '#2E1065',
  lavenderSubtle: '#E9D5FF',
  background: '#000000',
  surface: '#000000',
  surfaceCanvas: '#000000',
  surfacePure: '#09090B',
  surfaceContainer: '#18181B',
  graphiteText: '#FFFFFF',
  graphiteMuted: '#E4E4E7',
  onSurface: '#FFFFFF',
  onSurfaceVariant: '#E4E4E7',
  borderWhisper: '#FFFFFF',
  lavenderBorder: '#FFFFFF',
  outlineVariant: '#FFFFFF',
  statusSuccess: '#6EE7B7',
  statusWarning: '#FDE047',
  statusError: '#FCA5A5',
};

export const typography = {
  fonts: {
    headline: 'Roboto_700Bold',
    headlineBold: 'Roboto_700Bold',
    headlineRegular: 'Roboto_500Medium',
    body: 'Roboto_400Regular',
    bodyMedium: 'Roboto_500Medium',
    bodySemiBold: 'Roboto_600SemiBold',
    bodyBold: 'Roboto_700Bold',
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

export function useAppTheme() {
  const isDarkMode = useA11yStore((state) => state.isDarkMode);
  const highContrast = useA11yStore((state) => state.highContrast);
  const fontScale = useA11yStore((state) => state.fontScale);

  return useMemo(() => {
    let activeColors: AppColors;

    if (highContrast) {
      activeColors = isDarkMode ? highContrastDarkColors : highContrastLightColors;
    } else {
      activeColors = isDarkMode ? darkColors : colors;
    }

    const activeShadows = isDarkMode
      ? {
          card: {
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.45,
            shadowRadius: 12,
            elevation: 3,
          },
          elevated: {
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.55,
            shadowRadius: 20,
            elevation: 5,
          },
          fab: shadows.fab,
          banner: {
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.6,
            shadowRadius: 20,
            elevation: 6,
          },
        }
      : shadows;

    return {
      colors: activeColors,
      shadows: activeShadows,
      isDarkMode,
      highContrast,
      fontScale,
      borderWidth: highContrast ? 2 : 1,
      s: (size: number) => Math.round(size * fontScale),
    };
  }, [isDarkMode, highContrast, fontScale]);
}