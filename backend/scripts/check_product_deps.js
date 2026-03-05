
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: './backend/.env' });

const checkDeps = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        // Check for Shops
        const shops = await mongoose.connection.db.collection('shops').find({}).toArray();
        console.log(`Found ${shops.length} shops`);
        if (shops.length > 0) {
            console.log('First shop:', shops[0].name, shops[0]._id);
        } else {
            console.log('WARNING: No shops found. Admin product creation will fail.');
            // Create a dummy shop if needed
            const dummyShop = {
                name: 'Admin Shop',
                slug: 'admin-shop',
                description: 'Default shop for admin products',
                email: 'admin@example.com',
                phone: '1234567890',
                address: { street: '123 Admin St', city: 'Admin City', state: 'AD', pincode: '123456', country: 'India' },
                owner: new mongoose.Types.ObjectId(), // Random owner ID
                isActive: true,
                status: 'approved',
                createdAt: new Date(),
                updatedAt: new Date()
            };
            const result = await mongoose.connection.db.collection('shops').insertOne(dummyShop);
            console.log('Created dummy shop:', result.insertedId);
        }

        // Check for Categories
        const categories = await mongoose.connection.db.collection('categories').find({}).toArray();
        console.log(`Found ${categories.length} categories`);
        if (categories.length > 0) {
            console.log('First category:', categories[0].name, categories[0]._id);
        } else {
            console.log('WARNING: No categories found. If product creation requires category ID, it might fail.');
            // Create 'General' category
            const generalCat = {
                name: 'General',
                slug: 'general',
                description: 'General category',
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            const result = await mongoose.connection.db.collection('categories').insertOne(generalCat);
            console.log('Created General category:', result.insertedId);
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
};

checkDeps();
