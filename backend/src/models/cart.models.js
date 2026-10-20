import mongoose from 'mongoose';

const cartItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    max: 999,
    default: 1
  },
  variant: {
    name: String,
    option: String
  },
  price: {
    type: Number,
    required: true
  },
  taxRate: {
    type: Number,
    default: 18 // GST %
  },
  addedAt: {
    type: Date,
    default: Date.now
  }
});

const getEligibleSubtotalForRule = (items, subtotal, rule) => {
  if (!rule) return 0;

  if (rule.applicableOn === 'category') {
    return items.reduce((sum, item) => {
      const productCategory = item.product?.category?._id || item.product?.category || item.product;
      const matchesCategory = (rule.categories || []).some((catId) =>
        catId.toString() === productCategory?.toString()
      );
      return matchesCategory ? sum + (item.price * item.quantity) : sum;
    }, 0);
  }

  if (rule.applicableOn === 'product') {
    return items.reduce((sum, item) => {
      const productId = item.product?._id || item.product;
      const matchesProduct = (rule.products || []).some((prodId) =>
        prodId.toString() === productId?.toString()
      );
      return matchesProduct ? sum + (item.price * item.quantity) : sum;
    }, 0);
  }

  if (rule.applicableOn === 'shop') {
    return items.reduce((sum, item) => {
      const productShop = item.product?.shop?._id || item.product?.shop || item.product;
      const matchesShop = (rule.shops || []).some((shopId) =>
        shopId.toString() === productShop?.toString()
      );
      return matchesShop ? sum + (item.price * item.quantity) : sum;
    }, 0);
  }

  return subtotal;
};

const calculateRuleDiscount = (rule, eligibleSubtotal) => {
  if (!rule || eligibleSubtotal <= 0) return 0;
  if (eligibleSubtotal < (rule.minOrderValue || 0)) return 0;

  let discount = 0;
  if (rule.discountType === 'percentage') {
    discount = (eligibleSubtotal * rule.discountValue) / 100;
    if (rule.maxDiscount && discount > rule.maxDiscount) {
      discount = rule.maxDiscount;
    }
  } else {
    discount = rule.discountValue;
  }

  return Math.min(discount, eligibleSubtotal);
};

const cartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  items: [cartItemSchema],
  // Applied coupon
  coupon: {
    code: String,
    discount: Number,
    discountType: {
      type: String,
      enum: ['percentage', 'flat']
    }
  },
  // Automatically applied offer (coupons take precedence)
  offer: {
    offerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Offer'
    },
    title: String,
    discount: Number,
    discountType: {
      type: String,
      enum: ['percentage', 'flat']
    }
  },
  // Cart totals
  subtotal: {
    type: Number,
    default: 0
  },
  discount: {
    type: Number,
    default: 0
  },
  shippingCharge: {
    type: Number,
    default: 0
  },
  tax: {
    type: Number,
    default: 0
  },
  total: {
    type: Number,
    default: 0
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Update cart totals. Coupons take precedence over automatic offers.
cartSchema.methods.calculateTotals = function(coupon = null, offer = null) {
  this.subtotal = this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  let discount = 0;

  if (coupon) {
    const eligibleSubtotal = getEligibleSubtotalForRule(this.items, this.subtotal, coupon);
    discount = calculateRuleDiscount(coupon, eligibleSubtotal);

    this.coupon = {
      code: coupon.code,
      discount: coupon.discountType === 'percentage' ? coupon.discountValue : discount,
      discountType: coupon.discountType
    };
    this.offer = undefined;
  } else if (offer) {
    const eligibleSubtotal = getEligibleSubtotalForRule(this.items, this.subtotal, offer);
    discount = calculateRuleDiscount(offer, eligibleSubtotal);

    this.offer = {
      offerId: offer._id,
      title: offer.title,
      discount,
      discountType: offer.discountType
    };
    this.coupon = undefined;
  } else {
    this.coupon = undefined;
    this.offer = undefined;
  }

  this.discount = Math.min(discount, this.subtotal);

  // Calculate tax per-item using each product's taxRate
  this.tax = Math.round(this.items.reduce((sum, item) => {
    const itemNet = Math.max(0, (item.price * item.quantity) - (this.discount || 0) * (item.price * item.quantity / Math.max(1, this.subtotal)));
    return sum + (itemNet * ((item.taxRate ?? 18) / 100));
  }, 0) * 100) / 100;

  this.total = this.subtotal - this.discount + this.shippingCharge + this.tax;
  this.lastUpdated = Date.now();
};

// Add item to cart - validates price against DB to prevent client-side price tampering
cartSchema.methods.addItem = async function(productId, quantity, _clientPrice, variant = undefined) {
  const Product = mongoose.model('Product');
  const product = await Product.findById(productId).select('pricing.sellingPrice');
  if (!product) throw new Error('Product not found');

  // Always use DB price — never trust client-supplied price (prevents price tampering)
  const price = product.pricing?.sellingPrice ?? 0;
  if (price === 0 && !product.pricing?.sellingPrice) {
    throw new Error('Unable to determine product price');
  }

  const existingItemIndex = this.items.findIndex(item => 
    item.product.toString() === productId.toString() &&
    JSON.stringify(item.variant) === JSON.stringify(variant)
  );
  
  if (existingItemIndex > -1) {
    this.items[existingItemIndex].quantity += quantity;
  } else {
    const newItem = {
      product: productId,
      quantity,
      price,
      taxRate: product.pricing?.taxRate ?? 18
    };
    if (variant && typeof variant === 'object' && Object.keys(variant).length > 0) {
      newItem.variant = variant;
    }
    this.items.push(newItem);
  }
  
  this.calculateTotals();
  await this.save();
  return this;
};

// Remove item from cart
cartSchema.methods.removeItem = async function(itemId) {
  this.items = this.items.filter(item => item._id.toString() !== itemId.toString());
  this.calculateTotals();
  await this.save();
  return this;
};

// Update item quantity
cartSchema.methods.updateQuantity = async function(itemId, quantity) {
  const item = this.items.find(item => item._id.toString() === itemId.toString());
  if (item) {
    item.quantity = quantity;
    this.calculateTotals();
    await this.save();
  }
  return this;
};

// Clear cart
cartSchema.methods.clearCart = async function() {
  this.items = [];
  this.coupon = undefined;
  this.offer = undefined;
  this.discount = 0;
  this.calculateTotals();
  await this.save();
  return this;
};

const Cart = mongoose.model('Cart', cartSchema);

export default Cart;
