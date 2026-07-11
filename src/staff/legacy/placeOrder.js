'use strict';

import { supabase as sharedSupabase } from '../../lib/supabase.js';

// Staff module — adapted for React

  let supabaseClient;
  let menu = [];
  let categories = [];
  let activeSessionId = null;
  let syncIntervalId = null;
  
  // Check authentication
  function checkAuth() {
    const staffId = localStorage.getItem('staff_id');
    const staffUserId = localStorage.getItem('staff_user_id');
    
    if (!staffId || !staffUserId) {
      window.location.href = '/staff';
      return false;
    }
    
    return true;
  }
  
  // Get restaurant ID (from staff session)
  function getRestaurantId() {
    return localStorage.getItem('staff_user_id');
  }
  
  // Load and apply theme from menu_theme table
  async function loadAndApplyTheme() {
    const restaurantId = getRestaurantId();
    if (!restaurantId || !supabaseClient) return;
    
    try {
      // Load theme colors - restaurant-specific (filtered by restaurantId/user_id)
      // Each restaurant's staff interface shows only their own theme colors
      const { data, error } = await supabaseClient
        .from('menu_theme')
        .select('staff_side_color, button_color')
        .eq('user_id', restaurantId)
        .maybeSingle();
      
      if (error) throw error;
      
      // Use staff_side_color if available, fallback to button_color for backward compatibility
      const colorToUse = (data && data.staff_side_color) ? data.staff_side_color : (data && data.button_color) ? data.button_color : null;
      if (colorToUse) {
        const bc = String(colorToUse).trim();
        if (/^#[0-9A-Fa-f]{6}$/.test(bc)) {
          // Calculate darker variant for hover states
          const r = parseInt(bc.slice(1, 3), 16);
          const g = parseInt(bc.slice(3, 5), 16);
          const b = parseInt(bc.slice(5, 7), 16);
          const hoverR = Math.max(0, r - 22);
          const hoverG = Math.max(0, g - 22);
          const hoverB = Math.max(0, b - 22);
          const hoverHex = '#' + [hoverR, hoverG, hoverB].map(x => x.toString(16).padStart(2, '0')).join('');
          
          // Set CSS custom properties for primary color
          document.documentElement.style.setProperty('--theme-primary-color', bc);
          document.documentElement.style.setProperty('--theme-primary-color-dark', hoverHex);
        }
      }
    } catch (e) {
      console.error('Error loading theme:', e);
      // Keep default colors if theme loading fails
    }
  }
  
  function getSupabaseClient() {
    return sharedSupabase || window.supabaseClient || null;
  }

  function initializeSupabase() {
    supabaseClient = getSupabaseClient();
    if (!supabaseClient) {
      console.error('Supabase client not initialized');
      return;
    }
    initializeApp();
  }

  
  // ==================== SESSION MANAGEMENT ====================
  
  // Get all staff sessions
  function getStaffSessions() {
    const sessionsJson = localStorage.getItem('staff_sessions');
    return sessionsJson ? JSON.parse(sessionsJson) : {};
  }
  
  // Save all staff sessions
  function saveStaffSessions(sessions) {
    localStorage.setItem('staff_sessions', JSON.stringify(sessions));
  }
  
  // Create new session
  function createNewSession(tableNumber) {
    const sessionId = `session_${tableNumber}_${Date.now()}`;
    const session = {
      id: sessionId,
      tableNumber: tableNumber || null,
      cart: {},
      createdAt: new Date().toISOString(),
      status: 'active'
    };
    
    const sessions = getStaffSessions();
    sessions[sessionId] = session;
    saveStaffSessions(sessions);
    
    setActiveSession(sessionId);
    return sessionId;
  }
  
  // Set active session
  function setActiveSession(sessionId) {
    activeSessionId = sessionId;
    localStorage.setItem('activeStaffSession', sessionId);
    renderSessionTabs();
    
    // Restore menu section if it's showing empty state
    const menuSection = document.getElementById('menuSection');
    if (menuSection && menuSection.querySelector('.empty-state')) {
      restoreMenuSection();
    }
    
    renderCurrentSessionCart();
  }
  
  // Get active session
  function getActiveSession() {
    if (!activeSessionId) {
      activeSessionId = localStorage.getItem('activeStaffSession');
    }
    
    if (!activeSessionId) return null;
    
    const sessions = getStaffSessions();
    return sessions[activeSessionId] || null;
  }
  
  // Delete session
  function deleteSession(sessionId) {
    const sessions = getStaffSessions();
    delete sessions[sessionId];
    saveStaffSessions(sessions);
    
    if (activeSessionId === sessionId) {
      activeSessionId = null;
      localStorage.removeItem('activeStaffSession');
      
      // Switch to another session or show empty state
      const remainingSessions = Object.keys(sessions);
      if (remainingSessions.length > 0) {
        setActiveSession(remainingSessions[0]);
      } else {
        renderSessionTabs();
        renderCurrentSessionCart();
        showEmptyState();
      }
    } else {
      renderSessionTabs();
    }
  }
  
  // Get cart item count for session
  function getCartItemCount(cart) {
    return Object.values(cart).reduce((sum, item) => sum + (item.qty || 0), 0);
  }
  
  // ==================== UI RENDERING ====================
  
  // Render session tabs
  function renderSessionTabs() {
    const sessionsList = document.getElementById('sessionsList');
    if (!sessionsList) return;
    
    const sessions = getStaffSessions();
    // Show both 'active' (cart with items) and 'ordered' (order placed, waiting for payment/cancellation) sessions
    const visibleSessions = Object.values(sessions)
      .filter(s => s.status === 'active' || s.status === 'ordered')
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    sessionsList.innerHTML = '';
    
    if (visibleSessions.length === 0) {
      document.getElementById('sessionsBar').style.display = 'none';
      return;
    }
    
    document.getElementById('sessionsBar').style.display = 'block';
    
    visibleSessions.forEach(session => {
      const tab = document.createElement('button');
      tab.className = `session-tab ${session.id === activeSessionId ? 'active' : ''}`;
      const itemCount = session.status === 'ordered' ? 0 : getCartItemCount(session.cart);
      // Show table number or 'Takeaway' (no order number)
      const labelText = session.tableNumber || 'Takeaway';
      tab.innerHTML = `
        <span class="tab-label">${labelText}</span>
        <span class="tab-count">${itemCount}</span>
      `;
      tab.onclick = () => setActiveSession(session.id);
      sessionsList.appendChild(tab);
    });
  }
  
  // Render cart modal
  function renderCartModal() {
    const session = getActiveSession();
    const modalCartItems = document.getElementById('modalCartItems');
    const modalCartCount = document.getElementById('modalCartCount');
    const modalCartTotal = document.getElementById('modalCartTotal');
    const modalPlaceOrderBtn = document.getElementById('modalPlaceOrderBtn');
    
    if (!session) {
      if (modalCartItems) modalCartItems.innerHTML = '<p class="empty-cart">No active session</p>';
      if (modalCartCount) modalCartCount.textContent = '0';
      if (modalCartTotal) modalCartTotal.textContent = '₹0.00';
      if (modalPlaceOrderBtn) modalPlaceOrderBtn.disabled = true;
      return;
    }
    
    const cart = session.cart || {};
    const itemCount = getCartItemCount(cart);
    
    if (modalCartCount) modalCartCount.textContent = itemCount;
    
    if (itemCount === 0) {
      if (modalCartItems) modalCartItems.innerHTML = '<p class="empty-cart">Cart is empty</p>';
      if (modalCartTotal) modalCartTotal.textContent = '₹0.00';
      if (modalPlaceOrderBtn) modalPlaceOrderBtn.disabled = true;
    } else {
      // Render cart items
      if (modalCartItems) {
        modalCartItems.innerHTML = '';
        let total = 0;
        
        Object.values(cart).forEach(item => {
          const price = parseFloat(String(item.price).replace('₹', '').replace(',', '')) || 0;
          const itemTotal = price * (item.qty || 1);
          total += itemTotal;
          
          const cartItem = document.createElement('div');
          cartItem.className = 'cart-item';
          cartItem.innerHTML = `
            <div class="cart-item-info">
              <strong>${item.name}</strong>
              <span>₹${price.toFixed(2)} × ${item.qty}</span>
            </div>
            <div class="cart-item-actions">
              <button class="qty-btn" onclick="window.staffPlaceOrder.updateQty('${item.name.replace(/'/g, "\\'")}', -1); window.staffPlaceOrder.renderCartModal();">−</button>
              <span class="qty-display">${item.qty}</span>
              <button class="qty-btn" onclick="window.staffPlaceOrder.updateQty('${item.name.replace(/'/g, "\\'")}', 1); window.staffPlaceOrder.renderCartModal();">+</button>
            </div>
            <div class="cart-item-total">₹${itemTotal.toFixed(2)}</div>
          `;
          modalCartItems.appendChild(cartItem);
        });
        
        if (modalCartTotal) modalCartTotal.textContent = `₹${total.toFixed(2)}`;
        if (modalPlaceOrderBtn) {
          modalPlaceOrderBtn.disabled = false;
          modalPlaceOrderBtn.onclick = () => {
            placeOrder();
            const cartModal = document.getElementById('cartModal');
            if (cartModal) cartModal.style.display = 'none';
          };
        }
      }
    }
  }
  
  // Update floating kart button
  function updateKartButton() {
    const session = getActiveSession();
    const kartBadge = document.getElementById('kartBadge');
    const floatingKartBtn = document.getElementById('floatingKartBtn');
    
    if (!floatingKartBtn) return;
    
    if (!session || !kartBadge) {
      if (kartBadge) kartBadge.textContent = '0';
      // Hide button if no session
      floatingKartBtn.style.display = 'none';
      return;
    }
    
    const cart = session.cart || {};
    const itemCount = session.status === 'ordered' ? 0 : getCartItemCount(cart);
    
    // Show/hide the entire Kart button based on item count
    if (itemCount === 0) {
      floatingKartBtn.style.display = 'none';
      if (kartBadge) kartBadge.style.display = 'none';
    } else {
      floatingKartBtn.style.display = 'flex';
      if (kartBadge) {
        kartBadge.textContent = itemCount;
        kartBadge.style.display = 'flex';
      }
    }
  }
  
  // Render current session cart
  function renderCurrentSessionCart() {
    const session = getActiveSession();
    const menuSection = document.getElementById('menuSection');
    
    if (!session) {
      showEmptyState();
      updateKartButton();
      return;
    }
    
    // If session exists, make sure menu section is restored (not empty state)
    if (menuSection && menuSection.querySelector('.empty-state')) {
      restoreMenuSection();
    }
    
    updateKartButton();
  }
  
  // Show empty state
  function showEmptyState() {
    const menuSection = document.getElementById('menuSection');
    if (menuSection) {
      menuSection.innerHTML = `
        <div class="empty-state">
          <p>No active order session</p>
          <button class="btn-primary" onclick="document.getElementById('newSessionBtn').click()">
            Create New Order
          </button>
        </div>
      `;
    }
  }
  
  // Restore menu section (when session becomes active)
  function restoreMenuSection() {
    const menuSection = document.getElementById('menuSection');
    if (menuSection) {
      menuSection.innerHTML = `
        <div class="menu-grid" id="menuGrid">
          <!-- Menu items will be loaded here -->
        </div>
      `;
      
      // Re-setup search input event listener
      const menuSearch = document.getElementById('menuSearch');
      if (menuSearch) {
        let searchTimeout;
        menuSearch.addEventListener('input', (e) => {
          clearTimeout(searchTimeout);
          searchTimeout = setTimeout(() => {
            renderMenu(e.target.value);
          }, 300);
        });
      }
      
      // Reload menu
      loadMenu();
    }
  }
  
  // ==================== MENU LOADING ====================
  
  // Load menu data
  async function loadMenu() {
    const restaurantId = getRestaurantId();
    if (!restaurantId) {
      console.error('Restaurant ID not found');
      return;
    }
    
    try {
      // Load categories
      const { data: categoriesData, error: catError } = await supabaseClient
        .from('categories')
        .select('*')
        .eq('user_id', restaurantId)
        .order('display_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });
      
      if (catError) throw catError;
      categories = (categoriesData || []).map(c => c.name);
      
      // Load dishes
      const { data: dishesData, error: dishesError } = await supabaseClient
        .from('dishes')
        .select(`
          *,
          categories:category_id (
            id,
            name
          )
        `)
        .eq('user_id', restaurantId)
        .order('dish_name');
      
      if (dishesError) throw dishesError;
      
      menu = (dishesData || []).map(dish => ({
        ...dish,
        name: dish.dish_name,
        category: dish.categories?.name || '',
        image: dish.image_url,
        price: dish.price
      }));
      
      renderMenu();
      renderCategoryFilters();
    } catch (error) {
      console.error('Error loading menu:', error);
      alert('Failed to load menu. Please refresh the page.');
    }
  }
  
  // Render category filters
  function renderCategoryFilters() {
    const categoryFilter = document.getElementById('categoryFilter');
    if (!categoryFilter) return;
    
    // Clear existing options except "All Categories"
    categoryFilter.innerHTML = '<option value="all">All Categories</option>';
    
    // Add category options
    categories.forEach(category => {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = category;
      categoryFilter.appendChild(option);
    });
    
    // Add event listener for category filter change
    categoryFilter.addEventListener('change', (e) => {
      const selectedCategory = e.target.value === 'all' ? null : e.target.value;
      const searchQuery = document.getElementById('menuSearch')?.value || '';
      renderMenu(searchQuery, selectedCategory);
    });
  }
  
  // Render menu
  function renderMenu(searchQuery = '', categoryFilter = null) {
    const menuGrid = document.getElementById('menuGrid');
    if (!menuGrid) return;
    
    let filteredMenu = menu;
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filteredMenu = filteredMenu.filter(dish => 
        dish.name.toLowerCase().includes(query) ||
        (dish.description && dish.description.toLowerCase().includes(query))
      );
    }
    
    // Apply category filter
    if (categoryFilter) {
      filteredMenu = filteredMenu.filter(dish => dish.category === categoryFilter);
    }
    
    menuGrid.innerHTML = '';
    
    if (filteredMenu.length === 0) {
      menuGrid.innerHTML = '<p class="no-items">No dishes found</p>';
      return;
    }
    
    // Get current session cart to check if items are already added
    const session = getActiveSession();
    const cart = session?.cart || {};
    
    filteredMenu.forEach(dish => {
      const menuItem = document.createElement('div');
      menuItem.className = 'menu-item';
      // Create image element with proper error handling
      const img = document.createElement('img');
      img.className = 'menu-item-img';
      img.src = dish.image || '';
      img.alt = dish.name;
      img.onerror = function() {
        // Use a simple data URI as fallback (1x1 transparent pixel)
        this.src = 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'200\' height=\'200\'%3E%3Crect fill=\'%23f3f4f6\' width=\'200\' height=\'200\'/%3E%3Ctext x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' dy=\'.3em\' fill=\'%239ca3af\' font-family=\'Arial\' font-size=\'14\'%3ENo Image%3C/text%3E%3C/svg%3E';
        this.onerror = null; // Prevent infinite loop
      };
      
      // Check if item is in cart
      const cartItem = cart[dish.name];
      const isInCart = cartItem && cartItem.qty > 0;
      const quantity = isInCart ? cartItem.qty : 0;
      
      // Build button HTML - show quantity selector if in cart, otherwise show Add button
      let buttonHTML = '';
      if (isInCart) {
        buttonHTML = `
          <div class="menu-qty-selector">
            <button class="menu-qty-btn minus" onclick="window.staffPlaceOrder.updateQty('${dish.name.replace(/'/g, "\\'")}', -1);">−</button>
            <span class="menu-qty-display">${quantity}</span>
            <button class="menu-qty-btn plus" onclick="window.staffPlaceOrder.addToCart('${dish.name.replace(/'/g, "\\'")}', ${dish.price}, '${(dish.image || '').replace(/'/g, "\\'")}', '${dish.id}');">+</button>
          </div>
        `;
      } else {
        buttonHTML = `
          <button class="add-to-cart-btn" onclick="window.staffPlaceOrder.addToCart('${dish.name.replace(/'/g, "\\'")}', ${dish.price}, '${(dish.image || '').replace(/'/g, "\\'")}', '${dish.id}');">
            Add
          </button>
        `;
      }
      
      menuItem.innerHTML = `
        <div class="menu-item-info">
          <h3>${dish.name}</h3>
          <p>${dish.description || ''}</p>
          <div class="menu-item-footer">
            <span class="price">₹${dish.price}</span>
            ${buttonHTML}
          </div>
        </div>
      `;
      
      // Insert image as first child of menu-item (same div as info)
      menuItem.insertBefore(img, menuItem.firstChild);
      // Add data attribute to easily find this item later
      menuItem.setAttribute('data-dish-name', dish.name);
      menuGrid.appendChild(menuItem);
    });
  }
  
  // Update only the button for a specific menu item (without re-rendering the entire menu)
  function updateMenuItemButton(dishName) {
    const menuItem = document.querySelector(`[data-dish-name="${dishName.replace(/"/g, '\\"')}"]`);
    if (!menuItem) return;
    
    const session = getActiveSession();
    const cart = session?.cart || {};
    const cartItem = cart[dishName];
    const isInCart = cartItem && cartItem.qty > 0;
    const quantity = isInCart ? cartItem.qty : 0;
    
    const footer = menuItem.querySelector('.menu-item-footer');
    if (!footer) return;
    
    // Get dish data from menu array
    const dish = menu.find(d => d.name === dishName);
    if (!dish) return;
    
    // Build button HTML
    let buttonHTML = '';
    if (isInCart) {
      buttonHTML = `
        <div class="menu-qty-selector">
          <button class="menu-qty-btn minus" onclick="window.staffPlaceOrder.updateQty('${dishName.replace(/'/g, "\\'")}', -1);">−</button>
          <span class="menu-qty-display">${quantity}</span>
          <button class="menu-qty-btn plus" onclick="window.staffPlaceOrder.addToCart('${dishName.replace(/'/g, "\\'")}', ${dish.price}, '${(dish.image || '').replace(/'/g, "\\'")}', '${dish.id}');">+</button>
        </div>
      `;
    } else {
      buttonHTML = `
        <button class="add-to-cart-btn" onclick="window.staffPlaceOrder.addToCart('${dishName.replace(/'/g, "\\'")}', ${dish.price}, '${(dish.image || '').replace(/'/g, "\\'")}', '${dish.id}');">
          Add
        </button>
      `;
    }
    
    // Replace only the button part (keep price)
    const priceSpan = footer.querySelector('.price');
    footer.innerHTML = '';
    if (priceSpan) {
      footer.appendChild(priceSpan);
    }
    // Insert button HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = buttonHTML;
    while (tempDiv.firstChild) {
      footer.appendChild(tempDiv.firstChild);
    }
  }
  
  // Filter by category
  function filterByCategory(category) {
    const searchInput = document.getElementById('menuSearch');
    const searchQuery = searchInput?.value || '';
    renderMenu(searchQuery, category);
    
    // Update active filter
    document.querySelectorAll('.category-filter-btn').forEach(btn => {
      btn.classList.toggle('active', btn.textContent === category);
    });
  }
  
  // ==================== CART OPERATIONS ====================
  
  // Add to cart
  function addToCart(dishName, price, image, dishId) {
    const session = getActiveSession();
    if (!session) {
      alert('Please create a new order session first');
      return;
    }
    
    // If session has an order placed, reactivate it to allow adding more items
    if (session.status === 'ordered') {
      session.status = 'active';
    }
    
    const cart = session.cart || {};
    
    if (cart[dishName]) {
      cart[dishName].qty += 1;
    } else {
      cart[dishName] = {
        name: dishName,
        price: `₹${price}`,
        image: image,
        dish_id: dishId,
        qty: 1
      };
    }
    
    session.cart = cart;
    
    const sessions = getStaffSessions();
    sessions[session.id] = session;
    saveStaffSessions(sessions);
    
    renderCurrentSessionCart();
    renderSessionTabs();
    
    // Update cart modal if it's open
    const cartModal = document.getElementById('cartModal');
    if (cartModal && cartModal.style.display === 'flex') {
      renderCartModal();
    }
    
    // Update only the button for this specific item (without re-rendering entire menu)
    updateMenuItemButton(dishName);
  }
  
  // Update quantity
  function updateQty(dishName, delta) {
    const session = getActiveSession();
    if (!session) return;
    
    const cart = session.cart || {};
    if (!cart[dishName]) return;
    
    cart[dishName].qty += delta;
    
    if (cart[dishName].qty < 1) {
      delete cart[dishName];
    }
    
    session.cart = cart;
    
    const sessions = getStaffSessions();
    sessions[session.id] = session;
    saveStaffSessions(sessions);
    
    renderCurrentSessionCart();
    renderSessionTabs();
    
    // Update cart modal if it's open
    const cartModal = document.getElementById('cartModal');
    if (cartModal && cartModal.style.display === 'flex') {
      renderCartModal();
    }
    
    // Update only the button for this specific item (without re-rendering entire menu)
    updateMenuItemButton(dishName);
  }
  
  // Remove item
  function removeItem(dishName) {
    const session = getActiveSession();
    if (!session) return;
    
    const cart = session.cart || {};
    delete cart[dishName];
    
    session.cart = cart;
    
    const sessions = getStaffSessions();
    sessions[session.id] = session;
    saveStaffSessions(sessions);
    
    renderCurrentSessionCart();
    renderSessionTabs();
    
    // Update cart modal if it's open
    const cartModal = document.getElementById('cartModal');
    if (cartModal && cartModal.style.display === 'flex') {
      renderCartModal();
    }
  }
  
  // ==================== ORDER PLACEMENT ====================
  
  // Place order for current session
  async function placeOrder() {
    const session = getActiveSession();
    if (!session) {
      alert('No active session');
      return;
    }
    
    const cart = session.cart || {};
    if (Object.keys(cart).length === 0) {
      alert('Cart is empty');
      return;
    }
    
    // Calculate total
    let total = 0;
    Object.values(cart).forEach(item => {
      const price = parseFloat(String(item.price).replace('₹', '').replace(',', '')) || 0;
      total += price * (item.qty || 1);
    });
    
    const placeOrderBtn = document.getElementById('placeOrderBtn');
    if (placeOrderBtn) {
      placeOrderBtn.disabled = true;
      placeOrderBtn.textContent = 'Placing...';
    }
    
    try {
      const orderResult = await saveOrderToDatabase(cart, 'unpaid_new', total, session.tableNumber);
      
      if (orderResult && orderResult.orderNumber) {
        // Store order_id and order_number in session (don't delete session)
        session.status = 'ordered';
        session.orderNumber = orderResult.orderNumber;
        session.orderId = orderResult.orderId;
        session.placedAt = new Date().toISOString();
        // Clear cart after order is placed (items are now in database)
        session.cart = {};
        
        const sessions = getStaffSessions();
        sessions[session.id] = session;
        saveStaffSessions(sessions);
        
        // Keep session active - don't delete it
        // Session will be removed when order is paid or cancelled
        renderSessionTabs();
        renderCurrentSessionCart();
        
        // Refresh menu to update all item buttons (remove quantity selectors, show Add buttons)
        const menuSearch = document.getElementById('menuSearch');
        const categoryFilter = document.getElementById('categoryFilter');
        const searchQuery = menuSearch?.value || '';
        const selectedCategory = categoryFilter?.value === 'all' ? null : categoryFilter?.value;
        renderMenu(searchQuery, selectedCategory);
        
        // Show success modal
        showOrderPlacedModal(orderResult.orderNumber, session.tableNumber);
      } else {
        alert('Failed to place order. Please try again.');
      }
    } catch (error) {
      console.error('Error placing order:', error);
      alert('Error placing order: ' + (error.message || 'Unknown error'));
    } finally {
      if (placeOrderBtn) {
        placeOrderBtn.disabled = false;
        placeOrderBtn.textContent = 'Place Order';
      }
    }
  }
  
  // Save order to database
  async function saveOrderToDatabase(cart, paymentMethod, total, tableNumber) {
    const restaurantId = getRestaurantId();
    const staffId = localStorage.getItem('staff_id');
    const staffName = localStorage.getItem('staff_name');
    
    if (!restaurantId) {
      alert('Restaurant ID not found');
      return null;
    }
    
    try {
      // Step 1: Check if there's an existing unpaid order for the same table
      // An order is unpaid if payment_method is 'unpaid_new' or 'unpaid_pay_at_counter' and not cancelled
      function isUnpaidOrder(order) {
        return (order.payment_method === 'unpaid_new' || order.payment_method === 'unpaid_pay_at_counter') && !order.cancelled;
      }
      
      let existingUnpaidOrder = null;
      
      // Only check for existing order if table number is provided
      if (tableNumber) {
        try {
          // Try to query with staff_id (if column exists)
          let { data: existingOrders, error: queryError } = await supabaseClient
            .from('orders')
            .select('id, order_number, total_amount, payment_method, cancelled, table_number, staff_id')
            .eq('user_id', restaurantId)
            .eq('table_number', String(tableNumber))
            .eq('cancelled', false)
            .order('created_at', { ascending: false })
            .limit(10);
          
          // If staff_id column doesn't exist, retry without it
          if (queryError && (queryError.code === '42703' || queryError.message.includes('staff_id'))) {
            const { data: retryOrders, error: retryError } = await supabaseClient
              .from('orders')
              .select('id, order_number, total_amount, payment_method, cancelled, table_number')
              .eq('user_id', restaurantId)
              .eq('table_number', String(tableNumber))
              .eq('cancelled', false)
              .order('created_at', { ascending: false })
              .limit(10);
            
            if (!retryError && retryOrders) {
              existingOrders = retryOrders;
              // Add staff_id as null for all orders
              existingOrders.forEach(o => o.staff_id = null);
            }
          } else if (queryError) {
            throw queryError;
          }
          
          // Find the most recent unpaid order for this table
          if (existingOrders && existingOrders.length > 0) {
            existingUnpaidOrder = existingOrders.find(order => isUnpaidOrder(order));
            
            if (existingUnpaidOrder) {
              console.log('✅ Found existing unpaid order for table', tableNumber, 'Order #', existingUnpaidOrder.order_number);
            }
          }
        } catch (error) {
          console.warn('Could not check for existing orders:', error.message);
          // Continue to create new order
        }
      }
      
      // Step 2: If existing unpaid order found, merge items into it
      if (existingUnpaidOrder) {
        return await mergeItemsIntoExistingOrder(existingUnpaidOrder, cart, total, tableNumber, staffId);
      }
      
      // Step 3: No existing order found - create new order
      // Get next order number
      let nextOrderNumber = 1;
      const { data: maxOrderData } = await supabaseClient
        .from('orders')
        .select('order_number')
        .eq('user_id', restaurantId)
        .not('order_number', 'is', null)
        .order('order_number', { ascending: false })
        .limit(1);
      
      if (maxOrderData && maxOrderData.length > 0) {
        const maxOrderNum = maxOrderData[0].order_number;
        nextOrderNumber = (typeof maxOrderNum === 'number' ? maxOrderNum : parseInt(maxOrderNum) || 0) + 1;
      }
      
      // Create order
      const { data: rpcResult, error: orderError } = await supabaseClient.rpc('insert_order', {
        p_user_id: restaurantId,
        p_total_amount: parseFloat(total).toFixed(2),
        p_payment_method: paymentMethod,
        p_order_number: nextOrderNumber
      });
      
      let orderId = null;
      if (!orderError && rpcResult) {
        if (typeof rpcResult === 'object' && rpcResult.order_id) {
          orderId = rpcResult.order_id;
          nextOrderNumber = rpcResult.order_number;
        } else if (typeof rpcResult === 'string') {
          orderId = rpcResult;
        } else {
          orderId = rpcResult;
        }
      }
      
      if (!orderId) {
        throw new Error('Failed to create order');
      }
      
      // Insert order items
      const orderItems = Object.values(cart).map(item => {
        const priceStr = String(item.price || '0').replace(/[₹$,]/g, '').trim();
        const price = parseFloat(priceStr) || 0;
        
        return {
          order_id: orderId,
          dish_id: item.dish_id || null,
          dish_name: item.name || 'Unknown Item',
          price: parseFloat(price).toFixed(2),
          quantity: parseInt(item.qty) || 1
        };
      });
      
      const insertPromises = orderItems.map(item => 
        supabaseClient.rpc('insert_order_item', {
          p_order_id: orderId,
          p_dish_id: item.dish_id,
          p_dish_name: item.dish_name,
          p_price: item.price,
          p_quantity: item.quantity
        })
      );
      
      const itemsResults = await Promise.all(insertPromises);
      const itemsError = itemsResults.find(result => result.error)?.error;
      
      if (itemsError) {
        console.error('Error saving order items:', itemsError);
        console.error('Items error details:', JSON.stringify(itemsError, null, 2));
        alert('Error saving order items: ' + (itemsError.message || 'Unknown error'));
        // Order was created but items failed - continue anyway
      } else {
        console.log('✅ Order items saved successfully:', orderItems.length, 'items');
      }
      
      // Set table number
      if (tableNumber) {
        await supabaseClient.rpc('update_order_table_number', {
          p_order_id: orderId,
          p_table_number: String(tableNumber)
        });
      }
      
      // Mark order as placed by staff (if staff_id exists)
      // IMPORTANT: Set staff_id immediately after order creation so it's tracked
      if (staffId) {
        // Try to update staff_id field (if it exists in database)
        // If column doesn't exist, this will fail silently
        try {
          const { error: updateError } = await supabaseClient
            .from('orders')
            .update({ staff_id: staffId })
            .eq('id', orderId);
          
          if (updateError) {
            // Check if error is due to missing column
            if (updateError.code === '42703' || updateError.message.includes('staff_id')) {
              console.error('❌ staff_id column does not exist in orders table.');
              console.error('To enable "Orders by Me" feature, run this SQL:');
              console.error('ALTER TABLE orders ADD COLUMN staff_id UUID REFERENCES staff(id);');
            } else if (updateError.code === '42501' || updateError.message.includes('permission') || updateError.message.includes('policy')) {
              console.error('❌ RLS policy is blocking staff_id update:', updateError.message);
              console.error('You need to create an RLS policy to allow updating orders.staff_id');
            } else {
              console.error('❌ Could not update staff_id:', updateError.message);
              console.error('Error code:', updateError.code);
            }
          } else {
            console.log('✅ Order tagged with staff_id:', staffId);
          }
        } catch (error) {
          // Column might not exist yet - that's okay
          console.log('Note: staff_id column may not exist in orders table');
        }
      }
      
      return {
        orderNumber: String(nextOrderNumber).padStart(2, '0'),
        orderId: orderId
      };
    } catch (error) {
      console.error('Error saving order:', error);
      throw error;
    }
  }
  
  // Merge items into existing unpaid order
  async function mergeItemsIntoExistingOrder(existingOrder, cart, newItemsTotal, tableNumber, staffId) {
    try {
      const orderId = existingOrder.id;
      const existingOrderNumber = existingOrder.order_number;
      const existingTotal = parseFloat(existingOrder.total_amount || 0) || 0;
      
      console.log('🔄 Merging items into existing order:', orderId, 'Order #', existingOrderNumber);
      
      // Update table number on existing order (if needed)
      if (tableNumber) {
        const { error: rpcErr } = await supabaseClient.rpc('update_order_table_number', {
          p_order_id: orderId,
          p_table_number: String(tableNumber)
        });
        if (rpcErr) {
          const { error: updateErr } = await supabaseClient
            .from('orders')
            .update({ table_number: String(tableNumber) })
            .eq('id', orderId);
          if (updateErr) console.warn('Could not set table_number on order:', updateErr.message);
        }
      }
      
      // Prepare new order items from cart
      const newOrderItems = Object.values(cart).map(item => {
        const priceStr = String(item.price || '0').replace(/[₹$,]/g, '').trim();
        const price = parseFloat(priceStr) || 0;
        
        return {
          order_id: orderId,
          dish_id: item.dish_id || null,
          dish_name: item.name || 'Unknown Item',
          price: parseFloat(price).toFixed(2),
          quantity: parseInt(item.qty) || 1
        };
      });
      
      // Insert all new items as separate items (don't merge quantities)
      const insertPromises = newOrderItems.map(item => 
        supabaseClient.rpc('insert_order_item', {
          p_order_id: orderId,
          p_dish_id: item.dish_id,
          p_dish_name: item.dish_name,
          p_price: item.price,
          p_quantity: item.quantity
        })
      );
      
      const itemsResults = await Promise.all(insertPromises);
      const insertItemsError = itemsResults.find(result => result.error)?.error;
      
      if (insertItemsError) {
        console.error('Error inserting merged order items:', insertItemsError);
        console.error('Items error details:', JSON.stringify(insertItemsError, null, 2));
        // Continue anyway - some items may have been added
      } else {
        console.log('✅ Merged order items saved successfully:', newOrderItems.length, 'items');
      }
      
      // Calculate new total: existing total + new items total
      const updatedTotal = existingTotal + parseFloat(newItemsTotal);
      
      // Update order total_amount
      const { error: updateOrderError } = await supabaseClient
        .from('orders')
        .update({ total_amount: updatedTotal.toFixed(2) })
        .eq('id', orderId);
      
      if (updateOrderError) {
        console.warn('⚠ Could not update order total:', updateOrderError.message);
      } else {
        console.log('✅ Order total updated:', existingTotal, '+', newItemsTotal, '=', updatedTotal);
      }
      
      // Mark order as placed by staff (if staff_id exists and order doesn't have staff_id yet)
      // IMPORTANT: Set staff_id on merged orders so they appear in "Orders by Me"
      if (staffId) {
        // Always try to set staff_id, even if order already has one (in case it was customer-placed)
        // This ensures staff can claim ownership of orders they modify
        try {
          const { error: updateError } = await supabaseClient
            .from('orders')
            .update({ staff_id: staffId })
            .eq('id', orderId);
          
          if (updateError) {
            if (updateError.code === '42703' || updateError.message.includes('staff_id')) {
              console.error('❌ staff_id column does not exist in orders table.');
              console.error('To enable "Orders by Me" feature, run this SQL:');
              console.error('ALTER TABLE orders ADD COLUMN staff_id UUID REFERENCES staff(id);');
            } else if (updateError.code === '42501' || updateError.message.includes('permission') || updateError.message.includes('policy')) {
              console.error('❌ RLS policy is blocking staff_id update:', updateError.message);
              console.error('You need to create an RLS policy to allow updating orders.staff_id');
            } else {
              console.error('❌ Could not update staff_id:', updateError.message);
              console.error('Error code:', updateError.code);
            }
          } else {
            console.log('✅ Merged order tagged with staff_id:', staffId);
          }
        } catch (error) {
          console.log('Note: staff_id column may not exist');
        }
      }
      
      // Return formatted order number and order ID
      const displayOrderNumber = String(existingOrderNumber).padStart(2, '0');
      console.log('✅ Items merged into existing order #', displayOrderNumber);
      return {
        orderNumber: displayOrderNumber,
        orderId: orderId
      };
      
    } catch (error) {
      console.error('Error merging items into existing order:', error);
      throw error;
    }
  }
  
  // Show order placed modal
  function showOrderPlacedModal(orderNumber, tableNumber) {
    const modal = document.getElementById('orderPlacedModal');
    const orderNumberDisplay = document.getElementById('orderNumberDisplay');
    const orderTableDisplay = document.getElementById('orderTableDisplay');
    
    if (modal && orderNumberDisplay && orderTableDisplay) {
      orderNumberDisplay.textContent = `#${orderNumber}`;
      orderTableDisplay.textContent = tableNumber || 'Takeaway';
      modal.style.display = 'flex';
    }
  }
  
  // ==================== MODAL HANDLERS ====================
  
  // Setup modals
  function setupModals() {
    // New session modal
    const newSessionBtn = document.getElementById('newSessionBtn');
    const newSessionModal = document.getElementById('newSessionModal');
    const cancelNewSessionBtn = document.getElementById('cancelNewSessionBtn');
    const createSessionBtn = document.getElementById('createSessionBtn');
    const tableNumberInput = document.getElementById('tableNumberInput');
    
    if (newSessionBtn) {
      newSessionBtn.addEventListener('click', () => {
        if (newSessionModal) newSessionModal.style.display = 'flex';
        if (tableNumberInput) tableNumberInput.focus();
      });
    }
    
    if (cancelNewSessionBtn) {
      cancelNewSessionBtn.addEventListener('click', () => {
        if (newSessionModal) newSessionModal.style.display = 'none';
        if (tableNumberInput) tableNumberInput.value = '';
      });
    }
    
    if (createSessionBtn) {
      createSessionBtn.addEventListener('click', () => {
        const tableNumber = tableNumberInput?.value?.trim() || '';
        if (!tableNumber) {
          alert('Please enter table number');
          return;
        }
        
        createNewSession(tableNumber);
        if (newSessionModal) newSessionModal.style.display = 'none';
        if (tableNumberInput) tableNumberInput.value = '';
      });
    }
    
    
    // Order placed modal
    const placeAnotherBtn = document.getElementById('placeAnotherBtn');
    const backToDashboardBtn = document.getElementById('backToDashboardBtn');
    
    if (placeAnotherBtn) {
      placeAnotherBtn.addEventListener('click', () => {
        const modal = document.getElementById('orderPlacedModal');
        if (modal) modal.style.display = 'none';
      });
    }
    
    if (backToDashboardBtn) {
      backToDashboardBtn.addEventListener('click', () => {
        window.location.href = '/staff/dashboard';
      });
    }
    
    // Floating kart button click handler
    const floatingKartBtn = document.getElementById('floatingKartBtn');
    const cartModal = document.getElementById('cartModal');
    const closeCartModal = document.getElementById('closeCartModal');
    
    if (floatingKartBtn) {
      floatingKartBtn.addEventListener('click', () => {
        const session = getActiveSession();
        if (!session) {
          alert('Please create a new order session first');
          return;
        }
        
        renderCartModal();
        if (cartModal) cartModal.style.display = 'flex';
      });
    }
    
    if (closeCartModal) {
      closeCartModal.addEventListener('click', () => {
        if (cartModal) cartModal.style.display = 'none';
      });
    }
    
    // Close cart modal when clicking outside
    if (cartModal) {
      cartModal.addEventListener('click', (e) => {
        if (e.target === cartModal) {
          cartModal.style.display = 'none';
        }
      });
    }
    
    // Search input
    const menuSearch = document.getElementById('menuSearch');
    if (menuSearch) {
      let searchTimeout;
      menuSearch.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          renderMenu(e.target.value);
        }, 300);
      });
    }
  }
  
  // ==================== INITIALIZATION ====================
  
  // Check order status and clean up paid/cancelled order sessions
  async function syncSessionsWithOrders() {
    const sessions = getStaffSessions();
    const restaurantId = getRestaurantId();
    const sessionsToRemove = [];
    
    // Get all sessions with orders
    const orderedSessions = Object.values(sessions).filter(s => s.status === 'ordered' && s.orderId);
    
    if (orderedSessions.length === 0) {
      return; // No ordered sessions to check
    }
    
    try {
      // Fetch order statuses for all ordered sessions
      const orderIds = orderedSessions.map(s => s.orderId).filter(id => id);
      
      if (orderIds.length === 0) return;
      
      const { data: orders, error } = await supabaseClient
        .from('orders')
        .select('id, payment_method, cancelled')
        .in('id', orderIds)
        .eq('user_id', restaurantId);
      
      if (error) {
        console.warn('Could not check order statuses:', error.message);
        return;
      }
      
      if (!orders || orders.length === 0) return;
      
      // Create a map of order statuses
      const orderStatusMap = new Map();
      orders.forEach(order => {
        const isPaid = order.payment_method && 
                      order.payment_method !== 'unpaid_new' && 
                      order.payment_method !== 'unpaid_pay_at_counter' &&
                      (order.payment_method === 'upi' || 
                       order.payment_method === 'cash' ||
                       order.payment_method === 'card');
        const isCancelled = order.cancelled === true;
        orderStatusMap.set(order.id, { isPaid, isCancelled });
      });
      
      // Mark sessions for removal if their orders are paid or cancelled
      Object.keys(sessions).forEach(sessionId => {
        const session = sessions[sessionId];
        if (session.status === 'ordered' && session.orderId) {
          const status = orderStatusMap.get(session.orderId);
          if (status && (status.isPaid || status.isCancelled)) {
            sessionsToRemove.push(sessionId);
          }
        }
      });
      
      // Remove paid/cancelled order sessions
      sessionsToRemove.forEach(sessionId => {
        delete sessions[sessionId];
        if (activeSessionId === sessionId) {
          activeSessionId = null;
          localStorage.removeItem('activeStaffSession');
        }
      });
      
      if (sessionsToRemove.length > 0) {
        saveStaffSessions(sessions);
        console.log(`✅ Removed ${sessionsToRemove.length} session(s) for paid/cancelled orders`);
      }
    } catch (error) {
      console.warn('Error syncing sessions with orders:', error);
    }
  }
  
  function initializeApp() {
    if (!checkAuth()) return;
    
    // Load theme first
    loadAndApplyTheme();
    
    setupModals();
    loadMenu();
    
    // Sync sessions with order statuses before rendering
    syncSessionsWithOrders().then(() => {
      renderSessionTabs();
      
      // Load existing active session
      const existingSessionId = localStorage.getItem('activeStaffSession');
      if (existingSessionId) {
        const sessions = getStaffSessions();
        if (sessions[existingSessionId] && (sessions[existingSessionId].status === 'active' || sessions[existingSessionId].status === 'ordered')) {
          setActiveSession(existingSessionId);
        } else {
          renderCurrentSessionCart();
        }
      } else {
        renderCurrentSessionCart();
      }
    });
    
    if (syncIntervalId) clearInterval(syncIntervalId);
    syncIntervalId = setInterval(() => {
      syncSessionsWithOrders().then(() => {
        renderSessionTabs();
        if (activeSessionId) {
          const sessions = getStaffSessions();
          if (!sessions[activeSessionId]) {
            // Active session was removed, switch to another or show empty
            const remainingSessions = Object.values(sessions).filter(s => s.status === 'active' || s.status === 'ordered');
            if (remainingSessions.length > 0) {
              setActiveSession(remainingSessions[0].id);
            } else {
              activeSessionId = null;
              localStorage.removeItem('activeStaffSession');
              renderCurrentSessionCart();
            }
          }
        }
      });
    }, 30000); // Check every 30 seconds
  }
  
  // Expose functions globally
  window.staffPlaceOrder = {
    addToCart,
    updateQty,
    removeItem,
    renderCartModal,
    renderMenu
  };

export async function bootstrapPlaceOrder() {
  supabaseClient = getSupabaseClient();
  window.supabaseClient = supabaseClient;
  if (!supabaseClient) return;
  initializeSupabase();
}

export function teardownPlaceOrder() {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
  }
}
