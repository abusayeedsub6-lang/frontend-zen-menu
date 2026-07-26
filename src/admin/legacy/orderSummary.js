'use strict';

import { supabase } from '../../lib/supabase.js';
import {
  cancelAdminOrder,
  fetchAdminOrders,
  removeAdminOrderItem,
  updateAdminOrderPayment,
} from '../../services/adminOrders.js';

// Order Management Module — adapted for React (see admin/OrderSummaryPage.jsx)

  let supabaseClient;
  let ordersSubscription = null;
  let currentUserId = null;
  let subscriptionHealthCheck = null;
  let isCleaningUp = false; // Flag to prevent reconnection loops

  function getSupabaseClient() {
    return supabase;
  }

  // Get current user ID
  async function getCurrentUserId() {
    if (currentUserId) return currentUserId;
    
    supabaseClient = getSupabaseClient();
    if (!supabaseClient) return null;

    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (session && session.user) {
        currentUserId = session.user.id;
        return currentUserId;
      }
    } catch (error) {
      console.error('Error getting user ID:', error);
    }
    return null;
  }

  // Format date and time
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

  // Format payment method for display
  function formatPaymentMethod(method) {
    const methodMap = {
      'upi': 'UPI',
      'cash': 'Cash',
      'card': 'Card',
      'unpaid_new': 'New',
      'unpaid_pay_at_counter': 'Pay at Counter'
    };
    return methodMap[method] || method;
  }

  // Get payment badge class
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

  // Format order number for display
  function formatOrderNumber(orderNumber) {
    // Check for null, undefined, or empty string (but allow 0 as valid)
    if (orderNumber === null || orderNumber === undefined || orderNumber === '') {
      return 'N/A';
    }
    // Display as zero-padded format (e.g., "01", "02", "12")
    // order_number is stored as integer in DB, format with zero-padding for display
    const numStr = String(orderNumber);
    const paddedNum = numStr.padStart(2, '0');
    return paddedNum;
  }

  // Get bill revealed orders from sessionStorage
  function getBillRevealedOrders() {
    try {
      const stored = sessionStorage.getItem('billRevealedOrders');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  }

  // Save bill revealed order ID to sessionStorage
  function saveBillRevealedOrder(orderId) {
    try {
      const revealed = getBillRevealedOrders();
      if (!revealed.includes(orderId)) {
        revealed.push(orderId);
        sessionStorage.setItem('billRevealedOrders', JSON.stringify(revealed));
      }
    } catch (e) {
    }
  }

  // Render a single order card
  function renderOrderCard(order) {
    // Use stored order_number from database
    // Check for null/undefined specifically (0 is a valid order number)
    let displayOrderNumber = order.order_number;
    
    // Log if order_number is missing for debugging
    if (displayOrderNumber === null || displayOrderNumber === undefined) {
    }
    
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
      // Pay at Counter that hasn't been processed - show red badge
      badgeClass = 'counter';
      badgeText = 'Pay at Counter';
    } else if (isPaid && order.payment_method) {
      // Order is paid (Cash, UPI, or Card) - show the payment method with green badge
      const paymentMethod = formatPaymentMethod(order.payment_method);
      badgeClass = getPaymentBadgeClass(order.payment_method);
      badgeText = paymentMethod;
    } else if (order.payment_method === 'unpaid_new' && !isCancelled) {
      // Customer just placed order (hasn't done Get Bill yet) - show neutral "New" badge, not red Unpaid
      badgeClass = 'new';
      badgeText = 'New';
    } else {
      // Fallback: show payment method (shouldn't normally reach here)
      const paymentMethod = formatPaymentMethod(order.payment_method);
      badgeClass = getPaymentBadgeClass(order.payment_method);
      badgeText = paymentMethod;
    }
    
    const cardClass = isCancelled ? 'order-card cancelled' : 'order-card';
    const orderIdClass = isCancelled ? 'order-id cancelled' : 'order-id';
    
    // Get order items from the joined order_items table
    // Don't sort - preserve database insertion order (newest items at the end)
    // This ensures items appear in the same order as inserted
    const orderItems = order.order_items || [];

    // Total: calculate from order_items so it's correct after merged items (orders.total_amount may be stale)
    const totalFromItems = orderItems.length > 0
      ? orderItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0) * (parseInt(item.quantity) || 1), 0)
      : 0;
    const displayTotal = orderItems.length > 0 ? totalFromItems : (parseFloat(order.total_amount || 0) || 0);

    // Check if order is "New" and less than 10 minutes old (to show X buttons)
    const isNewOrder = order.payment_method === 'unpaid_new' && !isCancelled;
    const orderCreatedAt = new Date(order.created_at);
    const now = new Date();
    const minutesSinceOrder = (now - orderCreatedAt) / (1000 * 60);
    const canRemoveItems = isNewOrder && minutesSinceOrder < 10;

    // Build items HTML
    let itemsHTML = '';
    if (orderItems.length === 0) {
      itemsHTML = '<div class="order-item"><div class="order-item-serial"></div><div class="order-item-info"><strong>No items found</strong></div></div>';
    } else {
      orderItems.forEach((item, index) => {
        const itemTotal = (parseFloat(item.price) || 0) * (parseInt(item.quantity) || 1);
        const itemPrice = parseFloat(item.price || 0).toFixed(2);
        const serialNumber = index + 1;
        const removeButtonHTML = canRemoveItems ? `
          <button class="remove-item-btn" data-order-id="${order.id}" data-item-id="${item.id}" onclick="window.adminOrderSummary.removeOrderItem('${order.id}', '${item.id}')" title="Remove item">×</button>
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

    // Show 3-dot menu for unpaid orders (not cancelled)
    // Include orders with payment_method 'unpaid_new' or 'unpaid_pay_at_counter' (unpaid status)
    // Note: isUnpaid already includes !isCancelled check
    const shouldShowMenu = isUnpaid;
    const menuButtonHTML = shouldShowMenu ? `
      <button class="order-menu-btn" data-order-id="${order.id}" data-action="toggle-menu">
        ⋮
      </button>
      <div class="order-menu-dropdown" id="menu-${order.id}">
        <button class="order-menu-item" data-order-id="${order.id}" data-action="get-bill">Get Bill</button>
        <button class="order-menu-item cancel" data-order-id="${order.id}" data-action="cancel-order">Cancel Order</button>
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

  // Render all orders
  async function renderOrders() {
    const ordersGrid = document.querySelector('.orders-grid');
    if (!ordersGrid) {
      console.error('Orders grid not found');
      return;
    }

    const userId = await getCurrentUserId();
    if (!userId) {
      console.error('User ID not available');
      ordersGrid.innerHTML = '<p>Please log in to view orders.</p>';
      return;
    }

    try {
      const orders = await fetchAdminOrders();

      if (!orders || orders.length === 0) {
        ordersGrid.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: #6b7280; padding: 40px;">No orders yet. Orders will appear here when customers place them.</p>';
        return;
      }

      ordersGrid.innerHTML = '';
      orders.forEach((order) => {
        ordersGrid.insertAdjacentHTML('beforeend', renderOrderCard(order));
      });

      setupRealtimeSubscription();
    } catch (error) {
      console.error('Error loading orders:', error);
      ordersGrid.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: #ef4444; padding: 40px;">Failed to load orders. Please refresh.</p>';
    }
  }

  // Set up real-time subscription for new orders
  async function setupRealtimeSubscription() {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.error('User ID not available for real-time subscription');
      return;
    }

    supabaseClient = getSupabaseClient();
    if (!supabaseClient) {
      console.error('Supabase client not available for real-time subscription');
      return;
    }

    // Remove existing subscription if any
    if (ordersSubscription) {
      isCleaningUp = true; // Set flag to prevent reconnection
      try {
        await supabaseClient.removeChannel(ordersSubscription);
      } catch (error) {
      }
      ordersSubscription = null;
      // Reset flag after a short delay to allow cleanup to complete
      setTimeout(() => {
        isCleaningUp = false;
      }, 1000);
    }

    // Create a unique channel name to avoid conflicts
    const channelName = `orders_channel_${userId.substring(0, 8)}_${Date.now()}`;
    const channel = supabaseClient.channel(channelName);

    // Listen for INSERT events on orders table (filtered by user_id)
    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'orders',
        filter: `user_id=eq.${userId}`
      },
      () => {
        renderOrders();
      }
    );

    // Listen for UPDATE events on orders table (filtered by user_id)
    channel.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: `user_id=eq.${userId}`
      },
      () => {
        renderOrders();
      }
    );

    // Listen for INSERT events on order_items table
    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'order_items'
      },
      () => {
        renderOrders();
      }
    );

    ordersSubscription = channel;
    
    channel.subscribe((status, err) => {
      if (status === 'CHANNEL_ERROR') {
        console.error('Error subscribing to orders channel:', err);
        if (!isCleaningUp) {
          setTimeout(() => {
            setupRealtimeSubscription();
          }, 5000);
        }
      } else if (status === 'TIMED_OUT') {
        if (!isCleaningUp) {
          setTimeout(() => {
            setupRealtimeSubscription();
          }, 3000);
        }
      } else if (status === 'CLOSED') {
        if (!isCleaningUp) {
          setTimeout(() => {
            setupRealtimeSubscription();
          }, 3000);
        }
      } else if (err) {
        console.error('Subscription error:', err);
      }
    });
    
    if (subscriptionHealthCheck) {
      clearInterval(subscriptionHealthCheck);
    }
    
    subscriptionHealthCheck = setInterval(() => {
      if (ordersSubscription) {
        const state = ordersSubscription.state;
        if (state !== 'joined' && state !== 'joining') {
          setupRealtimeSubscription();
        }
      } else if (!isCleaningUp) {
        setupRealtimeSubscription();
      }
    }, 30000); // Check every 30 seconds
  }
  
  // Cleanup function to remove subscription
  function cleanupSubscription() {
    isCleaningUp = true; // Set flag to prevent reconnection
    if (subscriptionHealthCheck) {
      clearInterval(subscriptionHealthCheck);
      subscriptionHealthCheck = null;
    }
    if (ordersSubscription && supabaseClient) {
      try {
        supabaseClient.removeChannel(ordersSubscription);
      } catch (error) {
      }
      ordersSubscription = null;
    }
    // Reset flag after cleanup
    setTimeout(() => {
      isCleaningUp = false;
    }, 1000);
  }

  // Initialize order management
  async function initialize() {
    supabaseClient = getSupabaseClient();
    if (!supabaseClient) {
      console.error('Supabase client not available');
      return;
    }

    // Session may still be restoring after OAuth/page load.
    let userId = await getCurrentUserId();
    let authRetries = 0;
    while (!userId && authRetries < 50) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      userId = await getCurrentUserId();
      authRetries += 1;
    }
    if (!userId) {
      console.error('User ID not available - user may not be authenticated');
      return;
    }

    // Wait a bit more for the orders grid to be loaded in the DOM
    let gridRetries = 0;
    while (!document.querySelector('.orders-grid') && gridRetries < 20) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      gridRetries += 1;
    }

    // Render initial orders
    await renderOrders();

    // Set up real-time subscription (owner SELECT still allowed after RLS)
    await setupRealtimeSubscription();
    
    // Set up modal button event listeners
    setupModalEventListeners();
    
  }

  // Set up event listeners for cancel modal buttons
  function setupModalEventListeners() {
    const cancelModalYes = document.getElementById('cancelModalYes');
    const cancelModalNo = document.getElementById('cancelModalNo');
    
    if (cancelModalYes) {
      // Remove existing listeners to avoid duplicates
      const newYesBtn = cancelModalYes.cloneNode(true);
      cancelModalYes.parentNode.replaceChild(newYesBtn, cancelModalYes);
      newYesBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        confirmCancelOrder();
      });
    } else {
    }
    
    if (cancelModalNo) {
      // Remove existing listeners to avoid duplicates
      const newNoBtn = cancelModalNo.cloneNode(true);
      cancelModalNo.parentNode.replaceChild(newNoBtn, cancelModalNo);
      newNoBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        closeCancelModal();
      });
    } else {
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
          processPaymentWithMethod(selectedPaymentMethod);
        } else {
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
  }

  // Test function to verify subscription is working
  async function testSubscription() {
    const userId = await getCurrentUserId();
    if (ordersSubscription) {
    }
    return {
      userId,
      hasClient: !!supabaseClient,
      hasSubscription: !!ordersSubscription,
      subscriptionState: ordersSubscription?.state
    };
  }

  // Toggle order menu dropdown
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

  // Close menus when clicking outside
  document.addEventListener('click', function(e) {
    if (!e.target.closest('.order-menu-btn') && !e.target.closest('.order-menu-dropdown')) {
      document.querySelectorAll('.order-menu-dropdown').forEach(m => {
        m.classList.remove('show');
      });
    }
  });

  // Event delegation for order menu buttons (handles dynamically generated buttons)
  document.addEventListener('click', function(e) {
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
  });

  // Handle Cancel Order
  async function handleCancelOrder(orderId) {
    // Close menu
    document.querySelectorAll('.order-menu-dropdown').forEach(m => {
      m.classList.remove('show');
    });

    // Show confirmation modal
    const modal = document.getElementById('cancelModalOverlay');
    if (modal) {
      modal.classList.add('show');
      modal.setAttribute('data-order-id', orderId);
    } else {
      console.error('Cancel modal not found in DOM');
      alert('Error: Cancel confirmation modal not found. Please refresh the page.');
    }
  }

  // Store pending order ID and selected payment method
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

    const modal = document.getElementById('paymentMethodModal');
    if (modal) {
      modal.style.display = 'none';
    }

    const orderCard = document.querySelector(`[data-order-id="${orderId}"]`);
    if (!orderCard) return;

    const totalSection = orderCard.querySelector('.order-total');
    if (totalSection) {
      totalSection.style.display = 'flex';
      totalSection.classList.remove('hidden-total');
      orderCard.setAttribute('data-bill-revealed', 'true');
      saveBillRevealedOrder(orderId);
    }

    try {
      await updateAdminOrderPayment(orderId, paymentMethod);
      await renderOrders();
    } catch (error) {
      console.error('Error processing payment:', error);
      alert('Error processing payment. Please try again.');
    }
  }


  // Confirm and cancel order
  async function confirmCancelOrder() {
    const modal = document.getElementById('cancelModalOverlay');
    if (!modal) {
      console.error('Cancel modal not found');
      return;
    }

    const orderId = modal.getAttribute('data-order-id');
    if (!orderId) {
      console.error('Order ID not found in modal');
      return;
    }

    const yesBtn = modal.querySelector('.cancel-modal-btn.yes');
    if (yesBtn) {
      yesBtn.disabled = true;
      yesBtn.textContent = 'Cancelling...';
    }

    try {
      await cancelAdminOrder(orderId);
      modal.classList.remove('show');
      await renderOrders();
    } catch (error) {
      console.error('Error cancelling order:', error);
      alert('Error cancelling order: ' + (error.message || 'Unknown error'));
      if (yesBtn) {
        yesBtn.disabled = false;
        yesBtn.textContent = 'Yes';
      }
    }
  }

  // Close cancel modal
  function closeCancelModal() {
    const modal = document.getElementById('cancelModalOverlay');
    if (modal) {
      modal.classList.remove('show');
    }
  }

  // Remove individual item from order (only for "New" orders within 10 minutes)
  async function removeOrderItem(orderId, itemId) {
    if (!confirm('Are you sure you want to remove this item from the order?')) {
      return;
    }

    try {
      await removeAdminOrderItem(orderId, itemId);
      await renderOrders();
    } catch (error) {
      console.error('Error removing item:', error);
      alert('Error removing item: ' + (error.message || 'Unknown error. Please try again.'));
    }
  }

  // Expose functions globally
  window.orderManagementModule = {
    initialize: initialize,
    renderOrders: renderOrders,
    setupRealtimeSubscription: setupRealtimeSubscription,
    cleanup: cleanupSubscription,
    test: testSubscription
  };

  // Expose menu functions globally
  window.toggleOrderMenu = toggleOrderMenu;
  window.handleCancelOrder = handleCancelOrder;
  window.handleGetBill = handleGetBill;
  window.confirmCancelOrder = confirmCancelOrder;
  window.closeCancelModal = closeCancelModal;

  // Expose admin order summary functions
  window.adminOrderSummary = {
    removeOrderItem: removeOrderItem
  };

export async function bootstrapOrderSummary() {
  if (window.orderManagementModule) {
    await window.orderManagementModule.initialize();
  }
}

export function teardownOrderSummary() {
  if (window.orderManagementModule) {
    window.orderManagementModule.cleanup();
  }
}

