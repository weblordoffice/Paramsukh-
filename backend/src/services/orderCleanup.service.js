import Order from '../models/order.models.js';
import Product from '../models/product.models.js';
import { sendNotification } from '../controller/notifications/notifications.controller.js';

const PENDING_ORDER_EXPIRY_MINUTES = parseInt(process.env.PENDING_ORDER_EXPIRY_MINUTES || '30', 10);

/**
 * Expire stale online (Razorpay) orders that were created but never paid.
 * Restores reserved inventory and notifies the user so abandoned payments
 * don't permanently hold stock.
 */
export const expirePendingOrders = async () => {
  const cutoff = new Date(Date.now() - PENDING_ORDER_EXPIRY_MINUTES * 60 * 1000);

  const staleOrders = await Order.find({
    status: 'pending',
    'payment.method': 'razorpay',
    'payment.status': 'pending',
    createdAt: { $lte: cutoff }
  });

  let expired = 0;

  for (const order of staleOrders) {
    try {
      // Restore inventory that was reserved at order creation
      for (const item of order.items) {
        const product = await Product.findById(item.product);
        if (product && product.inventory && !product.inventory.isUnlimited) {
          product.inventory.stock += item.quantity;
          await product.save();
        }
      }

      order.cancellation = {
        reason: 'Payment not completed within allowed time',
        comment: 'Auto-expired by system',
      };
      await order.updateStatus('cancelled', 'Payment not completed — auto-expired');

      try {
        await sendNotification(order.user, {
          type: 'order',
          title: 'Order Expired',
          message: `Order #${order.orderNumber} was cancelled because payment was not completed in time.`,
          icon: '⏳',
          priority: 'medium',
          relatedId: order._id,
          relatedType: 'order',
          actionUrl: `/orders/${order._id}`
        });
      } catch (nErr) {
        console.error('[OrderCleanup] Notification skipped:', nErr.message);
      }

      expired += 1;
    } catch (err) {
      console.error(`[OrderCleanup] Failed to expire order ${order.orderNumber}:`, err.message);
    }
  }

  return { expired };
};
