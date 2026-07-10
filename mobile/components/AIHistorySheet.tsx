import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AIConversationSummary } from '../store/aiAssistantStore';

type AIHistorySheetProps = {
  visible: boolean;
  activeConversationId: string;
  conversations: AIConversationSummary[];
  loading: boolean;
  onClose: () => void;
  onNewChat: () => void;
  onOpenConversation: (conversationId: string) => void;
  onRenameConversation: (conversationId: string, title: string) => Promise<boolean>;
  onDeleteConversation: (conversationId: string) => Promise<boolean>;
  onClearAll: () => Promise<boolean>;
};

const formatTime = (value: string) => {
  if (!value) {
    return 'Just now';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Recently';
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
};

export default function AIHistorySheet({
  visible,
  activeConversationId,
  conversations,
  loading,
  onClose,
  onNewChat,
  onOpenConversation,
  onRenameConversation,
  onDeleteConversation,
  onClearAll,
}: AIHistorySheetProps) {
  const [renameConversationId, setRenameConversationId] = useState('');
  const [draftTitle, setDraftTitle] = useState('');
  const hasConversations = useMemo(() => conversations.length > 0, [conversations.length]);

  const beginRename = (conversation: AIConversationSummary) => {
    setRenameConversationId(conversation.id);
    setDraftTitle(conversation.title);
  };

  const handleRenameSave = async () => {
    const nextTitle = draftTitle.trim();
    if (!renameConversationId || !nextTitle) {
      return;
    }

    const ok = await onRenameConversation(renameConversationId, nextTitle);
    if (ok) {
      setRenameConversationId('');
      setDraftTitle('');
    }
  };

  const confirmDelete = (conversationId: string) => {
    Alert.alert(
      'Delete chat',
      'This conversation will be removed from your chat history.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void onDeleteConversation(conversationId);
          },
        },
      ]
    );
  };

  const confirmClearAll = () => {
    Alert.alert(
      'Clear all chats',
      'This will remove all saved AI conversations for your account.',
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
              <Text style={styles.title}>Chat History</Text>
              <Text style={styles.subtitle}>Continue previous AI conversations</Text>
            </View>
            <TouchableOpacity style={styles.headerButton} onPress={onClose}>
              <Ionicons name="close" size={20} color="#111827" />
            </TouchableOpacity>
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.primaryButton} onPress={onNewChat}>
              <Ionicons name="add" size={16} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>New Chat</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryButton, !hasConversations && styles.secondaryButtonDisabled]}
              onPress={confirmClearAll}
              disabled={!hasConversations}
            >
              <Text style={styles.secondaryButtonText}>Clear All</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color="#F1842D" />
            </View>
          ) : (
            <ScrollView
              style={styles.list}
              contentContainerStyle={hasConversations ? styles.listContent : styles.emptyContent}
              showsVerticalScrollIndicator={false}
            >
              {!hasConversations ? (
                <View style={styles.emptyState}>
                  <View style={styles.emptyIcon}>
                    <Ionicons name="chatbubbles-outline" size={28} color="#F1842D" />
                  </View>
                  <Text style={styles.emptyTitle}>No saved chats yet</Text>
                  <Text style={styles.emptySubtitle}>Start a new conversation and it will appear here.</Text>
                </View>
              ) : (
                conversations.map((conversation) => {
                  const isActive = conversation.id === activeConversationId;
                  const isRenaming = renameConversationId === conversation.id;

                  return (
                    <View
                      key={conversation.id}
                      style={[styles.card, isActive && styles.cardActive]}
                    >
                      <TouchableOpacity
                        style={styles.cardPressable}
                        activeOpacity={0.85}
                        onPress={() => onOpenConversation(conversation.id)}
                      >
                        <View style={styles.cardTopRow}>
                          <View style={[styles.cardBadge, isActive && styles.cardBadgeActive]}>
                            <Ionicons
                              name={isActive ? 'sparkles' : 'time-outline'}
                              size={14}
                              color={isActive ? '#FFFFFF' : '#F1842D'}
                            />
                          </View>
                          <View style={styles.cardTextWrap}>
                            {isRenaming ? (
                              <TextInput
                                style={styles.renameInput}
                                value={draftTitle}
                                onChangeText={setDraftTitle}
                                placeholder="Rename chat"
                                placeholderTextColor="#9CA3AF"
                              />
                            ) : (
                              <Text style={styles.cardTitle} numberOfLines={1}>
                                {conversation.title}
                              </Text>
                            )}
                            <Text style={styles.cardMeta}>
                              {conversation.messageCount} messages
                              {conversation.lastScreenLabel ? ` · ${conversation.lastScreenLabel}` : ''}
                              {' · '}
                              {formatTime(conversation.lastMessageAt)}
                            </Text>
                          </View>
                        </View>
                        {conversation.summary ? (
                          <Text style={styles.cardSummary} numberOfLines={2}>
                            {conversation.summary}
                          </Text>
                        ) : null}
                      </TouchableOpacity>

                      <View style={styles.cardActions}>
                        {isRenaming ? (
                          <>
                            <TouchableOpacity style={styles.inlineAction} onPress={handleRenameSave}>
                              <Ionicons name="checkmark" size={16} color="#16A34A" />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.inlineAction}
                              onPress={() => {
                                setRenameConversationId('');
                                setDraftTitle('');
                              }}
                            >
                              <Ionicons name="close" size={16} color="#6B7280" />
                            </TouchableOpacity>
                          </>
                        ) : (
                          <>
                            <TouchableOpacity style={styles.inlineAction} onPress={() => beginRename(conversation)}>
                              <Ionicons name="pencil-outline" size={16} color="#6B7280" />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.inlineAction} onPress={() => confirmDelete(conversation.id)}>
                              <Ionicons name="trash-outline" size={16} color="#DC2626" />
                            </TouchableOpacity>
                          </>
                        )}
                      </View>
                    </View>
                  );
                })
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
    minHeight: '62%',
    maxHeight: '84%',
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
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 10,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: '#F1842D',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
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
    minHeight: 240,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    marginTop: 16,
  },
  listContent: {
    paddingBottom: 20,
    gap: 12,
  },
  emptyContent: {
    minHeight: 260,
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
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
  cardActive: {
    borderColor: '#F1842D',
    backgroundColor: '#FFF7F0',
  },
  cardPressable: {},
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  cardBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFF0E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  cardBadgeActive: {
    backgroundColor: '#F1842D',
  },
  cardTextWrap: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1F2937',
  },
  renameInput: {
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8DDCF',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    color: '#111827',
    fontSize: 14,
    fontWeight: '600',
  },
  cardMeta: {
    marginTop: 4,
    fontSize: 12,
    color: '#6B7280',
  },
  cardSummary: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 19,
    color: '#6B7280',
  },
  cardActions: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  inlineAction: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFE4D6',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
