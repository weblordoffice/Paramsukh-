import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

import apiClient from '../../utils/apiClient';
import { useTheme } from '../../hooks/useTheme';

type GoalStatus = 'active' | 'completed' | 'paused';
type GoalFilter = 'active' | 'completed' | 'all';

type WellnessGoal = {
  _id: string;
  title: string;
  description?: string;
  category: string;
  targetValue: number;
  currentValue: number;
  unit?: string;
  startDate: string;
  targetDate?: string | null;
  status: GoalStatus;
  completedAt?: string | null;
  progressPercent: number;
  daysRemaining?: number | null;
  isOverdue?: boolean;
};

const CATEGORIES = [
  { value: 'physical', label: 'Physical', icon: 'barbell-outline', color: '#10B981' },
  { value: 'mental', label: 'Mental', icon: 'brain-outline', color: '#6366F1' },
  { value: 'emotional', label: 'Emotional', icon: 'heart-outline', color: '#EC4899' },
  { value: 'spiritual', label: 'Spiritual', icon: 'sparkles-outline', color: '#F59E0B' },
  { value: 'financial', label: 'Financial', icon: 'cash-outline', color: '#22C55E' },
  { value: 'relationship', label: 'Relationship', icon: 'people-outline', color: '#F97316' },
  { value: 'lifestyle', label: 'Lifestyle', icon: 'leaf-outline', color: '#14B8A6' },
  { value: 'other', label: 'Other', icon: 'ellipsis-horizontal-circle-outline', color: '#8B5CF6' },
] as const;

const emptyForm = {
  title: '',
  description: '',
  category: 'physical',
  targetValue: '',
  currentValue: '0',
  unit: '',
  targetDate: null as Date | null,
  status: 'active' as GoalStatus,
};

