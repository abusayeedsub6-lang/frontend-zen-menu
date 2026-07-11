import { useEffect, useState } from 'react';
import { fetchMenuTheme } from '../services/menu';
import { applyThemeColors, clearThemeColors } from '../utils/theme';

const DEFAULT_THEME = {
  menuName: 'ZEN MENU',
  menuDescription: 'Menu Without Menu Books',
  headerStyle: {},
  descriptionStyle: {},
};

export function useRestaurantTheme(adminId, { applyHeader = false } = {}) {
  const [theme, setTheme] = useState(DEFAULT_THEME);

  useEffect(() => {
    if (!adminId) {
      setTheme(DEFAULT_THEME);
      if (applyHeader) clearThemeColors();
      return;
    }

    let cancelled = false;

    async function loadTheme() {
      try {
        const data = await fetchMenuTheme(adminId);
        if (cancelled) return;

        const menuName = data?.menu_name ? String(data.menu_name) : DEFAULT_THEME.menuName;
        const menuDescription = data?.menu_description
          ? String(data.menu_description)
          : DEFAULT_THEME.menuDescription;
        const colorToUse = data?.user_side_color || data?.button_color || null;

        let headerStyle = {};
        let descriptionStyle = {};

        if (colorToUse) {
          const headerTheme = applyThemeColors(String(colorToUse).trim());
          if (applyHeader && headerTheme) {
            headerStyle = {
              background: headerTheme.headerBackground,
              color: headerTheme.headerColor,
            };
            descriptionStyle = { color: headerTheme.descriptionColor };
          } else {
            applyThemeColors(String(colorToUse).trim());
          }
        } else if (applyHeader) {
          clearThemeColors();
        }

        setTheme({
          menuName,
          menuDescription,
          headerStyle,
          descriptionStyle,
        });
      } catch {
        if (!cancelled) {
          setTheme(DEFAULT_THEME);
          if (applyHeader) clearThemeColors();
        }
      }
    }

    loadTheme();

    return () => {
      cancelled = true;
    };
  }, [adminId, applyHeader]);

  return theme;
}
