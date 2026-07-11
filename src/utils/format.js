export function formatDateTime(dateString) {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);

  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours || 12;
  const minutesStr = minutes < 10 ? `0${minutes}` : String(minutes);

  return `${day}/${month}/${year} • ${hours}:${minutesStr} ${ampm}`;
}

export function formatPaymentMethod(paymentMethod) {
  const methodMap = {
    upi: 'UPI',
    cash: 'Cash',
    card: 'Card',
    unpaid_new: 'New',
    unpaid_pay_at_counter: 'Please wait...',
  };
  return methodMap[paymentMethod] || paymentMethod;
}

export function formatOrderNumber(orderNumber) {
  if (orderNumber === null || orderNumber === undefined || orderNumber === '') {
    return 'N/A';
  }
  return String(orderNumber).padStart(2, '0');
}
