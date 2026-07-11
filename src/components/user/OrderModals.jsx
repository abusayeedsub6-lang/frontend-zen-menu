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
