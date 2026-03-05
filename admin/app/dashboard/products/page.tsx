'use client';

import { useEffect, useState } from 'react';
import apiClient from '@/lib/api/client';
import toast from 'react-hot-toast';
import { Search, Plus, Edit, Trash2, Package as PackageIcon, X, Upload, Save, ExternalLink } from 'lucide-react';
import Image from 'next/image';

interface ProductImage {
    url: string;
    alt?: string;
    isPrimary?: boolean;
}

interface Product {
    _id: string;
    name: string;
    description: string;
    price: number;
    images?: (string | ProductImage)[];
    category: string | { _id: string; name: string };
    stock: number;
    shop?: { name: string };
    pricing?: { sellingPrice: number; mrp: number };
    inventory?: { stock: number; quantity?: number };
    productType?: 'regular' | 'amazon';
    externalLink?: string | null;
}

export default function ProductsPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        price: '',
        category: '',
        stock: '',
        productType: 'regular' as 'regular' | 'amazon',
        externalLink: '',
        images: [] as string[]
    });

    useEffect(() => {
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        try {
            const response = await apiClient.get('/api/products');
            setProducts(response.data.data?.products || response.data.products || response.data || []);
        } catch (error: any) {
            if (error.response?.status !== 404) {
                console.error('Error fetching products:', error);
            }
            setProducts([]);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.productType === 'amazon' && !formData.externalLink?.trim()) {
            toast.error('External link (e.g. Amazon URL) is required for Amazon products');
            return;
        }
        if (formData.productType === 'regular' && !formData.price) {
            toast.error('Price is required for regular products');
            return;
        }
        setIsSubmitting(true);

        try {
            const payload: Record<string, unknown> = {
                name: formData.name,
                description: formData.description,
                category: formData.category,
                productType: formData.productType,
                images: formData.images.length ? formData.images : []
            };
            if (formData.productType === 'regular') {
                payload.price = parseFloat(formData.price) || 0;
                payload.stock = parseInt(formData.stock, 10) || 0;
            } else {
                payload.externalLink = formData.externalLink.trim();
            }

            if (editingProduct) {
                await apiClient.put(`/api/products/admin/${editingProduct._id}`, payload);
                toast.success('Product updated successfully');
            } else {
                await apiClient.post('/api/products/admin/create', payload);
                toast.success('Product created successfully');
            }

            setIsModalOpen(false);
            setEditingProduct(null);
            setFormData({ name: '', description: '', price: '', category: '', stock: '', productType: 'regular', externalLink: '', images: [] });
            fetchProducts();
        } catch (error: any) {
            console.error('Error saving product:', error);
            toast.error(error.response?.data?.message || 'Failed to save product');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this product?')) return;

        try {
            await apiClient.delete(`/api/products/admin/${id}`);
            toast.success('Product deleted successfully');
            setProducts(prev => prev.filter(p => p._id !== id));
        } catch (error: any) {
            toast.error('Failed to delete product');
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, append = true) => {
        const files = e.target.files;
        if (!files?.length) return;

        const fileList = Array.from(files);
        const toastId = toast.loading(fileList.length > 1 ? `Uploading ${fileList.length} images...` : 'Uploading image...');

        try {
            const newUrls: string[] = [];
            for (const file of fileList) {
                const uploadFormData = new FormData();
                uploadFormData.append('image', file);
                const response = await apiClient.post('/api/upload/course-media?type=product', uploadFormData);
                const url = response.data?.data?.url || response.data?.url;
                if (url) newUrls.push(url);
            }
            if (newUrls.length) {
                setFormData(prev => ({
                    ...prev,
                    images: append ? [...prev.images, ...newUrls] : newUrls
                }));
                toast.success(newUrls.length > 1 ? `${newUrls.length} images uploaded!` : 'Image uploaded!', { id: toastId });
            } else {
                toast.error('Upload failed', { id: toastId });
            }
        } catch (error: any) {
            console.error('Upload error:', error);
            toast.error(error.response?.data?.message || 'Upload failed', { id: toastId });
        }
        e.target.value = '';
    };

    const removeImage = (index: number) => {
        setFormData(prev => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }));
    };

    const getImageUrls = (p: Product): string[] => {
        if (!p.images?.length) return [];
        return p.images.map(img => typeof img === 'string' ? img : (img as ProductImage).url);
    };

    const openEditModal = (product: Product) => {
        setEditingProduct(product);
        setFormData({
            name: product.name,
            description: product.description || '',
            price: (product.pricing?.sellingPrice ?? product.price ?? 0).toString(),
            category: typeof product.category === 'object' ? (product.category as any)._id : product.category || '',
            stock: (product.inventory?.stock ?? product.inventory?.quantity ?? product.stock ?? 0).toString(),
            productType: (product.productType === 'amazon' ? 'amazon' : 'regular') as 'regular' | 'amazon',
            externalLink: product.externalLink || '',
            images: getImageUrls(product)
        });
        setIsModalOpen(true);
    };

    const filteredProducts = products.filter(product =>
        product.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-secondary">Products Management</h1>
                    <p className="text-accent mt-1">Manage marketplace products</p>
                </div>
                <button
                    onClick={() => {
                        setEditingProduct(null);
                        setFormData({ name: '', description: '', price: '', category: '', stock: '', productType: 'regular', externalLink: '', images: [] });
                        setIsModalOpen(true);
                    }}
                    className="flex items-center space-x-2 px-6 py-3 bg-primary hover:bg-primary-dark text-white rounded-lg transition duration-200 font-medium"
                >
                    <Plus className="w-5 h-5" />
                    <span>Add Product</span>
                </button>
            </div>

            {/* Product Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-white z-10">
                            <h2 className="text-xl font-bold text-secondary">
                                {editingProduct ? 'Edit Product' : 'Add New Product'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Product type toggle: Regular vs Selling on Amazon */}
                                <div className="col-span-2 flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                    <span className="text-sm font-medium text-gray-700">Product type</span>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.productType === 'amazon'}
                                            onChange={e => setFormData({ ...formData, productType: e.target.checked ? 'amazon' : 'regular' })}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-primary/30 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
                                        <span className="ml-2 text-sm font-medium text-gray-900">
                                            {formData.productType === 'amazon' ? 'Selling on Amazon' : 'Regular (sell here)'}
                                        </span>
                                    </label>
                                    {formData.productType === 'amazon' && (
                                        <span className="text-xs text-amber-600 flex items-center gap-1">
                                            <ExternalLink className="w-4 h-4" /> Link will open in new tab
                                        </span>
                                    )}
                                </div>

                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition text-black"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="e.g. Premium Yoga Mat"
                                    />
                                </div>

                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                    <textarea
                                        rows={3}
                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition text-black"
                                        value={formData.description}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                        placeholder="Product description..."
                                    />
                                </div>

                                {formData.productType === 'amazon' ? (
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">External link (e.g. Amazon URL) *</label>
                                        <input
                                            type="url"
                                            required
                                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition text-black"
                                            value={formData.externalLink}
                                            onChange={e => setFormData({ ...formData, externalLink: e.target.value })}
                                            placeholder="https://www.amazon.in/..."
                                        />
                                        <p className="text-xs text-gray-500 mt-1">When users tap this product, they will be taken to this link.</p>
                                    </div>
                                ) : (
                                    <>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Price (₹) *</label>
                                            <input
                                                type="number"
                                                required
                                                min="0"
                                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition text-black"
                                                value={formData.price}
                                                onChange={e => setFormData({ ...formData, price: e.target.value })}
                                                placeholder="0.00"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Stock Quantity *</label>
                                            <input
                                                type="number"
                                                required
                                                min="0"
                                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition text-black"
                                                value={formData.stock}
                                                onChange={e => setFormData({ ...formData, stock: e.target.value })}
                                                placeholder="0"
                                            />
                                        </div>
                                    </>
                                )}

                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition text-black"
                                        value={formData.category}
                                        onChange={e => setFormData({ ...formData, category: e.target.value })}
                                        placeholder="Enter category ID or name"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Enter a Category ID if available, or just a name.</p>
                                </div>

                                {/* Multiple images (slider) */}
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Product images (slider)</label>
                                    <p className="text-xs text-gray-500 mb-2">Add multiple images; they will be shown as a slider. First image is primary.</p>
                                    <div className="space-y-2">
                                        {formData.images.map((url, index) => (
                                            <div key={index} className="flex gap-2 items-center">
                                                <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                                                    <Image src={url} alt="" fill className="object-cover" unoptimized />
                                                </div>
                                                <input
                                                    type="url"
                                                    className="flex-1 px-3 py-2 border rounded-lg text-sm text-black"
                                                    value={url}
                                                    onChange={e => {
                                                        const next = [...formData.images];
                                                        next[index] = e.target.value;
                                                        setFormData({ ...formData, images: next });
                                                    }}
                                                    placeholder="Image URL"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => removeImage(index)}
                                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                                                    title="Remove"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                        <div className="flex gap-2">
                                            <input
                                                type="file"
                                                accept="image/*"
                                                multiple
                                                onChange={e => handleFileUpload(e, true)}
                                                className="hidden"
                                                id="product-image-upload"
                                            />
                                            <label
                                                htmlFor="product-image-upload"
                                                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg border border-gray-300 text-sm font-medium cursor-pointer inline-flex items-center gap-2"
                                            >
                                                <Upload className="w-4 h-4" /> Upload image(s)
                                            </label>
                                            <input
                                                type="url"
                                                className="flex-1 px-3 py-2 border rounded-lg text-sm text-black"
                                                placeholder="Or paste image URL and press Enter"
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        const target = e.target as HTMLInputElement;
                                                        const url = target.value?.trim();
                                                        if (url) {
                                                            setFormData(prev => ({ ...prev, images: [...prev.images, url] }));
                                                            target.value = '';
                                                        }
                                                    }
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end space-x-3 pt-6 border-t">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-6 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-8 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg transition disabled:opacity-50 flex items-center space-x-2 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                                >
                                    {isSubmitting ? (
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            <Save className="w-4 h-4" />
                                            <span>{editingProduct ? 'Update Product' : 'Create Product'}</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-xl p-4 shadow-md">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-accent" />
                    <input
                        type="text"
                        placeholder="Search products..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-black"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProducts.length === 0 ? (
                    <div className="col-span-full text-center py-12 text-accent">No products found</div>
                ) : (
                    filteredProducts.map((product) => (
                        <div key={product._id} className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-shadow card-hover group">
                            <div className="relative h-48 bg-gray-200 overflow-hidden">
                                {(typeof product.images?.[0] === 'object' ? (product.images[0] as ProductImage).url : product.images?.[0]) ? (
                                    <Image
                                        src={typeof product.images![0] === 'object' ? (product.images![0] as ProductImage).url : product.images![0] as string}
                                        alt={product.name}
                                        fill
                                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                                    />
                                ) : (
                                    <div className="flex items-center justify-center h-full bg-gradient-to-br from-primary to-primary-dark">
                                        <PackageIcon className="w-16 h-16 text-white opacity-50" />
                                    </div>
                                )}
                                <div className="absolute top-2 left-2">
                                    {(product as Product).productType === 'amazon' && (
                                        <span className="px-2 py-1 bg-amber-500 text-white text-xs font-semibold rounded flex items-center gap-1">
                                            <ExternalLink className="w-3 h-3" /> Amazon
                                        </span>
                                    )}
                                </div>
                                <div className="absolute top-2 right-2 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => openEditModal(product)}
                                        className="p-2 bg-white/90 text-primary hover:bg-white rounded-full shadow-lg transition"
                                        title="Edit"
                                    >
                                        <Edit className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(product._id)}
                                        className="p-2 bg-white/90 text-red-600 hover:bg-white rounded-full shadow-lg transition"
                                        title="Delete"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="p-6 space-y-4">
                                <div>
                                    <h3 className="text-xl font-bold text-secondary mb-2 line-clamp-1">{product.name}</h3>
                                    <p className="text-gray-900 text-sm line-clamp-2">{product.description}</p>
                                </div>

                                <div className="flex items-center justify-between text-sm">
                                    <span className="px-3 py-1 bg-primary/10 text-primary rounded-full font-medium truncate max-w-[120px]">
                                        {typeof product.category === 'object' ? (product.category as any).name : (product.category || 'General')}
                                    </span>
                                    {(product as Product).productType !== 'amazon' && (
                                        <span className={`font-medium ${(product.inventory?.stock || product.inventory?.quantity || product.stock) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            Stock: {product.inventory?.stock || product.inventory?.quantity || product.stock || 0}
                                        </span>
                                    )}
                                </div>

                                <div className="flex items-center justify-between pt-4 border-t">
                                    {(product as Product).productType === 'amazon' ? (
                                        <span className="text-sm text-amber-600 font-medium flex items-center gap-1">View on Amazon</span>
                                    ) : (
                                        <span className="text-2xl font-bold text-secondary">₹{product.pricing?.sellingPrice || product.price || 0}</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
