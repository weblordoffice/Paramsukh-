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
  addedAt: {
    type: Date,
    default: Date.now
  }
});

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

// Update cart totals
cartSchema.methods.calculateTotals = function() {
  // Calculate subtotal
  this.subtotal = this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  // Apply coupon discount
  if (this.coupon && this.coupon.code) {
    if (this.coupon.discountType === 'percentage') {
      this.discount = (this.subtotal * this.coupon.discount) / 100;
    } else {
      this.discount = this.coupon.discount;
    }
  } else {
    this.discount = 0;
  }
  
  // Calculate tax (assuming 18% GST)
  const taxableAmount = this.subtotal - this.discount;
  this.tax = Math.round((taxableAmount * 0.18) * 100) / 100;
  
  // Calculate total
  this.total = this.subtotal - this.discount + this.shippingCharge + this.tax;
  this.lastUpdated = Date.now();
};

// Add item to cart
cartSchema.methods.addItem = async function(productId, quantity, price, variant = undefined) {
  const existingItemIndex = this.items.findIndex(item => 
    item.product.toString() === productId.toString() &&
    JSON.stringify(item.variant) === JSON.stringify(variant)
  );
  
  if (existingItemIndex > -1) {
    // Update quantity if item exists
    this.items[existingItemIndex].quantity += quantity;
  } else {
    // Add new item
    const newItem = {
      product: productId,
      quantity,
      price
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
  this.coupon = {};
  this.calculateTotals();
  await this.save();
  return this;
};

const Cart = mongoose.model('Cart', cartSchema);

export default Cart;
