import path from 'path';
import { fileURLToPath } from 'url';

import dotenv from 'dotenv';

import connectDatabase from '../src/config/database.js';
import Category from '../src/models/category.models.js';
import Product from '../src/models/product.models.js';
import Shop from '../src/models/shop.models.js';
import { User } from '../src/models/user.models.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const IMG = (id) => `https://images.unsplash.com/${id}?w=800`;

const categories = [
  { name: 'Pooja', slug: 'pooja', icon: '🪔', order: 1 },
  { name: 'Books', slug: 'books', icon: '📚', order: 2 },
  { name: 'Clothing', slug: 'clothing', icon: '👕', order: 3 },
  { name: 'Wellness', slug: 'wellness', icon: '🧘', order: 4 },
  { name: 'General', slug: 'general', icon: '📦', order: 5 },
];

const products = [
  {
    name: 'Rudraksha Mala (108 Beads)',
    category: 'pooja',
    description: 'Hand-strung 108-bead Rudraksha mala for japa and meditation practice.',
    mrp: 599,
    sellingPrice: 399,
    stock: 120,
    featured: true,
    image: IMG('photo-1506126613408-eca07ce68773'),
    tags: ['pooja', 'mala', 'meditation'],
  },
  {
    name: 'Brass Pooja Thali Set',
    category: 'pooja',
    description: 'Traditional brass thali with diya, incense holder and offering bowls.',
    mrp: 1299,
    sellingPrice: 999,
    stock: 60,
    image: IMG('photo-1604608672516-f1b9b2c3e6f4'),
    tags: ['pooja', 'brass', 'thali'],
  },
  {
    name: 'Sandalwood Incense Pack',
    category: 'pooja',
    description: 'Natural sandalwood incense sticks for a calm, fragrant space.',
    mrp: 299,
    sellingPrice: 199,
    stock: 300,
    image: IMG('photo-1602874801006-e26c4c5b5e2a'),
    tags: ['pooja', 'incense', 'sandalwood'],
  },
  {
    name: 'Bhagavad Gita — Deluxe Edition',
    category: 'books',
    description: 'Hardbound deluxe edition of the Bhagavad Gita with Sanskrit and English translation.',
    mrp: 799,
    sellingPrice: 649,
    stock: 80,
    featured: true,
    image: IMG('photo-1544716278-ca5e3f4abd8c'),
    tags: ['books', 'gita', 'scripture'],
  },
  {
    name: 'Yoga Sutras of Patanjali',
    category: 'books',
    description: 'A clear modern commentary on Patanjali\u2019s Yoga Sutras for daily practice.',
    mrp: 599,
    sellingPrice: 449,
    stock: 95,
    image: IMG('photo-1512820790803-83ca734da794'),
    tags: ['books', 'yoga', 'philosophy'],
  },
  {
    name: 'Tibetan Singing Bowl',
    category: 'wellness',
    description: 'Hand-hammered singing bowl with cushion and striker for sound meditation.',
    mrp: 1899,
    sellingPrice: 1499,
    stock: 40,
    image: IMG('photo-1591291621164-2c6367723315'),
    tags: ['wellness', 'sound', 'meditation'],
  },
  {
    name: 'Premium Yoga Mat (6mm)',
    category: 'wellness',
    description: 'Non-slip 6mm cushioned yoga mat with carry strap.',
    mrp: 2499,
    sellingPrice: 1799,
    stock: 70,
    featured: true,
    image: IMG('photo-1599901860904-17e6ed7083a0'),
    tags: ['wellness', 'yoga', 'mat'],
  },
  {
    name: 'Meditation Cushion (Zafu)',
    category: 'wellness',
    description: 'Buckwheat-filled round zafu cushion for comfortable seated meditation.',
    mrp: 1199,
    sellingPrice: 899,
    stock: 55,
    image: IMG('photo-1593810450967-f9c42742e326'),
    tags: ['wellness', 'cushion', 'meditation'],
  },
  {
    name: 'Ayurvedic Herbal Tea',
    category: 'wellness',
    description: 'Caffeine-free herbal infusion with tulsi, ginger and lemongrass.',
    mrp: 499,
    sellingPrice: 349,
    stock: 200,
    image: IMG('photo-1564890369478-c89ca6d9cde9'),
    tags: ['wellness', 'tea', 'ayurveda'],
  },
  {
    name: 'Copper Water Bottle 1L',
    category: 'wellness',
    description: 'Handcrafted pure copper bottle for everyday hydration.',
    mrp: 899,
    sellingPrice: 699,
    stock: 150,
    image: IMG('photo-1602143407151-7111542de6e8'),
    tags: ['wellness', 'copper', 'bottle'],
  },
  {
    name: 'Cotton Yoga Pants',
    category: 'clothing',
    description: 'Breathable cotton yoga pants with an elastic waistband for daily practice.',
    mrp: 1499,
    sellingPrice: 1099,
    stock: 90,
    image: IMG('photo-1506629082955-511b1aa562c8'),
    tags: ['clothing', 'yoga', 'cotton'],
  },
  {
    name: 'Dhoti Kurta Set',
    category: 'clothing',
    description: 'Traditional cotton dhoti-kurta set, comfortable for rituals and gatherings.',
    mrp: 1999,
    sellingPrice: 1599,
    stock: 45,
    image: IMG('photo-1594633312681-425c7b97ccd1'),
    tags: ['clothing', 'traditional', 'cotton'],
  },
];

