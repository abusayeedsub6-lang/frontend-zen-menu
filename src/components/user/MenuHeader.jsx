import { Link } from 'react-router-dom';

export default function MenuHeader({
  menuName,
  menuDescription,
  headerStyle,
  descriptionStyle,
  showOrdersButton,
  ordersPath,
}) {
  return (
    <header id="menuHeader" style={headerStyle}>
      <div className="header-content">
        <h1 id="menuTitle">{menuName}</h1>
        <p id="menuDescription" style={descriptionStyle}>
          {menuDescription}
        </p>
        {showOrdersButton ? (
          <Link to={ordersPath} className="orders-btn" id="ordersBtn">
            Orders
          </Link>
        ) : null}
      </div>
    </header>
  );
}
