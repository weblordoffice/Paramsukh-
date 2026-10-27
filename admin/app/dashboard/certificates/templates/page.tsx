'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/api/client';
import toast from 'react-hot-toast';
import {
    ArrowLeft,
    Check,
    FileText,
    Plus,
    Save,
    Trash2,
    X,
} from 'lucide-react';
import { useAuthStore } from '@/lib/store/authStore';

type CertificateType = 'course_participation' | 'course_assessment' | 'membership';
type BackgroundType = 'image' | 'pdf';
type FieldType = 'text' | 'qr';

interface TemplateField {
    key: string;
    type: FieldType;
    label?: string;
    text?: string;
    xPercent: number;
    yPercent: number;
    widthPercent: number;
    fontSize: number;
    color: string;
    align: 'left' | 'center' | 'right';
    fontWeight: 'normal' | 'bold';
}

interface CertificateTemplate {
    _id: string;
    name: string;
    certificateType: CertificateType;
    courseId?: string | { _id: string; title?: string } | null;
    backgroundType: BackgroundType;
    backgroundUrl: string;
    backgroundPublicId?: string | null;
    pageWidth: number;
    pageHeight: number;
    fields: TemplateField[];
    version?: number;
    isActive: boolean;
}

interface CourseOption {
    _id: string;
    title: string;
}

type TemplateForm = Omit<CertificateTemplate, '_id' | 'version' | 'courseId'> & {
    courseId: string;
};

const CERTIFICATE_TYPES: { value: CertificateType; label: string }[] = [
    { value: 'course_participation', label: 'Course Participation' },
    { value: 'course_assessment', label: 'Course Assessment' },
    { value: 'membership', label: 'Membership' },
];

const FIELD_LIBRARY: { key: string; label: string; type: FieldType }[] = [
    { key: 'recipientName', label: 'Recipient name', type: 'text' },
    { key: 'courseName', label: 'Course name', type: 'text' },
    { key: 'certificateTitle', label: 'Certificate title', type: 'text' },
    { key: 'certificateId', label: 'Certificate ID', type: 'text' },
    { key: 'issuedDate', label: 'Issued date', type: 'text' },
    { key: 'planName', label: 'Plan name', type: 'text' },
    { key: 'customText', label: 'Custom text', type: 'text' },
    { key: 'qrCode', label: 'Verification QR', type: 'qr' },
];

const DEFAULT_FIELDS: TemplateField[] = [
    { key: 'certificateTitle', type: 'text', xPercent: 10, yPercent: 16, widthPercent: 80, fontSize: 34, color: '#2F241F', align: 'center', fontWeight: 'bold' },
    { key: 'recipientName', type: 'text', xPercent: 10, yPercent: 36, widthPercent: 80, fontSize: 30, color: '#B07D32', align: 'center', fontWeight: 'bold' },
    { key: 'courseName', type: 'text', xPercent: 12, yPercent: 50, widthPercent: 76, fontSize: 20, color: '#2F241F', align: 'center', fontWeight: 'normal' },
    { key: 'certificateId', type: 'text', xPercent: 3, yPercent: 82, widthPercent: 38, fontSize: 11, color: '#6B584A', align: 'center', fontWeight: 'normal' },
    { key: 'issuedDate', type: 'text', xPercent: 59, yPercent: 82, widthPercent: 38, fontSize: 11, color: '#6B584A', align: 'center', fontWeight: 'normal' },
    { key: 'qrCode', type: 'qr', xPercent: 44, yPercent: 78, widthPercent: 12, fontSize: 12, color: '#2F241F', align: 'center', fontWeight: 'normal' },
];

const emptyForm = (): TemplateForm => ({
    name: '',
    certificateType: 'course_participation',
    courseId: '',
    backgroundType: 'image',
    backgroundUrl: '',
    backgroundPublicId: '',
    pageWidth: 842,
    pageHeight: 595,
    fields: DEFAULT_FIELDS.map((field) => ({ ...field })),
    isActive: true,
});

