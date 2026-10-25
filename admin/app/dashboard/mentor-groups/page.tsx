'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/api/client';
import toast from 'react-hot-toast';
import { Search, Plus, Users, Pencil, Archive, Link2, ShieldAlert } from 'lucide-react';
import { useAuthStore } from '@/lib/store/authStore';
import MentorGroupModal from './MentorGroupModal';
import ManageMentorGroupModal from './ManageMentorGroupModal';
import type { CommunityOption, MentorGroup, MentorOption } from './types';

export default function MentorGroupsPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const hasPermission = useAuthStore((state) => state.hasPermission);

  const [groups, setGroups] = useState<MentorGroup[]>([]);
  const [mentors, setMentors] = useState<MentorOption[]>([]);
  const [communities, setCommunities] = useState<CommunityOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<MentorGroup | null>(null);
  const [managing, setManaging] = useState<MentorGroup | null>(null);

  useEffect(() => {
    if (user && !hasPermission('manage_mentor_groups')) {
      router.replace('/dashboard');
    }
  }, [user, hasPermission, router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [groupsRes, mentorsRes, communitiesRes] = await Promise.all([
        apiClient.get('/api/community/admin/mentor-groups'),
        apiClient.get('/api/community/admin/mentor-groups/mentors'),
        apiClient.get('/api/community/admin/mentor-groups/communities'),
      ]);
      setGroups(groupsRes.data.data || []);
      setMentors(mentorsRes.data.data || []);
      setCommunities(communitiesRes.data.data || []);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to load mentor groups');
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredGroups = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return groups;
    return groups.filter((group) => (
      group.name.toLowerCase().includes(term)
      || group.owner?.displayName?.toLowerCase().includes(term)
      || group.owner?.email?.toLowerCase().includes(term)
    ));
  }, [groups, search]);

  const archive = async (group: MentorGroup) => {
    if (!confirm(`Archive "${group.name}"? Members will lose access and the group will be removed from the mentor's mobile app.`)) {
      return;
    }
    try {
      await apiClient.delete(`/api/community/admin/mentor-groups/${group._id}`);
      toast.success('Mentor group archived');
      await load();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to archive group');
    }
  };

  if (user && !hasPermission('manage_mentor_groups')) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-gray-500">
        <ShieldAlert className="h-10 w-10" />
        <p>You do not have permission to manage mentor groups.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold text-secondary">
            <Users className="h-8 w-8" /> Mentor Groups
          </h1>
          <p className="mt-1 text-accent">
            Create private groups, choose a mentor owner, and manage members and linked communities.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setShowModal(true);
          }}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 font-medium text-white shadow-lg shadow-primary/30 transition hover:bg-primary-dark"
        >
          <Plus className="h-5 w-5" /> Create Group
        </button>
      </div>

      <div className="rounded-xl bg-white p-4 shadow-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-accent" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by group name or mentor..."
            className="w-full rounded-lg border border-gray-300 py-3 pl-10 pr-4 text-black outline-none focus:border-transparent focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-md">
          <Users className="mx-auto mb-4 h-16 w-16 text-accent/30" />
          <h2 className="text-lg font-semibold text-secondary">No mentor groups yet</h2>
          <p className="mt-1 text-sm text-accent">
            Create the first private group and assign it to a verified mentor.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {filteredGroups.map((group) => (
            <div key={group._id} className="rounded-xl bg-white p-5 shadow-md">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-lg font-bold text-secondary">{group.name}</h2>
                    <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                      Private
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-accent">
                    {group.description || 'No description'}
                  </p>
                  <p className="mt-2 text-sm font-medium text-secondary">
                    {group.owner?.displayName || 'No owner'}
                    {group.owner?.email ? (
                      <span className="ml-2 font-normal text-accent">{group.owner.email}</span>
                    ) : null}
                  </p>
                </div>
                {group.coverImage ? (
                  <img
                    src={group.coverImage}
                    alt=""
                    className="h-16 w-16 shrink-0 rounded-xl object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xl font-bold text-primary">
                    {group.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <span className="flex items-center gap-1 rounded-full bg-gray-50 px-3 py-1 text-gray-600">
                  <Users className="h-3.5 w-3.5" /> {group.memberCount} members
                </span>
                <span className="flex items-center gap-1 rounded-full bg-gray-50 px-3 py-1 text-gray-600">
                  <Link2 className="h-3.5 w-3.5" /> {group.linkedGroups.length} communities
                </span>
              </div>

              {group.linkedGroups.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {group.linkedGroups.map((linked) => (
                    <span key={linked._id} className="rounded bg-gray-50 px-2 py-1 text-xs text-accent">
                      {linked.name}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={() => setManaging(group)}
                  className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary-dark"
                >
                  <Users className="h-4 w-4" /> Manage
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(group);
                    setShowModal(true);
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <Pencil className="h-4 w-4" /> Edit
                </button>
                <button
                  type="button"
                  onClick={() => archive(group)}
                  className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  <Archive className="h-4 w-4" /> Archive
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <MentorGroupModal
        open={showModal}
        group={editing}
        mentors={mentors}
        onClose={() => {
          setShowModal(false);
          setEditing(null);
        }}
        onSaved={load}
      />

      <ManageMentorGroupModal
        open={Boolean(managing)}
        group={managing}
        communities={communities}
        onClose={() => setManaging(null)}
        onChanged={load}
      />
    </div>
  );
}
