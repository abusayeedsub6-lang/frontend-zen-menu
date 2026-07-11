export function buildCategoryOrderMap(categories) {
  const categoryOrder = {};
  categories.forEach((category) => {
    categoryOrder[category.name] =
      category.display_order !== null && category.display_order !== undefined
        ? category.display_order
        : 9999;
  });
  return categoryOrder;
}

export function filterAndGroupMenu(menu, { searchQuery = '', categoryFilter = null, categoryOrder = {} }) {
  let filteredMenu = menu;

  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    filteredMenu = filteredMenu.filter(
      (dish) =>
        dish.name.toLowerCase().includes(query) ||
        (dish.description && dish.description.toLowerCase().includes(query)),
    );
  }

  if (categoryFilter) {
    filteredMenu = filteredMenu.filter((dish) => dish.category === categoryFilter);
  }

  const dishesByCategory = {};
  filteredMenu.forEach((dish) => {
    const category = dish.category || 'Uncategorized';
    if (!dishesByCategory[category]) {
      dishesByCategory[category] = [];
    }
    dishesByCategory[category].push(dish);
  });

  const sortedCategories = Object.keys(dishesByCategory).sort((a, b) => {
    const orderA =
      categoryOrder[a] !== undefined
        ? categoryOrder[a]
        : (dishesByCategory[a][0]?.categoryDisplayOrder ?? 9999);
    const orderB =
      categoryOrder[b] !== undefined
        ? categoryOrder[b]
        : (dishesByCategory[b][0]?.categoryDisplayOrder ?? 9999);
    if (orderA !== orderB) return orderA - orderB;
    return a.localeCompare(b);
  });

  return { dishesByCategory, sortedCategories, filteredCount: filteredMenu.length };
}
