export function applyAdminHeaderTheme(colorToUse) {
  const headerEl = document.querySelector('header.admin-header');
  if (!colorToUse || !/^#[0-9A-Fa-f]{6}$/.test(String(colorToUse).trim())) {
    clearAdminHeaderTheme();
    return;
  }

  const bc = String(colorToUse).trim();
  const r = parseInt(bc.slice(1, 3), 16);
  const g = parseInt(bc.slice(3, 5), 16);
  const b = parseInt(bc.slice(5, 7), 16);
  const hoverR = Math.max(0, r - 22);
  const hoverG = Math.max(0, g - 22);
  const hoverB = Math.max(0, b - 22);
  const hoverHex = `#${[hoverR, hoverG, hoverB].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  if (headerEl) {
    headerEl.style.background = bc;
    headerEl.style.color = luminance < 0.5 ? '#ffffff' : '#222222';
  }

  document.documentElement.style.setProperty('--theme-primary-color', bc);
  document.documentElement.style.setProperty('--theme-primary-color-dark', hoverHex);
}

export function clearAdminHeaderTheme() {
  const headerEl = document.querySelector('header.admin-header');
  if (headerEl) {
    headerEl.style.background = '#ff6b00';
    headerEl.style.color = '#fff';
  }
  document.documentElement.style.removeProperty('--theme-primary-color');
  document.documentElement.style.removeProperty('--theme-primary-color-dark');
}
