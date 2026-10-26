'use client';

import { useEffect, useMemo, useState } from 'react';
import apiClient from '@/lib/api/client';
import toast from 'react-hot-toast';
import { Check, Search, X } from 'lucide-react';

type ScopePermission = 'manage_courses' | 'manage_events' | 'manage_community' | 'manage_mentor_groups';

interface ScopeOption {
    id: string;
    label: string;
    hint?: string;
}

interface PermissionScopePickerProps {
    isOpen: boolean;
    permission: ScopePermission | null;
    selectedIds: string[];
    onClose: () => void;
    onSave: (ids: string[]) => void;
}

const TITLES: Record<ScopePermission, string> = {
    manage_courses: 'Select courses',
    manage_events: 'Select events',
    manage_community: 'Select communities',
    manage_mentor_groups: 'Select mentor groups',
};

const fetchAllCourses = async (): Promise<ScopeOption[]> => {
    const collected: ScopeOption[] = [];
    let page = 1;
    let pages = 1;

    do {
        const response = await apiClient.get('/api/courses/all', {
            params: { page, limit: 100 },
        });
        (response.data.courses || []).forEach((course: any) => {
            collected.push({
                id: String(course._id),
                label: course.title || 'Untitled course',
                hint: [course.category, course.status].filter(Boolean).join(' · '),
            });
        });
        pages = Number(response.data.pagination?.pages || 1);
        page += 1;
    } while (page <= pages && page <= 20);

    return collected;
};

const fetchAllEvents = async (): Promise<ScopeOption[]> => {
    const collected: ScopeOption[] = [];
    let page = 1;
    let hasNextPage = true;

    while (hasNextPage && page <= 20) {
        const response = await apiClient.get('/api/events/all', {
            params: { includeCancelled: 'true', limit: 100, page },
        });
        (response.data.events || []).forEach((event: any) => {
            collected.push({
                id: String(event._id),
                label: event.title || 'Untitled event',
                hint: [event.category, event.eventDate ? new Date(event.eventDate).toLocaleDateString('en-IN') : '']
                    .filter(Boolean)
                    .join(' · '),
            });
        });
        hasNextPage = Boolean(response.data.pagination?.hasNextPage);
        page += 1;
    }

    return collected;
};

const fetchCommunities = async (): Promise<ScopeOption[]> => {
    const response = await apiClient.get('/api/community/admin/groups');
    return (response.data.data || []).map((group: any) => ({
        id: String(group._id),
        label: group.name || 'Untitled community',
        hint: group.groupType || '',
    }));
};

const fetchMentorGroups = async (): Promise<ScopeOption[]> => {
    const response = await apiClient.get('/api/community/admin/mentor-groups');
    return (response.data.data || []).map((group: any) => ({
        id: String(group._id),
        label: group.name || 'Untitled mentor group',
        hint: group.owner?.displayName ? `Mentor: ${group.owner.displayName}` : '',
    }));
};

const LOADERS: Record<ScopePermission, () => Promise<ScopeOption[]>> = {
    manage_courses: fetchAllCourses,
    manage_events: fetchAllEvents,
    manage_community: fetchCommunities,
    manage_mentor_groups: fetchMentorGroups,
};

export default function PermissionScopePicker({
    isOpen,
    permission,
    selectedIds,
    onClose,
    onSave,
}: PermissionScopePickerProps) {
    const [options, setOptions] = useState<ScopeOption[]>([]);
    const [selected, setSelected] = useState<string[]>(selectedIds);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isOpen || !permission) return;
        setSelected(selectedIds);
        setSearch('');
        setLoading(true);
        LOADERS[permission]()
            .then(setOptions)
            .catch((error: any) => {
                toast.error(error?.response?.data?.message || 'Failed to load options');
                setOptions([]);
            })
            .finally(() => setLoading(false));
        // selectedIds intentionally read when the picker opens.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, permission]);

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();
        if (!term) return options;
        return options.filter((option) =>
            `${option.label} ${option.hint || ''}`.toLowerCase().includes(term)
        );
    }, [options, search]);

    if (!isOpen || !permission) return null;

    const toggle = (id: string) => {
        setSelected((prev) =>
            prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
        );
    };

    const allFilteredSelected = filtered.length > 0 && filtered.every((option) => selected.includes(option.id));

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-xl shadow-xl overflow-hidden">
                <div className="px-5 py-4 border-b flex items-center justify-between bg-gray-50">
                    <div>
                        <h3 className="text-lg font-bold text-gray-800">{TITLES[permission]}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Only selected items will appear in this admin&apos;s workspace.
                        </p>
                    </div>
                    <button type="button" onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full text-gray-500">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-5 space-y-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search..."
                            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-black text-sm"
                        />
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>{selected.length} selected</span>
                        <button
                            type="button"
                            onClick={() => {
                                const filteredIds = filtered.map((option) => option.id);
                                setSelected((prev) => allFilteredSelected
                                    ? prev.filter((id) => !filteredIds.includes(id))
                                    : [...new Set([...prev, ...filteredIds])]);
                            }}
                            className="font-medium text-primary hover:underline"
                        >
                            {allFilteredSelected ? 'Clear shown' : 'Select all shown'}
                        </button>
                    </div>

                    <div className="max-h-72 overflow-y-auto border rounded-lg divide-y divide-gray-100">
                        {loading ? (
                            <div className="p-8 text-center text-sm text-gray-500">Loading...</div>
                        ) : filtered.length === 0 ? (
                            <div className="p-8 text-center text-sm text-gray-500">No items found</div>
                        ) : (
                            filtered.map((option) => {
                                const checked = selected.includes(option.id);
                                return (
                                    <label
                                        key={option.id}
                                        className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50"
                                    >
                                        <span className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded border ${checked ? 'bg-primary border-primary' : 'border-gray-300 bg-white'}`}>
                                            {checked ? <Check className="w-3.5 h-3.5 text-white" /> : null}
                                        </span>
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() => toggle(option.id)}
                                            className="sr-only"
                                        />
                                        <span>
                                            <span className="block text-sm font-medium text-gray-800">{option.label}</span>
                                            {option.hint ? <span className="block text-xs text-gray-500 mt-0.5">{option.hint}</span> : null}
                                        </span>
                                    </label>
                                );
                            })
                        )}
                    </div>
                </div>

                <div className="flex gap-3 px-5 py-4 border-t bg-gray-50">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-white font-medium transition"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            onSave(selected);
                            onClose();
                        }}
                        className="flex-1 py-2.5 bg-primary hover:bg-primary-dark text-white rounded-lg font-medium transition"
                    >
                        Save selection
                    </button>
                </div>
            </div>
        </div>
    );
}
