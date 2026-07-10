import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AIMemoryItem } from '../store/aiAssistantStore';

type AIMemorySheetProps = {
  visible: boolean;
  loading: boolean;
  memoryItems: AIMemoryItem[];
  onClose: () => void;
  onDeleteItem: (memoryId: string) => Promise<boolean>;
  onClearAll: () => Promise<boolean>;
};

const prettyKey = (value: string) =>
  String(value || '')
    .split(/[_-]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

export default function AIMemorySheet({
  visible,
  loading,
  memoryItems,
  onClose,
  onDeleteItem,
  onClearAll,
}: AIMemorySheetProps) {
  const confirmDelete = (memoryId: string) => {
    Alert.alert(
      'Delete memory',
      'The assistant will forget this remembered detail.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void onDeleteItem(memoryId);
          },
        },
      ]
    );
  };

  const confirmClearAll = () => {
    Alert.alert(
      'Clear AI memory',
      'This will remove all remembered preferences and long-term context for the assistant.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear all',
          style: 'destructive',
          onPress: () => {
            void onClearAll();
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.dismissArea} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>AI Memory</Text>
              <Text style={styles.subtitle}>What the assistant remembers about the user</Text>
            </View>
            <TouchableOpacity style={styles.headerButton} onPress={onClose}>
              <Ionicons name="close" size={20} color="#111827" />
            </TouchableOpacity>
          </View>

          <View style={styles.tipCard}>
            <Ionicons name="shield-checkmark-outline" size={18} color="#F1842D" />
            <Text style={styles.tipText}>
              Only durable preferences and goals should be remembered here, and the user can remove them at any time.
            </Text>
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.secondaryButton, memoryItems.length === 0 && styles.secondaryButtonDisabled]}
              onPress={confirmClearAll}
              disabled={memoryItems.length === 0}
            >
              <Text style={styles.secondaryButtonText}>Clear All Memory</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color="#F1842D" />
            </View>
          ) : (
            <ScrollView
              style={styles.list}
              contentContainerStyle={memoryItems.length > 0 ? styles.listContent : styles.emptyContent}
              showsVerticalScrollIndicator={false}
            >
              {memoryItems.length === 0 ? (
                <View style={styles.emptyState}>
                  <View style={styles.emptyIcon}>
                    <Ionicons name="leaf-outline" size={26} color="#F1842D" />
                  </View>
                  <Text style={styles.emptyTitle}>No saved memory yet</Text>
                  <Text style={styles.emptySubtitle}>
                    As the assistant learns durable user preferences and goals, they will appear here.
                  </Text>
                </View>
              ) : (
                memoryItems.map((item) => (
                  <View key={item.id} style={styles.card}>
                    <View style={styles.cardTopRow}>
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{item.category}</Text>
                      </View>
                      <TouchableOpacity style={styles.deleteButton} onPress={() => confirmDelete(item.id)}>
                        <Ionicons name="trash-outline" size={16} color="#DC2626" />
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.cardTitle}>{prettyKey(item.key)}</Text>
                    <Text style={styles.cardValue}>{item.value}</Text>
                    <Text style={styles.cardMeta}>
                      Confidence {Math.round((item.confidence || 0) * 100)}%
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(35, 24, 15, 0.28)',
    justifyContent: 'flex-end',
  },
  dismissArea: {
    flex: 1,
  },
  sheet: {
    backgroundColor: '#F8F3EC',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    minHeight: '55%',
    maxHeight: '82%',
    paddingHorizontal: 16,
    paddingBottom: 18,
  },
  handle: {
    width: 48,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#D8C8B5',
    alignSelf: 'center',
    marginTop: 12,
  },
  header: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1F2937',
  },
  subtitle: {
    marginTop: 2,
    fontSize: 13,
    color: '#6B7280',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFDF9',
    borderWidth: 1,
    borderColor: '#EFE4D6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipCard: {
    marginTop: 16,
    padding: 14,
    borderRadius: 18,
    backgroundColor: '#FFF7EC',
    borderWidth: 1,
    borderColor: '#F3DEC5',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: '#7C4A23',
  },
  actionsRow: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  secondaryButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: '#FFFDF9',
    borderWidth: 1,
    borderColor: '#E7D8C9',
  },
  secondaryButtonDisabled: {
    opacity: 0.45,
  },
  secondaryButtonText: {
    color: '#7C4A23',
    fontSize: 14,
    fontWeight: '700',
  },
  loadingWrap: {
    flex: 1,
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    marginTop: 14,
  },
  listContent: {
    paddingBottom: 20,
    gap: 12,
  },
  emptyContent: {
    minHeight: 240,
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFF0E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#374151',
  },
  emptySubtitle: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    color: '#6B7280',
  },
  card: {
    backgroundColor: '#FFFDF9',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EFE3D5',
    padding: 14,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#FFF0E2',
  },
  badgeText: {
    color: '#A16207',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  deleteButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFE4D6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: '800',
    color: '#1F2937',
  },
  cardValue: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: '#4B5563',
  },
  cardMeta: {
    marginTop: 10,
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '600',
  },
});
