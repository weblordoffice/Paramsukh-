import Order from '../../models/order.models.js';
import Cart from '../../models/cart.models.js';
import Product from '../../models/product.models.js';
import Shop from '../../models/shop.models.js';
import Address from '../../models/address.models.js';
import { sendNotification } from '../notifications/notifications.controller.js';
import { createRazorpayOrder, verifyRazorpaySignature, createRazorpayPaymentLink, fetchPaymentLink } from '../../services/razorpayService.js';
import { sendOrderConfirmationEmail } from '../../services/emailService.js';


// @desc    Create order from cart
// @route   POST /api/orders/create
// @access  Private
export const createOrder = async (req, res) => {
  try {
    const userId = req.user._id;
    const { addressId, paymentMethod, customerNotes } = req.body;

    console.log('[CreateOrder] Request:', { userId, addressId, paymentMethod });

    // Get cart
    const cart = await Cart.findOne({ user: userId }).populate('items.product');

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart is empty' });
    }

    // Get delivery address
    const address = await Address.findOne({ _id: addressId, user: userId });
    if (!address) {
      return res.status(404).json({ success: false, message: 'Delivery address not found' });
    }

    // Validate address has required fields for Order
    if (!address.phone || !address.pincode || !address.addressLine1 || !address.city || !address.state) {
      return res.status(400).json({
        success: false,
        message: 'Selected address is incomplete (missing phone, pincode, or street). Please edit or add a new address.'
      });
    }

    // Prepare order items
    const orderItems = [];
    for (const item of cart.items) {
      if (!item.product) {
        return res.status(400).json({ success: false, message: 'One or more items in cart are missing' });
      }

      let productImage = '';
      if (item.product.images && item.product.images.length > 0) {
        productImage = item.product.images[0]?.url || '';
      } else if (item.product.image) {
        productImage = item.product.image;
      }

      const orderItem = {
        product: item.product._id,
        productName: item.product.name,
        productImage: productImage,
        shop: item.product.shop,
        quantity: item.quantity,
        price: item.price,
        tax: item.price * item.quantity * 0.18,
        subtotal: item.price * item.quantity
      };

      // Only attach variant when it's a non-empty object
      if (item.variant && typeof item.variant === 'object' && Object.keys(item.variant).length > 0) {
        orderItem.variant = item.variant;
      }

      orderItems.push(orderItem);
    }

    // Manually generate random Order Number to ensure it exists
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const random = Math.floor(100000 + Math.random() * 900000);
    const generatedOrderNumber = `ORD${year}${month}${random}`;

    // Create order
    const order = new Order({
      orderNumber: generatedOrderNumber, // Explicitly set it
      user: userId,
      items: orderItems,
      deliveryAddress: {
        fullName: address.fullName,
        phone: address.phone,
        addressLine1: address.addressLine1,
        addressLine2: address.addressLine2,
        landmark: address.landmark,
        city: address.city,
        state: address.state,
        pincode: address.pincode,
        country: address.country
      },
      pricing: {
        subtotal: cart.subtotal,
        discount: cart.discount,
        shippingCharge: cart.shippingCharge,
        tax: cart.tax,
        total: cart.total
      },
      coupon: cart.coupon,
      payment: {
        method: paymentMethod,
        status: 'pending'
      },
      customerNotes,
      status: 'pending'
    });

    // Handle Razorpay Logic
    let razorpayOrder = null;
    if (paymentMethod === 'razorpay') {
      try {
        razorpayOrder = await createRazorpayOrder({
          amount: order.pricing.total,
          currency: 'INR',
          receipt: order.orderNumber,
          notes: {
            userId: userId.toString(),
            orderId: order._id.toString() // Will be available after save? No, let's behave.
          }
        });

        order.payment.razorpayOrderId = razorpayOrder.id;
        order.payment.razorpayReceiptId = razorpayOrder.receipt;
      } catch (rzpError) {
        console.error('Razorpay Order Creation Failed:', rzpError);
        return res.status(500).json({ success: false, message: 'Failed to initiate payment gateway' });
      }
    }

    await order.save();


    // Inventory Update
    for (const item of cart.items) {
      if (item.product) {
        const product = await Product.findById(item.product._id);
        if (product) {
          if (product.inventory && !product.inventory.isUnlimited) {
            product.inventory.stock = Math.max(0, product.inventory.stock - item.quantity);
          }
          if (product.stats) {
            product.stats.soldCount = (product.stats.soldCount || 0) + item.quantity;
          } else {
            product.stats = { soldCount: item.quantity };
          }
          await product.save();
        }
      }
    }

    // Clear cart
    await cart.clearCart();

    // Notification
    try {
      await sendNotification(userId, {
        type: 'system',
        title: 'Order Placed Successfully',
        message: `Your order #${order.orderNumber} has been placed successfully`,
        icon: '🛍️',
        priority: 'high',
        relatedId: order._id,
        relatedType: 'order',
        actionUrl: `/orders/${order._id}`
      });
    } catch (nErr) {
      console.error('[CreateOrder] Notification skipped:', nErr.message);
    }

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: {
        order,
        razorpay: razorpayOrder ? {
          orderId: razorpayOrder.id,
          amount: razorpayOrder.amount, // already in paise
          currency: razorpayOrder.currency,
          keyId: process.env.RAZORPAY_KEY_ID
        } : null
      }
    });
  } catch (error) {
    console.error('[CreateOrder] Critical Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create order (Unknown Error)',
      error: error.toString()
    });
  }
};

