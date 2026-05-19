import { ThemeType } from './ThemeContext'
import { Theme } from './Theme'

export const THEMES: Record<ThemeType, Theme> = {
  light: {
    /* ===========================================
     * THEME SWITCH COLORS
     * =========================================== */
    '--theme-switch-notch': "#5965E0",
    '--theme-switch-bg': "#E5E7EB",

    /* ===========================================
     * BRAND & IDENTITY COLORS
     * =========================================== */
    '--logo-color': "#0B0F19",

    /* ===========================================
     * SURFACE COLORS
     * =========================================== */
    '--card-color': "var(--glass-bg-light)",
    '--background': "#F4F6FA",
    '--gray-line': "#E5E7EB",

    /* ===========================================
     * TEXT COLORS
     * =========================================== */
    '--text': "#4B5563",
    '--text-secondary': "#9CA3AF",
    '--text-highlight': "#4F46E5",
    '--title': "#0B0F19",

    /* ===========================================
     * SEMANTIC COLORS (Team & Status)
     * =========================================== */
    '--red': "#DC2626",
    '--green': "#16A34A",
    '--green-positive': "#22C55E",
    '--blue': "#2563EB",
    '--blue-dark': "#1D4ED8",
    '--blue-twitter': "#1DA1F2",

    /* ===========================================
     * EXTENDED SEMANTIC COLORS (New)
     * =========================================== */
    '--success': "#16A34A",
    '--warning': "#D97706",
    '--error': "#DC2626",
    '--info': "#2563EB",

    /* ===========================================
     * SKELETON COLORS (New)
     * =========================================== */
    '--skeleton-base': "rgba(0, 0, 0, 0.05)",
    '--skeleton-highlight': "rgba(0, 0, 0, 0.1)",

    /* ===========================================
     * BORDER COLORS (New)
     * =========================================== */
    '--border-color': "var(--glass-border-light)",
    '--border-color-hover': "rgba(0, 0, 0, 0.12)",

    /* ===========================================
     * OVERLAY COLORS (New)
     * =========================================== */
    '--overlay-light': "rgba(255, 255, 255, 0.85)",
    '--overlay-dark': "rgba(0, 0, 0, 0.4)",

    /* ===========================================
     * SHADOW COLORS (New)
     * =========================================== */
    '--shadow-color': "rgba(0, 0, 0, 0.08)",

    /* ===========================================
     * INTERACTIVE COLORS (New)
     * =========================================== */
    '--hover-bg': "rgba(0, 0, 0, 0.03)",
    '--active-bg': "rgba(0, 0, 0, 0.06)",
    '--disabled-bg': "#E5E7EB",
    '--disabled-text': "#9CA3AF",

    /* ===========================================
     * GRADIENT COLORS (New)
     * =========================================== */
    '--gradient-blue-start': "#3B82F6",
    '--gradient-blue-end': "#1D4ED8",
    '--gradient-red-start': "#EF4444",
    '--gradient-red-end': "#B91C1C",

    /* ===========================================
     * LEGACY (for backward compatibility)
     * =========================================== */
    'background': "var(--background)",
  },
  dark: {
    /* ===========================================
     * THEME SWITCH COLORS
     * =========================================== */
    '--theme-switch-notch': "#00F2FE",
    '--theme-switch-bg': "#121824",

    /* ===========================================
     * BRAND & IDENTITY COLORS
     * =========================================== */
    '--logo-color': "#00F2FE",

    /* ===========================================
     * SURFACE COLORS
     * =========================================== */
    '--card-color': "var(--glass-bg)",
    '--background': "#070a13",
    '--gray-line': "rgba(255, 255, 255, 0.06)",

    /* ===========================================
     * TEXT COLORS
     * =========================================== */
    '--text': "#9EA8B6",
    '--text-secondary': "#64748B",
    '--text-highlight': "#00F2FE",
    '--title': "#FFFFFF",

    /* ===========================================
     * SEMANTIC COLORS (Team & Status)
     * =========================================== */
    '--red': "var(--neon-red)",
    '--green': "#00FF66",
    '--green-positive': "#00FF66",
    '--blue': "var(--neon-blue)",
    '--blue-dark': "var(--neon-blue-dark)",
    '--blue-twitter': "#1DA1F2",

    /* ===========================================
     * EXTENDED SEMANTIC COLORS (New)
     * =========================================== */
    '--success': "#10B981",
    '--warning': "#F59E0B",
    '--error': "#EF4444",
    '--info': "#3B82F6",

    /* ===========================================
     * SKELETON COLORS (New)
     * =========================================== */
    '--skeleton-base': "rgba(255, 255, 255, 0.05)",
    '--skeleton-highlight': "rgba(255, 255, 255, 0.1)",

    /* ===========================================
     * BORDER COLORS (New)
     * =========================================== */
    '--border-color': "var(--glass-border)",
    '--border-color-hover': "rgba(255, 255, 255, 0.15)",

    /* ===========================================
     * OVERLAY COLORS (New)
     * =========================================== */
    '--overlay-light': "rgba(255, 255, 255, 0.05)",
    '--overlay-dark': "rgba(0, 0, 0, 0.6)",

    /* ===========================================
     * SHADOW COLORS (New)
     * =========================================== */
    '--shadow-color': "rgba(0, 0, 0, 0.5)",

    /* ===========================================
     * INTERACTIVE COLORS (New)
     * =========================================== */
    '--hover-bg': "rgba(255, 255, 255, 0.04)",
    '--active-bg': "rgba(255, 255, 255, 0.08)",
    '--disabled-bg': "#0f172a",
    '--disabled-text': "#475569",

    /* ===========================================
     * GRADIENT COLORS (New)
     * =========================================== */
    '--gradient-blue-start': "var(--neon-blue)",
    '--gradient-blue-end': "var(--neon-blue-dark)",
    '--gradient-red-start': "var(--neon-red)",
    '--gradient-red-end': "var(--neon-red-dark)",

    /* ===========================================
     * LEGACY (for backward compatibility)
     * =========================================== */
    'background': "var(--background)",
  }
}
