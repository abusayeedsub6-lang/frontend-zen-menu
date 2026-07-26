import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CartModal from '../../components/user/CartModal';
import FloatingKartButton from '../../components/user/FloatingKartButton';
import MenuFilters from '../../components/user/MenuFilters';
import MenuGrid from '../../components/user/MenuGrid';
import MenuHeader from '../../components/user/MenuHeader';
import { OrderSuccessModal } from '../../components/user/OrderModals';
import { CartProvider, useCart } from '../../hooks/useCart';
import { useRestaurantContext } from '../../hooks/useRestaurantContext';
import { useRestaurantTheme } from '../../hooks/useRestaurantTheme';
import { usePageTitle } from '../../hooks/usePageTitle';
import { supabase } from '../../lib/supabase';
import { fetchCategories, fetchDishes, hasRestaurantOrders } from '../../services/menu';
import { buildCategoryOrderMap, filterAndGroupMenu } from '../../utils/menu';
import '../../styles/user.css';

function MenuPageContent() {
  const navigate = useNavigate();
  const { adminId, tableNumber, ordersPath } = useRestaurantContext();
  const theme = useRestaurantTheme(adminId, { applyHeader: true });
  usePageTitle(theme.menuName || 'Smart Digital Menu');
  const { cart, addToCart, changeQty, itemCount, placeOrder, isPlacingOrder } = useCart();

  const [menu, setMenu] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoryOrder, setCategoryOrder] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [showOrdersButton, setShowOrdersButton] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [showOrderSuccess, setShowOrderSuccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [emptyRestaurant, setEmptyRestaurant] = useState(false);

  const loadMenuData = useCallback(async () => {
    if (!adminId) return;

    const [categoryRows, dishRows] = await Promise.all([
      fetchCategories(adminId),
      fetchDishes(adminId),
    ]);

    setCategories(categoryRows.map((category) => category.name));
    setCategoryOrder(buildCategoryOrderMap(categoryRows));
    setMenu(dishRows);
    setEmptyRestaurant(dishRows.length === 0 && categoryRows.length === 0);
  }, [adminId]);

  const checkOrdersButton = useCallback(async () => {
    const hasOrders = localStorage.getItem('hasOrders') === 'true';
    if (hasOrders) {
      setShowOrdersButton(true);
      return;
    }

    const hasOrdersOnServer = await hasRestaurantOrders(adminId);
    setShowOrdersButton(hasOrdersOnServer);
  }, [adminId]);

  useEffect(() => {
    if (!adminId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function initialize() {
      setLoading(true);
      try {
        await loadMenuData();
        if (!cancelled) {
          await checkOrdersButton();
        }
      } catch (error) {
        console.error('Error loading menu:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    initialize();

    return () => {
      cancelled = true;
    };
  }, [adminId, loadMenuData, checkOrdersButton]);

  useEffect(() => {
    if (!supabase || !adminId) return undefined;

    const categoriesChannel = supabase
      .channel(`categories-changes-user-${adminId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'categories',
          filter: `user_id=eq.${adminId}`,
        },
        async (payload) => {
          if (payload.new?.user_id === adminId || payload.old?.user_id === adminId) {
            await loadMenuData();
          }
        },
      )
      .subscribe();

    const dishesChannel = supabase
      .channel(`dishes-changes-user-${adminId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'dishes',
          filter: `user_id=eq.${adminId}`,
        },
        async (payload) => {
          if (payload.new?.user_id === adminId || payload.old?.user_id === adminId) {
            await loadMenuData();
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(categoriesChannel);
      supabase.removeChannel(dishesChannel);
    };
  }, [adminId, loadMenuData]);

  const groupedMenu = useMemo(
    () =>
      filterAndGroupMenu(menu, {
        searchQuery,
        categoryFilter,
        categoryOrder,
      }),
    [menu, searchQuery, categoryFilter, categoryOrder],
  );

  async function handlePlaceOrder() {
    setIsCartOpen(false);
    try {
      await placeOrder(tableNumber);
      setShowOrderSuccess(true);
      window.setTimeout(() => {
        navigate(ordersPath);
      }, 1500);
    } catch (error) {
      console.error('Error placing order from cart:', error);
      alert(error.message || 'Error placing order. Please try again.');
    }
  }

  if (!adminId) {
    return (
      <div className="user-page">
        <MenuHeader
          menuName={theme.menuName}
          menuDescription={theme.menuDescription}
          headerStyle={theme.headerStyle}
          descriptionStyle={theme.descriptionStyle}
          showOrdersButton={false}
          ordersPath={ordersPath}
        />
        <MenuFilters
          categories={[]}
          searchQuery={searchQuery}
          categoryFilter={categoryFilter}
          onSearchChange={setSearchQuery}
          onCategoryChange={setCategoryFilter}
        />
        <div className="order-container" id="orderContainer">
          <div className="menu-section" id="menuSection">
            <div className="menu-grid" id="menuGrid">
              <div
                style={{
                  gridColumn: '1 / -1',
                  textAlign: 'center',
                  padding: '40px 20px',
                  color: '#6b7280',
                }}
              >
                <h2 style={{ marginBottom: '16px', color: '#374151' }}>Restaurant Not Found</h2>
                <p style={{ marginBottom: '8px' }}>Please access the menu through the restaurant&apos;s link.</p>
                <p style={{ fontSize: '14px', color: '#9ca3af' }}>
                  The menu requires a restaurant ID to display dishes.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="user-page">
      <MenuHeader
        menuName={theme.menuName}
        menuDescription={theme.menuDescription}
        headerStyle={theme.headerStyle}
        descriptionStyle={theme.descriptionStyle}
        showOrdersButton={showOrdersButton}
        ordersPath={ordersPath}
      />

      <MenuFilters
        categories={categories}
        searchQuery={searchQuery}
        categoryFilter={categoryFilter}
        onSearchChange={setSearchQuery}
        onCategoryChange={setCategoryFilter}
      />

      <div className="order-container" id="orderContainer">
        <div className="menu-section" id="menuSection">
          {loading ? (
            <div className="menu-grid" id="menuGrid">
              <p
                className="no-items"
                style={{
                  gridColumn: '1 / -1',
                  textAlign: 'center',
                  padding: '40px',
                  color: '#6b7280',
                }}
              >
                Loading menu...
              </p>
            </div>
          ) : emptyRestaurant ? (
            <div className="menu-grid" id="menuGrid">
              <div
                style={{
                  gridColumn: '1 / -1',
                  textAlign: 'center',
                  padding: '40px 20px',
                  color: '#6b7280',
                }}
              >
                <h2 style={{ marginBottom: '16px', color: '#374151' }}>No Menu Available</h2>
                <p style={{ marginBottom: '8px' }}>This restaurant doesn&apos;t have any dishes yet.</p>
              </div>
            </div>
          ) : (
            <MenuGrid groupedMenu={groupedMenu} cart={cart} onAdd={addToCart} onChangeQty={changeQty} />
          )}
        </div>
      </div>

      <CartModal
        isOpen={isCartOpen}
        cart={cart}
        isPlacingOrder={isPlacingOrder}
        onClose={() => setIsCartOpen(false)}
        onAdd={addToCart}
        onChangeQty={changeQty}
        onPlaceOrder={handlePlaceOrder}
      />

      <OrderSuccessModal isOpen={showOrderSuccess} />

      <FloatingKartButton itemCount={itemCount} onClick={() => setIsCartOpen(true)} />
    </div>
  );
}

export default function MenuPage() {
  const { adminId } = useRestaurantContext();

  return (
    <CartProvider adminId={adminId}>
      <MenuPageContent />
    </CartProvider>
  );
}
