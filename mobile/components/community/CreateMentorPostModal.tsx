import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../hooks/useTheme';
import { useCommunityStore, Group } from '@/store/communityStore';

type Props = {
  visible: boolean;
  defaultGroupId?: string | null;
  onClose: () => void;
  onCreated: () => void;
};

export default function CreateMentorPostModal({ visible, defaultGroupId, onClose, onCreated }: Props) {
  const { colors } = useTheme();
  const mentorGroups = useCommunityStore((state) => state.mentorGroups);
  const ownedGroups = useCommunityStore((state) => state.ownedGroups);
  const createPost = useCommunityStore((state) => state.createPost);
  const uploadMedia = useCommunityStore((state) => state.uploadMedia);

  const [groupId, setGroupId] = useState<string | null>(defaultGroupId || null);
  const [content, setContent] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const groups = useMemo(() => {
    const byId = new Map<string, Group>();
    [...ownedGroups, ...mentorGroups].forEach((group) => {
      if (group?._id) byId.set(group._id, group);
    });
    return [...byId.values()];
  }, [mentorGroups, ownedGroups]);

  useEffect(() => {
    if (visible) {
      const selectedGroup = defaultGroupId && groups.some((group) => group._id === defaultGroupId)
        ? defaultGroupId
        : (groups[0]?._id || null);
      setGroupId(selectedGroup);
      setContent('');
      setImageUri(null);
    }
  }, [visible, defaultGroupId, groups]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Grant photo access to attach an image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setImageUri(result.assets[0].uri);
    }
  };

  const submit = async () => {
    if (!groupId) {
      Alert.alert('Choose a group', 'Select which group should receive this mentor post.');
      return;
    }
    if (!content.trim() && !imageUri) {
      Alert.alert('Add something', 'Write a message or attach an image.');
      return;
    }

    setSaving(true);
    let images: string[] | undefined;
    if (imageUri) {
      const uploaded = await uploadMedia(imageUri, 'image');
      if (!uploaded) {
        setSaving(false);
        Alert.alert('Upload failed', 'Could not upload the image. Please try again.');
        return;
      }
      images = [uploaded];
    }

    const success = await createPost(
      groupId,
      content.trim() || 'Shared an image',
      images,
      [],
      { postType: 'mentor' }
    );
    setSaving(false);

    if (!success) {
      Alert.alert('Unable to post', 'Please try again.');
      return;
    }

    onCreated();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.text }]}>New Mentor Post</Text>
          <TouchableOpacity onPress={onClose} accessibilityLabel="Close">
            <Ionicons name="close" size={26} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[styles.label, { color: colors.textSecondary }]}>Post to</Text>
          {groups.length === 0 ? (
            <Text style={[styles.empty, { color: colors.textSecondary }]}>
              You are not assigned to a group yet.
            </Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.groupRow}>
              {groups.map((group) => {
                const active = groupId === group._id;
                return (
                  <TouchableOpacity
                    key={group._id}
                    onPress={() => setGroupId(group._id)}
                    style={[
                      styles.groupChip,
                      { backgroundColor: active ? colors.primary : colors.surface, borderColor: colors.border },
                    ]}
                  >
                    <Ionicons
                      name={group.groupType === 'mentor' ? 'lock-closed-outline' : 'people-outline'}
                      size={13}
                      color={active ? '#FFFFFF' : colors.textSecondary}
                    />
                    <Text
                      style={[styles.groupChipText, { color: active ? '#FFFFFF' : colors.textSecondary }]}
                      numberOfLines={1}
                    >
                      {group.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          <Text style={[styles.label, { color: colors.textSecondary }]}>Message</Text>
          <TextInput
            value={content}
            onChangeText={setContent}
            placeholder="Share guidance with your members..."
            placeholderTextColor={colors.textSecondary}
            multiline
            style={[
              styles.contentInput,
              { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          />

          {imageUri ? (
            <View style={styles.previewWrap}>
              <Image source={{ uri: imageUri }} style={styles.preview} />
              <TouchableOpacity style={styles.removeImage} onPress={() => setImageUri(null)}>
                <Ionicons name="close" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.attachButton, { borderColor: colors.border }]}
            onPress={pickImage}
            activeOpacity={0.8}
          >
            <Ionicons name="image-outline" size={18} color={colors.primary} />
            <Text style={[styles.attachText, { color: colors.primary }]}>
              {imageUri ? 'Replace image' : 'Attach image'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            onPress={submit}
            disabled={saving || groups.length === 0}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="send" size={16} color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>Publish Mentor Post</Text>
              </>
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
  label: { fontSize: 12, fontWeight: '700', marginBottom: 8, marginTop: 14 },
  empty: { fontSize: 13, lineHeight: 19 },
  groupRow: { gap: 8, paddingBottom: 4 },
  groupChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: 220,
  },
  groupChipText: { fontSize: 12, fontWeight: '700', maxWidth: 180 },
  contentInput: {
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 150,
    padding: 14,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  previewWrap: { marginTop: 14, position: 'relative' },
  preview: { width: '100%', height: 190, borderRadius: 12 },
  removeImage: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachButton: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  attachText: { fontSize: 13, fontWeight: '700' },
  primaryButton: {
    marginTop: 24,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});
