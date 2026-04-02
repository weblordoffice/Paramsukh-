import { create } from 'zustand';
import axios from 'axios';
import { API_URL } from '../config/api';

interface Product {
    _id: string;
    id: string; // for UI
    name: string;
    slug: string;
    price: number;
    description: string;
    image: string; // Emoji or URL
    images?: string[]; // multiple for slider
    rating: {
        average: number;
        count: number;
    };
    inStock: boolean;
    reviewsCount: number;
    productType?: 'regular' | 'amazon' | 'external';
    externalLink?: string | null;
}

interface ProductState {
    products: Product[];
    currentShop: any | null;
    currentProduct: any | null;
    isLoading: boolean;
    error: string | null;

    fetchProductsByShop: (shopId: string) => Promise<void>;
    fetchAllProducts: (params?: { search?: string, category?: string }) => Promise<void>;
    fetchProductById: (productId: string) => Promise<void>;
    fetchShopDetails: (shopId: string) => Promise<void>;
}

export const useProductStore = create<ProductState>((set) => ({
    products: [],
    currentShop: null,
    currentProduct: null,
    isLoading: false,
    error: null,

    fetchProductById: async (productId) => {
        set({ isLoading: true, error: null, currentProduct: null });
        try {
            const response = await axios.get(`${API_URL}/products/${productId}`);
            if (response.data && response.data.success) {
                const p = response.data.data.product;
                const formattedProduct = {
                    id: p._id,
                    _id: p._id,
                    name: p.name,
                    slug: p.slug,
                    price: p.pricing?.sellingPrice || p.price || 0,
                    description: p.description,
                    shortDescription: p.shortDescription,
                    images: p.images?.map((img: any) => img.url || img) || [],
                    image: p.images?.[0]?.url || p.images?.[0] || '📦',
                    rating: p.rating || { average: 0, count: 0 },
                    inStock: p.productType === 'amazon' ? true : (p.inventory?.stock ?? p.inventory?.quantity ?? 0) > 0,
                    reviewsCount: p.rating?.count || 0,
                    specifications: p.specifications || [],
                    category: p.category,
                    shop: p.shop,
                    productType: p.productType || 'regular',
                    externalLink: p.externalLink || null
                };
                set({ currentProduct: formattedProduct, isLoading: false });
            } else {
                set({ isLoading: false, error: 'Product not found' });
            }
        } catch (error: any) {
            console.error('Fetch Product Error:', error);
            set({ isLoading: false, error: 'Failed to fetch product' });
        }
    },

    fetchAllProducts: async (params = {}) => {
        set({ isLoading: true, error: null });
        try {
            let queryString = '';
            if (params.search) queryString += `&search=${encodeURIComponent(params.search)}`;
            if (params.category && params.category !== 'all') queryString += `&category=${encodeURIComponent(params.category)}`;

            // Remove leading & if exists (though axios params usually handle this, manual string allows control)
            // Better to use axios params object or simple template literal if confident

            const response = await axios.get(`${API_URL}/products?limit=50${queryString}`);

            if (response.data && response.data.success) {
                const backendProducts = response.data.data.products || [];

                const formattedProducts = backendProducts.map((p: any) => ({
                    id: p._id,
                    _id: p._id,
                    name: p.name,
                    slug: p.slug,
                    price: p.pricing?.sellingPrice || p.price || 0,
                    description: p.description,
                    image: p.images?.[0]?.url || p.images?.[0] || '📦',
                    images: p.images?.map((img: any) => img.url || img) || [],
                    rating: p.rating || { average: 0, count: 0 },
                    inStock: p.productType === 'amazon' ? true : (p.inventory?.stock ?? p.inventory?.quantity ?? 0) > 0,
                    reviewsCount: p.rating?.count || 0,
                    productType: p.productType || 'regular',
                    externalLink: p.externalLink || null
                }));

                set({ products: formattedProducts, isLoading: false });
            } else {
                console.log('Fetch all products response:', response.data);
                set({ products: [], isLoading: false, error: null });
            }
        } catch (error: any) {
            console.error('Fetch All Products Error:', error);
            set({ products: [], isLoading: false, error: null });
        }
    },

    fetchProductsByShop: async (shopId) => {
        set({ isLoading: true, error: null });
        try {
            const response = await axios.get(`${API_URL}/shops/${shopId}/products`);

            if (response.data && response.data.success) {
                const backendProducts = response.data.data.products || [];

                const formattedProducts = backendProducts.map((p: any) => ({
                    id: p._id,
                    _id: p._id,
                    name: p.name,
                    slug: p.slug,
                    price: p.price,
                    description: p.description,
                    image: p.images?.[0] || '📦', // Use first image or fallback emoji
                    rating: p.rating || { average: 0, count: 0 },
                    inStock: p.stock > 0,
                    reviewsCount: p.reviews?.length || 0
                }));

                set({ products: formattedProducts, isLoading: false });
            } else {
                console.log('Fetch products response:', response.data);
                set({ products: [], isLoading: false, error: null });
            }
        } catch (error: any) {
            // Fallback for demo if API fails or returns 404
            console.error('Fetch Products Error:', error);
            set({ products: [], isLoading: false, error: null });
        }
    },

    fetchShopDetails: async (shopId) => {
        set({ isLoading: true, error: null });
        try {
            const response = await axios.get(`${API_URL}/shops/${shopId}`);
            if (response.data.success) {
                const shop = response.data.data.shop;
                // Format if necessary
                const formattedShop = {
                    ...shop,
                    id: shop._id,
                    rating: shop.rating?.average || 0,
                    totalReviews: shop.rating?.count || 0,
                    image: shop.logo || '🏪',
                    location: shop.address?.city || 'India',
                    established: new Date(shop.createdAt).getFullYear().toString()
                };
                set({ currentShop: formattedShop, isLoading: false });
            }
        } catch (error) {
            console.error("Fetch Shop Details Error: ", error);
            set({ isLoading: false, error: "Failed to load shop details" });
        }
    }
}));
