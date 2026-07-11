export function applyStaffTheme(colorToUse) {
  if (!colorToUse) return;

  const bc = String(colorToUse).trim();
  if (!/^#[0-9A-Fa-f]{6}$/.test(bc)) return;

  const r = parseInt(bc.slice(1, 3), 16);
  const g = parseInt(bc.slice(3, 5), 16);
  const b = parseInt(bc.slice(5, 7), 16);
  const hoverR = Math.max(0, r - 22);
  const hoverG = Math.max(0, g - 22);
  const hoverB = Math.max(0, b - 22);
  const hoverHex = `#${[hoverR, hoverG, hoverB].map((x) => x.toString(16).padStart(2, '0')).join('')}`;

  document.documentElement.style.setProperty('--theme-primary-color', bc);
  document.documentElement.style.setProperty('--theme-primary-color-dark', hoverHex);
}

export function clearStaffTheme() {
  document.documentElement.style.removeProperty('--theme-primary-color');
  document.documentElement.style.removeProperty('--theme-primary-color-dark');
}
