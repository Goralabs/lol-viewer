/**
 * Theme Type Definitions - UI Redesign Phase 1
 *
 * Extended theme interface with design tokens.
 * All components should use these tokens via CSS variables.
 */

export interface Theme {
  /* ===========================================
   * THEME SWITCH COLORS
   * =========================================== */
  '--theme-switch-notch': string;
  '--theme-switch-bg': string;

  /* ===========================================
   * BRAND & IDENTITY COLORS
   * =========================================== */
  '--logo-color': string;

  /* ===========================================
   * SURFACE COLORS
   * =========================================== */
  '--card-color': string;
  '--background': string;
  '--gray-line': string;

  /* ===========================================
   * TEXT COLORS
   * =========================================== */
  '--text': string;
  '--text-secondary': string;
  '--text-highlight': string;
  '--title': string;

  /* ===========================================
   * SEMANTIC COLORS
   * =========================================== */
  '--red': string;
  '--green': string;
  '--green-positive': string;
  '--blue': string;
  '--blue-dark': string;
  '--blue-twitter': string;

  /* ===========================================
   * EXTENDED SEMANTIC COLORS (New)
   * =========================================== */
  '--success': string;
  '--warning': string;
  '--error': string;
  '--info': string;

  /* ===========================================
   * SKELETON COLORS (New)
   * =========================================== */
  '--skeleton-base': string;
  '--skeleton-highlight': string;

  /* ===========================================
   * BORDER COLORS (New)
   * =========================================== */
  '--border-color': string;
  '--border-color-hover': string;

  /* ===========================================
   * OVERLAY COLORS (New)
   * =========================================== */
  '--overlay-light': string;
  '--overlay-dark': string;

  /* ===========================================
   * SHADOW COLORS (New)
   * =========================================== */
  '--shadow-color': string;

  /* ===========================================
   * INTERACTIVE COLORS (New)
   * =========================================== */
  '--hover-bg': string;
  '--active-bg': string;
  '--disabled-bg': string;
  '--disabled-text': string;

  /* ===========================================
   * GRADIENT COLORS (New)
   * =========================================== */
  '--gradient-blue-start': string;
  '--gradient-blue-end': string;
  '--gradient-red-start': string;
  '--gradient-red-end': string;

  /* ===========================================
   * LEGACY (for backward compatibility)
   * =========================================== */
  'background': string;
}
