export default function FloatingKartButton({ itemCount, onClick }) {
  if (itemCount === 0) return null;

  return (
    <button type="button" className="floating-kart-btn" id="floatingKartBtn" onClick={onClick}>
      <span className="kart-icon">🛒</span>
      <span className="kart-text">Kart</span>
      <span className="kart-badge" id="kartBadge">
        {itemCount}
      </span>
    </button>
  );
}
