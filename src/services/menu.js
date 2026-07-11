import { supabase } from '../lib/supabase';

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