export default function WellnessGoalsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [goals, setGoals] = useState<WellnessGoal[]>([]);
  const [filter, setFilter] = useState<GoalFilter>('active');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<WellnessGoal | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const loadGoals = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const response = await apiClient.get('/wellness-goals');
      setGoals(response.data?.goals || []);
    } catch (error: any) {
      Alert.alert('Unable to load goals', error.response?.data?.message || 'Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    loadGoals();
  }, [loadGoals]));

  const visibleGoals = useMemo(() => {
    if (filter === 'all') return goals;
    return goals.filter((goal) => goal.status === filter);
  }, [filter, goals]);

  const activeCount = goals.filter((goal) => goal.status === 'active').length;
  const completedCount = goals.filter((goal) => goal.status === 'completed').length;
  const averageProgress = goals.length > 0
    ? Math.round(goals.reduce((sum, goal) => sum + goal.progressPercent, 0) / goals.length)
    : 0;

  const s = useMemo(() => StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surfaceSecondary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
    content: { padding: 20, paddingBottom: 40 },
    summary: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      marginBottom: 16,
    },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
    summaryValue: { fontSize: 22, fontWeight: '800', color: colors.primary },
    summaryLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
    summaryTrack: {
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.surfaceSecondary,
      overflow: 'hidden',
      marginTop: 12,
    },
    summaryFill: { height: '100%', borderRadius: 4, backgroundColor: colors.primary },
    tabs: {
      flexDirection: 'row',
      backgroundColor: colors.surfaceSecondary,
      borderRadius: 12,
      padding: 4,
      marginBottom: 16,
    },
    tab: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 9 },
    tabActive: { backgroundColor: colors.surface },
    tabText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
    tabTextActive: { color: colors.primary },
    goalCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      marginBottom: 12,
    },
    goalHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    goalIcon: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
    },
    goalInfo: { flex: 1 },
    goalTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
    goalMeta: { fontSize: 11, color: colors.textSecondary, marginTop: 3 },
    goalPercent: { fontSize: 16, fontWeight: '800', color: colors.primary },
    progressTrack: {
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.surfaceSecondary,
      overflow: 'hidden',
      marginTop: 10,
    },
    progressFill: { height: '100%', borderRadius: 4, backgroundColor: colors.primary },
    goalFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 12,
      gap: 8,
    },
    goalNumbers: { fontSize: 12, color: colors.textSecondary, flex: 1 },
    actions: { flexDirection: 'row', gap: 8 },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 9,
      backgroundColor: colors.surfaceSecondary,
    },
    actionText: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
    primaryAction: { backgroundColor: colors.primary },
    primaryActionText: { color: '#FFFFFF' },
    overdue: { fontSize: 10, fontWeight: '800', color: '#EF4444', marginTop: 6 },
    empty: { paddingVertical: 60, alignItems: 'center' },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 12 },
    emptyText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 6, paddingHorizontal: 20 },
    loading: { paddingVertical: 80, alignItems: 'center' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    modalSheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 20,
      paddingBottom: 34,
      maxHeight: '92%',
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    modalTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
    label: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 6,
      marginTop: 12,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 14,
      color: colors.text,
      backgroundColor: colors.surfaceSecondary,
    },
    textArea: { minHeight: 90, textAlignVertical: 'top' },
    row: { flexDirection: 'row', gap: 10 },
    half: { flex: 1 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 11,
      paddingVertical: 7,
      borderRadius: 14,
      backgroundColor: colors.surfaceSecondary,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    chipActive: { borderColor: colors.primary, backgroundColor: colors.primary + '12' },
    chipText: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
    chipTextActive: { color: colors.primary },
    dateButton: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: colors.surfaceSecondary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    dateText: { fontSize: 14, color: colors.text },
    statusRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
    statusChip: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 9,
      borderRadius: 10,
      backgroundColor: colors.surfaceSecondary,
    },
    statusChipActive: { backgroundColor: colors.primary },
    statusText: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
    statusTextActive: { color: '#FFFFFF' },
    submitButton: {
      marginTop: 20,
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
    },
    submitDisabled: { opacity: 0.6 },
    submitText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  }), [colors]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowDatePicker(false);
    setShowModal(true);
  };

  const openEdit = (goal: WellnessGoal) => {
    setEditing(goal);
    setForm({
      title: goal.title,
      description: goal.description || '',
      category: goal.category,
      targetValue: String(goal.targetValue),
      currentValue: String(goal.currentValue),
      unit: goal.unit || '',
      targetDate: goal.targetDate ? new Date(goal.targetDate) : null,
      status: goal.status,
    });
    setShowDatePicker(false);
    setShowModal(true);
  };

  const handleDateChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS !== 'ios') setShowDatePicker(false);
    if (event.type === 'set' && date) setForm((prev) => ({ ...prev, targetDate: date }));
    if (event.type === 'dismissed') setShowDatePicker(false);
  };

  const saveGoal = async () => {
    if (form.title.trim().length < 3) {
      Alert.alert('Title Required', 'Goal title must be at least 3 characters.');
      return;
    }
    if (!Number(form.targetValue) || Number(form.targetValue) <= 0) {
      Alert.alert('Target Required', 'Target value must be greater than 0.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        targetValue: Number(form.targetValue),
        currentValue: Number(form.currentValue) || 0,
        unit: form.unit.trim(),
        targetDate: form.targetDate ? form.targetDate.toISOString() : null,
        status: form.status,
      };

      if (editing) {
        await apiClient.patch(`/wellness-goals/${editing._id}`, payload);
      } else {
        await apiClient.post('/wellness-goals', payload);
      }

      setShowModal(false);
      setEditing(null);
      setForm(emptyForm);
      await loadGoals();
    } catch (error: any) {
      Alert.alert('Unable to save goal', error.response?.data?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const incrementGoal = async (goal: WellnessGoal) => {
    setPendingId(goal._id);
    try {
      await apiClient.patch(`/wellness-goals/${goal._id}/progress`, {
        currentValue: Number(goal.currentValue) + 1,
      });
      await loadGoals();
    } catch (error: any) {
      Alert.alert('Unable to update goal', error.response?.data?.message || 'Please try again.');
    } finally {
      setPendingId(null);
    }
  };

  const deleteGoal = (goal: WellnessGoal) => {
    Alert.alert('Delete Goal', `Delete "${goal.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setPendingId(goal._id);
          try {
            await apiClient.delete(`/wellness-goals/${goal._id}`);
            await loadGoals();
          } catch (error: any) {
            Alert.alert('Unable to delete goal', error.response?.data?.message || 'Please try again.');
          } finally {
            setPendingId(null);
          }
        },
      },
    ]);
  };

  const formatDate = (value?: string | Date | null) => {
    if (!value) return 'No deadline';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'No deadline';
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const getCategory = (value: string) => CATEGORIES.find((item) => item.value === value) || CATEGORIES[7];

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity style={s.headerBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Wellness Goals</Text>
        <TouchableOpacity style={s.headerBtn} onPress={openCreate}>
          <Ionicons name="add" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadGoals(true)} tintColor={colors.primary} />
        }
      >
        <View style={s.summary}>
          <View style={s.summaryRow}>
            <View>
              <Text style={s.summaryValue}>{activeCount}</Text>
              <Text style={s.summaryLabel}>Active goals</Text>
            </View>
            <View>
              <Text style={s.summaryValue}>{completedCount}</Text>
              <Text style={s.summaryLabel}>Completed</Text>
            </View>
            <View>
              <Text style={s.summaryValue}>{averageProgress}%</Text>
              <Text style={s.summaryLabel}>Average progress</Text>
            </View>
          </View>
          <View style={s.summaryTrack}>
            <View style={[s.summaryFill, { width: `${averageProgress}%` }]} />
          </View>
        </View>

        <View style={s.tabs}>
          {(['active', 'completed', 'all'] as GoalFilter[]).map((value) => (
            <TouchableOpacity
              key={value}
              style={[s.tab, filter === value && s.tabActive]}
              onPress={() => setFilter(value)}
            >
              <Text style={[s.tabText, filter === value && s.tabTextActive]}>
                {value === 'all' ? 'All' : value.charAt(0).toUpperCase() + value.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <View style={s.loading}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : visibleGoals.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="flag-outline" size={48} color={colors.textSecondary} />
            <Text style={s.emptyTitle}>No {filter === 'all' ? '' : filter} goals</Text>
            <Text style={s.emptyText}>
              Create a measurable goal to track your progress and earn wellness badges.
            </Text>
          </View>
        ) : (
          visibleGoals.map((goal) => {
            const category = getCategory(goal.category);
            return (
              <View key={goal._id} style={s.goalCard}>
                <View style={s.goalHeader}>
                  <View style={[s.goalIcon, { backgroundColor: category.color + '18' }]}>
                    <Ionicons name={category.icon as any} size={19} color={category.color} />
                  </View>
                  <View style={s.goalInfo}>
                    <Text style={s.goalTitle}>{goal.title}</Text>
                    <Text style={s.goalMeta}>
                      {category.label} · {goal.status}
                      {goal.targetDate ? ` · Due ${formatDate(goal.targetDate)}` : ''}
                    </Text>
                    {goal.isOverdue && <Text style={s.overdue}>Overdue</Text>}
                  </View>
                  <Text style={s.goalPercent}>{goal.progressPercent}%</Text>
                </View>

                <View style={s.progressTrack}>
                  <View style={[s.progressFill, { width: `${goal.progressPercent}%`, backgroundColor: category.color }]} />
                </View>

                <View style={s.goalFooter}>
                  <Text style={s.goalNumbers}>
                    {goal.currentValue}/{goal.targetValue} {goal.unit || ''}
                  </Text>
                  <View style={s.actions}>
                    {goal.status === 'active' && (
                      <TouchableOpacity
                        style={[s.actionBtn, s.primaryAction]}
                        onPress={() => incrementGoal(goal)}
                        disabled={pendingId === goal._id}
                      >
                        <Ionicons name="add" size={14} color="#FFFFFF" />
                        <Text style={[s.actionText, s.primaryActionText]}>1</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={s.actionBtn} onPress={() => openEdit(goal)}>
                      <Ionicons name="create-outline" size={14} color={colors.textSecondary} />
                      <Text style={s.actionText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.actionBtn} onPress={() => deleteGoal(goal)}>
                      <Ionicons name="trash-outline" size={14} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <KeyboardAvoidingView
          style={s.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowModal(false)} />
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{editing ? 'Edit Goal' : 'New Wellness Goal'}</Text>
              <TouchableOpacity onPress={() => setShowModal(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={s.label}>Goal title</Text>
              <TextInput
                style={s.input}
                value={form.title}
                onChangeText={(value) => setForm((prev) => ({ ...prev, title: value }))}
                placeholder="e.g. Meditate for 30 days"
                placeholderTextColor={colors.textSecondary}
                maxLength={160}
              />

              <Text style={s.label}>Description</Text>
              <TextInput
                style={[s.input, s.textArea]}
                value={form.description}
                onChangeText={(value) => setForm((prev) => ({ ...prev, description: value }))}
                placeholder="Why does this goal matter to you?"
                placeholderTextColor={colors.textSecondary}
                multiline
                maxLength={2000}
              />

              <Text style={s.label}>Category</Text>
              <View style={s.chips}>
                {CATEGORIES.map((category) => {
                  const active = form.category === category.value;
                  return (
                    <TouchableOpacity
                      key={category.value}
                      style={[s.chip, active && s.chipActive]}
                      onPress={() => setForm((prev) => ({ ...prev, category: category.value }))}
                    >
                      <Ionicons name={category.icon as any} size={13} color={active ? colors.primary : colors.textSecondary} />
                      <Text style={[s.chipText, active && s.chipTextActive]}>{category.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={s.row}>
                <View style={s.half}>
                  <Text style={s.label}>Target</Text>
                  <TextInput
                    style={s.input}
                    value={form.targetValue}
                    onChangeText={(value) => setForm((prev) => ({ ...prev, targetValue: value.replace(/[^0-9.]/g, '') }))}
                    placeholder="30"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={s.half}>
                  <Text style={s.label}>Current</Text>
                  <TextInput
                    style={s.input}
                    value={form.currentValue}
                    onChangeText={(value) => setForm((prev) => ({ ...prev, currentValue: value.replace(/[^0-9.]/g, '') }))}
                    placeholder="0"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              <Text style={s.label}>Unit</Text>
              <TextInput
                style={s.input}
                value={form.unit}
                onChangeText={(value) => setForm((prev) => ({ ...prev, unit: value }))}
                placeholder="days, sessions, kg, pages..."
                placeholderTextColor={colors.textSecondary}
                maxLength={40}
              />

              <Text style={s.label}>Target date</Text>
              <TouchableOpacity style={s.dateButton} onPress={() => setShowDatePicker(true)}>
                <Text style={s.dateText}>{form.targetDate ? formatDate(form.targetDate) : 'No deadline'}</Text>
                <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
              {form.targetDate && (
                <TouchableOpacity onPress={() => setForm((prev) => ({ ...prev, targetDate: null }))}>
                  <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 6 }}>Clear deadline</Text>
                </TouchableOpacity>
              )}
              {showDatePicker && (
                <>
                  <DateTimePicker
                    value={form.targetDate || new Date()}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    minimumDate={new Date()}
                    onChange={handleDateChange}
                  />
                  {Platform.OS === 'ios' && (
                    <TouchableOpacity
                      onPress={() => setShowDatePicker(false)}
                      style={{ alignSelf: 'flex-end', paddingVertical: 6, paddingHorizontal: 4 }}
                    >
                      <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 12 }}>Done</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}

              {editing && (
                <>
                  <Text style={s.label}>Status</Text>
                  <View style={s.statusRow}>
                    {(['active', 'completed', 'paused'] as GoalStatus[]).map((status) => (
                      <TouchableOpacity
                        key={status}
                        style={[s.statusChip, form.status === status && s.statusChipActive]}
                        onPress={() => setForm((prev) => ({ ...prev, status }))}
                      >
                        <Text style={[s.statusText, form.status === status && s.statusTextActive]}>
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              <TouchableOpacity
                style={[s.submitButton, saving && s.submitDisabled]}
                onPress={saveGoal}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={s.submitText}>{editing ? 'Save Changes' : 'Create Goal'}</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