const fieldSample = (field: TemplateField) => {
    switch (field.key) {
        case 'recipientName': return 'Aarav Sharma';
        case 'courseName': return 'Foundations of Daily Wellness';
        case 'certificateTitle': return 'Certificate of Completion';
        case 'certificateId': return 'PS-CERT-ABCD1234';
        case 'issuedDate': return new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
        case 'planName': return 'Silver Membership';
        case 'customText': return field.text || 'Custom text';
        case 'qrCode': return 'QR';
        default: return field.label || field.key;
    }
};

const templateCourseId = (template: CertificateTemplate) => {
    if (!template.courseId) return '';
    return typeof template.courseId === 'object' ? template.courseId._id : template.courseId;
};

export default function CertificateTemplatesPage() {
    const router = useRouter();
    const user = useAuthStore((state) => state.user);
    const hasPermission = useAuthStore((state) => state.hasPermission);
    const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
    const [courses, setCourses] = useState<CourseOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState(emptyForm());
    const [selectedFieldKey, setSelectedFieldKey] = useState<string | null>(null);
    const [previewWidth, setPreviewWidth] = useState(720);
    const [pdfPageCount, setPdfPageCount] = useState(1);
    const previewRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const dragRef = useRef<{ key: string; startX: number; startY: number; originX: number; originY: number } | null>(null);

    const isSuperAdmin = user?.role === 'super_admin';

    useEffect(() => {
        if (user && !isSuperAdmin && !hasPermission('manage_users')) {
            toast.error('You do not have permission to manage certificate templates');
            router.replace('/dashboard');
        }
    }, [user, isSuperAdmin, hasPermission, router]);

    const fetchTemplates = useCallback(async () => {
        try {
            setLoading(true);
            const response = await apiClient.get('/api/admin/certificate-templates', {
                params: { includeInactive: 'true' },
            });
            setTemplates(response.data?.templates || []);
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to load certificate templates');
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchCourses = useCallback(async () => {
        try {
            const response = await apiClient.get('/api/courses/all', { params: { limit: 100 } });
            setCourses((response.data?.courses || []).map((course: any) => ({
                _id: String(course._id),
                title: course.title || 'Untitled course',
            })));
        } catch {
            setCourses([]);
        }
    }, []);

    useEffect(() => {
        if (!user || (!isSuperAdmin && !hasPermission('manage_users'))) return;
        fetchTemplates();
        fetchCourses();
    }, [user, isSuperAdmin, hasPermission, fetchTemplates, fetchCourses]);

    useEffect(() => {
        const element = previewRef.current;
        if (!element) return;
        const update = () => setPreviewWidth(element.clientWidth || 720);
        update();
        const observer = new ResizeObserver(update);
        observer.observe(element);
        return () => observer.disconnect();
    }, [form.backgroundUrl, editingId]);

    useEffect(() => {
        if (form.backgroundType !== 'pdf' || !form.backgroundUrl || !canvasRef.current) return;

        let cancelled = false;
        const render = async () => {
            try {
                const pdfjs = await import('pdfjs-dist');
                pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
                const pdf = await pdfjs.getDocument({ url: form.backgroundUrl }).promise;
                const page = await pdf.getPage(1);
                if (cancelled || !canvasRef.current) return;
                const viewport = page.getViewport({ scale: 1.5 });
                const canvas = canvasRef.current;
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                const context = canvas.getContext('2d');
                if (!context) return;
                await page.render({ canvas, canvasContext: context, viewport }).promise;
                setPdfPageCount(pdf.numPages);
            } catch (error) {
                console.error('PDF preview failed:', error);
                toast.error('Could not preview this PDF. Check that it is not password protected.');
            }
        };

        render();
        return () => { cancelled = true; };
    }, [form.backgroundType, form.backgroundUrl]);

    useEffect(() => {
        const move = (event: PointerEvent) => {
            const drag = dragRef.current;
            const element = previewRef.current;
            if (!drag || !element) return;
            const rect = element.getBoundingClientRect();
            const nextX = Math.min(100, Math.max(0, drag.originX + ((event.clientX - drag.startX) / rect.width) * 100));
            const nextY = Math.min(100, Math.max(0, drag.originY + ((event.clientY - drag.startY) / rect.height) * 100));
            setForm((prev) => ({
                ...prev,
                fields: prev.fields.map((field) => field.key === drag.key
                    ? { ...field, xPercent: Math.round(nextX * 10) / 10, yPercent: Math.round(nextY * 10) / 10 }
                    : field),
            }));
        };
        const up = () => { dragRef.current = null; };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
        return () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
        };
    }, []);

    const startEditing = (template?: CertificateTemplate) => {
        if (template) {
            setEditingId(template._id);
            setForm({
                name: template.name,
                certificateType: template.certificateType,
                courseId: templateCourseId(template),
                backgroundType: template.backgroundType,
                backgroundUrl: template.backgroundUrl,
                backgroundPublicId: template.backgroundPublicId || '',
                pageWidth: template.pageWidth,
                pageHeight: template.pageHeight,
                fields: (template.fields || []).map((field) => ({ ...field })),
                isActive: template.isActive,
            });
            setPdfPageCount(1);
        } else {
            setEditingId(null);
            setForm(emptyForm());
            setPdfPageCount(1);
        }
        setSelectedFieldKey(null);
    };

    const handleUpload = async (file: File) => {
        setUploading(true);
        try {
            const body = new FormData();
            body.append('file', file);
            const response = await apiClient.post('/api/upload/certificate-template', body);
            const data = response.data?.data;
            if (!data?.url) throw new Error('No upload URL returned');
            setForm((prev) => ({
                ...prev,
                backgroundType: data.backgroundType,
                backgroundUrl: data.url,
                backgroundPublicId: data.publicId || '',
                pageWidth: data.pageWidth || prev.pageWidth,
                pageHeight: data.pageHeight || prev.pageHeight,
            }));
            setPdfPageCount(data.pageCount || 1);
            toast.success('Background uploaded');
        } catch (error: any) {
            toast.error(error.response?.data?.message || error.message || 'Upload failed');
        } finally {
            setUploading(false);
        }
    };

    const updateField = (key: string, patch: Partial<TemplateField>) => {
        setForm((prev) => ({
            ...prev,
            fields: prev.fields.map((field) => field.key === key ? { ...field, ...patch } : field),
        }));
    };

    const addField = (definition: { key: string; label: string; type: FieldType }) => {
        if (form.fields.some((field) => field.key === definition.key)) {
            setSelectedFieldKey(definition.key);
            return;
        }
        const defaults: Record<string, Partial<TemplateField>> = {
            recipientName: { xPercent: 10, yPercent: 36, widthPercent: 80, fontSize: 30, fontWeight: 'bold', color: '#B07D32' },
            courseName: { xPercent: 12, yPercent: 50, widthPercent: 76, fontSize: 20 },
            certificateTitle: { xPercent: 10, yPercent: 16, widthPercent: 80, fontSize: 34, fontWeight: 'bold' },
            certificateId: { xPercent: 3, yPercent: 82, widthPercent: 38, fontSize: 11 },
            issuedDate: { xPercent: 59, yPercent: 82, widthPercent: 38, fontSize: 11 },
            planName: { xPercent: 12, yPercent: 62, widthPercent: 76, fontSize: 16 },
            customText: { xPercent: 20, yPercent: 65, widthPercent: 60, fontSize: 16 },
            qrCode: { xPercent: 44, yPercent: 78, widthPercent: 12, fontSize: 12, type: 'qr' },
        };
        setForm((prev) => ({
            ...prev,
            fields: [...prev.fields, {
                key: definition.key,
                label: definition.label,
                type: definition.type,
                text: '',
                xPercent: 20,
                yPercent: 40,
                widthPercent: 40,
                fontSize: 16,
                color: '#2F241F',
                align: 'center',
                fontWeight: 'normal',
                ...(defaults[definition.key] || {}),
            }],
        }));
        setSelectedFieldKey(definition.key);
    };

    const removeField = (key: string) => {
        setForm((prev) => ({ ...prev, fields: prev.fields.filter((field) => field.key !== key) }));
        if (selectedFieldKey === key) setSelectedFieldKey(null);
    };

    const saveTemplate = async () => {
        if (!form.name.trim()) return toast.error('Enter a template name');
        if (!form.backgroundUrl) return toast.error('Upload a background first');
        if (form.fields.length === 0) return toast.error('Add at least one field');

        setSaving(true);
        try {
            const payload = {
                ...form,
                courseId: form.courseId || null,
                fields: form.fields,
            };
            if (editingId) {
                await apiClient.put(`/api/admin/certificate-templates/${editingId}`, payload);
                toast.success('Template updated');
            } else {
                await apiClient.post('/api/admin/certificate-templates', payload);
                toast.success('Template created');
            }
            await fetchTemplates();
            startEditing();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to save template');
        } finally {
            setSaving(false);
        }
    };

    const toggleTemplate = async (template: CertificateTemplate) => {
        try {
            if (template.isActive) {
                await apiClient.delete(`/api/admin/certificate-templates/${template._id}`);
                toast.success('Template deactivated');
            } else {
                await apiClient.put(`/api/admin/certificate-templates/${template._id}`, { isActive: true });
                toast.success('Template activated');
            }
            fetchTemplates();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to update template');
        }
    };

    const selectedField = form.fields.find((field) => field.key === selectedFieldKey) || null;
    const scale = previewWidth / Math.max(1, form.pageWidth);
    const previewHeight = Math.max(1, form.pageHeight) * scale;

    const backgroundStyle = useMemo(() => ({
        width: '100%',
        height: previewHeight,
    }), [previewHeight]);

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => router.push('/dashboard/certificates')}
                        className="rounded-lg border bg-white p-2 text-gray-600 hover:bg-gray-50"
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Certificate Templates</h1>
                        <p className="text-sm text-gray-500">
                            Upload an image or PDF, place fields, and activate the template.
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => startEditing()}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                    <Plus size={16} /> New template
                </button>
            </div>

            <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
                {loading ? (
                    <div className="flex justify-center py-14">
                        <div className="h-9 w-9 animate-spin rounded-full border-b-2 border-blue-600" />
                    </div>
                ) : templates.length === 0 ? (
                    <div className="py-14 text-center text-gray-500">
                        <FileText className="mx-auto mb-3 text-gray-300" size={44} />
                        No certificate templates yet.
                    </div>
                ) : (
                    <div className="divide-y">
                        {templates.map((template) => (
                            <div key={template._id} className="flex flex-wrap items-center gap-4 p-4">
                                <div className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-gray-50">
                                    {template.backgroundType === 'image' ? (
                                        <img src={template.backgroundUrl} alt="" className="h-full w-full object-cover" />
                                    ) : (
                                        <FileText className="text-gray-400" size={26} />
                                    )}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-semibold text-gray-900">{template.name}</span>
                                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                                            {CERTIFICATE_TYPES.find((type) => type.value === template.certificateType)?.label || template.certificateType}
                                        </span>
                                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${template.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                            {template.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>
                                    <p className="mt-1 text-xs text-gray-500">
                                        {template.courseId && typeof template.courseId === 'object'
                                            ? template.courseId.title
                                            : template.courseId
                                                ? 'Specific course'
                                                : 'Default for this certificate type'}
                                        {` · v${template.version || 1}`}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => startEditing(template)}
                                        className="rounded-lg border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => toggleTemplate(template)}
                                        className="rounded-lg border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                                    >
                                        {template.isActive ? 'Deactivate' : 'Activate'}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="rounded-xl border bg-white p-5 shadow-sm">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-lg font-bold text-gray-900">
                        {editingId ? 'Edit template' : 'New template'}
                    </h2>
                    <button onClick={() => startEditing()} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
                        <X size={15} /> Clear
                    </button>
                </div>

                <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
                    <div className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <label className="text-sm font-medium text-gray-700">
                                Template name
                                <input
                                    value={form.name}
                                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm text-gray-900"
                                    placeholder="Silver course certificate"
                                />
                            </label>
                            <label className="text-sm font-medium text-gray-700">
                                Certificate type
                                <select
                                    value={form.certificateType}
                                    onChange={(event) => setForm({ ...form, certificateType: event.target.value as CertificateType })}
                                    className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-900"
                                >
                                    {CERTIFICATE_TYPES.map((type) => (
                                        <option key={type.value} value={type.value}>{type.label}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="text-sm font-medium text-gray-700">
                                Course scope
                                <select
                                    value={form.courseId || ''}
                                    onChange={(event) => setForm({ ...form, courseId: event.target.value })}
                                    className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-900"
                                >
                                    <option value="">Default for all courses</option>
                                    {courses.map((course) => (
                                        <option key={course._id} value={course._id}>{course.title}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="text-sm font-medium text-gray-700">
                                Background image or PDF
                                <input
                                    type="file"
                                    accept="image/png,image/jpeg,application/pdf"
                                    disabled={uploading}
                                    onChange={(event) => {
                                        const file = event.target.files?.[0];
                                        if (file) handleUpload(file);
                                        event.target.value = '';
                                    }}
                                    className="mt-1 block w-full text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-blue-700"
                                />
                            </label>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {FIELD_LIBRARY.map((definition) => (
                                <button
                                    key={definition.key}
                                    type="button"
                                    onClick={() => addField(definition)}
                                    className="inline-flex items-center gap-1 rounded-full border bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-blue-300 hover:text-blue-700"
                                >
                                    <Plus size={12} /> {definition.label}
                                </button>
                            ))}
                        </div>

                        <div
                            ref={previewRef}
                            className="relative mx-auto overflow-hidden rounded-lg border bg-gray-100"
                            style={backgroundStyle}
                        >
                            {form.backgroundUrl ? (
                                form.backgroundType === 'pdf' ? (
                                    <canvas
                                        ref={canvasRef}
                                        className="absolute inset-0 h-full w-full object-contain"
                                    />
                                ) : (
                                    <img
                                        src={form.backgroundUrl}
                                        alt="Certificate background"
                                        className="absolute inset-0 h-full w-full object-contain"
                                    />
                                )
                            ) : (
                                <div className="flex h-full items-center justify-center text-sm text-gray-500">
                                    Upload a background to start
                                </div>
                            )}

                            {form.fields.map((field) => {
                                const isSelected = selectedFieldKey === field.key;
                                const isQr = field.key === 'qrCode';
                                return (
                                    <div
                                        key={field.key}
                                        onPointerDown={(event) => {
                                            event.preventDefault();
                                            setSelectedFieldKey(field.key);
                                            dragRef.current = {
                                                key: field.key,
                                                startX: event.clientX,
                                                startY: event.clientY,
                                                originX: field.xPercent,
                                                originY: field.yPercent,
                                            };
                                        }}
                                        className={`absolute cursor-move select-none whitespace-nowrap rounded border px-1 py-0.5 ${isSelected ? 'border-blue-600 bg-blue-50/90' : 'border-transparent bg-white/30 hover:border-blue-300'}`}
                                        style={{
                                            left: `${field.xPercent}%`,
                                            top: `${field.yPercent}%`,
                                            width: `${field.widthPercent}%`,
                                            color: field.color,
                                            fontWeight: field.fontWeight === 'bold' ? 700 : 400,
                                            fontSize: isQr ? Math.max(10, scale * 12) : Math.max(7, field.fontSize * scale),
                                            textAlign: field.align,
                                            lineHeight: 1.15,
                                        }}
                                    >
                                        {isQr ? 'QR' : fieldSample(field)}
                                    </div>
                                );
                            })}
                        </div>

                        <p className="text-xs text-gray-500">
                            Drag fields on the preview. {form.backgroundType === 'pdf' ? `PDF page 1 of ${pdfPageCount} is used. ` : ''}
                            {uploading ? 'Uploading background...' : ''}
                        </p>
                    </div>

                    <div className="space-y-3 rounded-xl border bg-gray-50 p-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-gray-900">Fields</h3>
                            <span className="text-xs text-gray-500">{form.fields.length} placed</span>
                        </div>

                        <div className="max-h-48 space-y-1 overflow-y-auto">
                            {form.fields.map((field) => (
                                <button
                                    key={field.key}
                                    type="button"
                                    onClick={() => setSelectedFieldKey(field.key)}
                                    className={`flex w-full items-center justify-between rounded-lg border px-2.5 py-2 text-left text-xs ${selectedFieldKey === field.key ? 'border-blue-400 bg-white text-blue-700' : 'border-gray-200 bg-white text-gray-700'}`}
                                >
                                    <span>{field.label || FIELD_LIBRARY.find((item) => item.key === field.key)?.label || field.key}</span>
                                    <Trash2
                                        size={13}
                                        className="text-gray-400 hover:text-red-600"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            removeField(field.key);
                                        }}
                                    />
                                </button>
                            ))}
                        </div>

                        {selectedField ? (
                            <div className="space-y-3 border-t pt-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Selected field</p>
                                {selectedField.key === 'customText' && (
                                    <label className="block text-xs font-medium text-gray-600">
                                        Text
                                        <input
                                            value={selectedField.text || ''}
                                            onChange={(event) => updateField(selectedField.key, { text: event.target.value })}
                                            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                                        />
                                    </label>
                                )}
                                <div className="grid grid-cols-2 gap-2">
                                    <label className="text-xs font-medium text-gray-600">
                                        X %
                                        <input
                                            type="number"
                                            value={selectedField.xPercent}
                                            onChange={(event) => updateField(selectedField.key, { xPercent: Number(event.target.value) })}
                                            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                                        />
                                    </label>
                                    <label className="text-xs font-medium text-gray-600">
                                        Y %
                                        <input
                                            type="number"
                                            value={selectedField.yPercent}
                                            onChange={(event) => updateField(selectedField.key, { yPercent: Number(event.target.value) })}
                                            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                                        />
                                    </label>
                                    <label className="text-xs font-medium text-gray-600">
                                        Width %
                                        <input
                                            type="number"
                                            value={selectedField.widthPercent}
                                            onChange={(event) => updateField(selectedField.key, { widthPercent: Number(event.target.value) })}
                                            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                                        />
                                    </label>
                                    <label className="text-xs font-medium text-gray-600">
                                        Font size
                                        <input
                                            type="number"
                                            value={selectedField.fontSize}
                                            onChange={(event) => updateField(selectedField.key, { fontSize: Number(event.target.value) })}
                                            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                                        />
                                    </label>
                                    <label className="text-xs font-medium text-gray-600">
                                        Colour
                                        <input
                                            type="color"
                                            value={selectedField.color}
                                            onChange={(event) => updateField(selectedField.key, { color: event.target.value })}
                                            className="mt-1 h-9 w-full rounded border bg-white px-1 py-1"
                                        />
                                    </label>
                                    <label className="text-xs font-medium text-gray-600">
                                        Align
                                        <select
                                            value={selectedField.align}
                                            onChange={(event) => updateField(selectedField.key, { align: event.target.value as TemplateField['align'] })}
                                            className="mt-1 w-full rounded border bg-white px-2 py-1.5 text-sm"
                                        >
                                            <option value="left">Left</option>
                                            <option value="center">Center</option>
                                            <option value="right">Right</option>
                                        </select>
                                    </label>
                                </div>
                                <label className="flex items-center gap-2 text-xs font-medium text-gray-600">
                                    <input
                                        type="checkbox"
                                        checked={selectedField.fontWeight === 'bold'}
                                        onChange={(event) => updateField(selectedField.key, { fontWeight: event.target.checked ? 'bold' : 'normal' })}
                                    />
                                    Bold
                                </label>
                            </div>
                        ) : (
                            <p className="border-t pt-3 text-xs text-gray-500">
                                Select a field on the preview or in this list to edit it.
                            </p>
                        )}
                    </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                        <input
                            type="checkbox"
                            checked={form.isActive}
                            onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
                        />
                        Active template
                    </label>
                    <button
                        onClick={saveTemplate}
                        disabled={saving || uploading}
                        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                    >
                        {saving ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <Save size={16} />}
                        {editingId ? 'Update template' : 'Create template'}
                    </button>
                </div>
            </div>

            <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-xs text-blue-800">
                <div className="mb-1 flex items-center gap-2 font-semibold">
                    <Check size={14} /> How this works
                </div>
                Template fields are stored as percentages, so the PDF matches the preview at full resolution.
                For PDF uploads, the first page is used. Existing issued certificates keep the template version
                they were created with.
            </div>
        </div>
    );
}
