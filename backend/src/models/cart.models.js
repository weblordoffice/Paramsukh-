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
cartSchema.methods.calculateTotals = function(coupon = null) {
  // Calculate subtotal
  this.subtotal = this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  // Apply coupon discount
  if (coupon) {
    let eligibleSubtotal = 0;
    
    if (coupon.applicableOn === 'category') {
      eligibleSubtotal = this.items.reduce((sum, item) => {
        const productCategory = item.product?.category?._id || item.product?.category || item.product;
        const matchesCategory = coupon.categories.some(catId => 
          catId.toString() === productCategory.toString()
        );
        return matchesCategory ? sum + (item.price * item.quantity) : sum;
      }, 0);
    } 
    else if (coupon.applicableOn === 'product') {
      eligibleSubtotal = this.items.reduce((sum, item) => {
        const productId = item.product?._id || item.product;
        const matchesProduct = coupon.products.some(prodId => 
          prodId.toString() === productId.toString()
        );
        return matchesProduct ? sum + (item.price * item.quantity) : sum;
      }, 0);
    } 
    else if (coupon.applicableOn === 'shop') {
      eligibleSubtotal = this.items.reduce((sum, item) => {
        const productShop = item.product?.shop?._id || item.product?.shop || item.product;
        const matchesShop = coupon.shops.some(shopId => 
          shopId.toString() === productShop.toString()
        );
        return matchesShop ? sum + (item.price * item.quantity) : sum;
      }, 0);
    } 
    else {
      eligibleSubtotal = this.subtotal;
    }

    let discount = 0;
    if (eligibleSubtotal >= (coupon.minOrderValue || 0)) {
      if (coupon.discountType === 'percentage') {
        discount = (eligibleSubtotal * coupon.discountValue) / 100;
        if (coupon.maxDiscount && discount > coupon.maxDiscount) {
          discount = coupon.maxDiscount;
        }
      } else {
        discount = coupon.discountValue;
      }
      discount = Math.min(discount, this.subtotal);
    }

    this.coupon = {
      code: coupon.code,
      discount: coupon.discountType === 'percentage' ? coupon.discountValue : discount,
      discountType: coupon.discountType
    };
    this.discount = discount;
  } else if (this.coupon && this.coupon.code) {
    if (this.coupon.discountType === 'percentage') {
      this.discount = Math.min((this.subtotal * this.coupon.discount) / 100, this.subtotal);
    } else {
      this.discount = Math.min(this.coupon.discount, this.subtotal);
    }
  } else {
    this.coupon = undefined;
    this.discount = 0;
  }
  
  // Calculate tax (assuming 18% GST)
  const taxableAmount = Math.max(0, this.subtotal - this.discount);
  this.tax = Math.round((taxableAmount * 0.18) * 100) / 100;
  
  // Calculate total
  this.total = this.subtotal - this.discount + this.shippingCharge + this.tax;
  this.lastUpdated = Date.now();
};

// Add item to cart - validates price against DB to prevent client-side price tampering
cartSchema.methods.addItem = async function(productId, quantity, _clientPrice, variant = undefined) {
  const Product = mongoose.model('Product');
  const product = await Product.findById(productId).select('pricing.sellingPrice');
  if (!product) throw new Error('Product not found');

  const price = product.pricing?.sellingPrice || _clientPrice;

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
  this.coupon = undefined;
  this.discount = 0;
  this.calculateTotals();
  await this.save();
  return this;
};

const Cart = mongoose.model('Cart', cartSchema);

export default Cart;
