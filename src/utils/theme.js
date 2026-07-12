import {
  DEFAULT_MENU_DESCRIPTION,
  DEFAULT_MENU_NAME,
  DEFAULT_PRIMARY_COLOR,
  isValidHexColor,
  resolveThemeColor,
} from './menuThemeDefaults';

export {
  DEFAULT_MENU_DESCRIPTION,
  DEFAULT_MENU_NAME,
  DEFAULT_PRIMARY_COLOR,
  isValidHexColor,
  resolveThemeColor,
};

export function applyThemeColors(hexColor) {
  const bc = resolveThemeColor(hexColor);

  const r = parseInt(bc.slice(1, 3), 16);
  const g = parseInt(bc.slice(3, 5), 16);
  const b = parseInt(bc.slice(5, 7), 16);
  const hoverR = Math.max(0, r - 22);
  const hoverG = Math.max(0, g - 22);
  const hoverB = Math.max(0, b - 22);
  const hoverHex = `#${[hoverR, hoverG, hoverB].map((x) => x.toString(16).padStart(2, '0')).join('')}`;

  document.documentElement.style.setProperty('--theme-button-bg', bc);
  document.documentElement.style.setProperty('--theme-button-hover', hoverHex);
  document.documentElement.style.setProperty('--theme-primary-color', bc);
  document.documentElement.style.setProperty('--theme-primary-color-dark', hoverHex);

  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return {
    headerBackground: bc,
    headerColor: luminance < 0.5 ? '#ffffff' : '#222222',
    descriptionColor: luminance < 0.5 ? 'rgba(255,255,255,0.9)' : '#666666',
  };
}

export function clearThemeColors() {
  // Restore shared defaults instead of leaving an unstyled white header
  applyThemeColors(DEFAULT_PRIMARY_COLOR);
}