// @desc    Get all orders (Admin only)
// @route   GET /api/orders/all
// @access  Admin
export const getAllOrders = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;

    const query = {};
    if (status) query.status = status;

    if (search) {
      query.$or = [
        { orderNumber: { $regex: search, $options: 'i' } },
        { 'deliveryAddress.fullName': { $regex: search, $options: 'i' } }
      ];
    }

    const orders = await Order.find(query)
      .populate('user', 'displayName email phone')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Order.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        orders,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total
        }
      }
    });
  } catch (error) {
    console.error('Get All Orders Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve orders',
      error: error.message
    });
  }
};

// @desc    Get user's orders
// @route   GET /api/orders/my-orders
// @access  Private
export const getMyOrders = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 10, status } = req.query;

    const query = { user: userId };
    if (status) query.status = status;

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Order.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        orders,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total
        }
      }
    });
  } catch (error) {
    console.error('Get My Orders Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve orders',
      error: error.message
    });
  }
};

// @desc    Get order details
// @route   GET /api/orders/:id
// @access  Private
export const getOrderDetails = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const order = await Order.findOne({ _id: id, user: userId })
      .populate('items.product', 'name images')
      .populate('items.shop', 'name slug phone email');

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
    console.error('Get Order Details Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve order',
      error: error.message
    });
  }
};

// @desc    Cancel order
// @route   PATCH /api/orders/:id/cancel
// @access  Private
export const cancelOrder = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    const { reason, comment } = req.body;

    const order = await Order.findOne({ _id: id, user: userId });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    if (!['pending', 'confirmed'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: 'Order cannot be cancelled at this stage'
      });
    }

    order.status = 'cancelled';
    order.cancelledAt = Date.now();
    order.cancellation = {
      reason: reason || 'User requested cancellation',
      comment: comment || '',
      cancelledBy: userId
    };

    await order.updateStatus('cancelled', 'Cancelled by user', userId);

    // Restore inventory
    for (const item of order.items) {
      const product = await Product.findById(item.product);
      if (product && !product.inventory.isUnlimited) {
        product.inventory.stock += item.quantity;
        await product.save();
      }
    }

    // Send notification
    await sendNotification(userId, {
      type: 'system',
      title: 'Order Cancelled',
      message: `Order #${order.orderNumber} has been cancelled`,
      icon: '❌',
      priority: 'medium'
    });

    res.status(200).json({
      success: true,
      message: 'Order cancelled successfully',
      data: { order }
    });
  } catch (error) {
    console.error('Cancel Order Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel order',
      error: error.message
    });
  }
};

