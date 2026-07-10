import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import apiClient from '../utils/apiClient';

const STORAGE_KEY = 'ai_assistant_state_v2';
const MAX_MESSAGES = 80;

export type AIChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: string;
  toolLabels?: string[];
  presentation?: AIToolPresentation | null;
  narrative?: AIResponseNarrative | null;
  actionStatus?: string | null;
};

export type AIResponseNarrative = {
  intro?: string | null;
  outro?: string | null;
};

export type AIToolPresentationRow = {
  label: string;
  value: string;
};

export type AIToolPresentationSection = {
  kind:
    | 'course_list'
    | 'event_list'
    | 'comparison_card'
    | 'registration_list'
    | 'membership_list'
    | 'podcast_list'
    | 'support_list'
    | 'progress_card'
    | 'status_card'
    | 'action_status'
    | 'payment_card'
    | 'counseling_list'
    | 'product_list'
    | 'address_list'
    | 'order_list'
    | 'address_form'
    | 'order_summary'
    | 'order_confirmed'
    | 'payment_link_card'
    | 'group_list'
    | 'post_list'
    | 'comment_list';
  title: string;
  items?: any[];
  rows?: AIToolPresentationRow[];
  progress?: number;
  status?: string | null;
  message?: string | null;
  paymentUrl?: string | null;
  paymentRequired?: boolean;
  tone?: 'orange' | 'green' | 'neutral' | 'blue' | 'red' | null;
  icon?: string | null;
  animation?: 'payment' | 'success' | 'pending' | 'settled' | null;
  ctaLabel?: string | null;
  ctaType?:
    | 'event_payment'
    | 'membership_payment'
    | 'navigate_membership'
    | 'course_playback'
    | 'booking_payment'
    | 'podcast_playback'
    | 'select_address'
    | 'confirm_order'
    | 'confirm_order_cancellation'
    | 'open_payment_link'
    | 'cancel_order'
    | 'view_posts'
    | 'like_post'
    | 'view_comments'
    | 'confirm_community_post'
    | 'confirm_post_comment'
    | 'confirm_comment_reply'
    | null;
  ctaPayload?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
  quantity?: number | null;
  product_name?: string | null;
  price?: number | null;
  recommendedId?: string | null;
  recommendedTitle?: string | null;
  comparisonMode?: 'event' | 'course' | null;
  slots?: string[];
};

export type AIToolPresentation = {
  version: number;
  sections: AIToolPresentationSection[];
};

export type AIConversationSummary = {
  id: string;
  title: string;
  status: string;
  lastMessageAt: string;
  lastScreenLabel: string | null;
  summary: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
};

