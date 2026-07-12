/** Shared defaults so every new admin menu looks the same out of the box. */
export const DEFAULT_MENU_NAME = 'ZEN MENU';
export const DEFAULT_MENU_DESCRIPTION = 'Menu Without Menu Books';
export const DEFAULT_PRIMARY_COLOR = '#ff6b00';

export function isValidHexColor(value) {
  return typeof value === 'string' && /^#[0-9A-Fa-f]{6}$/.test(value.trim());
}

export function resolveThemeColor(...candidates) {
  for (const candidate of candidates) {
    if (isValidHexColor(candidate)) return String(candidate).trim();
  }
  return DEFAULT_PRIMARY_COLOR;
}
