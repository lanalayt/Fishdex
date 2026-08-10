// FishDex Color System — Dark-first, premium feel
// Deep navy + teal accents, inspired by water at dusk

export const colors = {
  // Core palette
  primary: '#0EA5E9',        // Bright sky blue — main actions
  primaryDark: '#0284C7',    // Deeper blue — pressed states
  accent: '#2DD4BF',         // Teal — success, highlights
  accentDark: '#14B8A6',     // Deeper teal

  // Backgrounds (dark theme)
  background: '#0B1120',     // Deep navy — main bg
  surface: '#131C2E',        // Slightly lighter — cards, inputs
  surfaceLight: '#1A2540',   // Elevated surfaces — modals, sheets
  border: '#1E3048',         // Subtle borders
  borderLight: '#2A3F5F',    // More visible borders

  // Text
  text: '#F1F5F9',           // Primary text — near white
  textSecondary: '#94A3B8',  // Secondary text — muted blue-gray
  textTertiary: '#64748B',   // Placeholder text
  textInverse: '#0B1120',    // Text on light backgrounds

  // Status
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#0EA5E9',

  // Tab bar
  tabBar: '#070D1A',         // Near black
  tabBarBorder: '#131C2E',
  tabIconDefault: '#475569',
  tabIconSelected: '#0EA5E9',

  // Misc
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(0, 0, 0, 0.6)',
};

// Spacing scale (4px base)
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

// Border radius
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

// Font sizes
export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
  hero: 34,
};

// Font weights
export const fontWeight = {
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

// Shadows (for iOS)
export const shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
};

// Legacy export for compatibility with template code
export default {
  light: {
    text: colors.text,
    background: colors.background,
    tint: colors.primary,
    tabIconDefault: colors.tabIconDefault,
    tabIconSelected: colors.tabIconSelected,
  },
  dark: {
    text: colors.text,
    background: colors.background,
    tint: colors.primary,
    tabIconDefault: colors.tabIconDefault,
    tabIconSelected: colors.tabIconSelected,
  },
};
