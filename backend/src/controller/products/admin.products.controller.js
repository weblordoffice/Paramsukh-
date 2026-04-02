import mongoose from 'mongoose';
import Product from '../../models/product.models.js';
import Shop from '../../models/shop.models.js';
import Category from '../../models/category.models.js';

// @desc    Create product (Admin only - Simplified)
// @route   POST /api/products/admin/create
// @access  Admin
export const createProductAdmin = async (req, res) => {
    try {
        const {
            name,
            description,
            price,
            images,
            category,
            stock,
            isFeatured = false,
            productType = 'regular',
            externalLink
        } = req.body;

        // Validation
        if (!name) {
            return res.status(400).json({
                success: false,
                message: 'Name is required'
            });
        }
        if (productType === 'external' || productType === 'amazon') {
            if (!externalLink || !externalLink.trim()) {
                return res.status(400).json({
                    success: false,
                    message: 'External link (e.g. Website URL) is required for external products'
                });
            }
        } else if (!price && price !== 0) {
            return res.status(400).json({
                success: false,
                message: 'Price is required for regular products'
            });
        }

        // Generate unique slug with timestamp
        const baseSlug = name.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
        const timestamp = Date.now();
        const slug = `${baseSlug}-${timestamp}`;

        // Handle Category: ID or Name
        let categoryId;

        if (category && mongoose.Types.ObjectId.isValid(category)) {
            categoryId = category;
        } else if (category && typeof category === 'string') {
            // Try finding by name (case-insensitive)
            let existingCategory = await Category.findOne({
                name: { $regex: new RegExp(`^${category}$`, 'i') }
            });

            if (existingCategory) {
                categoryId = existingCategory._id;
            } else {
                // Create new category
                const newCategoryName = category.charAt(0).toUpperCase() + category.slice(1);
                try {
                    const newCategory = await Category.create({
                        name: newCategoryName,
                        slug: newCategoryName.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-'),
                        description: `Category for ${newCategoryName}`,
                        isActive: true
                    });
                    categoryId = newCategory._id;
                } catch (catError) {
                    console.error('Error creating category:', catError);
                    // Fallback to "General" if creation fails (e.g. duplicate slug race condition)
                    let generalCategory = await Category.findOne({ name: 'General' });
                    if (!generalCategory) {
                        generalCategory = await Category.create({
                            name: 'General',
                            slug: 'general',
                            description: 'General category',
                            isActive: true
                        });
                    }
                    categoryId = generalCategory._id;
                }
            }
        } else {
            // Fallback to General if no category provided
            let generalCategory = await Category.findOne({ name: 'General' });
            if (!generalCategory) {
                generalCategory = await Category.create({
                    name: 'General',
                    slug: 'general',
                    description: 'General category',
                    isActive: true
                });
            }
            categoryId = generalCategory._id;
        }

        // Find or create 'Admin Shop'
        let shop = await Shop.findOne({ slug: 'admin-shop' });
        if (!shop) {
            shop = await Shop.findOne(); // Fallback to any shop
            if (!shop) {
                // Create Admin Shop if absolutely no shop exists
                shop = await Shop.create({
                    name: 'Admin Shop',
                    slug: 'admin-shop',
                    description: 'Default shop for admin products',
                    email: 'admin@example.com',
                    phone: '1234567890',
                    address: { street: '123 Admin St', city: 'Admin City', state: 'AD', pincode: '123456', country: 'India' },
                    owner: req.user?._id || new mongoose.Types.ObjectId(), // Use current admin user or random ID
                    isActive: true,
                    status: 'approved'
                });
            }
        }

        // Format images array to match schema
        const formattedImages = Array.isArray(images) 
            ? images.map((img, index) => ({
                url: typeof img === 'string' ? img : img.url,
                alt: name,
                isPrimary: index === 0
            }))
            : [];

        const sellingPrice = productType === 'amazon' ? 0 : (parseFloat(price) || 0);
        const stockVal = productType === 'amazon' ? 0 : (parseInt(stock, 10) || 0);

        const product = new Product({
            name,
            slug,
            description: description || name,
            shortDescription: description ? description.substring(0, 150) : name.substring(0, 150),
            images: formattedImages,
            category: categoryId,
            productType: productType === 'amazon' ? 'external' : productType, // Migrate 'amazon' to 'external'
            externalLink: externalLink || '',
            pricing: {
                mrp: sellingPrice,
                sellingPrice,
                discount: 0
            },
            inventory: {
                stock: stockVal,
                isUnlimited: productType === 'external' || productType === 'amazon'
            },
            shop: shop._id,
            productType: productType === 'amazon' ? 'amazon' : 'regular',
            externalLink: productType === 'amazon' && externalLink ? externalLink.trim() : null,
            isFeatured,
            isActive: true,
            specifications: [],
            tags: []
        });

        await product.save();

        res.status(201).json({
            success: true,
            message: 'Product created successfully',
            data: { product }
        });

    } catch (error) {
        console.error('Create Product Admin Error:', error);
        console.error('Error Stack:', error.stack);
        console.error('Error Details:', JSON.stringify(error, null, 2));
        res.status(500).json({
            success: false,
            message: 'Failed to create product',
            error: error.message
        });
    }
};

// @desc    Update product (Admin only)
// @route   PUT /api/products/admin/:id
// @access  Admin
export const updateProductAdmin = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const product = await Product.findById(id);

        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        // Handle specific fields mapping to nested structure
        if (updates.price) {
            product.pricing.sellingPrice = updates.price;
            product.pricing.mrp = updates.price; // Update mrp as well
        }

        if (updates.stock !== undefined) {
            product.inventory.stock = updates.stock; // Changed from quantity to stock
        }

        // Format images array if provided
        if (updates.images !== undefined) {
            const imgs = Array.isArray(updates.images)
                ? updates.images.map((img, index) => ({
                    url: typeof img === 'string' ? img : img.url,
                    alt: product.name,
                    isPrimary: index === 0
                }))
                : [];
            product.images = imgs;
        }

        // Update top-level fields
        const allowedFields = ['name', 'description', 'category', 'isFeatured', 'isActive', 'productType', 'externalLink'];
        allowedFields.forEach(field => {
            if (updates[field] !== undefined) {
                product[field] = field === 'externalLink' && updates[field] ? String(updates[field]).trim() : updates[field];
            }
        });

        if (updates.price !== undefined && product.productType !== 'amazon') {
            product.pricing.sellingPrice = updates.price;
            product.pricing.mrp = updates.price;
        }
        if (updates.stock !== undefined && product.productType !== 'amazon') {
            product.inventory.stock = updates.stock;
        }

        await product.save();

        res.status(200).json({
            success: true,
            message: 'Product updated successfully',
            data: { product }
        });
    } catch (error) {
        console.error('Update Product Admin Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update product',
            error: error.message
        });
    }
};

// @desc    Delete product (Admin only)
// @route   DELETE /api/products/admin/:id
// @access  Admin
export const deleteProductAdmin = async (req, res) => {
    try {
        const { id } = req.params;

        const product = await Product.findByIdAndDelete(id);

        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Product deleted successfully'
        });
    } catch (error) {
        console.error('Delete Product Admin Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete product',
            error: error.message
        });
    }
};