const externalProducts = [
  {
    name: 'Recommended Reading Bundle',
    category: 'books',
    description: 'Curated spiritual reading bundle available on Amazon.',
    externalLink: 'https://www.amazon.in/',
    image: IMG('photo-1495446815901-a7297e633e8d'),
    tags: ['books', 'external'],
  },
  {
    name: 'Himalayan Salt Lamp',
    category: 'wellness',
    description: 'Warm Himalayan salt lamp for a calming ambience.',
    externalLink: 'https://www.amazon.in/',
    image: IMG('photo-1519710164239-da123dc03ef4'),
    tags: ['wellness', 'external', 'lamp'],
  },
];

const slugify = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const ensureOwner = async () => {
  const existing = await User.findOne({}).sort({ createdAt: 1 });
  if (existing) return existing;

  return User.create({
    displayName: 'ParamSukh Store',
    email: 'store@paramsukh.com',
    authProvider: 'phone',
    subscriptionPlan: 'free',
  });
};

const ensureShop = async (owner) => {
  return Shop.findOneAndUpdate(
    { slug: 'paramsukh-store' },
    {
      $set: {
        owner: owner._id,
        name: 'ParamSukh Store',
        slug: 'paramsukh-store',
        description: 'Official ParamSukh store — pooja essentials, books, clothing and wellness products.',
        email: 'store@paramsukh.com',
        phone: '+919045504444',
        address: {
          street: 'Wellness Avenue',
          city: 'Delhi',
          state: 'Delhi',
          pincode: '110001',
          country: 'India',
        },
        status: 'approved',
        isVerified: true,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
};

const buildRegularPayload = (product, categoryId, shopId) => {
  const price = product.sellingPrice ?? product.price ?? 0;
  const mrp = product.mrp ?? price;
  return {
    shop: shopId,
    name: product.name,
    slug: slugify(product.name),
    description: product.description,
    shortDescription: product.description.slice(0, 80),
    category: categoryId,
    images: [{ url: product.image, alt: product.name, isPrimary: true }],
    pricing: { mrp, sellingPrice: price },
    inventory: { stock: product.stock ?? 0, lowStockThreshold: 10 },
    tags: product.tags || [],
    productType: 'regular',
    isActive: true,
    isFeatured: Boolean(product.featured),
  };
};

const buildExternalPayload = (product, categoryId, shopId) => ({
  shop: shopId,
  name: product.name,
  slug: slugify(product.name),
  description: product.description,
  shortDescription: product.description.slice(0, 80),
  category: categoryId,
  images: [{ url: product.image, alt: product.name, isPrimary: true }],
  pricing: { mrp: 0, sellingPrice: 0 },
  inventory: { stock: 0, isUnlimited: true },
  tags: product.tags || [],
  productType: 'external',
  externalLink: product.externalLink,
  isActive: true,
  isFeatured: Boolean(product.featured),
});

const seedShop = async () => {
  try {
    await connectDatabase();

    const owner = await ensureOwner();
    const shop = await ensureShop(owner);

    const categoryIdsBySlug = {};
    for (const category of categories) {
      const saved = await Category.findOneAndUpdate(
        { slug: category.slug },
        { $set: { name: category.name, slug: category.slug, icon: category.icon, order: category.order, isActive: true } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
      categoryIdsBySlug[category.slug] = saved._id;
    }

    for (const product of products) {
      await Product.findOneAndUpdate(
        { slug: slugify(product.name) },
        { $set: buildRegularPayload(product, categoryIdsBySlug[product.category], shop._id) },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
    }

    for (const product of externalProducts) {
      await Product.findOneAndUpdate(
        { slug: slugify(product.name) },
        { $set: buildExternalPayload(product, categoryIdsBySlug[product.category], shop._id) },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
    }

    const all = await Product.find({}).sort({ createdAt: -1 }).select('name productType pricing inventory');
    console.table(
      all.map((p) => ({
        name: p.name,
        type: p.productType,
        price: p.pricing?.sellingPrice ?? 0,
        stock: p.inventory?.stock ?? 0,
      }))
    );
    console.log(`Shop: ${shop.name} (${shop.status}) | Categories: ${Object.keys(categoryIdsBySlug).length} | Products: ${all.length}`);
    process.exit(0);
  } catch (error) {
    console.error('Failed to seed shop:', error);
    process.exit(1);
  }
};

seedShop();
