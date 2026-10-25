import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { useCommunityStore, Group } from '@/store/communityStore';

type Props = {
  visible: boolean;
  onClose: () => void;
  onCreated: (group: Group) => void;
};

export default function CreateMentorGroupModal({ visible, onClose, onCreated }: Props) {
  const { colors } = useTheme();
  const createMentorGroup = useCommunityStore((state) => state.createMentorGroup);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setName('');
      setDescription('');
      setCoverImage('');
      setError(null);
    }
  }, [visible]);

  const submit = async () => {
    if (name.trim().length < 3) {
      setError('Group name must be at least 3 characters.');
      return;
    }
    setSaving(true);
    setError(null);
    const group = await createMentorGroup({
      name: name.trim(),
      description: description.trim(),
      coverImage: coverImage.trim() || null,
    });
    setSaving(false);
    if (!group) {
      setError('Unable to create the group. Please try again.');
      return;
    }
    onCreated(group);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.text }]}>Create Private Group</Text>
          <TouchableOpacity onPress={onClose} accessibilityLabel="Close">
            <Ionicons name="close" size={26} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={[styles.note, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}>
            <Ionicons name="lock-closed-outline" size={18} color={colors.primary} />
            <Text style={[styles.noteText, { color: colors.textSecondary }]}>
              This group is private. Only you and the people or communities you add can see it.
            </Text>
          </View>

          <Text style={[styles.label, { color: colors.textSecondary }]}>Group name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Sleep Reset Circle"
            placeholderTextColor={colors.textSecondary}
            maxLength={80}
            style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
          />

          <Text style={[styles.label, { color: colors.textSecondary }]}>Description</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="What is this group for?"
            placeholderTextColor={colors.textSecondary}
            maxLength={500}
            multiline
            style={[
              styles.input,
              styles.multiline,
              { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          />

          <Text style={[styles.label, { color: colors.textSecondary }]}>Cover image URL (optional)</Text>
          <TextInput
            value={coverImage}
            onChangeText={setCoverImage}
            placeholder="https://..."
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            keyboardType="url"
            style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            onPress={submit}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Create Group</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  title: { fontSize: 19, fontWeight: '800' },
  content: { padding: 20, paddingBottom: 50 },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  noteText: { flex: 1, fontSize: 12, lineHeight: 18 },
  label: { fontSize: 12, fontWeight: '700', marginBottom: 8, marginTop: 14 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  multiline: { minHeight: 100, textAlignVertical: 'top' },
  error: { color: '#DC2626', fontSize: 12, marginTop: 14 },
  primaryButton: {
    marginTop: 24,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});