// @desc    Request return
// @route   POST /api/orders/:id/return
// @access  Private
export const requestReturn = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    const { reason, comment, images } = req.body;

    const order = await Order.findOne({ _id: id, user: userId });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    if (order.status !== 'delivered') {
      return res.status(400).json({
        success: false,
        message: 'Only delivered orders can be returned'
      });
    }

    // Check if return window is still open (e.g., 7 days)
    const daysSinceDelivery = (Date.now() - order.deliveredAt) / (1000 * 60 * 60 * 24);
    if (daysSinceDelivery > 7) {
      return res.status(400).json({
        success: false,
        message: 'Return window has expired (7 days from delivery)'
      });
    }

    order.returnRequest = {
      reason: reason || 'Product issue',
      comment: comment || '',
      images: images || [],
      requestedAt: Date.now(),
      status: 'pending'
    };

    await order.save();

    // Send notification
    await sendNotification(userId, {
      type: 'system',
      title: 'Return Request Submitted',
      message: `Return request for order #${order.orderNumber} is being processed`,
      icon: '🔄',
      priority: 'medium'
    });

    res.status(200).json({
      success: true,
      message: 'Return request submitted successfully',
      data: { order }
    });
  } catch (error) {
    console.error('Request Return Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to request return',
      error: error.message
    });
  }
};

// @desc    Track order
// @route   GET /api/orders/:id/track
// @access  Private
export const trackOrder = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const order = await Order.findOne({ _id: id, user: userId })
      .select('orderNumber status statusHistory tracking estimatedDelivery');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.status(200).json({
      success: true,
      data: { tracking: order }
    });
  } catch (error) {
    console.error('Track Order Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to track order',
      error: error.message
    });
  }
};

// @desc    Get order invoice
// @route   GET /api/orders/:id/invoice
// @access  Private
export const getInvoice = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const order = await Order.findOne({ _id: id, user: userId })
      .populate('items.product', 'name')
      .populate('items.shop', 'name address gstNumber');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // In a real app, you'd generate a PDF invoice here
    res.status(200).json({
      success: true,
      data: {
        invoice: {
          orderNumber: order.orderNumber,
          invoiceNumber: order.invoiceNumber || `INV${order.orderNumber}`,
          date: order.createdAt,
          customer: order.deliveryAddress,
          items: order.items,
          pricing: order.pricing
        }
      }
    });
  } catch (error) {
    console.error('Get Invoice Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get invoice',
      error: error.message
    });
  }
};

// @desc    Verify Razorpay Payment for Order
// @route   POST /api/orders/verify-payment
// @access  Private
export const verifyOrderPayment = async (req, res) => {
  try {
    const userId = req.user._id;
    const { orderId, razorpayPaymentId, razorpayOrderId, razorpaySignature } = req.body;

    console.log('[VerifyPayment] Request:', { orderId, razorpayPaymentId });

    if (!orderId || !razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
      return res.status(400).json({ success: false, message: 'Missing payment verification details' });
    }

    // 1. Verify Signature
    const isValid = verifyRazorpaySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Invalid payment signature' });
    }

    // 2. Find Order
    const order = await Order.findOne({ _id: orderId, user: userId });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // 3. Update Order Status
    if (order.status === 'pending' || order.payment.status === 'pending') {
      order.status = 'confirmed';
      order.payment.status = 'completed';
      order.payment.razorpayPaymentId = razorpayPaymentId;
      order.payment.paidAt = Date.now();
      await order.save();

      console.log(`✅ Order #${order.orderNumber} confirmed via Razorpay`);

      // 4. Send Email Confirmation
      try {
        await sendOrderConfirmationEmail(req.user, order);
      } catch (emailErr) {
        console.error('Email confirmation failed:', emailErr);
      }

      // 5. Send Notification
      try {
        await sendNotification(userId, {
          type: 'order',
          title: 'Order Confirmed! ✅',
          message: `Payment successful! Your order #${order.orderNumber} is confirmed.`,
          icon: '📦',
          priority: 'high',
          relatedId: order._id,
          relatedType: 'order',
          actionUrl: `/orders/${order._id}`
        });
      } catch (nErr) {
        console.error('Notification failed:', nErr);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Payment verified and order confirmed',
      data: { order }
    });

  } catch (error) {
    console.error('[VerifyPayment] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Payment verification failed',
      error: error.message
    });
  }
};

