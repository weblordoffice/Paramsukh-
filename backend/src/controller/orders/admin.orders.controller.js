import Order from '../../models/order.models.js';
import Product from '../../models/product.models.js';
import { sendNotification } from '../notifications/notifications.controller.js';
import { User } from '../../models/user.models.js';
import { sendOrderCancellationEmail, sendOrderStatusEmail } from '../../services/emailService.js';

// @desc    Update order status (Admin only)
// @route   PATCH /api/orders/:id/status
// @access  Admin
export const updateOrderStatusAdmin = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, remarks } = req.body;

        const order = await Order.findById(id);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        const oldStatus = order.status;
        order.status = status;

        // Add to history
        order.statusHistory.push({
            status,
            comment: remarks || `Status updated to ${status} by admin`,
            updatedBy: req.admin?._id || null // adminAuth attaches the admin as req.admin
        });

        // Handle specific status logic
        if (status === 'delivered') {
            order.deliveredAt = Date.now();
            order.payment.status = 'completed'; // Assume payment collected on delivery if COD
        } else if (status === 'shipped') {
            order.shippedAt = Date.now();
        } else if (status === 'confirmed') {
            order.confirmedAt = Date.now();
        } else if ((status === 'cancelled' || status === 'returned') && oldStatus !== status) {
            // Restore inventory if cancelled or returned
            for (const item of order.items) {
                try {
                    const product = await Product.findById(item.product);
                    if (product) {
                        product.inventory.stock += item.quantity;
                        await product.save();
                    }
                } catch (invErr) {
                    console.error(`Failed to restore inventory for product ${item.product}:`, invErr.message);
                }
            }
            if (status === 'cancelled') {
                order.cancelledAt = Date.now();
            } else {
                order.returnedAt = Date.now();
            }
        }

        await order.save();

        // Notify user
        await sendNotification(order.user, {
            type: 'order_status',
            title: `Order ${status.charAt(0).toUpperCase() + status.slice(1)}`,
            message: `Your order #${order.orderNumber} is now ${status}`,
            icon: '📦',
            priority: 'medium',
            relatedId: order._id,
            relatedType: 'order',
            actionUrl: `/order-detail?orderId=${order._id}`
        });

        // Trigger user-specific email for order status changes (business event).
        try {
            const orderUser = await User.findById(order.user).select('email displayName preferences');
            if (orderUser) {
                if (status === 'cancelled') sendOrderCancellationEmail(orderUser, order);
                else sendOrderStatusEmail(orderUser, order, status);
            }
        } catch (emailErr) {
            console.error('[AdminOrderStatus] Email skipped:', emailErr?.message || emailErr);
        }

        res.status(200).json({
            success: true,
            message: `Order status updated to ${status}`,
            data: { order }
        });
    } catch (error) {
        console.error('Update Order Status Admin Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update order status',
            error: error.message
        });
    }
};

// @desc    Get order details (Admin)
// @route   GET /api/orders/:id/admin
// @access  Admin
export const getOrderDetailsAdmin = async (req, res) => {
    try {
        const { id } = req.params;

        const order = await Order.findById(id)
            .populate('user', 'displayName email phone')
            .populate('items.product', 'name images');

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        res.status(200).json({
            success: true,
            data: { order }
        });
    } catch (error) {
        console.error('Get Order Details Admin Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve order details',
            error: error.message
        });
    }
};
