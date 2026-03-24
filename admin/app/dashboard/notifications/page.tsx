'use client';

import { useEffect, useState } from 'react';
import apiClient from '@/lib/api/client';
import toast from 'react-hot-toast';
import {
  Bell, Trash2, CheckCircle, Send, Users, Crown,
  BookOpen, Calendar, ShoppingCart, Package, MessageSquare,
  Mic, Settings, Target, Megaphone, Filter, Clock,
  Search, LayoutDashboard, Sparkles, ChevronRight, BellOff,
  ClipboardList, Star
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Notification {
  _id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  user?: { displayName: string; email: string };
  icon?: string;
  priority?: string;
}

type SendMode = 'broadcast' | 'targeted';

interface Section {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bg: string;
  border: string;
  filters?: { key: string; label: string; placeholder: string }[];
}

// ─── Config ──────────────────────────────────────────────────────────────────

const SECTIONS: Section[] = [
  { id: 'all',          label: 'All Users',    icon: LayoutDashboard, color: 'text-slate-700',   bg: 'bg-slate-100',   border: 'border-slate-200' },
  { id: 'users',        label: 'Users',         icon: Users,           color: 'text-blue-700',    bg: 'bg-blue-50',     border: 'border-blue-200' },
  { id: 'memberships',  label: 'Memberships',   icon: Crown,           color: 'text-purple-700',  bg: 'bg-purple-50',   border: 'border-purple-200',
    filters: [{ key: 'planSlug', label: 'Plan Slug', placeholder: 'e.g. gold (blank = all)' }] },
  { id: 'plans',        label: 'Plans',          icon: Star,           color: 'text-indigo-700',  bg: 'bg-indigo-50',   border: 'border-indigo-200',
    filters: [{ key: 'planSlug', label: 'Plan Slug', placeholder: 'e.g. silver (blank = all)' }] },
  { id: 'courses',      label: 'Courses',        icon: BookOpen,       color: 'text-emerald-700', bg: 'bg-emerald-50',  border: 'border-emerald-200',
    filters: [{ key: 'courseId', label: 'Course ID', placeholder: 'Blank = all enrolled' }] },
  { id: 'podcasts',     label: 'Podcasts',       icon: Mic,            color: 'text-pink-700',    bg: 'bg-pink-50',     border: 'border-pink-200',
    filters: [{ key: 'podcastId', label: 'Podcast ID', placeholder: 'Blank = all subscribers' }] },
  { id: 'events',       label: 'Events',         icon: Calendar,       color: 'text-amber-700',   bg: 'bg-amber-50',    border: 'border-amber-200',
    filters: [{ key: 'eventId', label: 'Event ID', placeholder: 'Blank = all registrants' }] },
  { id: 'products',     label: 'Products',       icon: ShoppingCart,   color: 'text-orange-700',  bg: 'bg-orange-50',   border: 'border-orange-200' },
  { id: 'orders',       label: 'Orders',         icon: Package,        color: 'text-red-700',     bg: 'bg-red-50',      border: 'border-red-200',
    filters: [{ key: 'orderStatus', label: 'Order Status', placeholder: 'e.g. pending, delivered' }] },
  { id: 'bookings',     label: 'Bookings',       icon: ClipboardList,  color: 'text-teal-700',    bg: 'bg-teal-50',     border: 'border-teal-200' },
  { id: 'community',    label: 'Community',      icon: MessageSquare,  color: 'text-green-700',   bg: 'bg-green-50',    border: 'border-green-200',
    filters: [{ key: 'groupId', label: 'Group ID', placeholder: 'Blank = all groups' }] },
  { id: 'counseling',   label: 'Counseling',     icon: Settings,       color: 'text-cyan-700',    bg: 'bg-cyan-50',     border: 'border-cyan-200',
    filters: [{ key: 'bookingStatus', label: 'Booking Status', placeholder: 'e.g. upcoming' }] },
];

const NOTIF_TYPES = [
  { value: 'general',              label: '📢  General' },
  { value: 'event_reminder',       label: '📅  Event Reminder' },
  { value: 'event_registered',     label: '🎟️  Event Registered' },
  { value: 'membership_activated', label: '👑  Membership' },
  { value: 'course_enrolled',      label: '📚  Course' },
  { value: 'counseling_reminder',  label: '🤝  Counseling' },
  { value: 'community_post',       label: '💬  Community' },
  { value: 'system',               label: '⚙️  System' },
];

const PRIORITIES = [
  { value: 'low',    label: 'Low',    dot: 'bg-gray-400' },
  { value: 'medium', label: 'Medium', dot: 'bg-blue-500' },
  { value: 'high',   label: 'High',   dot: 'bg-orange-500' },
  { value: 'urgent', label: 'Urgent', dot: 'bg-red-500' },
];

const TEMPLATES = [
  { icon: '🎉', title: 'New Event Announced', message: 'We have an exciting new event coming up! Check the Events section for details.' },
  { icon: '🧘', title: 'Meditation Reminder',  message: 'Take a mindful moment today. Your daily session is waiting in the app.' },
  { icon: '📚', title: 'New Course Added',     message: 'A brand-new course has been added to our library. Explore it now!' },
  { icon: '🌟', title: 'Exclusive Offer',      message: 'As a valued member, you have access to an exclusive offer. Check your benefits.' },
  { icon: '🔔', title: 'App Update Alert',     message: "We've improved your experience with new features. Update the app today!" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function priorityPill(p?: string) {
  switch (p) {
    case 'urgent': return 'bg-red-100 text-red-700';
    case 'high':   return 'bg-orange-100 text-orange-700';
    case 'medium': return 'bg-blue-100 text-blue-700';
    default:       return 'bg-gray-100 text-gray-500';
  }
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendMode, setSendMode] = useState<SendMode>('broadcast');
  const [section, setSection] = useState<Section>(SECTIONS[0]);
  const [sectionFilters, setSectionFilters] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');

  const [form, setForm] = useState({
    title: '', message: '', type: 'general',
    priority: 'medium', icon: '🔔', actionUrl: '',
  });

  const patch = (f: Partial<typeof form>) => setForm(p => ({ ...p, ...f }));

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const r = await apiClient.get('/api/notifications/all');
      setNotifications(r.data.data?.notifications || []);
    } catch { setNotifications([]); }
    finally { setLoading(false); }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.message.trim()) {
      toast.error('Title and message are required'); return;
    }
    setSending(true);
    try {
      if (sendMode === 'broadcast') {
        await apiClient.post('/api/notifications/broadcast', {
          title: form.title, message: form.message,
          type: form.type, priority: form.priority,
          icon: form.icon, actionUrl: form.actionUrl || undefined,
        });
        toast.success('📢 Broadcast sent to all users!');
      } else {
        const cleanFilters: Record<string, string> = {};
        Object.entries(sectionFilters).forEach(([k, v]) => { if (v.trim()) cleanFilters[k] = v.trim(); });
        const r = await apiClient.post('/api/notifications/send', {
          title: form.title, message: form.message,
          section: section.id, filters: cleanFilters,
          type: form.type, priority: form.priority,
          icon: form.icon, actionUrl: form.actionUrl || undefined,
        });
        const count = r.data.data?.recipientCount ?? 0;
        toast.success(`✅ Sent to ${count} user${count !== 1 ? 's' : ''} in ${section.label}`);
      }
      patch({ title: '', message: '', actionUrl: '' });
      setTimeout(load, 700);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to send');
    } finally { setSending(false); }
  };

  const onDelete = async (id: string) => {
    if (!confirm('Delete this notification?')) return;
    try {
      await apiClient.delete(`/api/notifications/${id}/admin`);
      setNotifications(p => p.filter(n => n._id !== id));
      toast.success('Deleted');
    } catch { toast.error('Failed to delete'); }
  };

  const onMarkRead = async (id: string) => {
    try {
      await apiClient.patch(`/api/notifications/${id}/read/admin`);
      setNotifications(p => p.map(n => n._id === id ? { ...n, isRead: true } : n));
    } catch { toast.error('Failed'); }
  };

  const filtered = notifications.filter(n =>
    !search || n.title.toLowerCase().includes(search.toLowerCase()) ||
    n.message.toLowerCase().includes(search.toLowerCase())
  );

  const unread = notifications.filter(n => !n.isRead).length;
  const SectionIcon = section.icon;

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col gap-0">

      {/* ── Top Bar ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-secondary flex items-center gap-2">
            <Bell className="w-6 h-6 text-primary" /> Notifications Center
          </h1>
          <p className="text-sm text-accent mt-0.5">Compose & send push notifications to any audience</p>
        </div>
        {/* Stat chips */}
        <div className="hidden sm:flex items-center gap-3">
          {[
            { label: 'Total', val: notifications.length, cls: 'bg-gray-100 text-secondary' },
            { label: 'Unread', val: unread, cls: 'bg-primary/10 text-primary' },
            { label: 'Read', val: notifications.length - unread, cls: 'bg-emerald-50 text-emerald-700' },
          ].map(s => (
            <div key={s.label} className={`${s.cls} rounded-xl px-4 py-2 text-center min-w-[72px]`}>
              <p className="text-xl font-bold leading-none">{s.val}</p>
              <p className="text-xs font-medium mt-0.5 opacity-70">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Two-column body ── */}
      <div className="flex gap-6 flex-1 min-h-0">

        {/* ════════════ LEFT — Compose Panel ════════════ */}
        <div className="w-[440px] flex-shrink-0 flex flex-col gap-0 overflow-y-auto pr-1">
          <form onSubmit={handleSend} className="flex flex-col gap-5">

            {/* Mode toggle */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-1.5 flex gap-1">
              {(['broadcast', 'targeted'] as SendMode[]).map(m => (
                <button
                  key={m} type="button"
                  onClick={() => setSendMode(m)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    sendMode === m
                      ? 'bg-secondary text-white shadow'
                      : 'text-accent hover:text-secondary hover:bg-gray-50'
                  }`}
                >
                  {m === 'broadcast' ? <Megaphone className="w-4 h-4" /> : <Target className="w-4 h-4" />}
                  {m === 'broadcast' ? 'Broadcast to All' : 'Target Section'}
                </button>
              ))}
            </div>

            {/* Section picker */}
            {sendMode === 'targeted' && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                <p className="text-sm font-semibold text-secondary flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" /> Choose Audience
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {SECTIONS.map(sec => {
                    const Icon = sec.icon;
                    const active = section.id === sec.id;
                    return (
                      <button
                        key={sec.id} type="button"
                        onClick={() => { setSection(sec); setSectionFilters({}); }}
                        className={`p-2.5 rounded-xl border-2 flex flex-col items-center gap-1.5 transition-all text-center ${
                          active
                            ? `border-primary ${sec.bg} shadow-sm`
                            : 'border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${sec.bg}`}>
                          <Icon className={`w-4 h-4 ${active ? sec.color : 'text-gray-400'}`} />
                        </div>
                        <span className={`text-[11px] font-semibold leading-tight ${active ? 'text-primary' : 'text-gray-500'}`}>
                          {sec.label}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Sub-filter */}
                {section.filters && section.filters.length > 0 && (
                  <div className={`rounded-xl p-3 border ${section.border} ${section.bg} space-y-2`}>
                    <p className="text-xs font-semibold text-secondary flex items-center gap-1.5">
                      <Filter className="w-3.5 h-3.5" /> {section.label} Filter
                      <span className="font-normal text-accent">(optional)</span>
                    </p>
                    {section.filters.map(f => (
                      <input
                        key={f.key}
                        type="text"
                        placeholder={f.placeholder}
                        value={sectionFilters[f.key] || ''}
                        onChange={e => setSectionFilters(p => ({ ...p, [f.key]: e.target.value }))}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-primary focus:border-transparent"
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Templates */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
              <p className="text-sm font-semibold text-secondary flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" /> Quick Templates
              </p>
              <div className="flex flex-wrap gap-2">
                {TEMPLATES.map((t, i) => (
                  <button
                    key={i} type="button"
                    onClick={() => patch({ title: t.title, message: t.message, icon: t.icon })}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-primary/5 text-xs text-secondary font-medium border border-gray-200 hover:border-primary/30 rounded-lg transition"
                  >
                    <span>{t.icon}</span>
                    <span className="max-w-[90px] truncate">{t.title}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Compose */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
              <p className="text-sm font-semibold text-secondary flex items-center gap-2">
                <Bell className="w-4 h-4 text-primary" /> Compose Message
              </p>

              {/* Icon + Title */}
              <div className="flex gap-3 items-end">
                <div className="flex-shrink-0">
                  <label className="block text-xs font-medium text-accent mb-1">Icon</label>
                  <input
                    type="text"
                    value={form.icon}
                    maxLength={2}
                    onChange={e => patch({ icon: e.target.value })}
                    className="w-14 h-10 text-center text-xl border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-accent mb-1">Title *</label>
                  <input
                    type="text" required
                    value={form.title}
                    onChange={e => patch({ title: e.target.value })}
                    placeholder="Notification title"
                    className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>

              {/* Message */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-medium text-accent">Message *</label>
                  <span className={`text-xs ${form.message.length > 160 ? 'text-orange-500' : 'text-accent/50'}`}>
                    {form.message.length} chars
                  </span>
                </div>
                <textarea
                  required rows={3}
                  value={form.message}
                  onChange={e => patch({ message: e.target.value })}
                  placeholder="Write your notification message..."
                  className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                />
              </div>

              {/* Type + Priority */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-accent mb-1">Type</label>
                  <select
                    value={form.type}
                    onChange={e => patch({ type: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-transparent bg-white"
                  >
                    {NOTIF_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-accent mb-1">Priority</label>
                  <select
                    value={form.priority}
                    onChange={e => patch({ priority: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-transparent bg-white"
                  >
                    {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Action URL */}
              <div>
                <label className="block text-xs font-medium text-accent mb-1">
                  Deep Link <span className="font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={form.actionUrl}
                  onChange={e => patch({ actionUrl: e.target.value })}
                  placeholder="/event-detail?eventId=abc123"
                  className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                />
                <p className="text-[11px] text-accent/60 mt-1">App navigates here when user taps the push</p>
              </div>
            </div>

            {/* Preview card */}
            <div className="rounded-2xl overflow-hidden border border-gray-800 shadow-xl">
              <div className="bg-gray-900 px-4 pt-4 pb-2">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-bold tracking-widest text-gray-400 uppercase">Push Preview</span>
                  <span className="text-[11px] text-gray-500">
                    {sendMode === 'broadcast'
                      ? '📢 All users'
                      : `🎯 ${section.label}`}
                  </span>
                </div>
                {/* Fake Android system notification */}
                <div className="bg-[#1e1e1e] rounded-xl p-3 flex items-start gap-3 border border-white/10">
                  <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-base flex-shrink-0">
                    {form.icon || '🔔'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-white truncate">
                        {form.title || 'Notification Title'}
                      </p>
                      <span className="text-[11px] text-gray-500 flex-shrink-0 ml-2">now</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">
                      {form.message || 'Your message will appear here...'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-gray-950 px-4 py-2.5 flex items-center justify-between">
                <span className="text-[11px] text-gray-600">ParamSukh</span>
                <span className="text-[11px] text-gray-600">
                  {PRIORITIES.find(p => p.value === form.priority)?.label} priority
                </span>
              </div>
            </div>

            {/* Send button */}
            <button
              type="submit" disabled={sending}
              className="w-full py-3.5 bg-primary hover:bg-primary-dark text-white rounded-2xl font-bold text-sm transition shadow-lg shadow-primary/25 hover:shadow-primary/40 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {sending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  {sendMode === 'broadcast' ? 'Broadcast to All Users' : `Send to ${section.label}`}
                </>
              )}
            </button>

          </form>
        </div>

        {/* ════════════ RIGHT — History ════════════ */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0">

          {/* History header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-secondary flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-accent" />
              Notification History
              {unread > 0 && (
                <span className="ml-1 px-2 py-0.5 bg-primary text-white text-xs font-bold rounded-full">
                  {unread} unread
                </span>
              )}
            </h2>
            {/* Search */}
            <div className="relative w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-accent/60" />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 border rounded-xl text-xs focus:ring-2 focus:ring-primary focus:border-transparent bg-white"
              />
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
            {loading ? (
              <div className="flex items-center justify-center h-48">
                <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-20 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                  <BellOff className="w-8 h-8 text-gray-300" />
                </div>
                <p className="font-semibold text-secondary">No notifications yet</p>
                <p className="text-sm text-accent mt-1">
                  {search ? 'No results for that search' : 'Send your first notification using the panel on the left'}
                </p>
              </div>
            ) : (
              filtered.map(n => (
                <div
                  key={n._id}
                  className={`bg-white rounded-xl border transition-all hover:shadow-md group ${
                    !n.isRead ? 'border-l-4 border-l-primary border-gray-100' : 'border-gray-100'
                  }`}
                >
                  <div className="p-4 flex items-start gap-3">
                    {/* Icon */}
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0 ${
                      !n.isRead ? 'bg-primary/10' : 'bg-gray-100'
                    }`}>
                      {n.icon || '🔔'}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center flex-wrap gap-1.5 mb-0.5">
                            <span className="font-semibold text-sm text-secondary truncate">{n.title}</span>
                            {!n.isRead && (
                              <span className="px-1.5 py-0.5 bg-primary text-white text-[10px] font-bold rounded-full leading-none">NEW</span>
                            )}
                          </div>
                          <p className="text-xs text-accent leading-relaxed line-clamp-2">{n.message}</p>
                        </div>
                        {/* Actions — visible on hover */}
                        <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          {!n.isRead && (
                            <button
                              onClick={() => onMarkRead(n._id)}
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                              title="Mark as read"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => onDelete(n._id)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Footer row */}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${priorityPill(n.priority)}`}>
                          {n.priority || 'medium'}
                        </span>
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-[10px] font-medium rounded-full">
                          {n.type?.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[11px] text-accent/50 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {timeAgo(n.createdAt)}
                        </span>
                        {n.user && (
                          <span className="text-[11px] text-accent/50 truncate max-w-[140px]">
                            → {n.user.displayName || n.user.email}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