// @desc    Create Razorpay payment link for existing order (hosted checkout – works without native SDK)
// @route   POST /api/orders/:orderId/payment-link
// @access  Private
export const createOrderPaymentLink = async (req, res) => {
  try {
    const userId = req.user._id;
    const { orderId } = req.params;
    const order = await Order.findOne({ _id: orderId, user: userId });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (order.status !== 'pending' || order.payment?.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Order is not pending payment' });
    }
    const amount = order.pricing?.total ?? 0;
    if (amount <= 0) return res.status(400).json({ success: false, message: 'Invalid order total' });
    const customer = {
      name: req.user?.displayName || req.user?.name || order.deliveryAddress?.fullName || 'Customer',
      email: req.user?.email || undefined,
      contact: order.deliveryAddress?.phone || req.user?.phone ? String(req.user.phone).replace('+91', '').trim() : undefined,
    };
    const link = await createRazorpayPaymentLink({
      amount,
      currency: 'INR',
      description: `Order #${order.orderNumber} · Paramsukh`,
      customer,
      notes: { type: 'order', orderId: String(orderId), userId: String(userId) },
    });
    return res.status(200).json({
      success: true,
      data: { url: link.short_url, paymentLinkId: link.id },
    });
  } catch (error) {
    console.error('[CreateOrderPaymentLink] Error:', error);
    return res.status(500).json({ success: false, message: error?.message || 'Failed to create payment link' });
  }
};

// @desc    Confirm order payment link and mark order paid
// @route   POST /api/orders/confirm-payment-link
// @access  Private
export const verifyOrderPaymentByLink = async (req, res) => {
  try {
    const userId = req.user._id;
    const { orderId, paymentLinkId } = req.body;
    if (!orderId || !paymentLinkId) {
      return res.status(400).json({ success: false, message: 'orderId and paymentLinkId required' });
    }
    const link = await fetchPaymentLink(paymentLinkId);
    const status = String(link?.status || '').toLowerCase();
    const notes = link?.notes || {};
    if (notes?.userId && String(notes.userId) !== String(userId)) {
      return res.status(403).json({ success: false, message: 'Payment link does not belong to you' });
    }
    if (status !== 'paid' && status !== 'captured') {
      return res.status(200).json({ success: true, data: { status: link?.status }, message: 'Payment not completed yet' });
    }
    const order = await Order.findOne({ _id: orderId, user: userId });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (order.status !== 'pending' || order.payment?.status !== 'pending') {
      return res.status(200).json({ success: true, data: { order }, message: 'Order already confirmed' });
    }
    const paymentsRaw = link?.payments;
    const firstPayment = Array.isArray(paymentsRaw) ? paymentsRaw[0] : paymentsRaw;
    const razorpayPaymentId = firstPayment?.payment_id || link?.payment_id;
    order.status = 'confirmed';
    order.payment.status = 'completed';
    order.payment.razorpayPaymentId = razorpayPaymentId || `pay_${Date.now()}`;
    order.payment.paidAt = Date.now();
    await order.save();

    const cart = await Cart.findOne({ user: userId });
    if (cart) {
      cart.items = [];
      cart.subtotal = 0;
      cart.discount = 0;
      cart.shippingCharge = 0;
      cart.tax = 0;
      cart.total = 0;
      await cart.save();
    }
    try {
      await sendOrderConfirmationEmail(req.user, order);
    } catch (e) {
      console.error('Order confirmation email failed:', e);
    }
    try {
      await sendNotification(userId, {
        type: 'order',
        title: 'Order Confirmed! ✅',
        message: `Payment successful! Your order #${order.orderNumber} is confirmed.`,
        icon: '📦',
        priority: 'high',
        relatedId: order._id,
        relatedType: 'order',
        actionUrl: `/orders/${order._id}`,
      });
    } catch (e) {
      console.error('Notification failed:', e);
    }
    return res.status(200).json({
      success: true,
      message: 'Payment verified and order confirmed',
      data: { order },
    });
  } catch (error) {
    console.error('[VerifyOrderPaymentByLink] Error:', error);
    return res.status(500).json({ success: false, message: error?.message || 'Payment verification failed' });
  }
};
