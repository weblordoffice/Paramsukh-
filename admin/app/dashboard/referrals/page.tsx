'use client';

import { useEffect, useState } from 'react';
import apiClient from '@/lib/api/client';
import { Settings, Award, TrendingUp, Flag, Plus, Edit, Trash2, Save, X, ToggleLeft, ToggleRight, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import toast from 'react-hot-toast';

const TRIGGER_LABELS: Record<string, string> = {
  'user.signup': 'User Signup', 'user.first_purchase': 'First Purchase',
  'user.course_complete': 'Course Completion', 'user.monthly_active': 'Monthly Active',
  'user.membership_renew': 'Membership Renewal', 'user.event_register': 'Event Registration',
  'user.counseling_book': 'Counseling Booking', 'user.anniversary': '1-Year Anniversary',
};

interface Rule { _id?: string; name: string; slug: string; description: string; triggerEvent: string; pointsValue: number; isActive: boolean; cooldownPerUser: number; holdDays: number; displayOrder: number; }

export default function ReferralsPage() {
  const [tab, setTab] = useState<'settings' | 'rules' | 'stats'>('settings');
  const [config, setConfig] = useState<any>(null);
  const [rules, setRules] = useState<Rule[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [newRule, setNewRule] = useState(false);

  const defaultRule = (): Rule => ({ name: '', slug: '', description: '', triggerEvent: 'user.signup', pointsValue: 100, isActive: true, cooldownPerUser: 1, holdDays: 0, displayOrder: 0 });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [cfgRes, rulesRes, statsRes] = await Promise.all([
          apiClient.get('/api/admin/referral/config'),
          apiClient.get('/api/admin/referral/rules'),
          apiClient.get('/api/admin/referral/stats'),
        ]);
        if (cancelled) return;
        if (cfgRes.data.success) setConfig(cfgRes.data.config);
        if (rulesRes.data.success) setRules(rulesRes.data.rules);
        if (statsRes.data.success) setStats(statsRes.data);
      } catch (_) {}
      if (!cancelled) setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const saveConfig = async () => {
    try {
      await apiClient.put('/api/admin/referral/config', config);
      toast.success('Settings saved');
    } catch (_) { toast.error('Failed to save'); }
  };

  const saveRule = async (rule: Rule) => {
    try {
      if (rule._id) {
        const res = await apiClient.put(`/api/admin/referral/rules/${rule._id}`, rule);
        setRules(r => r.map(rr => rr._id === rule._id ? res.data.rule : rr));
      } else {
        const res = await apiClient.post('/api/admin/referral/rules', rule);
        setRules(r => [...r, res.data.rule]);
      }
      setEditingRule(null); setNewRule(false);
      toast.success('Rule saved');
    } catch (_) { toast.error('Failed to save rule'); }
  };

  const deleteRule = async (id: string) => {
    if (!confirm('Delete this rule?')) return;
    await apiClient.delete(`/api/admin/referral/rules/${id}`);
    setRules(r => r.filter(rr => rr._id !== id));
    toast.success('Rule deleted');
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary">Referral System</h1>
          <p className="text-sm text-accent mt-1">Manage earning rules, settings, and view stats</p>
        </div>
        <div className="flex gap-2">
          {([['settings', Settings], ['rules', Award], ['stats', TrendingUp]] as [string, React.ComponentType<any>][]).map(([t, Icon]) => (
            <Button key={t} variant={tab === t ? 'default' : 'outline'} onClick={() => setTab(t as any)} size="sm">
              <Icon className="w-4 h-4 mr-2" />{t.charAt(0).toUpperCase() + t.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {tab === 'settings' && config && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card><CardHeader><CardTitle className="flex items-center gap-2"><Settings className="w-5 h-5" /> Point Value & System</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-secondary">Referral System</label>
                <button onClick={() => setConfig({ ...config, isActive: !config.isActive })}>
                  {config.isActive ? <ToggleRight className="w-8 h-8 text-green-500" /> : <ToggleLeft className="w-8 h-8 text-gray-300" />}
                </button>
              </div>
              <div>
                <label className="text-sm font-medium text-secondary">1 Point = ₹</label>
                <Input type="number" value={config.pointValueInRupees} onChange={e => setConfig({ ...config, pointValueInRupees: Number(e.target.value) })} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium text-secondary">Code Format</label>
                <Select value={config.referralCodeFormat} onValueChange={v => setConfig({ ...config, referralCodeFormat: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="displayName">Display Name (neeraj)</SelectItem>
                    <SelectItem value="random8">Random 8-char (a1b2c3d4)</SelectItem>
                    <SelectItem value="random12">Random 12-char (k9m2x7p4w1q8)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent></Card>

          <Card><CardHeader><CardTitle className="flex items-center gap-2"><RotateCcw className="w-5 h-5" /> Redemption Limits</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div><label className="text-sm font-medium text-secondary">Minimum Redemption (points)</label>
                <Input type="number" value={config.minRedemptionPoints} onChange={e => setConfig({ ...config, minRedemptionPoints: Number(e.target.value) })} className="mt-1" /></div>
              <div><label className="text-sm font-medium text-secondary">Max per Order (%)</label>
                <Input type="number" value={config.maxRedemptionPercent} onChange={e => setConfig({ ...config, maxRedemptionPercent: Number(e.target.value) })} className="mt-1" /></div>
              <div><label className="text-sm font-medium text-secondary">Points Expire After (months, 0=never)</label>
                <Input type="number" value={config.pointsExpireMonths} onChange={e => setConfig({ ...config, pointsExpireMonths: Number(e.target.value) })} className="mt-1" /></div>
            </CardContent></Card>

          <Card><CardHeader><CardTitle className="flex items-center gap-2"><Flag className="w-5 h-5" /> Anti-Abuse</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div><label className="text-sm font-medium text-secondary">Min Referrer Account Age (days)</label>
                <Input type="number" value={config.minReferrerAccountAgeDays} onChange={e => setConfig({ ...config, minReferrerAccountAgeDays: Number(e.target.value) })} className="mt-1" /></div>
              <div><label className="text-sm font-medium text-secondary">Max Ref per IP (24h)</label>
                <Input type="number" value={config.maxReferralsPerIP24h} onChange={e => setConfig({ ...config, maxReferralsPerIP24h: Number(e.target.value) })} className="mt-1" /></div>
              <div><label className="text-sm font-medium text-secondary">Purchase Points Hold (days)</label>
                <Input type="number" value={config.purchasePointsHoldDays} onChange={e => setConfig({ ...config, purchasePointsHoldDays: Number(e.target.value) })} className="mt-1" /></div>
              <div><label className="text-sm font-medium text-secondary">Lifetime Point Cap</label>
                <Input type="number" value={config.maxPointsPerReferrerTotal} onChange={e => setConfig({ ...config, maxPointsPerReferrerTotal: Number(e.target.value) })} className="mt-1" /></div>
            </CardContent></Card>

          <Card><CardHeader><CardTitle className="flex items-center gap-2"><Bell className="w-5 h-5" /> Notifications</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-secondary">Notify on Points Earned</span>
                <button onClick={() => setConfig({ ...config, notifyOnEarn: !config.notifyOnEarn })}>
                  {config.notifyOnEarn ? <ToggleRight className="w-8 h-8 text-green-500" /> : <ToggleLeft className="w-8 h-8 text-gray-300" />}
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-secondary">Notify on Points Redeemed</span>
                <button onClick={() => setConfig({ ...config, notifyOnRedeem: !config.notifyOnRedeem })}>
                  {config.notifyOnRedeem ? <ToggleRight className="w-8 h-8 text-green-500" /> : <ToggleLeft className="w-8 h-8 text-gray-300" />}
                </button>
              </div>
            </CardContent></Card>

          <div className="lg:col-span-2 flex justify-end">
            <Button onClick={saveConfig}><Save className="w-4 h-4 mr-2" /> Save Settings</Button>
          </div>
        </div>
      )}

      {tab === 'rules' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { setEditingRule(defaultRule()); setNewRule(true); }}><Plus className="w-4 h-4 mr-2" /> New Rule</Button>
          </div>
          {(newRule || editingRule) && (
            <Card><CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="text-sm font-medium">Rule Name</label>
                  <Input value={editingRule?.name || ''} onChange={e => setEditingRule({ ...editingRule!, name: e.target.value })} /></div>
                <div><label className="text-sm font-medium">Trigger Event</label>
                  <Select value={editingRule?.triggerEvent || 'user.signup'} onValueChange={v => setEditingRule({ ...editingRule!, triggerEvent: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(TRIGGER_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select></div>
                <div><label className="text-sm font-medium">Points</label>
                  <Input type="number" value={editingRule?.pointsValue || 0} onChange={e => setEditingRule({ ...editingRule!, pointsValue: Number(e.target.value) })} /></div>
                <div><label className="text-sm font-medium">Cooldown Per User</label>
                  <Input type="number" value={editingRule?.cooldownPerUser || 1} onChange={e => setEditingRule({ ...editingRule!, cooldownPerUser: Number(e.target.value) })} /></div>
                <div><label className="text-sm font-medium">Hold Days</label>
                  <Input type="number" value={editingRule?.holdDays || 0} onChange={e => setEditingRule({ ...editingRule!, holdDays: Number(e.target.value) })} /></div>
                <div><label className="text-sm font-medium">Display Order</label>
                  <Input type="number" value={editingRule?.displayOrder || 0} onChange={e => setEditingRule({ ...editingRule!, displayOrder: Number(e.target.value) })} /></div>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={editingRule?.isActive || false} onChange={e => setEditingRule({ ...editingRule!, isActive: e.target.checked })} /> Active
                </label>
                <Input placeholder="Description" value={editingRule?.description || ''} onChange={e => setEditingRule({ ...editingRule!, description: e.target.value })} className="flex-1" />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => { setEditingRule(null); setNewRule(false); }}><X className="w-4 h-4 mr-2" /> Cancel</Button>
                <Button onClick={() => saveRule(editingRule!)}><Save className="w-4 h-4 mr-2" /> Save Rule</Button>
              </div>
            </CardContent></Card>
          )}
          <div className="space-y-3">
            {rules.map(r => (
              <Card key={r._id} className="hover:shadow-md transition-shadow">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    <Badge variant={r.isActive ? 'default' : 'secondary'}>{r.isActive ? 'Active' : 'Inactive'}</Badge>
                    <div>
                      <p className="font-semibold text-secondary">{r.name}</p>
                      <p className="text-xs text-accent">{TRIGGER_LABELS[r.triggerEvent] || r.triggerEvent} · {r.pointsValue} pts · Cooldown: {r.cooldownPerUser} · Hold: {r.holdDays}d</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => setEditingRule(r)}><Edit className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteRule(r._id!)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {rules.length === 0 && <p className="text-center text-accent py-8">No earning rules created yet. Create your first rule above.</p>}
          </div>
        </div>
      )}

      {tab === 'stats' && stats && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card><CardContent className="pt-6"><p className="text-3xl font-bold text-secondary">{stats.summary.totalReferrals}</p><p className="text-sm text-accent">Total Referrals</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-3xl font-bold text-secondary">{stats.summary.referralsThisMonth}</p><p className="text-sm text-accent">This Month</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-3xl font-bold text-secondary">{stats.summary.totalPointsEarned.toLocaleString()}</p><p className="text-sm text-accent">Total Points</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-3xl font-bold text-secondary">₹{stats.summary.totalValueEarned.toLocaleString()}</p><p className="text-sm text-accent">Total Value</p></CardContent></Card>
          </div>
          <Card><CardHeader><CardTitle>Top Referrers</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead className="bg-gray-50"><tr><th className="text-left p-3 font-semibold">#</th><th className="text-left p-3 font-semibold">User</th><th className="text-right p-3 font-semibold">Referrals</th><th className="text-right p-3 font-semibold">Points</th></tr></thead>
                <tbody>
                  {stats.topReferrers.map((r: any, i: number) => (
                    <tr key={i} className="border-t border-gray-100"><td className="p-3 text-accent">{i + 1}</td><td className="p-3 font-medium">{r.name}</td><td className="p-3 text-right">{r.count}</td><td className="p-3 text-right font-mono">{r.points.toLocaleString()}</td></tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

const Bell = ({ className }: any) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;
