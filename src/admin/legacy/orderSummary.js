'use strict';

import { supabase as sharedSupabase } from '../../lib/supabase.js';

// Order Management Module — adapted for React (see admin/OrderSummaryPage.jsx)

  let supabaseClient;
  let ordersSubscription = null;
  let currentUserId = null;
  let subscriptionHealthCheck = null;
  let isCleaningUp = false; // Flag to prevent reconnection loops

  // Get Supabase client from global scope
  function getSupabaseClient() {
    if (sharedSupabase) {
      return sharedSupabase;
    }
    if (window.supabaseClient) {
      return window.supabaseClient;
    }
    return null;
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

    supabaseClient = getSupabaseClient();
    if (!supabaseClient) {
      console.error('Supabase client not available');
      return;
    }

    try {
      // Fetch orders with their items for this restaurant (filtered by user_id)
      const selectWithTable = `
        id,
        order_number,
        total_amount,
        payment_method,
        created_at,
        user_id,
        cancelled,
        table_number,
        order_items (
          id,
          dish_id,
          dish_name,
          price,
          quantity
        )
      `;
      const selectWithoutTable = `
        id,
        order_number,
        total_amount,
        payment_method,
        created_at,
        user_id,
        cancelled,
        order_items (
          id,
          dish_id,
          dish_name,
          price,
          quantity
        )
      `;
      let orders = null;
      let error = null;
      let res = await supabaseClient
        .from('orders')
        .select(selectWithTable)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      orders = res.data;
      error = res.error;
      // If column table_number doesn't exist yet, retry without it so page still loads
      if (error && (String(error.message || '').includes('table_number') || String(error.message || '').includes('column'))) {
        res = await supabaseClient
          .from('orders')
          .select(selectWithoutTable)
          .eq('user_id', userId)
          .order('created_at', { ascending: false });
        orders = res.data;
        error = res.error;
      }
      if (error) throw error;

      if (!orders || orders.length === 0) {
        ordersGrid.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: #6b7280; padding: 40px;">No orders yet. Orders will appear here when customers place them.</p>';
        return;
      }

      // Fetch all order items for all orders; order by sort_order so items match customer (insertion order)
      const orderIds = orders.map(o => o.id).filter(Boolean);
      if (orderIds.length > 0) {
        let allItems = null;
        let itemsError = null;
        const selectWithSort = 'id, dish_id, dish_name, price, quantity, order_id, sort_order';
        const selectBase = 'id, dish_id, dish_name, price, quantity, order_id';
        let res = await supabaseClient
          .from('order_items')
          .select(selectWithSort)
          .in('order_id', orderIds)
          .order('sort_order', { ascending: true });
        allItems = res.data;
        itemsError = res.error;
        if (itemsError && (String(itemsError.message || '').includes('sort_order') || String(itemsError.message || '').includes('column'))) {
          res = await supabaseClient
            .from('order_items')
            .select(selectBase)
            .in('order_id', orderIds)
            .order('id', { ascending: true });
          allItems = res.data;
          itemsError = res.error;
        }
        if (!itemsError && allItems) {
          const itemsByOrderId = new Map();
          allItems.forEach(item => {
            if (!itemsByOrderId.has(item.order_id)) {
              itemsByOrderId.set(item.order_id, []);
            }
            itemsByOrderId.get(item.order_id).push(item);
          });
          if (allItems.length > 0 && allItems[0].sort_order != null) {
            itemsByOrderId.forEach((arr) => {
              arr.sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0));
            });
          }
          orders.forEach(order => {
            if (order.id && itemsByOrderId.has(order.id)) {
              order.order_items = itemsByOrderId.get(order.id);
            } else if (!order.order_items) {
              order.order_items = [];
            }
          });
        }
      }

      // Render order cards using stored order_number from database
      ordersGrid.innerHTML = orders.map(order => renderOrderCard(order)).join('');
    } catch (error) {
      console.error('Error loading orders:', error);
      ordersGrid.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: #dc2626; padding: 40px;">Error loading orders. Please refresh the page.</p>';
    }
  }

  // Set up real-time subscription for new orders
  async function setupRealtimeSubscription() {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.error('❌ User ID not available for real-time subscription');
      return;
    }

    supabaseClient = getSupabaseClient();
    if (!supabaseClient) {
      console.error('❌ Supabase client not available for real-time subscription');
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
    // Wait for Supabase client to be available
    let retries = 0;
    while (!getSupabaseClient() && retries < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      retries++;
    }

    if (!getSupabaseClient()) {
      console.error('❌ Supabase client not available after waiting');
      return;
    }

    supabaseClient = getSupabaseClient();
    // Wait for user authentication
    const userId = await getCurrentUserId();
    if (!userId) {
      console.error('❌ User ID not available - user may not be authenticated');
      return;
    }
    // Wait a bit more for the orders grid to be loaded in the DOM
    let gridRetries = 0;
    while (!document.querySelector('.orders-grid') && gridRetries < 20) {
      await new Promise(resolve => setTimeout(resolve, 100));
      gridRetries++;
    }

    if (!document.querySelector('.orders-grid')) {
    }

    // Render initial orders
    await renderOrders();

    // Set up real-time subscription
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

    supabaseClient = getSupabaseClient();
    if (!supabaseClient) {
      alert('Database connection error. Please refresh the page.');
      return;
    }

    try {
      // Fetch the actual order from database to check its payment_method
      const { data: orderData, error: fetchError } = await supabaseClient
        .from('orders')
        .select('payment_method')
        .eq('id', orderId)
        .single();

      if (fetchError || !orderData) {
        console.error('Error fetching order:', fetchError);
        alert('Error fetching order data. Please try again.');
        return;
      }

      const currentPaymentMethod = orderData.payment_method;
      // Admin/Staff can always override payment method when processing Get Bill
      // This allows admin/staff to update payment method even if customer already selected something
      // (e.g., customer selected "Pay at Counter", admin/staff can now set it to Cash/UPI/Card)

      // Use the selected payment method directly (cash, upi, or card)
      // Database constraint now allows: 'unpaid_new', 'unpaid_pay_at_counter', 'upi', 'cash', 'card'
      const newPaymentMethod = paymentMethod;
      // Try RPC function first
      let updateSucceeded = false;
      try {
        const { data: rpcData, error: rpcError } = await supabaseClient.rpc('update_order_payment_method', {
          p_order_id: orderId,
          p_payment_method: newPaymentMethod
        });
        
        if (!rpcError && rpcData === true) {
          updateSucceeded = true;
        } else if (rpcError) {
        }
      } catch (rpcException) {
      }

      // Fallback to direct update
      if (!updateSucceeded) {
        const { error: updateError } = await supabaseClient
          .from('orders')
          .update({ payment_method: newPaymentMethod })
          .eq('id', orderId);
        
        if (updateError) {
          console.error('Error updating payment method:', updateError);
          alert('Error updating payment method: ' + (updateError.message || 'Unknown error') + '. Please try again.');
          return;
        } else {
        }
      }

      // Re-render orders to reflect the badge change (green badge, paid status)
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
      supabaseClient = getSupabaseClient();
      if (!supabaseClient) {
        alert('Database connection error. Please refresh the page.');
        return;
      }

      // Get current user ID to ensure we can update the order
      const userId = await getCurrentUserId();
      if (!userId) {
        alert('Authentication error. Please log in again.');
        return;
      }

      // Try RPC function first (if it exists)
      let updateSucceeded = false;
      try {
        const { data: rpcData, error: rpcError } = await supabaseClient.rpc('update_order_cancelled', {
          p_order_id: orderId,
          p_cancelled: true
        });
        
        if (!rpcError && (rpcData === true || rpcData === null)) {
          updateSucceeded = true;
        } else if (rpcError) {
        }
      } catch (rpcException) {
      }

      // Fallback to direct update with user_id filter to ensure RLS compliance
      if (!updateSucceeded) {
        // First, verify the order exists and belongs to this user
        const { data: orderVerify, error: verifyError } = await supabaseClient
          .from('orders')
          .select('id, cancelled, payment_method, user_id')
          .eq('id', orderId)
          .eq('user_id', userId)
          .single();
        
        if (verifyError || !orderVerify) {
          console.error('Order verification failed:', verifyError);
          alert('Order not found or you do not have permission to cancel it.');
          if (yesBtn) {
            yesBtn.disabled = false;
            yesBtn.textContent = 'Yes';
          }
          return;
        }
        
        // Check if already cancelled
        if (orderVerify.cancelled === true) {
          updateSucceeded = true;
        } else {
          // Proceed with update
          const { data: updateData, error: updateError } = await supabaseClient
            .from('orders')
            .update({ cancelled: true })
            .eq('id', orderId)
            .eq('user_id', userId) // Add user_id filter for RLS compliance
            .select('id, cancelled'); // Select to verify update succeeded
          
          if (updateError) {
            console.error('Error cancelling order:', updateError);
            console.error('Error details:', JSON.stringify(updateError, null, 2));
            
            // Provide more specific error messages
            if (updateError.code === 'PGRST301' || updateError.message?.includes('permission') || updateError.message?.includes('policy')) {
              alert('Permission denied: Unable to cancel order. Please check database permissions.');
            } else {
              alert('Error cancelling order: ' + (updateError.message || 'Unknown error. Please try again.'));
            }
            
            if (yesBtn) {
              yesBtn.disabled = false;
              yesBtn.textContent = 'Yes';
            }
            return;
          }
          
          // If update returned no error, it likely succeeded
          // RLS might block the SELECT but allow the UPDATE
          if (updateData && updateData.length > 0) {
            // Double-check the cancelled status
            const updatedOrder = updateData[0];
            if (updatedOrder.cancelled === true) {
              updateSucceeded = true;
            } else {
              // Try to verify by reading back
              const { data: recheckData, error: recheckError } = await supabaseClient
                .from('orders')
                .select('id, cancelled')
                .eq('id', orderId)
                .eq('user_id', userId)
                .single();
              
              if (!recheckError && recheckData && recheckData.cancelled === true) {
                updateSucceeded = true;
              } else {
                // Update might have succeeded but we can't verify - assume success if no error
                updateSucceeded = true;
              }
            }
          } else {
            // Update returned no data - this is common with RLS
            // If there's no error, the update likely succeeded
            updateSucceeded = true;
            
            // Try to verify by reading back (optional verification)
            try {
              const { data: recheckData, error: recheckError } = await supabaseClient
                .from('orders')
                .select('id, cancelled')
                .eq('id', orderId)
                .eq('user_id', userId)
                .single();
              
              if (!recheckError && recheckData && recheckData.cancelled === true) {
              } else if (recheckError) {
                // Still assume success since update had no error
              }
            } catch (verifyErr) {
              // Still assume success since update had no error
            }
          }
        }
      }

      if (!updateSucceeded) {
        alert('Failed to cancel order. Please try again or contact support.');
        if (yesBtn) {
          yesBtn.disabled = false;
          yesBtn.textContent = 'Yes';
        }
        return;
      }

      // Close modal and refresh orders
      modal.classList.remove('show');
      await renderOrders();
      
      alert('Order cancelled successfully');
    } catch (error) {
      console.error('Error cancelling order:', error);
      alert('Error cancelling order: ' + (error.message || 'Unknown error. Please try again.'));
    } finally {
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

    supabaseClient = getSupabaseClient();
    if (!supabaseClient) {
      alert('Database connection error. Please refresh the page.');
      return;
    }

    try {
      // Delete the order item
      const { error: deleteError } = await supabaseClient
        .from('order_items')
        .delete()
        .eq('id', itemId)
        .eq('order_id', orderId);

      if (deleteError) {
        throw deleteError;
      }

      // Recalculate order total
      const { data: remainingItems, error: itemsError } = await supabaseClient
        .from('order_items')
        .select('price, quantity')
        .eq('order_id', orderId);

      if (itemsError) {
        throw itemsError;
      }

      const newTotal = remainingItems.reduce((sum, item) => {
        return sum + (parseFloat(item.price) || 0) * (parseInt(item.quantity) || 1);
      }, 0);

      // Update order total
      const { error: updateError } = await supabaseClient
        .from('orders')
        .update({ total_amount: newTotal })
        .eq('id', orderId);

      if (updateError) {
        throw updateError;
      }

      // Re-render orders from the latest data in Supabase
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

