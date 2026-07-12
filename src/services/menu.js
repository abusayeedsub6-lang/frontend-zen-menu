import { supabase } from '../lib/supabase';
import {
  DEFAULT_MENU_DESCRIPTION,
  DEFAULT_MENU_NAME,
  DEFAULT_PRIMARY_COLOR,
  isValidHexColor,
} from '../utils/menuThemeDefaults';

export async function fetchMenuTheme(adminId) {
  if (!supabase || !adminId) return null;

  const { data, error } = await supabase
    .from('menu_theme')
    .select('menu_name, menu_description, user_side_color, button_color')
    .eq('user_id', adminId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/** Create default theme for a new admin, or backfill missing colors/names. */
export async function ensureDefaultMenuTheme(userId) {
  if (!supabase || !userId) return null;

  const { data, error } = await supabase
    .from('menu_theme')
    .select('user_id, menu_name, menu_description, user_side_color, staff_side_color, admin_side_color, button_color')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;

  const defaults = {
    menu_name: DEFAULT_MENU_NAME,
    menu_description: DEFAULT_MENU_DESCRIPTION,
    user_side_color: DEFAULT_PRIMARY_COLOR,
    staff_side_color: DEFAULT_PRIMARY_COLOR,
    admin_side_color: DEFAULT_PRIMARY_COLOR,
  };

  if (!data) {
    const { data: inserted, error: insertError } = await supabase
      .from('menu_theme')
      .upsert({ user_id: userId, ...defaults }, { onConflict: 'user_id' })
      .select()
      .maybeSingle();
    if (insertError) throw insertError;
    return inserted;
  }

  const updates = {};
  if (!data.menu_name?.trim()) updates.menu_name = DEFAULT_MENU_NAME;
  if (!data.menu_description?.trim()) updates.menu_description = DEFAULT_MENU_DESCRIPTION;
  if (!isValidHexColor(data.user_side_color) && !isValidHexColor(data.button_color)) {
    updates.user_side_color = DEFAULT_PRIMARY_COLOR;
  }
  if (!isValidHexColor(data.staff_side_color)) updates.staff_side_color = DEFAULT_PRIMARY_COLOR;
  if (!isValidHexColor(data.admin_side_color) && !isValidHexColor(data.button_color)) {
    updates.admin_side_color = DEFAULT_PRIMARY_COLOR;
  }

  if (Object.keys(updates).length === 0) return data;

  const { data: updated, error: updateError } = await supabase
    .from('menu_theme')
    .update(updates)
    .eq('user_id', userId)
    .select()
    .maybeSingle();
  if (updateError) throw updateError;
  return updated;
}

export async function fetchCategories(adminId) {
  if (!supabase || !adminId) {
    throw new Error('admin_id is required to load categories');
  }

  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', adminId)
    .order('display_order', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function fetchDishes(adminId) {
  if (!supabase || !adminId) {
    throw new Error('admin_id is required to load dishes');
  }

  const { data, error } = await supabase
    .from('dishes')
    .select(`
      *,
      categories:category_id (
        id,
        name,
        display_order
      )
    `)
    .eq('user_id', adminId)
    .order('dish_name');

  if (error) throw error;

  return (data ?? []).map((dish) => ({
    ...dish,
    name: dish.dish_name,
    category: dish.categories?.name || '',
    categoryDisplayOrder:
      dish.categories?.display_order !== null && dish.categories?.display_order !== undefined
        ? dish.categories.display_order
        : 9999,
    image: dish.image_url,
    price: dish.price,
  }));
}

export async function hasRestaurantOrders(adminId) {
  if (!supabase || !adminId) return false;

  const { data, error } = await supabase
    .from('orders')
    .select('id')
    .eq('user_id', adminId)
    .limit(1);

  if (error) return false;
  return Boolean(data && data.length > 0);
}
