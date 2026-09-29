import { logPaymentAudit } from './paymentAudit.service.js';
import Order from '../models/order.models.js';
import Product from '../models/product.models.js';
import Cart from '../models/cart.models.js';

export class PaymentSaga {
  constructor(orderId, userId, options = {}) {
    this.orderId = orderId;
    this.userId = userId;
    this.steps = [];
    this.compensationSteps = [];
    this.currentStepIndex = -1;
    this.status = 'pending';
    this.error = null;
    this.options = {
      timeout: 30000,
      ...options,
    };
  }

  addStep({
    name,
    execute,
    compensate,
    onSuccess,
    onFailure,
  }) {
    this.steps.push({ name, execute, compensate, onSuccess, onFailure });
    return this;
  }

  async execute() {
    this.status = 'running';
    this.currentStepIndex = -1;

    for (let i = 0; i < this.steps.length; i++) {
      this.currentStepIndex = i;
      const step = this.steps[i];

      try {
        console.log(`[PaymentSaga] Executing step: ${step.name}`);
        const result = await this.executeWithTimeout(step.execute);

        if (step.onSuccess) {
          await step.onSuccess(result);
        }
      } catch (error) {
        console.error(`[PaymentSaga] Step ${step.name} failed:`, error.message);
        this.error = error;
        this.status = 'failed';

        await logPaymentAudit({
          orderId: this.orderId,
          userId: this.userId,
          action: 'fulfillment_failed',
          metadata: { step: step.name, error: error.message },
          status: 'failed',
          errorMessage: error.message,
        });

        await this.compensate();

        if (step.onFailure) {
          await step.onFailure(error);
        }

        return { success: false, error: error.message, failedStep: step.name };
      }
    }

    this.status = 'completed';
    return { success: true };
  }

  async compensate() {
    console.log(`[PaymentSaga] Starting compensation for ${this.currentStepIndex} steps`);

    for (let i = this.currentStepIndex; i >= 0; i--) {
      const step = this.steps[i];

      if (step.compensate) {
        try {
          console.log(`[PaymentSaga] Compensating step: ${step.name}`);
          await step.compensate();
        } catch (compensateError) {
          console.error(`[PaymentSaga] Compensation failed for ${step.name}:`, compensateError.message);
        }
      }
    }
  }

  async executeWithTimeout(fn) {
    return Promise.race([
      fn(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Step timeout')), this.options.timeout)
      ),
    ]);
  }
}

export const createOrderPaymentSaga = async (orderId, userId) => {
  const saga = new PaymentSaga(orderId, userId);

  saga.addStep({
    name: 'validate_order',
    execute: async () => {
      const order = await Order.findById(orderId);
      if (!order) throw new Error('Order not found');
      if (order.status !== 'pending') throw new Error('Order is not in pending status');
      return order;
    },
    compensate: async () => {},
  });

  saga.addStep({
    name: 'reserve_inventory',
    execute: async (order) => {
      for (const item of order.items) {
        if (item.product) {
          await Product.findOneAndUpdate(
            { _id: item.product, 'inventory.stock': { $gte: item.quantity } },
            { $inc: { 'inventory.stock': -item.quantity } }
          );
        }
      }
      return true;
    },
    compensate: async () => {
      const order = await Order.findById(orderId);
      if (order) {
        for (const item of order.items) {
          if (item.product) {
            await Product.findByIdAndUpdate(item.product, {
              $inc: { 'inventory.stock': item.quantity },
            });
          }
        }
      }
    },
  });

  saga.addStep({
    name: 'clear_user_cart',
    execute: async () => {
      await Cart.findOneAndUpdate(
        { user: userId },
        { items: [], subtotal: 0, total: 0, discount: 0 }
      );
      return true;
    },
    compensate: async () => {},
  });

  saga.addStep({
    name: 'confirm_order',
    execute: async () => {
      const order = await Order.findByIdAndUpdate(
        orderId,
        { status: 'confirmed', 'payment.status': 'completed' },
        { new: true }
      );
      return order;
    },
    compensate: async () => {
      await Order.findByIdAndUpdate(orderId, { status: 'cancelled' });
    },
  });

  return saga;
};
