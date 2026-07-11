import { FALLBACK_DISH_IMAGE } from '../../utils/restaurant';

function MenuItemActions({ dish, cartItem, onAdd, onChangeQty }) {
  const isInCart = cartItem && cartItem.qty > 0;
  const quantity = isInCart ? cartItem.qty : 0;

  if (isInCart) {
    return (
      <div className="menu-qty-selector">
        <button type="button" className="menu-qty-btn minus" onClick={() => onChangeQty(dish.name, -1)}>
          −
        </button>
        <span className="menu-qty-display">{quantity}</span>
        <button
          type="button"
          className="menu-qty-btn plus"
          onClick={() => onAdd(dish.name, dish.price, dish.image, dish.id)}
        >
          +
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="add-to-cart-btn"
      onClick={() => onAdd(dish.name, dish.price, dish.image, dish.id)}
    >
      Add
    </button>
  );
}

function MenuItem({ dish, cartItem, onAdd, onChangeQty }) {
  return (
    <div className="menu-item" data-dish-name={dish.name}>
      <img
        className="menu-item-img"
        src={dish.image || ''}
        alt={dish.name}
        onError={(e) => {
          e.currentTarget.src = FALLBACK_DISH_IMAGE;
          e.currentTarget.onerror = null;
        }}
      />
      <div className="menu-item-info">
        <h3>{dish.name}</h3>
        <p>{dish.description || ''}</p>
        <div className="menu-item-footer">
          <span className="price">₹{dish.price}</span>
          <div className="menu-item-actions">
            <MenuItemActions dish={dish} cartItem={cartItem} onAdd={onAdd} onChangeQty={onChangeQty} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MenuGrid({ groupedMenu, cart, onAdd, onChangeQty }) {
  const { dishesByCategory, sortedCategories, filteredCount } = groupedMenu;

  if (filteredCount === 0) {
    return (
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
          No dishes found
        </p>
      </div>
    );
  }

  return (
    <div className="menu-grid" id="menuGrid">
      {sortedCategories.map((category) => (
        <div key={category} className="menu-category-group" style={{ display: 'contents' }}>
          <div className="menu-category-heading">{category}</div>
          {dishesByCategory[category].map((dish) => (
            <MenuItem
              key={dish.id || dish.name}
              dish={dish}
              cartItem={cart[dish.name]}
              onAdd={onAdd}
              onChangeQty={onChangeQty}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
