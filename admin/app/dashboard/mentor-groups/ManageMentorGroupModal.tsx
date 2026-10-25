'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import apiClient from '@/lib/api/client';
import toast from 'react-hot-toast';
import { X, Search, UserPlus, Users, Link2, Unlink, Trash2 } from 'lucide-react';
import type {
  CommunityOption,
  MentorGroup,
  MentorGroupMember,
  UserCandidate,
} from './types';

type Props = {
  open: boolean;
  group: MentorGroup | null;
  communities: CommunityOption[];
  onClose: () => void;
  onChanged: () => void;
};

type Tab = 'members' | 'communities';

export default function ManageMentorGroupModal({
  open,
  group,
  communities,
  onClose,
  onChanged,
}: Props) {
  const [tab, setTab] = useState<Tab>('members');
  const [detail, setDetail] = useState<MentorGroup | null>(group);
  const [members, setMembers] = useState<MentorGroupMember[]>([]);
  const [candidates, setCandidates] = useState<UserCandidate[]>([]);
  const [query, setQuery] = useState('');
  const [selectedCommunityIds, setSelectedCommunityIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!group?._id) return;
    setLoading(true);
    try {
      const response = await apiClient.get(
        `/api/community/admin/mentor-groups/${group._id}/members`
      );
      setDetail(response.data.data?.group || group);
      setMembers(response.data.data?.members || []);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to load group members');
    } finally {
      setLoading(false);
    }
  }, [group]);

  const searchUsers = useCallback(async (term = '') => {
    try {
      const response = await apiClient.get(
        '/api/community/admin/mentor-groups/user-candidates',
        { params: term ? { q: term } : undefined }
      );
      setCandidates(response.data.data || []);
    } catch {
      setCandidates([]);
    }
  }, []);

  useEffect(() => {
    if (!open || !group?._id) return;
    setTab('members');
    setQuery('');
    setSelectedCommunityIds([]);
    setDetail(group);
    load();
    searchUsers('');
  }, [open, group, load, searchUsers]);

  const linkedGroups = useMemo(
    () => detail?.linkedGroups || [],
    [detail?.linkedGroups]
  );
  const availableCommunities = useMemo(
    () => communities.filter(
      (community) => !linkedGroups.some((linked) => linked._id === community._id)
    ),
    [communities, linkedGroups]
  );

  const addUser = async (userId: string) => {
    if (!group?._id) return;
    setBusy(true);
    try {
      await apiClient.post(`/api/community/admin/mentor-groups/${group._id}/members`, {
        userIds: [userId],
      });
      toast.success('Member added');
      await load();
      onChanged();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to add member');
    } finally {
      setBusy(false);
    }
  };

  const removeMember = async (member: MentorGroupMember) => {
    if (!group?._id) return;
    if (!confirm(`Remove ${member.displayName} from this group?`)) return;
    setBusy(true);
    try {
      await apiClient.delete(
        `/api/community/admin/mentor-groups/${group._id}/members/${member.userId}`
      );
      toast.success('Member removed');
      await load();
      onChanged();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to remove member');
    } finally {
      setBusy(false);
    }
  };

  const addCommunities = async () => {
    if (!group?._id || selectedCommunityIds.length === 0) return;
    setBusy(true);
    try {
      await apiClient.post(`/api/community/admin/mentor-groups/${group._id}/members`, {
        groupIds: selectedCommunityIds,
      });
      toast.success('Communities linked');
      setSelectedCommunityIds([]);
      await load();
      onChanged();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to add communities');
    } finally {
      setBusy(false);
    }
  };

  const detachCommunity = async (communityId: string, name: string) => {
    if (!group?._id) return;
    if (!confirm(`Detach "${name}"? Members who only came from this community will lose access.`)) return;
    setBusy(true);
    try {
      await apiClient.delete(
        `/api/community/admin/mentor-groups/${group._id}/linked-groups/${communityId}`
      );
      toast.success('Community detached');
      await load();
      onChanged();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to detach community');
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b bg-gray-50 px-6 py-4">
          <div>
            <h2 className="text-xl font-bold text-gray-800">{detail?.name || 'Manage Group'}</h2>
            <p className="mt-0.5 text-sm text-gray-500">
              {detail?.owner?.displayName ? `Owner: ${detail.owner.displayName}` : 'Mentor group'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-gray-500 hover:bg-gray-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex gap-2 border-b px-6 py-3">
          <button
            type="button"
            onClick={() => setTab('members')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold ${tab === 'members' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <Users className="h-4 w-4" /> Members ({members.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('communities')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold ${tab === 'communities' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <Link2 className="h-4 w-4" /> Communities ({linkedGroups.length})
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'members' ? (
            <div className="space-y-6">
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">Add people</label>
                <div className="flex gap-2">
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') searchUsers(query.trim());
                    }}
                    placeholder="Search by name or email"
                    className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-black outline-none focus:border-transparent focus:ring-2 focus:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={() => searchUsers(query.trim())}
                    className="rounded-lg bg-primary px-4 py-2.5 text-white hover:bg-primary-dark"
                  >
                    <Search className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">
                  {candidates.length === 0 ? (
                    <p className="text-sm text-gray-500">No matching users.</p>
                  ) : (
                    candidates.map((candidate) => (
                      <div key={candidate._id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-gray-800">{candidate.displayName}</p>
                          <p className="truncate text-xs text-gray-500">{candidate.email || 'No email'}</p>
                        </div>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => addUser(candidate._id)}
                          className="flex items-center gap-1 rounded-lg border border-primary px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/5 disabled:opacity-50"
                        >
                          <UserPlus className="h-3.5 w-3.5" /> Add
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-700">Current members</h3>
                {loading ? (
                  <p className="text-sm text-gray-500">Loading...</p>
                ) : members.length === 0 ? (
                  <p className="text-sm text-gray-500">No members yet.</p>
                ) : (
                  <div className="space-y-2">
                    {members.map((member) => (
                      <div key={member._id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-gray-800">
                            {member.displayName}
                            {member.role === 'mentor' ? (
                              <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">Mentor</span>
                            ) : null}
                          </p>
                          <p className="truncate text-xs text-gray-500">
                            {member.email || 'No email'} · {member.isDirect ? 'Added directly' : `Via ${member.sourceGroupName || 'community'}`}
                          </p>
                        </div>
                        {member.isDirect && member.role !== 'mentor' ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => removeMember(member)}
                            className="rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
                            title="Remove member"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : (
                          <span className="text-[10px] text-gray-400">
                            {member.role === 'mentor' ? 'Owner/Mentor' : 'Managed by community'}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-700">Linked communities</h3>
                {linkedGroups.length === 0 ? (
                  <p className="text-sm text-gray-500">No communities linked.</p>
                ) : (
                  <div className="space-y-2">
                    {linkedGroups.map((community) => (
                      <div key={community._id} className="flex items-center justify-between rounded-lg border px-3 py-2.5">
                        <div>
                          <p className="text-sm font-medium text-gray-800">{community.name}</p>
                          <p className="text-xs text-gray-500">All members of this community get access.</p>
                        </div>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => detachCommunity(community._id, community.name)}
                          className="flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          <Unlink className="h-3.5 w-3.5" /> Detach
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-700">Add communities</h3>
                {availableCommunities.length === 0 ? (
                  <p className="text-sm text-gray-500">No other communities available.</p>
                ) : (
                  <>
                    <div className="max-h-60 space-y-2 overflow-y-auto">
                      {availableCommunities.map((community) => {
                        const checked = selectedCommunityIds.includes(community._id);
                        return (
                          <label key={community._id} className="flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                setSelectedCommunityIds((current) => (
                                  current.includes(community._id)
                                    ? current.filter((id) => id !== community._id)
                                    : [...current, community._id]
                                ));
                              }}
                              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-gray-800">{community.name}</span>
                              <span className="block text-xs text-gray-500">{community.memberCount || 0} members</span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      disabled={busy || selectedCommunityIds.length === 0}
                      onClick={addCommunities}
                      className="mt-3 flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
                    >
                      <Link2 className="h-4 w-4" /> Add Selected Communities
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
