export const truncate = (value, maxLength = 140) => {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3).trim()}...`;
};

export const toSentence = (value, maxLength = 140) => {
  return truncate(value, maxLength);
};

export const formatCurrency = (amount, currency = 'INR') => {
  if (typeof amount !== 'number' || isNaN(amount)) return '₹0';
  return `₹${amount.toLocaleString('en-IN')}`;
};
