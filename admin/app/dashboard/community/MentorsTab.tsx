'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import apiClient from '@/lib/api/client';
import toast from 'react-hot-toast';
import {
    Search,
    UserPlus,
    Pencil,
    Trash2,
    X,
    CheckCircle2,
    XCircle,
    Users,
} from 'lucide-react';

interface MentorUser {
    _id: string;
    displayName?: string;
    email?: string;
    phone?: string;
    photoURL?: string | null;
    subscriptionPlan?: string;
}

interface MentorGroup {
    _id: string;
    name: string;
    groupType?: string;
    category?: string | null;
    planSlug?: string | null;
}

interface MentorRecord {
    _id: string;
    userId: MentorUser | null;
    headline?: string;
    bio?: string;
    expertise?: string[];
    languages?: string[];
    groupIds?: MentorGroup[];
    isVerified?: boolean;
    isActive?: boolean;
    createdAt?: string;
}

interface GroupRecord {
    _id: string;
    name: string;
    groupType: string;
    category?: string | null;
}

interface FormState {
    userId: string;
    headline: string;
    bio: string;
    expertise: string;
    languages: string;
    groupIds: string[];
    isVerified: boolean;
    isActive: boolean;
}

const emptyForm: FormState = {
    userId: '',
    headline: '',
    bio: '',
    expertise: '',
    languages: '',
    groupIds: [],
    isVerified: true,
    isActive: true,
};

