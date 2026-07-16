import Cart from '../../models/cart.models.js';
import Product from '../../models/product.models.js';
import Coupon from '../../models/coupon.models.js';

/**
 * Calculates the subtotal of items in the cart that match the coupon's restrictions.
 */
const getEligibleSubtotal = (cart, coupon) => {
  if (coupon.applicableOn === 'category') {
    return cart.items.reduce((sum, item) => {
      const productCategory = item.product?.category?._id || item.product?.category || item.product;
      const matchesCategory = coupon.categories.some(catId => 
        catId.toString() === productCategory.toString()
      );
      return matchesCategory ? sum + (item.price * item.quantity) : sum;
    }, 0);
  } 
  else if (coupon.applicableOn === 'product') {
    return cart.items.reduce((sum, item) => {
      const productId = item.product?._id || item.product;
      const matchesProduct = coupon.products.some(prodId => 
        prodId.toString() === productId.toString()
      );
      return matchesProduct ? sum + (item.price * item.quantity) : sum;
    }, 0);
  } 
  else if (coupon.applicableOn === 'shop') {
    return cart.items.reduce((sum, item) => {
      const productShop = item.product?.shop?._id || item.product?.shop || item.product;
      const matchesShop = coupon.shops.some(shopId => 
        shopId.toString() === productShop.toString()
      );
      return matchesShop ? sum + (item.price * item.quantity) : sum;
    }, 0);
  } 
  return cart.subtotal;
};

/**
 * Helper to dynamically load the active coupon from DB and recalculate cart totals.
 */
export const recalculateCartTotals = async (cart) => {
  if (cart.coupon && cart.coupon.code) {
    const coupon = await Coupon.findOne({ code: cart.coupon.code.toUpperCase(), isActive: true });
    if (coupon) {
      await cart.populate({
        path: 'items.product',
        select: 'name images pricing inventory shop category'
      });
      cart.calculateTotals(coupon);
    } else {
      cart.coupon = undefined;
      cart.discount = 0;
      cart.calculateTotals();
    }
  } else {
    cart.calculateTotals();
  }
  return cart;
};

// @desc    Get user's cart
// @route   GET /api/cart
// @access  Private
export const getCart = async (req, res) => {
  try {
    const userId = req.user._id;

    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      cart = new Cart({ user: userId, items: [] });
      await cart.save();
    }

    await recalculateCartTotals(cart);
    await cart.save();

    await cart.populate({
      path: 'items.product',
      select: 'name images pricing inventory shop category',
      populate: { path: 'shop', select: 'name slug' }
    });

    res.status(200).json({
      success: true,
      data: { cart }
    });
  } catch (error) {
    console.error('Get Cart Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve cart',
      error: error.message
    });
  }
};

// @desc    Add item to cart
// @route   POST /api/cart/add
// @access  Private
export const addToCart = async (req, res) => {
  try {
    const userId = req.user._id;
    const { productId, quantity = 1, variant } = req.body;

    const product = await Product.findById(productId);
    if (!product || !product.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Product not found or inactive'
      });
    }

    if (!product.isAvailable(quantity)) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient stock'
      });
    }

    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      cart = new Cart({ user: userId, items: [] });
    }

    await cart.addItem(productId, quantity, product.pricing.sellingPrice, variant);

    await recalculateCartTotals(cart);
    await cart.save();

    await cart.populate({
      path: 'items.product',
      select: 'name images pricing inventory shop category'
    });

    res.status(200).json({
      success: true,
      message: 'Item added to cart',
      data: { cart }
    });
  } catch (error) {
    console.error('Add to Cart Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add item to cart',
      error: error.message
    });
  }
};

// @desc    Update cart item quantity
// @route   PATCH /api/cart/update/:itemId
// @access  Private
export const updateCartItem = async (req, res) => {
  try {
    const userId = req.user._id;
    const { itemId } = req.params;
    const { quantity } = req.body;

    if (!quantity || quantity < 1) {
      return res.status(400).json({
        success: false,
        message: 'Valid quantity is required'
      });
    }

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    const item = cart.items.find(i => i._id.toString() === itemId);
    if (item) {
      const product = await Product.findById(item.product);
      if (!product.isAvailable(quantity)) {
        return res.status(400).json({
          success: false,
          message: 'Insufficient stock'
        });
      }
    }

    await cart.updateQuantity(itemId, quantity);

    await recalculateCartTotals(cart);
    await cart.save();

    await cart.populate({
      path: 'items.product',
      select: 'name images pricing inventory shop category'
    });

    res.status(200).json({
      success: true,
      message: 'Cart updated',
      data: { cart }
    });
  } catch (error) {
    console.error('Update Cart Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update cart',
      error: error.message
    });
  }
};

// @desc    Remove item from cart
// @route   DELETE /api/cart/remove/:itemId
// @access  Private
export const removeFromCart = async (req, res) => {
  try {
    const userId = req.user._id;
    const { itemId } = req.params;

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    await cart.removeItem(itemId);

    await recalculateCartTotals(cart);
    await cart.save();

    await cart.populate({
      path: 'items.product',
      select: 'name images pricing inventory shop category'
    });

    res.status(200).json({
      success: true,
      message: 'Item removed from cart',
      data: { cart }
    });
  } catch (error) {
    console.error('Remove from Cart Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove item',
      error: error.message
    });
  }
};

// @desc    Clear cart
// @route   DELETE /api/cart/clear
// @access  Private
export const clearCart = async (req, res) => {
  try {
    const userId = req.user._id;

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    await cart.clearCart();

    res.status(200).json({
      success: true,
      message: 'Cart cleared',
      data: { cart }
    });
  } catch (error) {
    console.error('Clear Cart Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear cart',
      error: error.message
    });
  }
};

// @desc    Apply coupon to cart
// @route   POST /api/cart/apply-coupon
// @access  Private
export const applyCoupon = async (req, res) => {
  try {
    const userId = req.user._id;
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Coupon code is required'
      });
    }

    const cart = await Cart.findOne({ user: userId });
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cart is empty'
      });
    }

    const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true });
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Invalid coupon code'
      });
    }

    await cart.populate({
      path: 'items.product',
      select: 'name images pricing inventory shop category'
    });

    const eligibleSubtotal = getEligibleSubtotal(cart, coupon);
    if (eligibleSubtotal === 0) {
      return res.status(400).json({
        success: false,
        message: 'This coupon is not applicable to any products in your cart.'
      });
    }

    const validity = await coupon.canUserUse(userId, eligibleSubtotal);
    if (!validity.valid) {
      return res.status(400).json({
        success: false,
        message: validity.message
      });
    }

    cart.calculateTotals(coupon);
    await cart.save();

    res.status(200).json({
      success: true,
      message: 'Coupon applied successfully',
      data: { cart }
    });
  } catch (error) {
    console.error('Apply Coupon Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to apply coupon',
      error: error.message
    });
  }
};

// @desc    Remove coupon from cart
// @route   DELETE /api/cart/remove-coupon
// @access  Private
export const removeCoupon = async (req, res) => {
  try {
    const userId = req.user._id;

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    cart.coupon = undefined;
    cart.discount = 0;
    cart.calculateTotals();
    await cart.save();

    await cart.populate({
      path: 'items.product',
      select: 'name images pricing inventory shop category'
    });

    res.status(200).json({
      success: true,
      message: 'Coupon removed',
      data: { cart }
    });
  } catch (error) {
    console.error('Remove Coupon Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove coupon',
      error: error.message
    });
  }
};
