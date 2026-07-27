'use strict';

import { supabase } from '../../lib/supabase.js';
import { getAdminSession } from '../../services/adminAuth.js';
import {
  createAdminCategory,
  createAdminDish,
  createAdminStaffMember,
  deleteAdminCategory,
  deleteAdminDish,
  deleteAdminStaffMember,
  fetchAdminCategories,
  fetchAdminDishes,
  fetchAdminStaff,
  fetchAdminTheme,
  reorderAdminCategories,
  saveAdminTheme,
  updateAdminCategory,
  updateAdminDish,
} from '../../services/adminManage.js';

// Manage Menu Module — adapted for React (see admin/ManageMenuPage.jsx)

  // State variables
  let menu = [];
  let categories = [];
  let editingDishId = null;
  let editingCategoryId = null;

  function getSupabaseClient() {
    return supabase;
  }

  async function getCurrentUserId() {
    const session = getAdminSession();
    return session?.user?.id || null;
  }

  // ==================== SUPABASE DATA OPERATIONS ====================

  // Load categories from Supabase (filtered by user_id)
  async function loadCategories() {
    try {
      categories = await fetchAdminCategories();
      updateCategoryDropdown();
      if (document.getElementById('categoryTableBody')) {
        renderCategories();
      }
      return categories;
    } catch (error) {
      console.error('Error loading categories:', error);
      alert('Failed to load categories: ' + error.message);
      return [];
    }
  }

  // Load dishes from Supabase with category names (filtered by user_id)
  async function loadDishes() {
    try {
      menu = await fetchAdminDishes();
      const searchInput = document.getElementById('searchInput');
      if (searchInput) {
        renderMenu(searchInput.value.trim());
      }
      return menu;
    } catch (error) {
      console.error('Error loading dishes:', error);
      alert('Failed to load dishes: ' + error.message);
      return [];
    }
  }

  // Category management functions
  async function getCategories() {
    if (categories.length === 0) {
      await loadCategories();
    }
    return categories.map(c => c.name);
  }

  async function addCategory(name) {
    try {
      const data = await createAdminCategory(name);
      await loadCategories();
      return data;
    } catch (error) {
      console.error('Error adding category:', error);
      alert('Failed to add category: ' + error.message);
      throw error;
    }
  }

  async function updateCategoryInDB(id, oldName, newName) {
    try {
      const data = await updateAdminCategory(id, newName);
      await loadCategories();
      await loadDishes();
      return data;
    } catch (error) {
      console.error('Error updating category:', error);
      alert('Failed to update category: ' + error.message);
      throw error;
    }
  }

  async function deleteCategoryFromDB(id, name) {
    try {
      try {
        await deleteAdminCategory(id, { force: false });
      } catch (error) {
        if (error.code === 'CATEGORY_IN_USE') {
          if (!confirm(error.message + ' Remove anyway?')) return;
          await deleteAdminCategory(id, { force: true });
        } else {
          throw error;
        }
      }
      await loadCategories();
      await loadDishes();
    } catch (error) {
      console.error('Error deleting category:', error);
      alert('Failed to delete category: ' + error.message);
      throw error;
    }
  }

  function updateCategoryDropdown() {
    const categoryInput = document.getElementById('category');
    if (!categoryInput) return;
    categoryInput.innerHTML = '';
    categories.forEach(cat => {
      const opt = document.createElement('option');
      opt.text = cat.name;
      opt.value = cat.id; // Store category ID, not name
      categoryInput.appendChild(opt);
    });
  }

  // Initialize data on load
  async function initializeData() {
    await Promise.all([loadCategories(), loadDishes()]);
  }

  // ==================== UI INITIALIZATION ====================

  function initializeUI() {
    const nameInput = document.getElementById('name');
    const priceInput = document.getElementById('price');
    const imageInput = document.getElementById('image');
    const descriptionInput = document.getElementById('description');
    const categoryInput = document.getElementById('category');
    const searchInput = document.getElementById('searchInput');
    const notFoundText = document.getElementById('notFound');
    const saveBtn = document.getElementById('saveBtn');

    // Navigation buttons for cards (URL-synced via React Router)
    const navCategoryBtn = document.getElementById('navCategoryBtn');
    const navDishBtn = document.getElementById('navDishBtn');
    const navOffersBtn = document.getElementById('navOffersBtn');
    const navThemeBtn = document.getElementById('navThemeBtn');
    const navStaffBtn = document.getElementById('navStaffBtn');

    const categoryCard = document.getElementById('categoryCard');
    const dishCard = document.getElementById('dishCard');
    const offersCard = document.getElementById('offersCard');
    const themeCard = document.getElementById('themeCard');
    const staffCard = document.getElementById('staffCard');
    const menuItemsCard = document.getElementById('menuItemsCard');

    const MANAGE_MENU_TABS = {
      category: { cardId: 'categoryCard', buttonId: 'navCategoryBtn' },
      dish: { cardId: 'dishCard', buttonId: 'navDishBtn' },
      offers: { cardId: 'offersCard', buttonId: 'navOffersBtn' },
      theme: { cardId: 'themeCard', buttonId: 'navThemeBtn' },
      staff: { cardId: 'staffCard', buttonId: 'navStaffBtn' },
    };

    function setActiveNavButton(buttonId) {
      [navCategoryBtn, navDishBtn, navOffersBtn, navThemeBtn, navStaffBtn].forEach(btn => {
        if (btn) btn.classList.remove('active');
      });
      const activeBtn = document.getElementById(buttonId);
      if (activeBtn) activeBtn.classList.add('active');
    }

    function showCard(id) {
      if (categoryCard) categoryCard.style.display = 'none';
      if (dishCard) dishCard.style.display = 'none';
      if (offersCard) offersCard.style.display = 'none';
      if (themeCard) themeCard.style.display = 'none';
      if (staffCard) staffCard.style.display = 'none';
      if (menuItemsCard) menuItemsCard.style.display = 'none';
      const card = document.getElementById(id);
      if (card) card.style.display = 'block';
      if (id === 'dishCard' && menuItemsCard) {
        menuItemsCard.style.display = 'block';
      }
      if (id === 'themeCard') {
        loadThemeIntoForm();
      }
      if (id === 'staffCard') {
        loadStaff();
      }
      
      if (id === 'categoryCard') setActiveNavButton('navCategoryBtn');
      else if (id === 'dishCard') setActiveNavButton('navDishBtn');
      else if (id === 'offersCard') setActiveNavButton('navOffersBtn');
      else if (id === 'themeCard') setActiveNavButton('navThemeBtn');
      else if (id === 'staffCard') setActiveNavButton('navStaffBtn');
      
      setTimeout(() => updateTableContainerHeight(), 0);
    }

    function activateTab(tab) {
      const config = MANAGE_MENU_TABS[tab] || MANAGE_MENU_TABS.category;
      showCard(config.cardId);
      if (tab === 'category' || !MANAGE_MENU_TABS[tab]) {
        renderCategories();
      } else if (tab === 'dish') {
        updateCategoryDropdown();
        renderMenu();
      } else if (tab === 'staff') {
        loadStaff();
      }
    }

    function navigateToTab(tab) {
      if (typeof window.__manageMenuNavigate === 'function') {
        window.__manageMenuNavigate(tab);
        return;
      }
      activateTab(tab);
    }

    if (navCategoryBtn) {
      navCategoryBtn.addEventListener('click', () => navigateToTab('category'));
    }
    if (navDishBtn) {
      navDishBtn.addEventListener('click', () => navigateToTab('dish'));
    }
    if (navOffersBtn) {
      navOffersBtn.addEventListener('click', () => navigateToTab('offers'));
    }
    if (navThemeBtn) {
      navThemeBtn.addEventListener('click', () => navigateToTab('theme'));
    }
    if (navStaffBtn) {
      navStaffBtn.addEventListener('click', () => navigateToTab('staff'));
    }

    // Always register tab activation — even if dish form controls are missing
    window.manageMenuActivateTab = activateTab;

    if (saveBtn && searchInput) {
      saveBtn.addEventListener('click', saveDish);
      searchInput.addEventListener('input', () => renderMenu(searchInput.value.trim()));

      // Remove error state when user starts typing/selecting
      [nameInput, priceInput, imageInput, categoryInput].forEach(field => {
        if (field) {
          if (field.tagName === 'SELECT') {
            field.addEventListener('change', function() {
              this.classList.remove('error');
            });
          } else {
            field.addEventListener('input', function() {
              this.classList.remove('error');
            });
          }
        }
      });
    }

    // Category ops
    const newCategoryInput = document.getElementById('newCategoryInput');
    const addCategoryActionBtn = document.getElementById('addCategoryActionBtn');

    if (addCategoryActionBtn) {
      addCategoryActionBtn.addEventListener('click', async () => {
        const name = (newCategoryInput?.value || '').trim();
        if (!name) return alert('Enter a category name');
        
        const catList = await getCategories();
        const exists = catList.some(c => c.toLowerCase() === name.toLowerCase());
        if (exists) return alert('Category exists');
        
        try {
          await addCategory(name);
          if (newCategoryInput) newCategoryInput.value = '';
        } catch (error) {
          // Error already handled in addCategory
        }
      });
    }

    // Staff Management
    const staffNameInput = document.getElementById('staffNameInput');
    const staffPinInput = document.getElementById('staffPinInput');
    const staffPhoneInput = document.getElementById('staffPhoneInput');
    const addStaffBtn = document.getElementById('addStaffBtn');
    const closeCredentialsModal = document.getElementById('closeCredentialsModal');
    const copyCredentialsBtn = document.getElementById('copyCredentialsBtn');

    // PIN input: only allow numbers, max 4 digits
    if (staffPinInput) {
      staffPinInput.addEventListener('input', function(e) {
        e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4);
      });
    }

    if (addStaffBtn) {
      addStaffBtn.addEventListener('click', async () => {
        const staffName = staffNameInput?.value?.trim() || '';
        const pin = staffPinInput?.value || '';
        const phone = staffPhoneInput?.value?.trim() || null;
        
        if (!staffName) {
          alert('Please enter staff name');
          return;
        }
        
        if (pin.length !== 4) {
          alert('PIN must be exactly 4 digits');
          return;
        }
        
        try {
          await createStaff(staffName, pin, phone);
        } catch (error) {
          // Error already handled in createStaff
        }
      });
    }

    if (closeCredentialsModal) {
      closeCredentialsModal.addEventListener('click', closeStaffCredentialsModal);
    }

    if (copyCredentialsBtn) {
      copyCredentialsBtn.addEventListener('click', copyStaffCredentials);
    }

    // Close modal when clicking outside
    const staffCredentialsModal = document.getElementById('staffCredentialsModal');
    if (staffCredentialsModal) {
      staffCredentialsModal.addEventListener('click', function(e) {
        if (e.target === staffCredentialsModal) {
          closeStaffCredentialsModal();
        }
      });
    }

    // Offers
    const offerInput = document.getElementById('offerInput');
    const offerSaveBtn = document.getElementById('offerSaveBtn');
    const offerText = document.getElementById('offerText');

    function saveOffer() {
      const v = parseFloat(offerInput?.value || 0) || 0;
      localStorage.setItem('offer', String(v));
      if (offerText) {
        offerText.innerText = v > 0 ? v + '% OFF applied to all items' : 'No active offer';
      }
      if (offerInput) offerInput.value = '';
    }

    if (offerSaveBtn) {
      offerSaveBtn.addEventListener('click', saveOffer);
    }

    // Theme: load/save and color picker sync
    const themeMenuName = document.getElementById('themeMenuName');
    const themeMenuDescription = document.getElementById('themeMenuDescription');
    const themeUserSideColor = document.getElementById('themeUserSideColor');
    const themeUserSideColorHex = document.getElementById('themeUserSideColorHex');
    const themeStaffSideColor = document.getElementById('themeStaffSideColor');
    const themeStaffSideColorHex = document.getElementById('themeStaffSideColorHex');
    const themeAdminSideColor = document.getElementById('themeAdminSideColor');
    const themeAdminSideColorHex = document.getElementById('themeAdminSideColorHex');
    const themeSaveBtn = document.getElementById('themeSaveBtn');
    const themeResetBtn = document.getElementById('themeResetBtn');
    const themeUserSideSwatches = document.getElementById('themeUserSideSwatches');
    const themeStaffSideSwatches = document.getElementById('themeStaffSideSwatches');
    const themeAdminSideSwatches = document.getElementById('themeAdminSideSwatches');

    function normalizeHex(h) {
      const s = String(h).trim().toLowerCase();
      return /^#[0-9a-f]{6}$/.test(s) ? s : '';
    }
    function updateUserSideSwatchSelection() {
      if (!themeUserSideSwatches) return;
      const current = normalizeHex((themeUserSideColorHex && themeUserSideColorHex.value) || (themeUserSideColor && themeUserSideColor.value) || '');
      themeUserSideSwatches.querySelectorAll('.theme-swatch').forEach(el => {
        el.classList.toggle('selected', current && el.dataset.hex.toLowerCase() === current);
      });
    }
    function updateStaffSideSwatchSelection() {
      if (!themeStaffSideSwatches) return;
      const current = normalizeHex((themeStaffSideColorHex && themeStaffSideColorHex.value) || (themeStaffSideColor && themeStaffSideColor.value) || '');
      themeStaffSideSwatches.querySelectorAll('.theme-swatch').forEach(el => {
        el.classList.toggle('selected', current && el.dataset.hex.toLowerCase() === current);
      });
    }
    function updateAdminSideSwatchSelection() {
      if (!themeAdminSideSwatches) return;
      const current = normalizeHex((themeAdminSideColorHex && themeAdminSideColorHex.value) || (themeAdminSideColor && themeAdminSideColor.value) || '');
      themeAdminSideSwatches.querySelectorAll('.theme-swatch').forEach(el => {
        el.classList.toggle('selected', current && el.dataset.hex.toLowerCase() === current);
      });
    }

    async function loadThemeIntoForm() {
      const userId = await getCurrentUserId();
      if (!userId) return;
      try {
        const data = await fetchAdminTheme();
        const name = (data && data.menu_name != null) ? String(data.menu_name) : 'ZEN MENU';
        const desc = (data && data.menu_description != null) ? String(data.menu_description) : 'Menu Without Menu Books';
        const defaultColor = (data && data.button_color) ? String(data.button_color).trim() : '#ff6b00';
        const userColor = (data && data.user_side_color) ? String(data.user_side_color).trim() : defaultColor;
        const staffColor = (data && data.staff_side_color) ? String(data.staff_side_color).trim() : defaultColor;
        const adminColor = (data && data.admin_side_color) ? String(data.admin_side_color).trim() : defaultColor;
        if (themeMenuName) themeMenuName.value = name;
        if (themeMenuDescription) themeMenuDescription.value = desc;
        if (themeUserSideColor) themeUserSideColor.value = userColor.match(/^#[0-9A-Fa-f]{6}$/) ? userColor : '#ff6b00';
        if (themeUserSideColorHex) themeUserSideColorHex.value = themeUserSideColor ? themeUserSideColor.value : '#ff6b00';
        if (themeStaffSideColor) themeStaffSideColor.value = staffColor.match(/^#[0-9A-Fa-f]{6}$/) ? staffColor : '#ff6b00';
        if (themeStaffSideColorHex) themeStaffSideColorHex.value = themeStaffSideColor ? themeStaffSideColor.value : '#ff6b00';
        if (themeAdminSideColor) themeAdminSideColor.value = adminColor.match(/^#[0-9A-Fa-f]{6}$/) ? adminColor : '#ff6b00';
        if (themeAdminSideColorHex) themeAdminSideColorHex.value = themeAdminSideColor ? themeAdminSideColor.value : '#ff6b00';
        updateUserSideSwatchSelection();
        updateStaffSideSwatchSelection();
        updateAdminSideSwatchSelection();
      } catch (e) {
        if (themeMenuName) themeMenuName.value = 'ZEN MENU';
        if (themeMenuDescription) themeMenuDescription.value = 'Menu Without Menu Books';
        if (themeUserSideColor) themeUserSideColor.value = '#ff6b00';
        if (themeUserSideColorHex) themeUserSideColorHex.value = '#ff6b00';
        if (themeStaffSideColor) themeStaffSideColor.value = '#ff6b00';
        if (themeStaffSideColorHex) themeStaffSideColorHex.value = '#ff6b00';
        if (themeAdminSideColor) themeAdminSideColor.value = '#ff6b00';
        if (themeAdminSideColorHex) themeAdminSideColorHex.value = '#ff6b00';
        updateUserSideSwatchSelection();
        updateStaffSideSwatchSelection();
        updateAdminSideSwatchSelection();
      }
    }

    function syncUserSideColorFromPicker() {
      if (themeUserSideColor && themeUserSideColorHex) themeUserSideColorHex.value = themeUserSideColor.value;
      updateUserSideSwatchSelection();
    }
    function syncUserSideColorFromHex() {
      const hex = (themeUserSideColorHex && themeUserSideColorHex.value) ? themeUserSideColorHex.value.trim() : '';
      if (/^#[0-9A-Fa-f]{6}$/.test(hex) && themeUserSideColor) themeUserSideColor.value = hex;
      updateUserSideSwatchSelection();
    }
    function syncStaffSideColorFromPicker() {
      if (themeStaffSideColor && themeStaffSideColorHex) themeStaffSideColorHex.value = themeStaffSideColor.value;
      updateStaffSideSwatchSelection();
    }
    function syncStaffSideColorFromHex() {
      const hex = (themeStaffSideColorHex && themeStaffSideColorHex.value) ? themeStaffSideColorHex.value.trim() : '';
      if (/^#[0-9A-Fa-f]{6}$/.test(hex) && themeStaffSideColor) themeStaffSideColor.value = hex;
      updateStaffSideSwatchSelection();
    }
    function syncAdminSideColorFromPicker() {
      if (themeAdminSideColor && themeAdminSideColorHex) themeAdminSideColorHex.value = themeAdminSideColor.value;
      updateAdminSideSwatchSelection();
    }
    function syncAdminSideColorFromHex() {
      const hex = (themeAdminSideColorHex && themeAdminSideColorHex.value) ? themeAdminSideColorHex.value.trim() : '';
      if (/^#[0-9A-Fa-f]{6}$/.test(hex) && themeAdminSideColor) themeAdminSideColor.value = hex;
      updateAdminSideSwatchSelection();
    }
    if (themeUserSideColor) themeUserSideColor.addEventListener('input', syncUserSideColorFromPicker);
    if (themeUserSideColorHex) themeUserSideColorHex.addEventListener('input', syncUserSideColorFromHex);
    if (themeStaffSideColor) themeStaffSideColor.addEventListener('input', syncStaffSideColorFromPicker);
    if (themeStaffSideColorHex) themeStaffSideColorHex.addEventListener('input', syncStaffSideColorFromHex);
    if (themeAdminSideColor) themeAdminSideColor.addEventListener('input', syncAdminSideColorFromPicker);
    if (themeAdminSideColorHex) themeAdminSideColorHex.addEventListener('input', syncAdminSideColorFromHex);

    if (themeUserSideSwatches) {
      themeUserSideSwatches.querySelectorAll('.theme-swatch').forEach(el => {
        el.addEventListener('click', () => {
          const hex = (el.dataset.hex || '').toLowerCase();
          if (!/^#[0-9a-f]{6}$/.test(hex)) return;
          if (themeUserSideColor) themeUserSideColor.value = hex;
          if (themeUserSideColorHex) themeUserSideColorHex.value = hex;
          updateUserSideSwatchSelection();
        });
      });
    }
    if (themeStaffSideSwatches) {
      themeStaffSideSwatches.querySelectorAll('.theme-swatch').forEach(el => {
        el.addEventListener('click', () => {
          const hex = (el.dataset.hex || '').toLowerCase();
          if (!/^#[0-9a-f]{6}$/.test(hex)) return;
          if (themeStaffSideColor) themeStaffSideColor.value = hex;
          if (themeStaffSideColorHex) themeStaffSideColorHex.value = hex;
          updateStaffSideSwatchSelection();
        });
      });
    }
    if (themeAdminSideSwatches) {
      themeAdminSideSwatches.querySelectorAll('.theme-swatch').forEach(el => {
        el.addEventListener('click', () => {
          const hex = (el.dataset.hex || '').toLowerCase();
          if (!/^#[0-9a-f]{6}$/.test(hex)) return;
          if (themeAdminSideColor) themeAdminSideColor.value = hex;
          if (themeAdminSideColorHex) themeAdminSideColorHex.value = hex;
          updateAdminSideSwatchSelection();
        });
      });
    }

    const DEFAULT_MENU_NAME = 'ZEN MENU';
    const DEFAULT_MENU_DESC = 'Menu Without Menu Books';
    const DEFAULT_PRIMARY_COLOR = '#ff6b00';

    function setThemeFormToDefaults() {
      if (themeMenuName) themeMenuName.value = DEFAULT_MENU_NAME;
      if (themeMenuDescription) themeMenuDescription.value = DEFAULT_MENU_DESC;
      if (themeUserSideColor) themeUserSideColor.value = DEFAULT_PRIMARY_COLOR;
      if (themeUserSideColorHex) themeUserSideColorHex.value = DEFAULT_PRIMARY_COLOR;
      if (themeStaffSideColor) themeStaffSideColor.value = DEFAULT_PRIMARY_COLOR;
      if (themeStaffSideColorHex) themeStaffSideColorHex.value = DEFAULT_PRIMARY_COLOR;
      if (themeAdminSideColor) themeAdminSideColor.value = DEFAULT_PRIMARY_COLOR;
      if (themeAdminSideColorHex) themeAdminSideColorHex.value = DEFAULT_PRIMARY_COLOR;
      updateUserSideSwatchSelection();
      updateStaffSideSwatchSelection();
      updateAdminSideSwatchSelection();
    }

    if (themeResetBtn) {
      themeResetBtn.addEventListener('click', async () => {
        const userId = await getCurrentUserId();
        if (!userId) { alert('Not logged in'); return; }
        setThemeFormToDefaults();
        try {
          await saveAdminTheme({
            menu_name: DEFAULT_MENU_NAME,
            menu_description: DEFAULT_MENU_DESC,
            user_side_color: DEFAULT_PRIMARY_COLOR,
            staff_side_color: DEFAULT_PRIMARY_COLOR,
            admin_side_color: DEFAULT_PRIMARY_COLOR,
          });
          if (themeSaveBtn) {
            themeSaveBtn.classList.add('saved');
            themeSaveBtn.textContent = 'Saved!';
            setTimeout(() => {
              themeSaveBtn.classList.remove('saved');
              themeSaveBtn.textContent = 'Save Theme';
            }, 2000);
          }
        } catch (e) {
          console.error('Theme reset save failed:', e);
          alert('Failed to save theme: ' + (e.message || 'Unknown error'));
        }
      });
    }

    if (themeSaveBtn) {
      themeSaveBtn.addEventListener('click', async () => {
        const userId = await getCurrentUserId();
        if (!userId) { alert('Not logged in'); return; }
        const name = (themeMenuName && themeMenuName.value) ? themeMenuName.value.trim() : 'ZEN MENU';
        const desc = (themeMenuDescription && themeMenuDescription.value) ? themeMenuDescription.value.trim() : 'Menu Without Menu Books';
        let userColor = (themeUserSideColorHex && themeUserSideColorHex.value) ? themeUserSideColorHex.value.trim() : (themeUserSideColor ? themeUserSideColor.value : DEFAULT_PRIMARY_COLOR);
        if (!/^#[0-9A-Fa-f]{6}$/.test(userColor)) userColor = DEFAULT_PRIMARY_COLOR;
        let staffColor = (themeStaffSideColorHex && themeStaffSideColorHex.value) ? themeStaffSideColorHex.value.trim() : (themeStaffSideColor ? themeStaffSideColor.value : DEFAULT_PRIMARY_COLOR);
        if (!/^#[0-9A-Fa-f]{6}$/.test(staffColor)) staffColor = DEFAULT_PRIMARY_COLOR;
        let adminColor = (themeAdminSideColorHex && themeAdminSideColorHex.value) ? themeAdminSideColorHex.value.trim() : (themeAdminSideColor ? themeAdminSideColor.value : DEFAULT_PRIMARY_COLOR);
        if (!/^#[0-9A-Fa-f]{6}$/.test(adminColor)) adminColor = DEFAULT_PRIMARY_COLOR;
        try {
          await saveAdminTheme({
            menu_name: name,
            menu_description: desc,
            user_side_color: userColor,
            staff_side_color: staffColor,
            admin_side_color: adminColor,
          });
          themeSaveBtn.classList.add('saved');
          themeSaveBtn.textContent = 'Saved!';
          setTimeout(() => {
            themeSaveBtn.classList.remove('saved');
            themeSaveBtn.textContent = 'Save Theme';
          }, 2000);
        } catch (e) {
          console.error('Theme save failed:', e);
          alert('Failed to save theme: ' + (e.message || 'Unknown error'));
        }
      });
    }

    // Close sidebar when clicking nav buttons on mobile
    [navCategoryBtn, navDishBtn, navOffersBtn, navThemeBtn, navStaffBtn].forEach(btn => {
      if (btn) {
        btn.addEventListener('click', () => {
          if (window.innerWidth <= 768) {
            const manageMenuSection = document.getElementById('manageMenuSection');
            // Only affect manage menu sidebar, not the main orders sidebar
            if (!manageMenuSection || manageMenuSection.style.display === 'none') {
              return; // Don't interfere with orders page
            }
            const sidebar = manageMenuSection.querySelector('.layout .sidebar');
            const overlay = document.getElementById('overlay');
            if (sidebar) sidebar.classList.add('mobile-hidden');
            if (overlay) overlay.classList.remove('active');
            document.body.style.overflow = '';
          }
        });
      }
    });
  }

  // ==================== RENDER FUNCTIONS ====================

  async function renderCategories() {
    const tbody = document.getElementById('categoryTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    await getCategories(); // Ensure categories are loaded

    categories.forEach((cat, index) => {
      const tr = document.createElement('tr');
      tr.className = 'draggable-row';
      tr.draggable = true;
      tr.dataset.categoryId = cat.id;
      tr.dataset.index = index;
      
      const escapedCat = cat.name.replace(/'/g, "\\'").replace(/"/g, '&quot;');
      const escapedId = String(cat.id).replace(/'/g, "\\'").replace(/"/g, '&quot;');
      
      tr.innerHTML = `
        <td class="drag-handle">⋮⋮</td>
        <td>${index + 1}</td>
        <td>${cat.name}</td>
        <td class="actions">
          <div class="dots" onclick="window.manageMenuModule.toggleCategoryMenu(this)">⋮</div>
          <div class="menu-actions">
            <div onclick="window.manageMenuModule.updateCategory('${escapedId}', '${escapedCat}')">Update</div>
            <div class="danger" onclick="window.manageMenuModule.removeCategory('${escapedId}', '${escapedCat}')">Remove</div>
          </div>
        </td>`;
      
      // Add drag event listeners
      tr.addEventListener('dragstart', handleDragStart);
      tr.addEventListener('dragover', handleDragOver);
      tr.addEventListener('drop', handleDrop);
      tr.addEventListener('dragend', handleDragEnd);
      
      // Prevent drag when clicking on action buttons
      const actionsCell = tr.querySelector('.actions');
      if (actionsCell) {
        actionsCell.addEventListener('mousedown', (e) => {
          e.stopPropagation();
        });
      }
      
      tbody.appendChild(tr);
    });
  }

  // Drag and drop handlers
  let draggedElement = null;
  let draggedIndex = null;

  function handleDragStart(e) {
    // Prevent drag when clicking directly on action buttons or menu
    const target = e.target;
    if (target.closest('.menu-actions') || target.classList.contains('dots')) {
      e.preventDefault();
      return false;
    }
    
    draggedElement = this;
    draggedIndex = parseInt(this.dataset.index);
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.outerHTML);
  }

  function handleDragOver(e) {
    if (e.preventDefault) {
      e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    
    const targetRow = this;
    if (targetRow && targetRow !== draggedElement && targetRow.classList.contains('draggable-row')) {
      const targetIndex = parseInt(targetRow.dataset.index);
      const allRows = Array.from(targetRow.parentNode.querySelectorAll('tr.draggable-row'));
      
      // Remove previous drop indicators
      allRows.forEach(row => {
        row.classList.remove('drag-over-top', 'drag-over-bottom');
      });
      
      // Add visual indicator
      if (targetIndex < draggedIndex) {
        targetRow.classList.add('drag-over-top');
      } else if (targetIndex > draggedIndex) {
        targetRow.classList.add('drag-over-bottom');
      }
    }
    
    return false;
  }

  function handleDrop(e) {
    if (e.stopPropagation) {
      e.stopPropagation();
    }
    
    const targetRow = this;
    if (!targetRow || targetRow === draggedElement || !targetRow.classList.contains('draggable-row')) {
      return false;
    }
    
    const targetIndex = parseInt(targetRow.dataset.index);
    const sourceIndex = draggedIndex;
    
    if (targetIndex === sourceIndex) {
      // No change needed
      return false;
    }
    
    // Remove visual indicators
    document.querySelectorAll('.drag-over-top, .drag-over-bottom').forEach(el => {
      el.classList.remove('drag-over-top', 'drag-over-bottom');
    });
    
    // Reorder categories array
    const [movedCategory] = categories.splice(sourceIndex, 1);
    categories.splice(targetIndex, 0, movedCategory);
    
    // Update display_order values in database
    updateCategoryOrders();
    
    return false;
  }

  function handleDragEnd(e) {
    this.classList.remove('dragging');
    document.querySelectorAll('.drag-over-top, .drag-over-bottom').forEach(el => {
      el.classList.remove('drag-over-top', 'drag-over-bottom');
    });
    draggedElement = null;
    draggedIndex = null;
  }

  // Update display_order values in database after reordering
  async function updateCategoryOrders() {
    try {
      const orderedIds = categories.map((c) => c.id);
      categories = await reorderAdminCategories(orderedIds);
      await loadCategories();
    } catch (error) {
      console.error('Error updating category orders:', error);
      alert('Failed to save category order: ' + error.message);
      await loadCategories();
    }
  }

  function renderMenu(search = '') {
    const tbody = document.querySelector('#menuTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const filtered = search
      ? menu.filter(d => d && d.name && d.name.toLowerCase().includes(search.toLowerCase()))
      : menu.filter(d => d && d.name);

    const notFoundText = document.getElementById('notFound');
    if (notFoundText) {
      notFoundText.style.display = filtered.length === 0 && search ? 'block' : 'none';
    }

    filtered.forEach((d, index) => {
      const tr = document.createElement('tr');
      const escapedName = d.name.replace(/'/g, "\\'").replace(/"/g, '&quot;');
      const escapedId = String(d.id).replace(/'/g, "\\'").replace(/"/g, '&quot;');
      // Number dishes in descending order: newest dish gets highest number
      const dishNumber = filtered.length - index;
      tr.innerHTML = `
        <td>${dishNumber}</td>
        <td>${d.name}</td>
        <td>₹${d.price}</td>
        <td>${d.category || 'N/A'}</td>
        <td title="${(d.description || '').replace(/"/g, '&quot;')}">${d.description || ''}</td>
        <td><img src="${d.image_url || ''}" alt="${d.name}" style="width:60px;height:40px;object-fit:cover;border-radius:6px" loading="lazy"></td>
        <td class="actions">
          <div class="dots" onclick="window.manageMenuModule.toggleMenu(this)">⋮</div>
          <div class="menu-actions">
            <div onclick="window.manageMenuModule.editDish('${escapedId}')">Update</div>
            <div class="danger" onclick="window.manageMenuModule.deleteDish('${escapedId}')">Remove</div>
          </div>
        </td>`;
      tbody.appendChild(tr);
    });
    
    // Update table container height after rows are rendered
    // Use requestAnimationFrame to ensure DOM is updated
    requestAnimationFrame(() => {
      updateTableContainerHeight();
    });
  }

  // ==================== CATEGORY OPERATIONS ====================

  function closeAllMenuActions() {
    document.querySelectorAll('.menu-actions').forEach((menu) => {
      menu.style.display = 'none';
      menu.style.position = '';
      menu.style.top = '';
      menu.style.left = '';
      menu.style.right = '';
      menu.style.zIndex = '';
    });
  }

  function positionMenuActions(menu, anchor) {
    menu.style.display = 'block';
    menu.style.position = 'fixed';
    menu.style.right = 'auto';
    menu.style.zIndex = '1000';

    const anchorRect = anchor.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const gap = 4;
    const margin = 8;

    let top = anchorRect.bottom + gap;
    if (top + menuRect.height > window.innerHeight - margin) {
      top = Math.max(margin, anchorRect.top - menuRect.height - gap);
    }

    let left = anchorRect.right - menuRect.width;
    if (left < margin) left = margin;
    if (left + menuRect.width > window.innerWidth - margin) {
      left = Math.max(margin, window.innerWidth - menuRect.width - margin);
    }

    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;
  }

  function toggleCategoryMenu(el) {
    const menu = el.nextElementSibling;
    const wasOpen = menu && menu.style.display === 'block';
    closeAllMenuActions();
    if (!wasOpen && menu) {
      positionMenuActions(menu, el);
    }
  }

  async function removeCategory(id, name) {
    try {
      await deleteCategoryFromDB(id, name);
    } catch (error) {
      // Error already handled in deleteCategoryFromDB
    }
  }

  async function updateCategory(id, name) {
    const newName = prompt('Enter new category name:', name);
    if (!newName || newName.trim() === '') return;
    
    const trimmedName = newName.trim();
    const catList = await getCategories();
    const exists = catList.some(c => c.toLowerCase() === trimmedName.toLowerCase() && c !== name);
    if (exists) return alert('Category already exists');
    
    try {
      await updateCategoryInDB(id, name, trimmedName);
    } catch (error) {
      // Error already handled in updateCategoryInDB
    }
  }


  // ==================== DISH OPERATIONS ====================

  async function saveDish() {
    const nameInput = document.getElementById('name');
    const priceInput = document.getElementById('price');
    const imageInput = document.getElementById('image');
    const descriptionInput = document.getElementById('description');
    const categoryInput = document.getElementById('category');

    [nameInput, priceInput, imageInput, categoryInput].forEach((field) => {
      if (field) field.classList.remove('error');
    });

    let hasError = false;
    if (!nameInput?.value || !nameInput.value.trim()) {
      if (nameInput) nameInput.classList.add('error');
      hasError = true;
    }
    if (!priceInput?.value || !priceInput.value.trim()) {
      if (priceInput) priceInput.classList.add('error');
      hasError = true;
    }
    if (!imageInput?.value || !imageInput.value.trim()) {
      if (imageInput) imageInput.classList.add('error');
      hasError = true;
    }

    const catList = await getCategories();
    if (catList.length === 0) {
      alert('Please add at least one category before adding dishes');
      return;
    }
    if (!categoryInput?.value) {
      if (categoryInput) categoryInput.classList.add('error');
      hasError = true;
    }
    if (hasError) return;

    const dishName = nameInput.value.trim();
    const dishPrice = parseInt(priceInput.value.trim(), 10);
    const categoryId = categoryInput.value;

    if (isNaN(dishPrice) || dishPrice <= 0) {
      if (priceInput) priceInput.classList.add('error');
      alert('Please enter a valid price');
      return;
    }
    if (!categoryId) {
      if (categoryInput) categoryInput.classList.add('error');
      alert('Please select a valid category');
      return;
    }

    const dishData = {
      dish_name: dishName,
      price: dishPrice,
      image_url: imageInput.value.trim(),
      description: descriptionInput?.value.trim() || null,
      category_id: categoryId,
    };

    try {
      if (editingDishId) {
        await updateAdminDish(editingDishId, dishData);
        editingDishId = null;
      } else {
        await createAdminDish(dishData);
      }
      await loadDishes();
      clearForm();
    } catch (error) {
      console.error('Error saving dish:', error);
      alert('Failed to save dish: ' + error.message);
    }
  }

  function clearForm() {
    const nameInput = document.getElementById('name');
    const priceInput = document.getElementById('price');
    const imageInput = document.getElementById('image');
    const descriptionInput = document.getElementById('description');
    const categoryInput = document.getElementById('category');

    if (nameInput) nameInput.value = '';
    if (priceInput) priceInput.value = '';
    if (imageInput) imageInput.value = '';
    if (descriptionInput) descriptionInput.value = '';
    if (categoryInput && categories.length > 0) {
      categoryInput.value = categories[0].id;
    }
    // Remove error states
    [nameInput, priceInput, imageInput, categoryInput].forEach(field => {
      if (field) field.classList.remove('error');
    });
    editingDishId = null;
  }

  async function deleteDish(id) {
    if (!confirm('Are you sure you want to delete this dish?')) return;
    try {
      await deleteAdminDish(id);
      await loadDishes();
    } catch (error) {
      console.error('Error deleting dish:', error);
      alert('Failed to delete dish: ' + error.message);
    }
  }

  function editDish(id) {
    const dish = menu.find(d => d.id === id);
    if (!dish) return;

    const nameInput = document.getElementById('name');
    const priceInput = document.getElementById('price');
    const imageInput = document.getElementById('image');
    const descriptionInput = document.getElementById('description');
    const categoryInput = document.getElementById('category');

    if (nameInput) nameInput.value = dish.name;
    if (priceInput) priceInput.value = dish.price;
    if (imageInput) imageInput.value = dish.image_url || '';
    if (descriptionInput) descriptionInput.value = dish.description || '';
    
    // Set category_id in dropdown
    if (categoryInput) {
      if (dish.category_id && categories.some(c => c.id === dish.category_id)) {
        categoryInput.value = dish.category_id;
      } else if (categories.length > 0) {
        categoryInput.value = categories[0].id;
      }
    }
    
    editingDishId = id;
  }

  function toggleMenu(el) {
    const menu = el.nextElementSibling;
    const wasOpen = menu && menu.style.display === 'block';
    closeAllMenuActions();
    if (!wasOpen && menu) {
      positionMenuActions(menu, el);
    }
  }

  // Close menu actions when clicking outside
  document.addEventListener('click', e => {
    if (!e.target.closest('.dots') && !e.target.closest('.menu-actions')) {
      closeAllMenuActions();
    }
  });

  // Keep fixed menus from floating after scroll/resize
  document.addEventListener('scroll', closeAllMenuActions, true);
  window.addEventListener('resize', closeAllMenuActions);

  // ==================== SIDEBAR POSITIONING ====================

  function setSidebarPosition() {
    const header = document.querySelector('header');
    const manageMenuSection = document.getElementById('manageMenuSection');
    // Only affect manage menu sidebar, not the main orders sidebar
    if (!manageMenuSection || manageMenuSection.style.display === 'none') {
      return; // Don't interfere with orders page
    }
    const sidebar = manageMenuSection.querySelector('.layout .sidebar');
    if (header) {
      const headerHeight = header.offsetHeight || 64;
      document.documentElement.style.setProperty('--admin-header-height', `${headerHeight}px`);
      if (sidebar) {
        sidebar.style.top = `${headerHeight}px`;
        sidebar.style.height = `calc(100vh - ${headerHeight}px)`;
      }
    }
  }

  // Keep manage-menu content width fixed; sidebar expands as an overlay
  function updateContainerWidth() {
    const manageMenuSection = document.getElementById('manageMenuSection');
    if (!manageMenuSection || manageMenuSection.style.display === 'none') {
      return;
    }
    const container = manageMenuSection.querySelector('.layout .container');
    if (container) {
      container.classList.add('full-width');
    }
  }

  // Initialize sidebar collapse behavior
  let manageMenuSidebarInitialized = false;
  function initializeSidebarBehavior() {
    const manageMenuSection = document.getElementById('manageMenuSection');
    // Only initialize if manage menu section exists and is visible
    if (!manageMenuSection || manageMenuSection.style.display === 'none') {
      return; // Don't interfere with orders page
    }
    const sidebar = manageMenuSection.querySelector('.layout .sidebar');
    const container = manageMenuSection.querySelector('.layout .container');
    
    if (!sidebar) return;
    
    // Reset initialization if sidebar was removed and re-added
    if (manageMenuSidebarInitialized && !sidebar.hasAttribute('data-behavior-initialized')) {
      manageMenuSidebarInitialized = false;
    }
    
    if (manageMenuSidebarInitialized) return;
    manageMenuSidebarInitialized = true;
    sidebar.setAttribute('data-behavior-initialized', 'true');

    // Ensure sidebar is collapsed on initial load (desktop only)
    if (window.innerWidth > 768) {
      sidebar.classList.add('collapsed');
      sidebar.classList.remove('mobile-hidden');
      if (container) {
        container.classList.add('full-width');
      }
    } else {
      // Mobile: start hidden
      sidebar.classList.add('mobile-hidden');
    }

    // Desktop hover behavior
    let hoverTimeout;
    let isHovering = false;
    
    const handleMouseEnter = function() {
      if (window.innerWidth > 768) {
        isHovering = true;
        if (sidebar.classList.contains('collapsed')) {
          clearTimeout(hoverTimeout);
          sidebar.classList.remove('collapsed');
          updateContainerWidth();
        }
      }
    };
    
    const handleMouseLeave = function() {
      if (window.innerWidth > 768) {
        isHovering = false;
        if (!sidebar.classList.contains('collapsed')) {
          hoverTimeout = setTimeout(function() {
            if (!isHovering) {
              sidebar.classList.add('collapsed');
              updateContainerWidth();
            }
          }, 200);
        }
      }
    };
    
    sidebar.addEventListener('mouseenter', handleMouseEnter);
    sidebar.addEventListener('mouseleave', handleMouseLeave);

    // Auto-collapse sidebar when clicking outside (desktop only)
    const handleClickOutside = function(e) {
      const manageMenuSection = document.getElementById('manageMenuSection');
      // Only handle clicks when manage menu is visible
      if (window.innerWidth > 768 && sidebar && manageMenuSection && manageMenuSection.style.display !== 'none') {
        // Don't collapse if clicking on menu toggle, overlay, or sidebar itself
        const menuToggle = document.getElementById('menuToggle');
        const overlay = document.getElementById('overlay');
        if (menuToggle && menuToggle.contains(e.target)) return;
        if (overlay && overlay.contains(e.target)) return;
        if (sidebar.contains(e.target)) return;
        
        if (!sidebar.classList.contains('collapsed')) {
          sidebar.classList.add('collapsed');
          updateContainerWidth();
        }
      }
    };
    if (manageMenuSidebarClickHandler) {
      document.removeEventListener('click', manageMenuSidebarClickHandler);
    }
    manageMenuSidebarClickHandler = handleClickOutside;
    document.addEventListener('click', manageMenuSidebarClickHandler);

    // Auto-collapse on desktop after sidebar tab selection
    const sidebarTabs = manageMenuSection ? manageMenuSection.querySelectorAll('.layout .sidebar-tab') : [];
    sidebarTabs.forEach(tab => {
      tab.addEventListener('click', function() {
        if (window.innerWidth > 768 && sidebar) {
          setTimeout(function() {
            if (!sidebar.matches(':hover')) {
              sidebar.classList.add('collapsed');
              updateContainerWidth();
            }
          }, 300);
        }
      });
    });
  }

  // ==================== REAL-TIME SUBSCRIPTIONS ====================

  let categoriesChannel = null;
  let dishesChannel = null;
  let manageMenuSidebarClickHandler = null;
  let manageMenuResizeHandler = null;
  
  async function setupRealtimeSubscriptions() {
    const supabaseClient = getSupabaseClient();
    if (!supabaseClient) {
      console.error('Supabase client not initialized');
      return;
    }
    
    const userId = await getCurrentUserId();
    if (!userId) {
      console.error('User ID not available for real-time subscriptions');
      return;
    }
    
    // Subscribe to categories changes for current user only
    categoriesChannel = supabaseClient
      .channel('categories-changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'categories',
          filter: `user_id=eq.${userId}`
        },
        async (payload) => {
          await loadCategories();
        }
      )
      .subscribe();

    // Subscribe to dishes changes for current user only
    dishesChannel = supabaseClient
      .channel('dishes-changes')
      .on('postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'dishes',
          filter: `user_id=eq.${userId}`
        },
        async (payload) => {
          await loadDishes();
        }
      )
      .subscribe();
  }

  // ==================== STAFF MANAGEMENT ====================

  // Load staff from Supabase
  async function loadStaff() {
    try {
      const data = await fetchAdminStaff();
      renderStaff(data || []);
      return data || [];
    } catch (error) {
      console.error('Error loading staff:', error);
      alert('Failed to load staff: ' + error.message);
      return [];
    }
  }

  // Render staff table
  function renderStaff(staffList) {
    const tbody = document.getElementById('staffTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (!staffList || staffList.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px; color: #6b7280;">No staff members yet. Add your first staff member above.</td></tr>';
      return;
    }
    
    staffList.forEach((staff, index) => {
      const row = document.createElement('tr');
      
      // Format last login
      let lastLoginText = 'Never';
      if (staff.last_login) {
        const lastLogin = new Date(staff.last_login);
        const now = new Date();
        const diffMs = now - lastLogin;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 60) {
          lastLoginText = `${diffMins} min ago`;
        } else if (diffHours < 24) {
          lastLoginText = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        } else {
          lastLoginText = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
        }
      }
      
      // Format created at
      const createdAt = staff.created_at ? new Date(staff.created_at).toLocaleDateString() : '-';
      
      // Create PIN display with eye icon
      let pinDisplay = '-';
      if (staff.staff_pin) {
        const pinId = `pin-${staff.id}`;
        const maskedPin = '••••';
        const eyeIconSvg = `
          <svg class="pin-eye-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
        `;
        pinDisplay = `
          <div class="pin-display-container" style="display: flex; align-items: center; gap: 6px;">
            <span class="pin-value" id="${pinId}" data-pin="${escapeHtml(staff.staff_pin)}">${maskedPin}</span>
            <button class="pin-toggle-btn" onclick="window.manageMenuModule.togglePinVisibility('${pinId}')" title="Show PIN" style="background: none; border: none; cursor: pointer; padding: 2px; display: flex; align-items: center;">
              <span class="pin-eye-icon-wrapper">${eyeIconSvg}</span>
            </button>
          </div>
        `;
      }
      
      row.innerHTML = `
        <td>${index + 1}</td>
        <td>${escapeHtml(staff.staff_name)}</td>
        <td>${staff.phone ? escapeHtml(staff.phone) : '-'}</td>
        <td>${lastLoginText}</td>
        <td>${createdAt}</td>
        <td>${pinDisplay}</td>
        <td>
          <button class="btn-delete" onclick="window.manageMenuModule.deleteStaff('${staff.id}', '${escapeHtml(staff.staff_name)}')" title="Delete Staff">
            🗑️
          </button>
        </td>
      `;
      
      tbody.appendChild(row);
    });
  }

  // Create new staff
  async function createStaff(staffName, pin, phone = null) {
    if (!staffName || !staffName.trim()) {
      alert('Please enter staff name');
      return;
    }
    if (!pin || !/^\d{4}$/.test(pin)) {
      alert('PIN must be exactly 4 digits');
      return;
    }

    try {
      const data = await createAdminStaffMember({
        staffName,
        pin,
        phone,
      });

      showStaffCredentialsModal(staffName, pin);

      const staffNameInput = document.getElementById('staffNameInput');
      const staffPinInput = document.getElementById('staffPinInput');
      const staffPhoneInput = document.getElementById('staffPhoneInput');
      if (staffNameInput) staffNameInput.value = '';
      if (staffPinInput) staffPinInput.value = '';
      if (staffPhoneInput) staffPhoneInput.value = '';

      await loadStaff();
      return data;
    } catch (error) {
      console.error('Error creating staff:', error);
      alert('Failed to create staff: ' + error.message);
      throw error;
    }
  }

  // Delete staff
  async function deleteStaff(staffId, staffName) {
    if (!confirm(`Are you sure you want to delete staff member "${staffName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteAdminStaffMember(staffId);
      await loadStaff();
    } catch (error) {
      console.error('Error deleting staff:', error);
      alert('Failed to delete staff: ' + error.message);
      throw error;
    }
  }

  // Show staff credentials modal
  function showStaffCredentialsModal(staffName, pin) {
    const modal = document.getElementById('staffCredentialsModal');
    const modalStaffName = document.getElementById('modalStaffName');
    const modalStaffPin = document.getElementById('modalStaffPin');
    
    if (modal && modalStaffName && modalStaffPin) {
      modalStaffName.textContent = staffName;
      modalStaffPin.textContent = pin;
      modal.style.display = 'flex';
    }
  }

  // Close staff credentials modal
  function closeStaffCredentialsModal() {
    const modal = document.getElementById('staffCredentialsModal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  // Copy credentials to clipboard
  async function copyStaffCredentials() {
    const modalStaffName = document.getElementById('modalStaffName');
    const modalStaffPin = document.getElementById('modalStaffPin');
    
    if (modalStaffName && modalStaffPin) {
      const text = `Staff Name: ${modalStaffName.textContent}\nPIN: ${modalStaffPin.textContent}`;
      try {
        await navigator.clipboard.writeText(text);
        const copyBtn = document.getElementById('copyCredentialsBtn');
        if (copyBtn) {
          const originalText = copyBtn.textContent;
          copyBtn.textContent = 'Copied!';
          setTimeout(() => {
            copyBtn.textContent = originalText;
          }, 2000);
        }
      } catch (error) {
        console.error('Failed to copy:', error);
        alert('Failed to copy to clipboard');
      }
    }
  }

  // Helper function to escape HTML
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ==================== PUBLIC API ====================

  // Update table container height for proper scrolling - show exactly 6 rows
  function updateTableContainerHeight() {
    const tableContainer = document.getElementById('tableContainer');
    const menuItemsCard = document.getElementById('menuItemsCard');
    const menuTable = document.getElementById('menuTable');
    
    if (tableContainer && menuItemsCard && menuTable) {
      // Get the table header height
      const thead = menuTable.querySelector('thead');
      const firstRow = menuTable.querySelector('tbody tr:first-child');
      
      if (thead && firstRow) {
        const headerHeight = thead.offsetHeight;
        const rowHeight = firstRow.offsetHeight;
        
        // Calculate height for exactly 6 rows: header + (6 rows * row height)
        // Add 1px for border on the last row
        const maxTableHeight = headerHeight + (6 * rowHeight) + 1;
        tableContainer.style.maxHeight = maxTableHeight + 'px';
      } else {
        // Fallback: calculate based on card dimensions
        const cardHeight = menuItemsCard.offsetHeight;
        const headerHeight = menuItemsCard.querySelector('.menu-items-header')?.offsetHeight || 0;
        const notFoundText = document.getElementById('notFound');
        const notFoundHeight = notFoundText && notFoundText.style.display !== 'none' ? notFoundText.offsetHeight : 0;
        const availableHeight = cardHeight - headerHeight - notFoundHeight - 20; // 20px for margins/padding
        
        // Estimate: approximately 50px per row (padding + content + border)
        // Show exactly 6 rows: header (~40px) + (6 rows * ~50px) = ~340px
        const estimatedHeight = 40 + (6 * 50) + 1; // header + 6 rows + border
        const calculatedHeight = Math.min(availableHeight, estimatedHeight);
        
        if (calculatedHeight > 0) {
          tableContainer.style.maxHeight = calculatedHeight + 'px';
        }
      }
    }
  }

  // Toggle PIN visibility with 30-second auto-hide
  const pinVisibilityTimers = {};
  
  function togglePinVisibility(pinId) {
    const pinElement = document.getElementById(pinId);
    if (!pinElement) return;
    
    const actualPin = pinElement.getAttribute('data-pin');
    const eyeIconWrapper = pinElement.parentElement?.querySelector('.pin-eye-icon-wrapper');
    
    if (!actualPin) return;
    
    // Check if PIN is currently visible
    const isVisible = pinElement.textContent !== '••••';
    
    // SVG icons
    const eyeOpenSvg = `
      <svg class="pin-eye-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
        <circle cx="12" cy="12" r="3"></circle>
      </svg>
    `;
    const eyeSlashSvg = `
      <svg class="pin-eye-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
        <line x1="1" y1="1" x2="23" y2="23"></line>
      </svg>
    `;
    
    if (isVisible) {
      // Hide PIN
      pinElement.textContent = '••••';
      if (eyeIconWrapper) {
        eyeIconWrapper.innerHTML = eyeOpenSvg;
      }
      if (pinVisibilityTimers[pinId]) {
        clearTimeout(pinVisibilityTimers[pinId]);
        delete pinVisibilityTimers[pinId];
      }
    } else {
      // Show PIN
      pinElement.textContent = actualPin;
      if (eyeIconWrapper) {
        eyeIconWrapper.innerHTML = eyeSlashSvg;
      }
      
      // Clear any existing timer for this PIN
      if (pinVisibilityTimers[pinId]) {
        clearTimeout(pinVisibilityTimers[pinId]);
      }
      
      // Set timer to hide PIN after 30 seconds
      pinVisibilityTimers[pinId] = setTimeout(() => {
        pinElement.textContent = '••••';
        if (eyeIconWrapper) {
          eyeIconWrapper.innerHTML = eyeOpenSvg;
        }
        delete pinVisibilityTimers[pinId];
      }, 30000); // 30 seconds
    }
  }

  // Expose functions to window for onclick handlers and external access
  window.manageMenuModule = {
    togglePinVisibility: togglePinVisibility,
    initialize: async function(initialTab = 'category') {
      const tab = isManageMenuTab(initialTab) ? initialTab : 'category';
      initializeUI();
      // Show the URL tab immediately (before data finishes loading)
      if (typeof window.manageMenuActivateTab === 'function') {
        window.manageMenuActivateTab(tab);
      }
      // Position sidebar immediately so it never flashes under the header
      setSidebarPosition();
      await initializeData();

      if (manageMenuResizeHandler) {
        window.removeEventListener('resize', manageMenuResizeHandler);
      }
      manageMenuResizeHandler = () => {
        setSidebarPosition();
        updateTableContainerHeight();
      };
      window.addEventListener('resize', manageMenuResizeHandler);

      initializeSidebarBehavior();

      const manageMenuSection = document.getElementById('manageMenuSection');
      const sidebar = manageMenuSection ? manageMenuSection.querySelector('.layout .sidebar') : null;
      const container = manageMenuSection ? manageMenuSection.querySelector('.layout .container') : null;

      if (sidebar) {
        if (window.innerWidth <= 768) {
          sidebar.classList.add('mobile-hidden');
        } else {
          sidebar.classList.add('collapsed');
          sidebar.classList.remove('mobile-hidden');
          if (container) {
            container.classList.add('full-width');
          }
          updateContainerWidth();
        }
      }

      // Re-apply after data load so lists render for the active tab
      if (typeof window.manageMenuActivateTab === 'function') {
        window.manageMenuActivateTab(tab);
      }

      requestAnimationFrame(() => {
        setSidebarPosition();
        updateTableContainerHeight();
      });
    },
    initializeData: initializeData,
    setupRealtimeSubscriptions: setupRealtimeSubscriptions,
    toggleCategoryMenu: toggleCategoryMenu,
    updateCategory: updateCategory,
    removeCategory: removeCategory,
    toggleMenu: toggleMenu,
    editDish: editDish,
    deleteDish: deleteDish,
    loadCategories: loadCategories,
    loadDishes: loadDishes,
    loadStaff: loadStaff,
    createStaff: createStaff,
    deleteStaff: deleteStaff,
    activateTab: function(tab) {
      if (typeof window.manageMenuActivateTab === 'function') {
        window.manageMenuActivateTab(tab);
      }
    },
  };

const MANAGE_MENU_TAB_SLUGS = ['category', 'dish', 'offers', 'theme', 'staff'];

export function isManageMenuTab(tab) {
  return MANAGE_MENU_TAB_SLUGS.includes(tab);
}

export function activateManageMenuTab(tab) {
  const nextTab = isManageMenuTab(tab) ? tab : 'category';
  if (window.manageMenuModule?.activateTab) {
    window.manageMenuModule.activateTab(nextTab);
  } else if (typeof window.manageMenuActivateTab === 'function') {
    window.manageMenuActivateTab(nextTab);
  }
}

export async function bootstrapManageMenu(initialTab = 'category') {
  if (window.manageMenuModule) {
    const tab = isManageMenuTab(initialTab) ? initialTab : 'category';
    await window.manageMenuModule.initialize(tab);
    await window.manageMenuModule.setupRealtimeSubscriptions();
  }
}

export function teardownManageMenu() {
  const supabaseClient = supabase;
  if (categoriesChannel && supabaseClient) {
    supabaseClient.removeChannel(categoriesChannel);
  }
  if (dishesChannel && supabaseClient) {
    supabaseClient.removeChannel(dishesChannel);
  }
  categoriesChannel = null;
  dishesChannel = null;
  if (manageMenuSidebarClickHandler) {
    document.removeEventListener('click', manageMenuSidebarClickHandler);
    manageMenuSidebarClickHandler = null;
  }
  if (manageMenuResizeHandler) {
    window.removeEventListener('resize', manageMenuResizeHandler);
    manageMenuResizeHandler = null;
  }
  manageMenuSidebarInitialized = false;
  delete window.manageMenuActivateTab;
}
