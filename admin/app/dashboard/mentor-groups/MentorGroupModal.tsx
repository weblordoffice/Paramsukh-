'use client';

import { useEffect, useState } from 'react';
import apiClient from '@/lib/api/client';
import toast from 'react-hot-toast';
import { X, Users } from 'lucide-react';
import type { MentorGroup, MentorOption } from './types';

type Props = {
  open: boolean;
  group: MentorGroup | null;
  mentors: MentorOption[];
  onClose: () => void;
  onSaved: () => void;
};

export default function MentorGroupModal({ open, group, mentors, onClose, onSaved }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [ownerUserId, setOwnerUserId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(group?.name || '');
    setDescription(group?.description || '');
    setCoverImage(group?.coverImage || '');
    setOwnerUserId(group?.owner?._id || '');
  }, [open, group]);

  if (!open) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (name.trim().length < 3) {
      toast.error('Group name must be at least 3 characters');
      return;
    }
    if (!group && !ownerUserId) {
      toast.error('Select a mentor owner');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        coverImage: coverImage.trim() || null,
        ...(group ? {} : { ownerUserId }),
      };
      if (group) {
        await apiClient.patch(`/api/community/admin/mentor-groups/${group._id}`, payload);
        toast.success('Mentor group updated');
      } else {
        await apiClient.post('/api/community/admin/mentor-groups', payload);
        toast.success('Mentor group created');
      }
      onSaved();
      onClose();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to save mentor group');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b bg-gray-50 px-6 py-4">
          <h2 className="text-xl font-bold text-gray-800">
            {group ? 'Edit Mentor Group' : 'Create Mentor Group'}
          </h2>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-gray-500 hover:bg-gray-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4 p-6">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Group name</label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              required
              placeholder="e.g. Sleep Reset Circle"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-black outline-none focus:border-transparent focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={500}
              rows={4}
              placeholder="What is this group for?"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-black outline-none focus:border-transparent focus:ring-2 focus:ring-primary"
            />
            <p className="mt-1 text-xs text-gray-500">{description.length}/500</p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Cover image URL (optional)</label>
            <input
              value={coverImage}
              onChange={(event) => setCoverImage(event.target.value)}
              placeholder="https://..."
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-black outline-none focus:border-transparent focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="mb-1 flex items-center gap-2 text-sm font-medium text-gray-700">
              <Users className="h-4 w-4" /> Mentor owner
            </label>
            <select
              value={ownerUserId}
              onChange={(event) => setOwnerUserId(event.target.value)}
              disabled={Boolean(group)}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-black outline-none focus:border-transparent focus:ring-2 focus:ring-primary disabled:bg-gray-100"
            >
              <option value="">Select an active verified mentor</option>
              {mentors.map((mentor) => (
                <option key={mentor._id} value={mentor._id}>
                  {mentor.displayName}{mentor.email ? ` — ${mentor.email}` : ''}
                </option>
              ))}
            </select>
            {group ? (
              <p className="mt-1 text-xs text-gray-500">
                Ownership cannot be changed after creation.
              </p>
            ) : (
              <p className="mt-1 text-xs text-gray-500">
                The selected mentor can also manage this group from the mobile app.
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-300 py-2.5 font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-lg bg-primary py-2.5 font-medium text-white shadow-lg shadow-primary/30 transition hover:bg-primary-dark disabled:opacity-70"
            >
              {saving ? 'Saving...' : group ? 'Update Group' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
