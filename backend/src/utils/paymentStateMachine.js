export const PAYMENT_STATES = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  REFUNDED: 'refunded',
};

export const ORDER_STATES = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  PROCESSING: 'processing',
  SHIPPED: 'shipped',
  OUT_FOR_DELIVERY: 'out_for_delivery',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  RETURNED: 'returned',
};

export const PAYMENT_TRANSITIONS = {
  [PAYMENT_STATES.PENDING]: [PAYMENT_STATES.PROCESSING, PAYMENT_STATES.FAILED],
  [PAYMENT_STATES.PROCESSING]: [PAYMENT_STATES.COMPLETED, PAYMENT_STATES.FAILED],
  [PAYMENT_STATES.COMPLETED]: [PAYMENT_STATES.REFUNDED],
  [PAYMENT_STATES.FAILED]: [],
  [PAYMENT_STATES.REFUNDED]: [],
};

export const ORDER_TRANSITIONS = {
  [ORDER_STATES.PENDING]: [ORDER_STATES.CONFIRMED, ORDER_STATES.CANCELLED],
  [ORDER_STATES.CONFIRMED]: [ORDER_STATES.PROCESSING, ORDER_STATES.CANCELLED, ORDER_STATES.RETURNED],
  [ORDER_STATES.PROCESSING]: [ORDER_STATES.SHIPPED, ORDER_STATES.RETURNED],
  [ORDER_STATES.SHIPPED]: [ORDER_STATES.OUT_FOR_DELIVERY, ORDER_STATES.RETURNED],
  [ORDER_STATES.OUT_FOR_DELIVERY]: [ORDER_STATES.DELIVERED, ORDER_STATES.RETURNED],
  [ORDER_STATES.DELIVERED]: [ORDER_STATES.RETURNED],
  [ORDER_STATES.CANCELLED]: [],
  [ORDER_STATES.RETURNED]: [],
};

export class InvalidStateTransitionError extends Error {
  constructor(currentState, targetState, entityType = 'Payment') {
    super(`${entityType} state transition from '${currentState}' to '${targetState}' is not allowed`);
    this.name = 'InvalidStateTransitionError';
    this.currentState = currentState;
    this.targetState = targetState;
    this.entityType = entityType;
  }
}

export const validatePaymentTransition = (currentState, targetState) => {
  const allowed = PAYMENT_TRANSITIONS[currentState] || [];
  if (!allowed.includes(targetState)) {
    throw new InvalidStateTransitionError(currentState, targetState, 'Payment');
  }
  return true;
};

export const validateOrderTransition = (currentState, targetState) => {
  const allowed = ORDER_TRANSITIONS[currentState] || [];
  if (!allowed.includes(targetState)) {
    throw new InvalidStateTransitionError(currentState, targetState, 'Order');
  }
  return true;
};

export const canTransitionPayment = (currentState, targetState) => {
  try {
    validatePaymentTransition(currentState, targetState);
    return true;
  } catch {
    return false;
  }
};

export const canTransitionOrder = (currentState, targetState) => {
  try {
    validateOrderTransition(currentState, targetState);
    return true;
  } catch {
    return false;
  }
};

export const getNextPaymentStates = (currentState) => {
  return PAYMENT_TRANSITIONS[currentState] || [];
};

export const getNextOrderStates = (currentState) => {
  return ORDER_TRANSITIONS[currentState] || [];
};

export const isPaymentFinalState = (state) => {
  return [PAYMENT_STATES.COMPLETED, PAYMENT_STATES.FAILED, PAYMENT_STATES.REFUNDED].includes(state);
};

export const isOrderFinalState = (state) => {
  return [ORDER_STATES.DELIVERED, ORDER_STATES.CANCELLED, ORDER_STATES.RETURNED].includes(state);
};

export const isPaymentPending = (state) => {
  return state === PAYMENT_STATES.PENDING || state === PAYMENT_STATES.PROCESSING;
};

export const isOrderPending = (state) => {
  return state === ORDER_STATES.PENDING || state === ORDER_STATES.CONFIRMED;
};
