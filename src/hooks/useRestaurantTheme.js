import { useEffect, useState } from 'react';
import { fetchMenuTheme } from '../services/menu';
import { applyThemeColors, clearThemeColors } from '../utils/theme';
import {
  DEFAULT_MENU_DESCRIPTION,
  DEFAULT_MENU_NAME,
  DEFAULT_PRIMARY_COLOR,
  resolveThemeColor,
} from '../utils/menuThemeDefaults';

function buildDefaultTheme() {
  const headerTheme = applyThemeColors(DEFAULT_PRIMARY_COLOR);
  return {
    menuName: DEFAULT_MENU_NAME,
    menuDescription: DEFAULT_MENU_DESCRIPTION,
    headerStyle: {
      background: headerTheme.headerBackground,
      color: headerTheme.headerColor,
    },
    descriptionStyle: { color: headerTheme.descriptionColor },
  };
}

const DEFAULT_THEME = buildDefaultTheme();

export function useRestaurantTheme(adminId, { applyHeader = false } = {}) {
  const [theme, setTheme] = useState(DEFAULT_THEME);

  useEffect(() => {
    if (!adminId) {
      setTheme(buildDefaultTheme());
      if (applyHeader) clearThemeColors();
      return;
    }

    let cancelled = false;

    async function loadTheme() {
      try {
        const data = await fetchMenuTheme(adminId);
        if (cancelled) return;

        const menuName = data?.menu_name?.trim() ? String(data.menu_name) : DEFAULT_MENU_NAME;
        const menuDescription = data?.menu_description?.trim()
          ? String(data.menu_description)
          : DEFAULT_MENU_DESCRIPTION;
        const colorToUse = resolveThemeColor(data?.user_side_color, data?.button_color);

        let headerStyle = {};
        let descriptionStyle = {};

        const headerTheme = applyThemeColors(colorToUse);
        if (applyHeader && headerTheme) {
          headerStyle = {
            background: headerTheme.headerBackground,
            color: headerTheme.headerColor,
          };
          descriptionStyle = { color: headerTheme.descriptionColor };
        }

        setTheme({
          menuName,
          menuDescription,
          headerStyle,
          descriptionStyle,
        });
      } catch {
        if (!cancelled) {
          setTheme(buildDefaultTheme());
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