export default function MentorsTab() {
    const [mentors, setMentors] = useState<MentorRecord[]>([]);
    const [groups, setGroups] = useState<GroupRecord[]>([]);
    const [users, setUsers] = useState<MentorUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [pendingId, setPendingId] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<MentorRecord | null>(null);
    const [form, setForm] = useState<FormState>(emptyForm);
    const [userSearch, setUserSearch] = useState('');
    const [groupSearch, setGroupSearch] = useState('');

    const loadMentors = useCallback(async () => {
        setLoading(true);
        try {
            const response = await apiClient.get('/api/community/admin/mentors');
            setMentors(response.data.data || []);
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to load mentors');
            setMentors([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadMentors();

        const loadGroups = async () => {
            try {
                const response = await apiClient.get('/api/community/admin/groups');
                setGroups(response.data.data || []);
            } catch {
                // Non-blocking
            }
        };

        const loadUsers = async () => {
            try {
                const response = await apiClient.get('/api/user/all');
                setUsers(response.data.users || []);
            } catch {
                // Non-blocking; admin can still edit existing mentors.
            }
        };

        loadGroups();
        loadUsers();
    }, [loadMentors]);

    const filteredUsers = useMemo(() => {
        const term = userSearch.trim().toLowerCase();
        const list = term
            ? users.filter((user) =>
                [user.displayName, user.email, user.phone]
                    .filter(Boolean)
                    .some((value) => String(value).toLowerCase().includes(term))
            )
            : users;

        return list.slice(0, 40);
    }, [userSearch, users]);

    const filteredGroups = useMemo(() => {
        const term = groupSearch.trim().toLowerCase();
        if (!term) return groups;
        return groups.filter((group) => group.name.toLowerCase().includes(term));
    }, [groupSearch, groups]);

    const openCreate = () => {
        setEditing(null);
        setForm(emptyForm);
        setUserSearch('');
        setGroupSearch('');
        setShowModal(true);
    };

    const openEdit = (mentor: MentorRecord) => {
        setEditing(mentor);
        setForm({
            userId: mentor.userId?._id || '',
            headline: mentor.headline || '',
            bio: mentor.bio || '',
            expertise: (mentor.expertise || []).join(', '),
            languages: (mentor.languages || []).join(', '),
            groupIds: (mentor.groupIds || []).map((group) => group._id),
            isVerified: mentor.isVerified !== false,
            isActive: mentor.isActive !== false,
        });
        setUserSearch('');
        setGroupSearch('');
        setShowModal(true);
    };

    const toggleGroup = (groupId: string) => {
        setForm((prev) => ({
            ...prev,
            groupIds: prev.groupIds.includes(groupId)
                ? prev.groupIds.filter((id) => id !== groupId)
                : [...prev.groupIds, groupId],
        }));
    };

    const saveMentor = async () => {
        if (!editing && !form.userId) {
            toast.error('Please select a user');
            return;
        }

        setSaving(true);
        try {
            const payload = {
                userId: form.userId,
                headline: form.headline.trim(),
                bio: form.bio.trim(),
                expertise: form.expertise.split(',').map((item) => item.trim()).filter(Boolean),
                languages: form.languages.split(',').map((item) => item.trim()).filter(Boolean),
                groupIds: form.groupIds,
                isVerified: form.isVerified,
                isActive: form.isActive,
            };

            if (editing) {
                await apiClient.patch(`/api/community/admin/mentors/${editing._id}`, payload);
                toast.success('Mentor updated');
            } else {
                await apiClient.post('/api/community/admin/mentors', payload);
                toast.success('Mentor created');
            }

            setShowModal(false);
            setEditing(null);
            setForm(emptyForm);
            await loadMentors();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to save mentor');
        } finally {
            setSaving(false);
        }
    };

    const deactivateMentor = async (mentor: MentorRecord) => {
        if (!confirm(`Deactivate ${mentor.userId?.displayName || 'this mentor'}? They will lose mentor access.`)) return;
        setPendingId(mentor._id);
        try {
            await apiClient.delete(`/api/community/admin/mentors/${mentor._id}`);
            toast.success('Mentor deactivated');
            await loadMentors();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to deactivate mentor');
        } finally {
            setPendingId(null);
        }
    };

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-lg font-bold text-secondary">Mentors</h2>
                    <p className="text-sm text-accent">Assign verified experts to community groups.</p>
                </div>
                <button
                    onClick={openCreate}
                    className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition font-medium"
                >
                    <UserPlus className="w-5 h-5" />
                    Add Mentor
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-16">
                    <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
            ) : mentors.length === 0 ? (
                <div className="bg-white rounded-xl p-12 text-center text-accent shadow-md">
                    <Users className="w-16 h-16 mx-auto mb-4 text-accent/30" />
                    <p>No mentors yet. Add your first mentor to enable Mentor Corner.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {mentors.map((mentor) => (
                        <div key={mentor._id} className="bg-white rounded-xl p-5 shadow-md">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-3 min-w-0">
                                    <div className="w-12 h-12 rounded-full bg-gray-100 overflow-hidden flex items-center justify-center font-bold text-primary">
                                        {mentor.userId?.photoURL ? (
                                            <img src={mentor.userId.photoURL} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            (mentor.userId?.displayName || 'M').charAt(0).toUpperCase()
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="font-bold text-secondary">
                                                {mentor.userId?.displayName || 'Unknown user'}
                                            </h3>
                                            {mentor.isVerified ? (
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-green-50 text-green-700 flex items-center gap-1">
                                                    <CheckCircle2 className="w-3 h-3" /> Verified
                                                </span>
                                            ) : (
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700 flex items-center gap-1">
                                                    <XCircle className="w-3 h-3" /> Unverified
                                                </span>
                                            )}
                                            {!mentor.isActive && (
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                                                    Inactive
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-accent mt-0.5">
                                            {mentor.userId?.email || mentor.userId?.phone || 'No contact'}
                                        </p>
                                        {!!mentor.headline && (
                                            <p className="text-sm text-secondary mt-2">{mentor.headline}</p>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                    <button
                                        onClick={() => openEdit(mentor)}
                                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                                        title="Edit mentor"
                                    >
                                        <Pencil className="w-4 h-4" />
                                    </button>
                                    {mentor.isActive !== false && (
                                        <button
                                            onClick={() => deactivateMentor(mentor)}
                                            disabled={pendingId === mentor._id}
                                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
                                            title="Deactivate mentor"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {(mentor.expertise || []).length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-3">
                                    {(mentor.expertise || []).map((item) => (
                                        <span key={item} className="px-2 py-1 rounded bg-gray-50 text-xs text-accent">
                                            {item}
                                        </span>
                                    ))}
                                </div>
                            )}

                            <div className="mt-3 pt-3 border-t border-gray-100">
                                <p className="text-xs font-semibold text-accent uppercase tracking-wide mb-1.5">Groups</p>
                                {(mentor.groupIds || []).length === 0 ? (
                                    <p className="text-sm text-accent">Not assigned to any group</p>
                                ) : (
                                    <div className="flex flex-wrap gap-1.5">
                                        {(mentor.groupIds || []).map((group) => (
                                            <span key={group._id} className="px-2 py-1 rounded bg-primary/5 text-xs text-primary">
                                                {group.name}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !saving && setShowModal(false)}>
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(event) => event.stopPropagation()}>
                        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between rounded-t-xl z-10">
                            <h2 className="text-xl font-bold text-secondary">
                                {editing ? 'Edit Mentor' : 'Add Mentor'}
                            </h2>
                            <button
                                onClick={() => !saving && setShowModal(false)}
                                className="p-2 hover:bg-gray-100 rounded-lg"
                                title="Close"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-5">
                            {!editing && (
                                <div>
                                    <label className="block text-sm font-semibold text-secondary mb-2">
                                        Select user <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative mb-2">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-accent" />
                                        <input
                                            type="text"
                                            value={userSearch}
                                            onChange={(event) => setUserSearch(event.target.value)}
                                            placeholder="Search by name, email, or phone..."
                                            className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                                        />
                                    </div>
                                    <div className="max-h-44 overflow-y-auto border border-gray-200 rounded-lg divide-y">
                                        {filteredUsers.length === 0 ? (
                                            <p className="p-3 text-sm text-accent">No users found</p>
                                        ) : (
                                            filteredUsers.map((user) => (
                                                <button
                                                    key={user._id}
                                                    type="button"
                                                    onClick={() => setForm((prev) => ({ ...prev, userId: user._id }))}
                                                    className={`w-full text-left px-3 py-2 text-sm transition ${form.userId === user._id ? 'bg-primary/10 text-primary font-semibold' : 'text-secondary hover:bg-gray-50'}`}
                                                >
                                                    <span className="block">{user.displayName || 'Unnamed user'}</span>
                                                    <span className="block text-xs text-accent">{user.email || user.phone || user._id}</span>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}

                            {editing && (
                                <div className="rounded-lg bg-gray-50 p-3">
                                    <p className="text-sm font-semibold text-secondary">{editing.userId?.displayName}</p>
                                    <p className="text-xs text-accent">{editing.userId?.email || editing.userId?.phone}</p>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-semibold text-secondary mb-2">Headline</label>
                                <input
                                    type="text"
                                    value={form.headline}
                                    onChange={(event) => setForm((prev) => ({ ...prev, headline: event.target.value }))}
                                    placeholder="e.g. Mindfulness & stress management mentor"
                                    maxLength={120}
                                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-secondary mb-2">Bio</label>
                                <textarea
                                    value={form.bio}
                                    onChange={(event) => setForm((prev) => ({ ...prev, bio: event.target.value }))}
                                    placeholder="Short introduction for the Mentor Corner profile"
                                    rows={3}
                                    maxLength={2000}
                                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-secondary mb-2">Expertise</label>
                                    <input
                                        type="text"
                                        value={form.expertise}
                                        onChange={(event) => setForm((prev) => ({ ...prev, expertise: event.target.value }))}
                                        placeholder="Meditation, Stress, Sleep"
                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                                    />
                                    <p className="text-xs text-accent mt-1">Comma-separated</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-secondary mb-2">Languages</label>
                                    <input
                                        type="text"
                                        value={form.languages}
                                        onChange={(event) => setForm((prev) => ({ ...prev, languages: event.target.value }))}
                                        placeholder="English, Hindi"
                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                                    />
                                    <p className="text-xs text-accent mt-1">Comma-separated</p>
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="block text-sm font-semibold text-secondary">Assigned groups</label>
                                    <span className="text-xs text-accent">{form.groupIds.length} selected</span>
                                </div>
                                <div className="relative mb-2">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-accent" />
                                    <input
                                        type="text"
                                        value={groupSearch}
                                        onChange={(event) => setGroupSearch(event.target.value)}
                                        placeholder="Search groups..."
                                        className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                                    />
                                </div>
                                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y">
                                    {filteredGroups.length === 0 ? (
                                        <p className="p-3 text-sm text-accent">No groups found</p>
                                    ) : (
                                        filteredGroups.map((group) => {
                                            const checked = form.groupIds.includes(group._id);
                                            return (
                                                <label
                                                    key={group._id}
                                                    className={`flex items-center gap-3 px-3 py-2 text-sm cursor-pointer transition ${checked ? 'bg-primary/5' : 'hover:bg-gray-50'}`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        onChange={() => toggleGroup(group._id)}
                                                        className="w-4 h-4 accent-[#F1842D]"
                                                    />
                                                    <span className="text-secondary">{group.name}</span>
                                                    <span className="text-xs text-accent ml-auto">{group.groupType}</span>
                                                </label>
                                            );
                                        })
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-6">
                                <label className="flex items-center gap-2 text-sm font-medium text-secondary">
                                    <input
                                        type="checkbox"
                                        checked={form.isVerified}
                                        onChange={(event) => setForm((prev) => ({ ...prev, isVerified: event.target.checked }))}
                                        className="w-4 h-4 accent-[#F1842D]"
                                    />
                                    Verified mentor
                                </label>
                                <label className="flex items-center gap-2 text-sm font-medium text-secondary">
                                    <input
                                        type="checkbox"
                                        checked={form.isActive}
                                        onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                                        className="w-4 h-4 accent-[#F1842D]"
                                    />
                                    Active
                                </label>
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-2">
                                <button
                                    onClick={() => setShowModal(false)}
                                    disabled={saving}
                                    className="px-4 py-2.5 border border-gray-300 rounded-lg text-secondary font-medium hover:bg-gray-50 transition disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={saveMentor}
                                    disabled={saving}
                                    className="px-5 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition font-semibold disabled:opacity-50"
                                >
                                    {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Mentor'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
