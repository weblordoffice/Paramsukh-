'use client';

import { useState, useRef } from 'react';
import apiClient from '@/lib/api/client';
import toast from 'react-hot-toast';
import { Plus, Edit, Trash2, FileText, X, ExternalLink, Upload } from 'lucide-react';

// Backend returns pdfUrl; we use url in the UI
interface PDF {
    _id: string;
    title: string;
    url?: string;
    pdfUrl?: string;
    thumbnailUrl?: string;
    description?: string;
    fileSize?: string;
}

interface PDFsTabProps {
    courseId: string;
    pdfs: PDF[];
    onUpdate: () => void;
}

export default function PDFsTab({ courseId, pdfs, onUpdate }: PDFsTabProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPDF, setEditingPDF] = useState<PDF | null>(null);
    const [formData, setFormData] = useState({
        title: '',
        url: '',
        thumbnailUrl: '',
        description: '',
        fileSize: '',
    });
    const [submitting, setSubmitting] = useState(false);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [uploadingFile, setUploadingFile] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const pdfUrl = (p: PDF) => p.url ?? p.pdfUrl ?? '';

    const openModal = (pdf?: PDF) => {
        setSelectedFile(null);
        if (pdf) {
            setEditingPDF(pdf);
            setFormData({
                title: pdf.title,
                url: pdfUrl(pdf),
                thumbnailUrl: pdf.thumbnailUrl || '',
                description: pdf.description || '',
                fileSize: pdf.fileSize || '',
            });
        } else {
            setEditingPDF(null);
            setFormData({
                title: '',
                url: '',
                thumbnailUrl: '',
                description: '',
                fileSize: '',
            });
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingPDF(null);
        setSelectedFile(null);
        setFormData({
            title: '',
            url: '',
            thumbnailUrl: '',
            description: '',
            fileSize: '',
        });
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.type !== 'application/pdf') {
            toast.error('Please select a PDF file');
            return;
        }
        if (file.size > 50 * 1024 * 1024) {
            toast.error('PDF must be under 50MB');
            return;
        }
        setSelectedFile(file);
        setUploadingFile(true);
        try {
            const form = new FormData();
            form.append('pdf', file);
            const res = await apiClient.post('/api/upload/pdf', form);
            const url = res.data?.data?.url;
            if (url) {
                setFormData((prev) => ({ ...prev, url }));
                toast.success('PDF uploaded. Add title and save.');
            } else {
                toast.error('Upload failed');
            }
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to upload PDF');
        } finally {
            setUploadingFile(false);
            e.target.value = '';
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const pdfUrl = formData.url?.trim();
        if (!pdfUrl) {
            toast.error('Enter a PDF URL or upload a file from your computer');
            return;
        }
        setSubmitting(true);
        try {
            if (editingPDF) {
                await apiClient.put(`/api/courses/${courseId}/pdfs/${editingPDF._id}`, {
                    title: formData.title.trim(),
                    pdfUrl,
                    description: formData.description?.trim() || '',
                    thumbnailUrl: formData.thumbnailUrl?.trim() || '',
                });
                toast.success('PDF updated successfully');
            } else {
                await apiClient.post(`/api/courses/${courseId}/pdfs`, {
                    title: formData.title.trim(),
                    pdfUrl,
                    description: formData.description?.trim() || '',
                    thumbnailUrl: formData.thumbnailUrl?.trim() || '',
                    order: pdfs.length,
                    isFree: false,
                });
                toast.success('PDF added successfully');
            }
            closeModal();
            onUpdate();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to save PDF');
            console.error(error);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (pdfId: string) => {
        if (!confirm('Are you sure you want to delete this PDF?')) return;

        setDeleting(pdfId);
        try {
            await apiClient.delete(`/api/courses/${courseId}/pdfs/${pdfId}`);
            toast.success('PDF deleted successfully');
            onUpdate();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to delete PDF');
            console.error(error);
        } finally {
            setDeleting(null);
        }
    };

    return (
        <div>
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-xl font-semibold text-gray-900">Course PDFs</h2>
                    <p className="text-sm text-gray-600 mt-1">
                        Manage PDF resources and materials
                    </p>
                </div>
                <button
                    onClick={() => openModal()}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <Plus className="w-5 h-5" />
                    Add PDF
                </button>
            </div>

            {/* PDFs Grid */}
            {pdfs.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600 mb-4">No PDFs added yet</p>
                    <button
                        onClick={() => openModal()}
                        className="text-blue-600 hover:underline"
                    >
                        Add your first PDF
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {pdfs.map((pdf) => (
                        <div
                            key={pdf._id}
                            className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
                        >
                            {pdf.thumbnailUrl ? (
                                <img
                                    src={pdf.thumbnailUrl}
                                    alt={pdf.title}
                                    className="w-full h-48 object-cover"
                                />
                            ) : (
                                <div className="w-full h-48 bg-gray-100 flex items-center justify-center">
                                    <FileText className="w-16 h-16 text-gray-400" />
                                </div>
                            )}

                            <div className="p-4">
                                <h3 className="font-medium text-gray-900 mb-2 line-clamp-2">
                                    {pdf.title}
                                </h3>
                                {pdf.description && (
                                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                                        {pdf.description}
                                    </p>
                                )}
                                {pdf.fileSize && (
                                    <p className="text-xs text-gray-500 mb-3">{pdf.fileSize}</p>
                                )}

                                <div className="flex items-center gap-2">
                                    <a
                                        href={pdfUrl(pdf)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                        View
                                    </a>
                                    <button
                                        onClick={() => openModal(pdf)}
                                        className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                    >
                                        <Edit className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(pdf._id)}
                                        disabled={deleting === pdf._id}
                                        className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
                            <h3 className="text-lg font-semibold text-gray-900">
                                {editingPDF ? 'Edit PDF' : 'Add New PDF'}
                            </h3>
                            <button
                                onClick={closeModal}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        PDF Title *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="Course Workbook"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        PDF URL
                                    </label>
                                    <input
                                        type="url"
                                        value={formData.url}
                                        onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="https://example.com/file.pdf or upload below"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        Direct link to the PDF file, or upload from your computer below
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Or upload from computer
                                    </label>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="application/pdf"
                                        onChange={handleFileSelect}
                                        className="hidden"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={uploadingFile}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-gray-600"
                                    >
                                        {uploadingFile ? (
                                            <>
                                                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                                <span>Uploading...</span>
                                            </>
                                        ) : selectedFile || formData.url ? (
                                            <>
                                                <FileText className="w-5 h-5 text-green-600" />
                                                <span>{selectedFile ? selectedFile.name : 'PDF URL set'}</span>
                                            </>
                                        ) : (
                                            <>
                                                <Upload className="w-5 h-5" />
                                                <span>Choose PDF file (max 50MB)</span>
                                            </>
                                        )}
                                    </button>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Thumbnail URL
                                    </label>
                                    <input
                                        type="url"
                                        value={formData.thumbnailUrl}
                                        onChange={(e) => setFormData({ ...formData, thumbnailUrl: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="https://..."
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        Optional preview image for the PDF
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        File Size
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.fileSize}
                                        onChange={(e) => setFormData({ ...formData, fileSize: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="2.5 MB"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Description
                                    </label>
                                    <textarea
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        rows={3}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="Brief description of the PDF content..."
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                                >
                                    {submitting ? 'Saving...' : editingPDF ? 'Update PDF' : 'Add PDF'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
