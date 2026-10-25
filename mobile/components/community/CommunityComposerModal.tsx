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
import { useCommunityStore, FeedPostType, Group } from '@/store/communityStore';

type Props = {
  visible: boolean;
  allowedTypes: FeedPostType[];
  groups: Group[];
  initialGroupId?: string | null;
  initialType?: FeedPostType;
  onClose: () => void;
  onCreated: () => void;
};

const TYPE_LABELS: Record<FeedPostType, string> = {
  discussion: 'Discussion',
  question: 'Question',
  mentor: 'Mentor Post',
};

export default function CommunityComposerModal({
  visible,
  allowedTypes,
  groups,
  initialGroupId,
  initialType,
  onClose,
  onCreated,
}: Props) {
  const { colors } = useTheme();
  const createPost = useCommunityStore((state) => state.createPost);
  const uploadMedia = useCommunityStore((state) => state.uploadMedia);

  const usableGroups = useMemo(() => {
    const byId = new Map<string, Group>();
    groups.forEach((group) => {
      if (group?._id) byId.set(group._id, group);
    });
    return [...byId.values()];
  }, [groups]);

  const [type, setType] = useState<FeedPostType>(initialType || allowedTypes[0] || 'discussion');
  const [groupId, setGroupId] = useState<string | null>(initialGroupId || usableGroups[0]?._id || null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;

    const nextType = initialType && allowedTypes.includes(initialType)
      ? initialType
      : allowedTypes[0] || 'discussion';
    const nextGroup = initialGroupId && usableGroups.some((group) => group._id === initialGroupId)
      ? initialGroupId
      : usableGroups[0]?._id || null;

    setType(nextType);
    setGroupId(nextGroup);
    setTitle('');
    setContent('');
    setImageUri(null);
    // Reset only when the composer is opened with its current props.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

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
      Alert.alert('Choose a community', 'Select where this post should go.');
      return;
    }
    if (type === 'question' && title.trim().length < 5) {
      Alert.alert('Title required', 'Add a question title of at least 5 characters.');
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
      undefined,
      {
        postType: type,
        title: type === 'question' ? title.trim() : undefined,
      }
    );
    setSaving(false);

    if (!success) {
      Alert.alert('Unable to publish', 'Please try again.');
      return;
    }

    onCreated();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Create Post</Text>
          <TouchableOpacity onPress={onClose} accessibilityLabel="Close">
            <Ionicons name="close" size={26} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {allowedTypes.length > 1 ? (
            <>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Post type</Text>
              <View style={styles.segment}>
                {allowedTypes.map((option) => {
                  const active = type === option;
                  return (
                    <TouchableOpacity
                      key={option}
                      style={[
                        styles.segmentButton,
                        { backgroundColor: active ? colors.primary : colors.surface },
                      ]}
                      onPress={() => setType(option)}
                    >
                      <Text style={[styles.segmentText, { color: active ? '#FFFFFF' : colors.textSecondary }]}>
                        {TYPE_LABELS[option]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          ) : null}

          <Text style={[styles.label, { color: colors.textSecondary }]}>Post to</Text>
          {usableGroups.length === 0 ? (
            <Text style={[styles.empty, { color: colors.textSecondary }]}>
              No community is available for this post.
            </Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.groupRow}>
              {usableGroups.map((group) => {
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

          {type === 'question' ? (
            <>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Question title</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="What do you need help with?"
                placeholderTextColor={colors.textSecondary}
                maxLength={200}
                style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
              />
            </>
          ) : null}

          <Text style={[styles.label, { color: colors.textSecondary }]}>
            {type === 'question' ? 'Details' : 'Message'}
          </Text>
          <TextInput
            value={content}
            onChangeText={setContent}
            placeholder={type === 'mentor' ? 'Share guidance with your members...' : 'Write something...'}
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
            style={[styles.publishButton, { backgroundColor: colors.primary }]}
            onPress={submit}
            disabled={saving || usableGroups.length === 0}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="send" size={16} color="#FFFFFF" />
                <Text style={styles.publishText}>Publish {TYPE_LABELS[type]}</Text>
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
  headerTitle: { fontSize: 19, fontWeight: '800' },
  content: { padding: 20, paddingBottom: 50 },
  label: { fontSize: 12, fontWeight: '700', marginBottom: 8, marginTop: 14 },
  segment: { flexDirection: 'row', gap: 6 },
  segmentButton: { flex: 1, alignItems: 'center', borderRadius: 9, paddingVertical: 9 },
  segmentText: { fontSize: 12, fontWeight: '700' },
  empty: { fontSize: 12, lineHeight: 18 },
  groupRow: { gap: 8, paddingBottom: 4 },
  groupChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 7,
    maxWidth: 220,
  },
  groupChipText: { fontSize: 11, fontWeight: '700', maxWidth: 175 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 14,
  },
  contentInput: {
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 140,
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
  publishButton: {
    marginTop: 24,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  publishText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});