export type AIMemoryItem = {
  id: string;
  category: string;
  key: string;
  value: string;
  confidence: number;
  isActive: boolean;
  sourceConversationId: string | null;
  sourceMessageId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AIWidgetPosition = {
  side: 'left' | 'right';
  offsetY: number;
};

type PersistedAssistantState = {
  ownerUserId: string | null;
  sessionId: string;
  messages: AIChatMessage[];
  widgetPosition: AIWidgetPosition;
};

type AIAssistantState = PersistedAssistantState & {
  hydrated: boolean;
  conversations: AIConversationSummary[];
  memoryItems: AIMemoryItem[];
  conversationsLoading: boolean;
  memoryLoading: boolean;
  activeConversationLoading: boolean;
  hydrate: (userId?: string | null) => Promise<void>;
  appendMessage: (
    role: AIChatMessage['role'],
    text: string,
    options?: { id?: string; toolLabels?: string[]; presentation?: AIToolPresentation | null; narrative?: AIResponseNarrative | null; actionStatus?: string | null }
  ) => Promise<string>;
  updateMessage: (
    messageId: string,
    updateFn: (msg: AIChatMessage) => AIChatMessage
  ) => void;
  clearHistory: () => Promise<void>;
  replaceMessages: (messages: AIChatMessage[]) => Promise<void>;
  setWidgetPosition: (position: AIWidgetPosition) => Promise<void>;
  setSessionId: (sessionId: string | null) => Promise<void>;
  fetchConversations: () => Promise<void>;
  loadConversation: (conversationId: string) => Promise<void>;
  startNewChat: () => Promise<void>;
  renameConversation: (conversationId: string, title: string) => Promise<boolean>;
  deleteConversation: (conversationId: string) => Promise<boolean>;
  clearAllConversations: () => Promise<boolean>;
  fetchMemoryItems: () => Promise<void>;
  deleteMemoryItem: (memoryId: string) => Promise<boolean>;
  clearAllMemory: () => Promise<boolean>;
  resetSession: () => Promise<void>;
};

const createWelcomeMessage = (): AIChatMessage => ({
  id: 'welcome-message',
  role: 'assistant',
  text: 'Ask me about courses, memberships, podcasts, events, or your learning progress.',
  createdAt: new Date().toISOString(),
});

const ensureMessages = (messages?: AIChatMessage[]) => {
  if (!messages || messages.length === 0) {
    return [createWelcomeMessage()];
  }

  return messages.slice(-MAX_MESSAGES);
};

const mapServerMessage = (message: any): AIChatMessage | null => {
  const text = String(message?.content || '').trim();
  const role = message?.role === 'user' ? 'user' : message?.role === 'assistant' ? 'assistant' : null;

  if (!text || !role) {
    return null;
  }

  return {
    id: String(message.id || `${role}-${Date.now()}`),
    role,
    text,
    createdAt: message.createdAt || new Date().toISOString(),
    presentation:
      message?.metadata?.toolPresentation &&
      Array.isArray(message.metadata.toolPresentation.sections)
        ? message.metadata.toolPresentation
        : null,
    narrative:
      message?.metadata?.responseNarrative &&
      typeof message.metadata.responseNarrative === 'object'
        ? message.metadata.responseNarrative
        : null,
  };
};

const createInitialState = (userId?: string | null): PersistedAssistantState => ({
  ownerUserId: userId ?? null,
  sessionId: '',
  messages: [createWelcomeMessage()],
  widgetPosition: {
    side: 'right',
    offsetY: 420,
  },
});

async function persistState(state: PersistedAssistantState) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

const persistCurrentState = async (get: () => AIAssistantState, overrides: Partial<PersistedAssistantState> = {}) => {
  const state = get();
  await persistState({
    ownerUserId: overrides.ownerUserId ?? state.ownerUserId,
    sessionId: overrides.sessionId ?? state.sessionId,
    messages: overrides.messages ?? state.messages,
    widgetPosition: overrides.widgetPosition ?? state.widgetPosition,
  });
};

export const useAIAssistantStore = create<AIAssistantState>((set, get) => ({
  ...createInitialState(),
  hydrated: false,
  conversations: [],
  memoryItems: [],
  conversationsLoading: false,
  memoryLoading: false,
  activeConversationLoading: false,

  hydrate: async (userId) => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const fallback = createInitialState(userId);

      if (!raw) {
        set({ ...fallback, hydrated: true });
        await persistState(fallback);
        return;
      }

      const parsed = JSON.parse(raw) as Partial<PersistedAssistantState> | null;
      if (!parsed || parsed.ownerUserId !== (userId ?? null)) {
        set({ ...fallback, hydrated: true });
        await persistState(fallback);
        return;
      }

      const nextState: PersistedAssistantState = {
        ownerUserId: parsed.ownerUserId ?? null,
        sessionId: parsed.sessionId || '',
        messages: ensureMessages(parsed.messages),
        widgetPosition: {
          side: parsed.widgetPosition?.side === 'left' ? 'left' : 'right',
          offsetY: typeof parsed.widgetPosition?.offsetY === 'number' ? parsed.widgetPosition.offsetY : 420,
        },
      };

      set({ ...nextState, hydrated: true });
    } catch {
      const fallback = createInitialState(userId);
      set({ ...fallback, hydrated: true });
      await persistState(fallback);
    }
  },

  appendMessage: async (role, text, options) => {
    const trimmed = text.trim();
    if (!trimmed && role === 'user') {
      return '';
    }

    const messageId = options?.id || `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const nextMessages = ensureMessages([
      ...get().messages,
      {
        id: messageId,
        role,
        text: trimmed,
        createdAt: new Date().toISOString(),
        toolLabels:
          role === 'assistant' && Array.isArray(options?.toolLabels) && options.toolLabels.length > 0
            ? options.toolLabels
            : undefined,
        presentation: role === 'assistant' ? options?.presentation || null : null,
        narrative: role === 'assistant' ? options?.narrative || null : null,
        actionStatus: options?.actionStatus || null,
      } as any,
    ]);

    set({ messages: nextMessages });
    await persistCurrentState(get, { messages: nextMessages });
    return messageId;
  },

  updateMessage: (messageId, updateFn) => {
    set((state) => {
      const nextMessages = state.messages.map((msg) =>
        msg.id === messageId ? updateFn(msg) : msg
      );
      return { messages: nextMessages };
    });
  },

  clearHistory: async () => {
    const nextState = {
      messages: [createWelcomeMessage()],
      sessionId: '',
    };

    set(nextState);
    await persistCurrentState(get, nextState);
  },

  replaceMessages: async (messages) => {
    const nextMessages = ensureMessages(messages);
    set({ messages: nextMessages });
    await persistCurrentState(get, { messages: nextMessages });
  },

  setWidgetPosition: async (position) => {
    set({ widgetPosition: position });
    await persistCurrentState(get, { widgetPosition: position });
  },

  setSessionId: async (sessionId) => {
    const nextSessionId = String(sessionId || '').trim();
    set({ sessionId: nextSessionId });
    await persistCurrentState(get, { sessionId: nextSessionId });
  },

  fetchConversations: async () => {
    set({ conversationsLoading: true });
    try {
      const response = await apiClient.get('/chat/conversations');
      const conversations = Array.isArray(response.data?.data) ? response.data.data : [];
      set({ conversations });
    } catch {
      set({ conversations: [] });
    } finally {
      set({ conversationsLoading: false });
    }
  },

  loadConversation: async (conversationId) => {
    const normalizedId = String(conversationId || '').trim();
    if (!normalizedId) {
      return;
    }

    set({ activeConversationLoading: true });
    try {
      const response = await apiClient.get(`/chat/conversations/${normalizedId}`);
      const serverMessages = Array.isArray(response.data?.data?.messages)
        ? response.data.data.messages
        : [];
      const nextMessages = ensureMessages(
        serverMessages
          .map(mapServerMessage)
          .filter(Boolean) as AIChatMessage[]
      );

      set({
        sessionId: normalizedId,
        messages: nextMessages,
      });
      await persistCurrentState(get, {
        sessionId: normalizedId,
        messages: nextMessages,
      });
    } catch {
      // Keep current state if conversation load fails.
    } finally {
      set({ activeConversationLoading: false });
    }
  },

  startNewChat: async () => {
    const nextMessages = [createWelcomeMessage()];
    set({
      sessionId: '',
      messages: nextMessages,
    });
    await persistCurrentState(get, {
      sessionId: '',
      messages: nextMessages,
    });
  },

  renameConversation: async (conversationId, title) => {
    const nextTitle = String(title || '').trim();
    if (!conversationId || !nextTitle) {
      return false;
    }

    try {
      const response = await apiClient.patch(`/chat/conversations/${conversationId}`, {
        title: nextTitle,
      });

      const updated = response.data?.data;
      if (!updated?.id) {
        return false;
      }

      set((state) => ({
        conversations: state.conversations.map((item) =>
          item.id === updated.id ? { ...item, ...updated } : item
        ),
      }));
      return true;
    } catch {
      return false;
    }
  },

  deleteConversation: async (conversationId) => {
    if (!conversationId) {
      return false;
    }

    try {
      await apiClient.delete(`/chat/conversations/${conversationId}`);
      set((state) => ({
        conversations: state.conversations.filter((item) => item.id !== conversationId),
      }));

      if (get().sessionId === conversationId) {
        await get().startNewChat();
      }

      return true;
    } catch {
      return false;
    }
  },

  clearAllConversations: async () => {
    try {
      await apiClient.post('/chat/conversations/clear-all');
      set({ conversations: [] });
      await get().startNewChat();
      return true;
    } catch {
      return false;
    }
  },

  fetchMemoryItems: async () => {
    set({ memoryLoading: true });
    try {
      const response = await apiClient.get('/chat/memory');
      const memoryItems = Array.isArray(response.data?.data) ? response.data.data : [];
      set({ memoryItems });
    } catch {
      set({ memoryItems: [] });
    } finally {
      set({ memoryLoading: false });
    }
  },

  deleteMemoryItem: async (memoryId) => {
    if (!memoryId) {
      return false;
    }

    try {
      await apiClient.delete(`/chat/memory/${memoryId}`);
      set((state) => ({
        memoryItems: state.memoryItems.filter((item) => item.id !== memoryId),
      }));
      return true;
    } catch {
      return false;
    }
  },

  clearAllMemory: async () => {
    try {
      await apiClient.post('/chat/memory/clear');
      set({ memoryItems: [] });
      return true;
    } catch {
      return false;
    }
  },

  resetSession: async () => {
    const nextState = createInitialState(get().ownerUserId);
    set(nextState);
    await persistState(nextState);
  },
}));
