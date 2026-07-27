'use strict';

import { fetchCategories, fetchDishes, fetchMenuTheme } from '../../services/menu.js';
import { fetchStaffOrderStatuses, placeStaffOrder } from '../../services/staffOrders.js';

// Staff module — adapted for React

  let menu = [];
  let categories = [];
  let activeSessionId = null;
  let syncIntervalId = null;
  
  // Phase 2: require API staff JWT (not only local ids).
  function checkAuth() {
    const staffId = localStorage.getItem('staff_id');
    const staffUserId = localStorage.getItem('staff_user_id');
    const staffToken = localStorage.getItem('staff_token');

    if (!staffId || !staffUserId || !staffToken) {
      window.location.href = '/staff';
      return false;
    }

    return true;
  }
  
  // Get restaurant ID (from staff session)
  function getRestaurantId() {
    return localStorage.getItem('staff_user_id');
  }
  
  // Load and apply the restaurant theme through the API.
  async function loadAndApplyTheme() {
    const restaurantId = getRestaurantId();
    if (!restaurantId) return;

    try {
      const data = await fetchMenuTheme(restaurantId);
      const colorToUse = data?.staff_side_color || data?.button_color || null;
      if (colorToUse) {
        const bc = String(colorToUse).trim();
        if (/^#[0-9A-Fa-f]{6}$/.test(bc)) {
          const r = parseInt(bc.slice(1, 3), 16);
          const g = parseInt(bc.slice(3, 5), 16);
          const b = parseInt(bc.slice(5, 7), 16);
          const hoverR = Math.max(0, r - 22);
          const hoverG = Math.max(0, g - 22);
          const hoverB = Math.max(0, b - 22);
          const hoverHex = '#' + [hoverR, hoverG, hoverB].map((x) => x.toString(16).padStart(2, '0')).join('');
          document.documentElement.style.setProperty('--theme-primary-color', bc);
          document.documentElement.style.setProperty('--theme-primary-color-dark', hoverHex);
        }
      }
    } catch (e) {
      console.error('Error loading theme:', e);
    }
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
      const categoriesData = await fetchCategories(restaurantId);
      categories = (categoriesData || []).map((c) => c.name);

      const dishesData = await fetchDishes(restaurantId);
      menu = (dishesData || []).map((dish) => ({
        ...dish,
        name: dish.name || dish.dish_name,
        category: dish.category || dish.categories?.name || '',
        image: dish.image || dish.image_url,
        price: dish.price,
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
    
    const placeOrderBtn = document.getElementById('placeOrderBtn');
    if (placeOrderBtn) {
      placeOrderBtn.disabled = true;
      placeOrderBtn.textContent = 'Placing...';
    }
    
    try {
      const orderResult = await submitStaffOrder(cart, session.tableNumber);
      
      if (orderResult && orderResult.orderNumber) {
        // Store order_id and order_number in session (don't delete session)
        session.status = 'ordered';
        session.orderNumber = orderResult.orderNumber;
        session.orderId = orderResult.orderId;
        session.placedAt = new Date().toISOString();
        // Clear cart after order is placed (items are now on the server)
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
  
  // Place order through the API (merge/create handled by backend).
  async function submitStaffOrder(cart, tableNumber) {
    const restaurantId = getRestaurantId();
    if (!restaurantId) {
      alert('Restaurant ID not found');
      return null;
    }

    try {
      const items = Object.values(cart).map((item) => ({
        dish_id: item.dish_id || null,
        name: item.name || 'Unknown Item',
        price: item.price,
        qty: item.qty || 1,
      }));

      const result = await placeStaffOrder({
        items,
        tableNumber: tableNumber || null,
      });

      return {
        orderNumber: result.displayOrderNumber || String(result.orderNumber).padStart(2, '0'),
        orderId: result.orderId,
      };
    } catch (error) {
      console.error('Error saving order:', error);
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
      
      const orders = await fetchStaffOrderStatuses(orderIds);
      const error = null;
      
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
  if (!checkAuth()) return;
  initializeApp();
}

export function teardownPlaceOrder() {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
  }
}
