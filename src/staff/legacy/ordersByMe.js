'use strict';

import { fetchMenuTheme } from '../../services/menu.js';
import {
  cancelStaffOrder,
  fetchMyStaffOrders,
  removeStaffOrderItem,
  updateStaffOrderPayment,
} from '../../services/staffOrders.js';
import { startPolling } from '../../lib/polling.js';

// Staff module — adapted for React

  let orders = [];
  let selectedOrderId = null;
  let stopOrdersPolling = null;
  let documentMenuClickHandler = null;
  let documentCloseMenusHandler = null;
  
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
  
  // Get restaurant ID
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
  
  // Load orders placed by current staff
  async function loadOrders() {
    const restaurantId = getRestaurantId();
    const currentStaffId = localStorage.getItem('staff_id');
    if (!restaurantId || !currentStaffId) {
      console.error('Restaurant ID or staff ID not found');
      return;
    }

    try {
      orders = await fetchMyStaffOrders();
      renderOrders();
      setupOrdersPolling();
    } catch (error) {
      console.error('Error loading orders:', error);
      alert('Failed to load orders. Please refresh the page.');
    }
  }
  
  // Render orders
  function renderOrders() {
    const ordersList = document.getElementById('ordersList');
    const emptyState = document.getElementById('emptyState');
    
    if (!ordersList) {
      console.error('❌ ordersList element not found');
      return;
    }
    
    console.log(`🔄 renderOrders called with ${orders.length} order(s) in memory`);
    
    // Get filters
    const tableSearch = document.getElementById('tableSearch')?.value?.toLowerCase() || '';
    const statusFilter = document.getElementById('statusFilter')?.value || 'all';
    
    // Filter orders
    let filteredOrders = orders;
    
    if (tableSearch) {
      const query = tableSearch.trim().toLowerCase().replace(/^#/, '');
      filteredOrders = filteredOrders.filter((order) => {
        const tableMatch =
          order.table_number != null &&
          String(order.table_number).toLowerCase().includes(query);
        const orderNum = String(order.order_number ?? '').toLowerCase();
        const orderMatch =
          orderNum.includes(query) ||
          orderNum.padStart(2, '0').includes(query);
        return tableMatch || orderMatch;
      });
    }
    
    if (statusFilter !== 'all') {
        filteredOrders = filteredOrders.filter(order => {
          if (statusFilter === 'new') {
            return order.payment_method === 'unpaid_new' && !order.cancelled;
          } else if (statusFilter === 'cash') {
            return order.payment_method === 'cash' && !order.cancelled;
          } else if (statusFilter === 'upi') {
            return order.payment_method === 'upi' && !order.cancelled;
          } else if (statusFilter === 'card') {
            return order.payment_method === 'card' && !order.cancelled;
          } else if (statusFilter === 'cancelled') {
            return order.cancelled === true;
          }
          return true;
        });
    }
    
    ordersList.innerHTML = '';
    
    if (filteredOrders.length === 0) {
      console.log('⚠️ No orders to display after filtering');
      if (emptyState) {
        // Only show empty state if it's not already showing a custom message
        const currentEmptyStateHTML = emptyState.innerHTML;
        if (!currentEmptyStateHTML.includes('Staff tracking is not enabled')) {
          emptyState.innerHTML = `
            <p>No orders found</p>
            <p style="font-size: 14px; color: #9ca3af; margin-top: 8px;">You haven't placed any orders yet</p>
          `;
        }
        emptyState.style.display = 'block';
      }
      return;
    }
    
    if (emptyState) emptyState.style.display = 'none';
    console.log(`✅ Rendering ${filteredOrders.length} order card(s)`);
    
    filteredOrders.forEach(order => {
      const cardDiv = document.createElement('div');
      cardDiv.innerHTML = createOrderCard(order);
      ordersList.appendChild(cardDiv.firstElementChild);
    });
  }
  
  // Format order number for display (same as admin side)
  function formatOrderNumber(orderNumber) {
    if (orderNumber === null || orderNumber === undefined || orderNumber === '') {
      return 'N/A';
    }
    const numStr = String(orderNumber);
    return numStr.padStart(2, '0');
  }

  // Format date and time (same as admin side)
  function formatDateTime(dateString) {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const minutesStr = minutes < 10 ? '0' + minutes : minutes;
    
    return `${day}/${month}/${year} • ${hours}:${minutesStr} ${ampm}`;
  }

  // Get bill revealed orders from sessionStorage (same as admin side)
  function getBillRevealedOrders() {
    try {
      const stored = sessionStorage.getItem('billRevealedOrders');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  }

  // Save bill revealed order ID to sessionStorage (same as admin side)
  function saveBillRevealedOrder(orderId) {
    try {
      const revealed = getBillRevealedOrders();
      if (!revealed.includes(orderId)) {
        revealed.push(orderId);
        sessionStorage.setItem('billRevealedOrders', JSON.stringify(revealed));
      }
    } catch (e) {
      console.warn('Failed to save bill revealed order:', e);
    }
  }

  // Format payment method for display (same as admin side)
  function formatPaymentMethod(method) {
    const methodMap = {
      'upi': 'UPI',
      'cash': 'Cash',
      'card': 'Card',
      'unpaid_new': 'New',
      'unpaid_pay_at_counter': 'Asking Bill'
    };
    return methodMap[method] || method;
  }

  // Get payment badge class (same as admin side)
  function getPaymentBadgeClass(method) {
    const classMap = {
      'upi': 'paid',
      'cash': 'paid',
      'card': 'paid',
      'unpaid_new': 'new',
      'unpaid_pay_at_counter': 'counter'
    };
    return classMap[method] || 'paid';
  }

  // Create order card (same as admin side)
  function createOrderCard(order) {
    // Use stored order_number from database
    let displayOrderNumber = order.order_number;
    const orderDisplayText = formatOrderNumber(displayOrderNumber);
    const dateTime = formatDateTime(order.created_at);
    
    // Check if order is cancelled
    const isCancelled = order.cancelled === true;
    
    // Check if order is paid
    // Paid methods: 'upi', 'cash', 'card' (all show green badges)
    // Unpaid methods: 'unpaid_new' (grey "New" badge), 'unpaid_pay_at_counter' (red "Pay at Counter" badge)
    // Both 'unpaid_new' and 'unpaid_pay_at_counter' are considered unpaid status
    const isPaid = order.payment_method && 
                   order.payment_method !== 'unpaid_new' && 
                   order.payment_method !== 'unpaid_pay_at_counter' &&
                   (order.payment_method === 'upi' || 
                    order.payment_method === 'cash' ||
                    order.payment_method === 'card');
    
    // Check if order is unpaid
    // Both 'unpaid_new' and 'unpaid_pay_at_counter' are unpaid statuses
    // 'unpaid_new' = customer hasn't done Get Bill yet (grey "New" badge)
    // 'unpaid_pay_at_counter' = customer selected Pay at Counter but not yet processed (red "Pay at Counter" badge)
    const isUnpaid = (order.payment_method === 'unpaid_new' || order.payment_method === 'unpaid_pay_at_counter') && !isCancelled;
    
    // Determine payment badge display
    let badgeClass, badgeText;
    if (isCancelled) {
      badgeClass = 'cancelled';
      badgeText = 'Cancelled';
    } else if (order.payment_method === 'unpaid_pay_at_counter') {
      badgeClass = 'counter';
      badgeText = 'Asking Bill';
    } else if (isPaid && order.payment_method) {
      const paymentMethod = formatPaymentMethod(order.payment_method);
      badgeClass = getPaymentBadgeClass(order.payment_method);
      badgeText = paymentMethod;
    } else if (order.payment_method === 'unpaid_new' && !isCancelled) {
      badgeClass = 'new';
      badgeText = 'New';
    } else {
      const paymentMethod = formatPaymentMethod(order.payment_method);
      badgeClass = getPaymentBadgeClass(order.payment_method);
      badgeText = paymentMethod;
    }
    
    const cardClass = isCancelled ? 'order-card cancelled' : 'order-card';
    const orderIdClass = isCancelled ? 'order-id cancelled' : 'order-id';
    
    // Get order items
    const orderItems = order.order_items || [];

    // Total: calculate from order_items
    const totalFromItems = orderItems.length > 0
      ? orderItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0) * (parseInt(item.quantity) || 1), 0)
      : 0;
    const displayTotal = orderItems.length > 0 ? totalFromItems : (parseFloat(order.total_amount || 0) || 0);

    // Show remove item until order is paid or cancelled
    const canRemoveItems = !isCancelled && !isPaid;

    // Build items HTML
    let itemsHTML = '';
    if (orderItems.length === 0) {
      itemsHTML = '<div class="order-item"><div class="order-item-serial"></div><div class="order-item-info"><strong>No items found</strong></div></div>';
    } else {
      orderItems.forEach((item, index) => {
        const itemTotal = (parseFloat(item.price) || 0) * (parseInt(item.quantity) || 1);
        const itemPrice = parseFloat(item.price || 0).toFixed(2);
        const serialNumber = index + 1;
        const dishName = item.dish_name || 'this dish';
        const safeDishName = String(dishName).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const removeButtonHTML = canRemoveItems ? `
          <button class="remove-item-btn" data-order-id="${order.id}" data-item-id="${item.id}" onclick="window.staffOrdersByMe.removeOrderItem('${order.id}', '${item.id}', '${safeDishName}')" title="Remove item">×</button>
        ` : '';
        itemsHTML += `
          <div class="order-item">
            <div class="order-item-serial">${serialNumber}.</div>
            <div class="order-item-info">
              <strong>${item.dish_name || 'Unknown Item'}</strong>
              <span>Qty: ${item.quantity || 1} × ₹${itemPrice}</span>
            </div>
            <div class="order-item-price">₹${itemTotal.toFixed(2)}</div>
            ${removeButtonHTML}
          </div>
        `;
      });
    }

    // Show 3-dot menu for unpaid orders (not cancelled) - same as admin side
    const shouldShowMenu = isUnpaid;
    const menuButtonHTML = shouldShowMenu ? `
      <button class="order-menu-btn" data-order-id="${order.id}" data-action="toggle-menu">
        ⋮
      </button>
      <div class="order-menu-dropdown" id="menu-${order.id}">
        <button class="order-menu-item" data-order-id="${order.id}" data-action="get-bill">Bill</button>
        <button class="order-menu-item cancel" data-order-id="${order.id}" data-action="cancel-order">Cancel</button>
      </div>
    ` : '';

    // Check if total should be hidden (for Unpaid or Pay at Counter (unpaid) orders that haven't had Get Bill clicked)
    const shouldHideTotal = isUnpaid;
    const billRevealedOrders = getBillRevealedOrders();
    const isBillRevealed = billRevealedOrders.includes(order.id);
    const shouldShowTotal = !shouldHideTotal || isBillRevealed;
    const totalClass = shouldShowTotal ? 'order-total' : 'order-total hidden-total';
    const totalStyle = shouldShowTotal ? '' : 'style="display: none;"';

    const rawTable = order.table_number;
    const tableNumberDisplay = (rawTable != null && rawTable !== '') ? String(rawTable).trim() : '';
    
    // No staff indicator badge in "Orders by Me" - all orders are already filtered to show only this staff's orders
    return `
      <div class="${cardClass}" data-order-id="${order.id}" data-order-number="${displayOrderNumber || ''}" data-bill-revealed="${shouldShowTotal ? 'true' : 'false'}">
        <div class="order-header">
          <div class="order-header-left">
            <div class="${orderIdClass}">ORD <span class="order-number">#${orderDisplayText}</span></div>
            <div class="order-table-line">Table: ${tableNumberDisplay}</div>
          </div>
          <div class="order-header-right">
            <span class="payment-badge ${badgeClass}">${badgeText}</span>
            ${menuButtonHTML}
          </div>
        </div>
        <div class="order-date">${dateTime}</div>
        <div class="order-items">
          ${itemsHTML}
        </div>
        <div class="${totalClass}" ${totalStyle}>
          <span class="total-label">Total</span>
          <span class="total-amount">₹${displayTotal.toFixed(2)}</span>
        </div>
      </div>
    `;
  }
  
  // View order details
  function viewOrderDetails(orderId) {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    
    selectedOrderId = orderId;
    
    const modal = document.getElementById('orderDetailModal');
    const modalOrderNumber = document.getElementById('modalOrderNumber');
    const modalTableNumber = document.getElementById('modalTableNumber');
    const modalOrderDate = document.getElementById('modalOrderDate');
    const modalOrderStatus = document.getElementById('modalOrderStatus');
    const modalOrderItems = document.getElementById('modalOrderItems');
    const modalOrderTotal = document.getElementById('modalOrderTotal');
    const processBillBtn = document.getElementById('processBillBtn');
    
    if (!modal) return;
    
    const orderNumber = String(order.order_number || 'N/A').padStart(2, '0');
    const tableNumber = order.table_number || '-';
    const date = formatDateTime(order.created_at);
    const statusBadge = getStatusBadge(order.payment_method);
    
    // Calculate total
    const totalFromItems = (order.order_items || []).reduce((sum, item) => {
      return sum + (parseFloat(item.price) || 0) * (parseInt(item.quantity) || 1);
    }, 0);
    const displayTotal = totalFromItems > 0 ? totalFromItems : (parseFloat(order.total_amount || 0) || 0);
    
    if (modalOrderNumber) modalOrderNumber.textContent = `Order #${orderNumber}`;
    if (modalTableNumber) modalTableNumber.textContent = tableNumber;
    if (modalOrderDate) modalOrderDate.textContent = date;
    if (modalOrderStatus) modalOrderStatus.innerHTML = statusBadge;
    if (modalOrderTotal) modalOrderTotal.textContent = `₹${displayTotal.toFixed(2)}`;
    
    // No "Placed by" indicator in modal for "Orders by Me" - all orders are already filtered to show only this staff's orders
    
    // Render order items
    if (modalOrderItems) {
      modalOrderItems.innerHTML = '';
      (order.order_items || []).forEach((item, index) => {
        const itemRow = document.createElement('div');
        itemRow.className = 'order-item-row';
        const itemTotal = (parseFloat(item.price) || 0) * (parseInt(item.quantity) || 1);
        const serialNumber = index + 1;
        itemRow.innerHTML = `
          <div class="order-item-serial">${serialNumber}.</div>
          <div class="item-info">
            <strong>${item.dish_name}</strong>
            <span>Qty: ${item.quantity} × ₹${parseFloat(item.price || 0).toFixed(2)}</span>
          </div>
          <div class="item-total">₹${itemTotal.toFixed(2)}</div>
        `;
        modalOrderItems.appendChild(itemRow);
      });
    }
    
    // Show/hide Get Bill button
    const canProcessBill = order.payment_method === 'unpaid' || order.payment_method === 'pay_at_counter';
    if (processBillBtn) {
      processBillBtn.style.display = canProcessBill ? 'block' : 'none';
    }
    
    modal.style.display = 'flex';
  }
  
  // Process bill (Get Bill) - same as admin side
  async function processBill(orderId) {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    
    // Reveal bill total
    saveBillRevealedOrder(orderId);
    
    if (!confirm(`Mark Order #${String(order.order_number || 'N/A').padStart(2, '0')} as paid?`)) {
      return;
    }
    
    try {
      const currentPaymentMethod = order.payment_method;
      let newPaymentMethod;
      
      if (currentPaymentMethod === 'unpaid_pay_at_counter') {
        newPaymentMethod = 'cash'; // Process Pay at Counter as Cash payment
      } else if (currentPaymentMethod === 'unpaid_new') {
        newPaymentMethod = 'cash'; // Process new order as Cash payment
      } else {
        alert('This order is already processed');
        return;
      }
      
      await updateStaffOrderPayment(orderId, newPaymentMethod);

      await loadOrders();

      alert('Bill processed successfully!');
      
    } catch (error) {
      console.error('Error processing bill:', error);
      alert('Error processing bill: ' + (error.message || 'Unknown error'));
    }
  }
  
  
  // Handle Cancel Order (same as admin side) - moved outside setupEventListeners for global access
  async function handleCancelOrder(orderId) {
    console.log('handleCancelOrder called for order:', orderId);
    
    // Close menu
    document.querySelectorAll('.order-menu-dropdown').forEach(m => {
      m.classList.remove('show');
    });

    // Show confirmation modal
    const modal = document.getElementById('cancelModalOverlay');
    if (modal) {
      console.log('Showing cancel modal for order:', orderId);
      modal.classList.add('show');
      modal.setAttribute('data-order-id', orderId);
    } else {
      console.error('Cancel modal not found in DOM');
      alert('Error: Cancel confirmation modal not found. Please refresh the page.');
    }
  }

  // Confirm and cancel order (same as admin side) - moved outside setupEventListeners for global access
  async function confirmCancelOrder() {
    const modal = document.getElementById('cancelModalOverlay');
    if (!modal) return;

    const orderId = modal.getAttribute('data-order-id');
    if (!orderId) {
      console.error('Order ID not found in modal');
      return;
    }

    console.log('Cancelling order:', orderId);

    const yesBtn = modal.querySelector('.cancel-modal-btn.yes');
    if (yesBtn) {
      yesBtn.disabled = true;
      yesBtn.textContent = 'Cancelling...';
    }

    try {
      await cancelStaffOrder(orderId);
      modal.classList.remove('show');
      await loadOrders();
      console.log('Order cancelled successfully');
    } catch (error) {
      console.error('Error cancelling order:', error);
      alert('Error cancelling order: ' + (error.message || 'Unknown error'));
      if (yesBtn) {
        yesBtn.disabled = false;
        yesBtn.textContent = 'Yes';
      }
    }
  }

  // Close cancel modal (same as admin side) - moved outside setupEventListeners for global access
  function closeCancelModal() {
    const modal = document.getElementById('cancelModalOverlay');
    if (modal) {
      modal.classList.remove('show');
    }
  }

  // Staff order updates come from the API because RLS blocks anon order reads.
  function setupOrdersPolling() {
    if (stopOrdersPolling) return;
    stopOrdersPolling = startPolling(() => loadOrders(), 8000);
  }
  
  // Setup event listeners (same as admin side)
  // Store pending order ID and selected payment method (outside setupEventListeners for scope)
  // NOTE: This function and processPaymentWithMethod should remain IDENTICAL across
  // admin-side/order_summary.js, staff-side/all_orders.js, and staff-side/orders_by_me.js
  let pendingPaymentOrderId = null;
  let selectedPaymentMethod = null;

  // Handle Get Bill - show payment method modal
  // NOTE: This function should remain IDENTICAL across all admin and staff files
  function handleGetBill(orderId) {
    // Close menu
    document.querySelectorAll('.order-menu-dropdown').forEach(m => {
      m.classList.remove('show');
    });

    // Store order ID for payment processing
    pendingPaymentOrderId = orderId;
    selectedPaymentMethod = null;

    // Show payment method selection modal
    const modal = document.getElementById('paymentMethodModal');
    if (modal) {
      // Reset selected state
      document.querySelectorAll('.payment-method-btn').forEach(btn => {
        btn.classList.remove('selected');
      });
      // Disable Process button
      const processBtn = document.getElementById('processPaymentBtn');
      if (processBtn) {
        processBtn.disabled = true;
      }
      modal.style.display = 'flex';
    } else {
      alert('Payment method modal not found. Please refresh the page.');
    }
  }

  // Process payment with selected method
  // NOTE: This function should remain IDENTICAL across all admin and staff files
  // Only difference allowed: renderOrders() vs loadOrders() (same functionality, different names)
  async function processPaymentWithMethod(paymentMethod) {
    if (!pendingPaymentOrderId) return;

    const orderId = pendingPaymentOrderId;
    pendingPaymentOrderId = null;
    selectedPaymentMethod = null;

    // Close modal
    const modal = document.getElementById('paymentMethodModal');
    if (modal) {
      modal.style.display = 'none';
    }

    // Store order ID
    const orderCard = document.querySelector(`[data-order-id="${orderId}"]`);
    if (!orderCard) return;

    // Show the total section if it was hidden
    const totalSection = orderCard.querySelector('.order-total');
    if (totalSection) {
      totalSection.style.display = 'flex';
      totalSection.classList.remove('hidden-total');
      orderCard.setAttribute('data-bill-revealed', 'true');
      // Save to sessionStorage so it persists across re-renders
      saveBillRevealedOrder(orderId);
    }

    try {
      const order = orders.find((o) => o.id === orderId);
      const currentPaymentMethod = order?.payment_method;
      console.log('Current payment method:', currentPaymentMethod);

      const newPaymentMethod = paymentMethod;
      console.log('Updating payment method to:', newPaymentMethod, 'for order:', orderId);

      await updateStaffOrderPayment(orderId, newPaymentMethod);

      // Re-render orders to reflect the badge change
      await loadOrders();
    } catch (error) {
      console.error('Error processing payment:', error);
      alert('Error processing payment. Please try again.');
    }
  }

  function setupEventListeners() {
    // Search input
    const tableSearch = document.getElementById('tableSearch');
    if (tableSearch) {
      tableSearch.addEventListener('input', renderOrders);
    }
    
    // Status filter
    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) {
      statusFilter.addEventListener('change', renderOrders);
    }

    // Payment method modal event listeners
    const paymentMethodModal = document.getElementById('paymentMethodModal');
    const closePaymentMethodModal = document.getElementById('closePaymentMethodModal');
    const paymentMethodBtns = document.querySelectorAll('.payment-method-btn');

    // Close modal button
    if (closePaymentMethodModal) {
      closePaymentMethodModal.addEventListener('click', function() {
        if (paymentMethodModal) {
          paymentMethodModal.style.display = 'none';
        }
        pendingPaymentOrderId = null;
        selectedPaymentMethod = null;
      });
    }

    // Close modal on overlay click
    if (paymentMethodModal) {
      paymentMethodModal.addEventListener('click', function(e) {
        if (e.target === paymentMethodModal) {
          paymentMethodModal.style.display = 'none';
          pendingPaymentOrderId = null;
          selectedPaymentMethod = null;
        }
      });
    }

    // Payment method selection buttons
    paymentMethodBtns.forEach(btn => {
      btn.addEventListener('click', function() {
        // Remove selected class from all buttons
        paymentMethodBtns.forEach(b => b.classList.remove('selected'));
        // Add selected class to clicked button
        btn.classList.add('selected');
        
        // Get payment method from data attribute
        const method = btn.getAttribute('data-method');
        if (method) {
          selectedPaymentMethod = method;
          console.log('Payment method selected:', method);
          // Enable Process button
          const processBtn = document.getElementById('processPaymentBtn');
          if (processBtn) {
            processBtn.disabled = false;
          }
        }
      });
    });

    // Process Payment button
    const processPaymentBtn = document.getElementById('processPaymentBtn');
    if (processPaymentBtn) {
      processPaymentBtn.addEventListener('click', function() {
        if (selectedPaymentMethod && pendingPaymentOrderId) {
          console.log('Processing payment with method:', selectedPaymentMethod);
          processPaymentWithMethod(selectedPaymentMethod);
        } else {
          console.warn('Cannot process: selectedPaymentMethod=', selectedPaymentMethod, 'pendingPaymentOrderId=', pendingPaymentOrderId);
        }
      });
    }

    // Cancel Payment button
    const cancelPaymentBtn = document.getElementById('cancelPaymentBtn');
    if (cancelPaymentBtn) {
      cancelPaymentBtn.addEventListener('click', function() {
        if (paymentMethodModal) {
          paymentMethodModal.style.display = 'none';
        }
        pendingPaymentOrderId = null;
        selectedPaymentMethod = null;
      });
    }
    
    // Toggle order menu dropdown (same as admin side)
    function toggleOrderMenu(orderId, event) {
      event.stopPropagation();
      const menu = document.getElementById(`menu-${orderId}`);
      if (!menu) return;
      
      // Close all other menus
      document.querySelectorAll('.order-menu-dropdown').forEach(m => {
        if (m.id !== `menu-${orderId}`) {
          m.classList.remove('show');
        }
      });
      
      // Toggle current menu
      menu.classList.toggle('show');
    }

    // Event delegation for order menu buttons (handles dynamically generated buttons) - same as admin side
    if (documentMenuClickHandler) {
      document.removeEventListener('click', documentMenuClickHandler);
    }
    documentMenuClickHandler = function(e) {
      // Handle menu toggle button
      if (e.target.matches('.order-menu-btn[data-action="toggle-menu"]') || e.target.closest('.order-menu-btn[data-action="toggle-menu"]')) {
        e.stopPropagation();
        const btn = e.target.matches('.order-menu-btn') ? e.target : e.target.closest('.order-menu-btn');
        const orderId = btn.getAttribute('data-order-id');
        if (orderId) {
          toggleOrderMenu(orderId, e);
        }
      }
      
      // Handle Get Bill button
      if (e.target.matches('.order-menu-item[data-action="get-bill"]')) {
        e.stopPropagation();
        const orderId = e.target.getAttribute('data-order-id');
        if (orderId) {
          handleGetBill(orderId);
        }
      }
      
      // Handle Cancel Order button
      if (e.target.matches('.order-menu-item[data-action="cancel-order"]')) {
        e.stopPropagation();
        const orderId = e.target.getAttribute('data-order-id');
        if (orderId) {
          handleCancelOrder(orderId);
        }
      }
    };
    document.addEventListener('click', documentMenuClickHandler);

    // Close menus when clicking outside (same as admin side)
    if (documentCloseMenusHandler) {
      document.removeEventListener('click', documentCloseMenusHandler);
    }
    documentCloseMenusHandler = function(e) {
      if (!e.target.closest('.order-menu-btn') && !e.target.closest('.order-menu-dropdown')) {
        document.querySelectorAll('.order-menu-dropdown').forEach(m => {
          m.classList.remove('show');
        });
      }
    };
    document.addEventListener('click', documentCloseMenusHandler);
    
    // Close order modal
    const closeOrderModal = document.getElementById('closeOrderModal');
    const cancelGetBillBtn = document.getElementById('cancelGetBillBtn');
    const orderDetailModal = document.getElementById('orderDetailModal');
    
    if (closeOrderModal) {
      closeOrderModal.addEventListener('click', () => {
        if (orderDetailModal) orderDetailModal.style.display = 'none';
      });
    }
    
    if (cancelGetBillBtn) {
      cancelGetBillBtn.addEventListener('click', () => {
        if (orderDetailModal) orderDetailModal.style.display = 'none';
      });
    }
    
    // Process bill button (in modal)
    const processBillBtn = document.getElementById('processBillBtn');
    if (processBillBtn) {
      processBillBtn.addEventListener('click', () => {
        if (selectedOrderId) {
          processBill(selectedOrderId);
        }
      });
    }

    // Cancel modal event listeners (same as admin side)
    const cancelModalYes = document.getElementById('cancelModalYes');
    const cancelModalNo = document.getElementById('cancelModalNo');
    
    if (cancelModalYes) {
      cancelModalYes.addEventListener('click', () => {
        confirmCancelOrder();
      });
    }
    
    if (cancelModalNo) {
      cancelModalNo.addEventListener('click', () => {
        closeCancelModal();
      });
    }

    // Close cancel modal when clicking outside
    const cancelModalOverlay = document.getElementById('cancelModalOverlay');
    if (cancelModalOverlay) {
      cancelModalOverlay.addEventListener('click', (e) => {
        if (e.target === cancelModalOverlay) {
          closeCancelModal();
        }
      });
    }

    // Remove item confirmation modal
    const removeItemModalYes = document.getElementById('removeItemModalYes');
    const removeItemModalNo = document.getElementById('removeItemModalNo');
    const removeItemModalOverlay = document.getElementById('removeItemModalOverlay');

    if (removeItemModalYes) {
      removeItemModalYes.addEventListener('click', () => {
        confirmRemoveOrderItem();
      });
    }

    if (removeItemModalNo) {
      removeItemModalNo.addEventListener('click', () => {
        closeRemoveItemModal();
      });
    }

    if (removeItemModalOverlay) {
      removeItemModalOverlay.addEventListener('click', (e) => {
        if (e.target === removeItemModalOverlay) {
          closeRemoveItemModal();
        }
      });
    }
    
    // Close modal when clicking outside
    if (orderDetailModal) {
      orderDetailModal.addEventListener('click', (e) => {
        if (e.target === orderDetailModal) {
          orderDetailModal.style.display = 'none';
        }
      });
    }
  }
  
  // Initialize app
  function initializeApp() {
    if (!checkAuth()) return;
    
    // Load theme first
    loadAndApplyTheme();
    
    setupEventListeners();
    loadOrders();
  }
  
  // Expose functions globally
  // Remove individual item from order (until paid or cancelled)
  let pendingRemoveOrderId = null;
  let pendingRemoveItemId = null;

  function removeOrderItem(orderId, itemId, dishName) {
    pendingRemoveOrderId = orderId;
    pendingRemoveItemId = itemId;
    const modal = document.getElementById('removeItemModalOverlay');
    if (modal) {
      const message = document.getElementById('removeItemModalMessage');
      if (message) {
        message.textContent = `You want to remove ${dishName || 'this dish'}?`;
      }
      modal.classList.add('show');
      const yesBtn = document.getElementById('removeItemModalYes');
      if (yesBtn) {
        yesBtn.disabled = false;
        yesBtn.textContent = 'Yes';
      }
    }
  }

  function closeRemoveItemModal() {
    const modal = document.getElementById('removeItemModalOverlay');
    if (modal) {
      modal.classList.remove('show');
    }
    pendingRemoveOrderId = null;
    pendingRemoveItemId = null;
    const yesBtn = document.getElementById('removeItemModalYes');
    if (yesBtn) {
      yesBtn.disabled = false;
      yesBtn.textContent = 'Yes';
    }
  }

  async function confirmRemoveOrderItem() {
    const orderId = pendingRemoveOrderId;
    const itemId = pendingRemoveItemId;
    if (!orderId || !itemId) {
      closeRemoveItemModal();
      return;
    }

    const yesBtn = document.getElementById('removeItemModalYes');
    if (yesBtn) {
      yesBtn.disabled = true;
      yesBtn.textContent = 'Removing...';
    }

    try {
      const newTotal = await removeStaffOrderItem(orderId, itemId);

      if (Array.isArray(orders) && orders.length > 0) {
        const orderIndex = orders.findIndex((o) => o.id === orderId);
        if (orderIndex !== -1) {
          const order = orders[orderIndex];
          if (order && Array.isArray(order.order_items)) {
            order.order_items = order.order_items.filter((item) => String(item.id) !== String(itemId));
            order.total_amount = newTotal;
          }
        }
        renderOrders();
      }

      closeRemoveItemModal();
    } catch (error) {
      console.error('Error removing item:', error);
      alert('Error removing item: ' + (error.message || 'Unknown error'));
      if (yesBtn) {
        yesBtn.disabled = false;
        yesBtn.textContent = 'Yes';
      }
    }
  }

  window.staffOrdersByMe = {
    viewOrderDetails,
    processBill,
    confirmCancelOrder,
    closeCancelModal,
    removeOrderItem,
    confirmRemoveOrderItem,
    closeRemoveItemModal
  };
  
  // Also expose for inline onclick handlers
  window.confirmCancelOrder = confirmCancelOrder;
  window.closeCancelModal = closeCancelModal;

export async function bootstrapOrdersByMe() {
  if (!checkAuth()) return;
  initializeApp();
}

export function teardownOrdersByMe() {
  if (stopOrdersPolling) {
    stopOrdersPolling();
    stopOrdersPolling = null;
  }
  if (documentMenuClickHandler) {
    document.removeEventListener('click', documentMenuClickHandler);
    documentMenuClickHandler = null;
  }
  if (documentCloseMenusHandler) {
    document.removeEventListener('click', documentCloseMenusHandler);
    documentCloseMenusHandler = null;
  }
}
