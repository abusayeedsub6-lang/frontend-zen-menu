export function CancelOrderModal({ isOpen, isProcessing, onConfirm, onCancel }) {
  if (!isOpen) return null;

  return (
    <div
      className={`cancel-modal-overlay${isOpen ? ' show' : ''}`}
      id="cancelModalOverlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="cancel-modal">
        <div className="cancel-modal-message">Do you want to cancel the order?</div>
        <div className="cancel-modal-buttons">
          <button type="button" className="cancel-modal-btn no" onClick={onCancel} disabled={isProcessing}>
            No
          </button>
          <button type="button" className="cancel-modal-btn yes" onClick={onConfirm} disabled={isProcessing}>
            {isProcessing ? 'Cancelling...' : 'Yes'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function RemoveItemModal({ isOpen, dishName, isProcessing, onConfirm, onCancel }) {
  if (!isOpen) return null;

  return (
    <div
      className={`cancel-modal-overlay${isOpen ? ' show' : ''}`}
      id="removeItemModalOverlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="cancel-modal compact">
        <div className="cancel-modal-message">You want to remove {dishName || 'this dish'}?</div>
        <div className="cancel-modal-buttons">
          <button type="button" className="cancel-modal-btn no" onClick={onCancel} disabled={isProcessing}>
            No
          </button>
          <button type="button" className="cancel-modal-btn yes" onClick={onConfirm} disabled={isProcessing}>
            {isProcessing ? 'Removing...' : 'Yes'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function GetBillModal({ isOpen, onConfirm, onCancel }) {
  if (!isOpen) return null;

  return (
    <div
      className={`confirm-modal-overlay${isOpen ? ' show' : ''}`}
      id="confirmModalOverlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="confirm-modal">
        <div className="confirm-modal-message">Do you want the bill?</div>
        <div className="confirm-modal-buttons">
          <button type="button" className="confirm-modal-btn no" onClick={onCancel}>
            No
          </button>
          <button type="button" className="confirm-modal-btn yes" onClick={onConfirm}>
            Yes
          </button>
        </div>
      </div>
    </div>
  );
}

export function OrderSuccessModal({ isOpen }) {
  if (!isOpen) return null;

  return (
    <div className="order-success-overlay show" id="orderSuccessModal" role="status" aria-live="polite">
      <div className="order-success-modal">
        <div className="order-success-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="36" height="36" fill="none">
            <circle cx="12" cy="12" r="11" fill="currentColor" />
            <path
              d="M7.5 12.5l3 3 6-6.5"
              stroke="#fff"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div className="order-success-message">Order Placed Successfully</div>
      </div>
    </div>
  );
}
