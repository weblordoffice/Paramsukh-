import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

import AIToolPresentation from './AIToolPresentation';
import AIChatHome from './AIChatHome';
import AIHistorySheet from './AIHistorySheet';
import AIMemorySheet from './AIMemorySheet';
import { AIToolPresentationSection, useAIAssistantStore } from '../store/aiAssistantStore';
import { useAuthStore } from '../store/authStore';
import apiClient from '../utils/apiClient';
import { AIScreenContext } from '../utils/aiScreenContext';
import EventSource from 'react-native-sse';
import { getTokenSecurely } from '../utils/biometricAuth';
import { API_URL } from '../config/api';

type AIChatPanelProps = {
  title?: string;
  subtitle?: string;
  onClose?: () => void;
  compact?: boolean;
  context?: AIScreenContext;
};

const getThinkingStages = (message: string, context?: AIScreenContext) => {
  const normalized = message.toLowerCase();

  const coursePool = [
    'Analyzing your learning curriculum...',
    'Looking up your lesson history...',
    'Mapping out your course milestones...',
    'Pinpointing the perfect lesson for you...',
    'Retrieving available meditation paths...',
    'Reviewing your course progression...',
    'Synthesizing course catalog recommendations...',
  ];
  const eventPool = [
    'Fetching upcoming spiritual events...',
    'Checking dates and venues...',
    'Verifying event availability...',
    'Reviewing your registered events...',
    'Looking up nearby meditation sessions...',
    'Checking registration details...',
    'Gathering event coordinators\' updates...',
  ];
  const membershipPool = [
    'Analyzing subscription options...',
    'Checking active membership tier...',
    'Retrieving public discount pricing...',
    'Comparing plan benefits...',
    'Evaluating membership access perks...',
    'Verifying your plan validity...',
  ];
  const supportPool = [
    'Accessing user support channel...',
    'Retrieving your ticket status...',
    'Reviewing active support queries...',
    'Consulting ParamSukh documentation...',
    'Analyzing error logs and context...',
  ];
  const counselorPool = [
    'Dialling into the counselor calendar...',
    'Checking available session slots...',
    'Reviewing counselor schedule...',
    'Fetching open booking times...',
    'Confirming availability with the counselor...',
  ];
  const wellnessPool = [
    'Consulting spiritual guidance texts...',
    'Drawing your daily affirmation...',
    'Aligning cosmic charts for horoscope...',
    'Retrieving daily wisdom quote...',
    'Preparing spiritual wellness insights...',
  ];
  const shopPool = [
    'Scanning product catalog indexes...',
    'Analyzing product specifications and details...',
    'Checking product pricing and stock status...',
    'Retrieving shop collection listings...',
    'Filtering products based on your preferences...',
  ];
  const defaultPool = [
    'Pondering your query...',
    'Connecting to ParamSukh databases...',
    'Analyzing context and intent...',
    'Synthesizing a clear answer...',
    'Formulating the best guidance...',
    'Gathering helpful insights...',
  ];

  let selectedPool = defaultPool;
  if (
    (normalized.includes('availab') && (normalized.includes('counsel') || normalized.includes('therapist') || normalized.includes('session') || normalized.includes('booking') || normalized.includes('slot'))) ||
    normalized.includes('slot') ||
    normalized.includes('counsel') ||
    normalized.includes('therapist') ||
    normalized.includes('book a session') ||
    normalized.includes('free slot') ||
    normalized.includes('when is') ||
    normalized.includes('for tomorrow') ||
    normalized.includes('for today')
  ) {
    selectedPool = counselorPool;
  } else if (
    normalized.includes('guidance') ||
    normalized.includes('horoscope') ||
    normalized.includes('quote') ||
    normalized.includes('affirmation') ||
    normalized.includes('daily') ||
    normalized.includes('zodiac') ||
    normalized.includes('mood')
  ) {
    selectedPool = wellnessPool;
  } else if (
    normalized.includes('product') ||
    normalized.includes('item') ||
    normalized.includes('shop') ||
    normalized.includes('buy') ||
    normalized.includes('order') ||
    normalized.includes('price') ||
    normalized.includes('purchase')
  ) {
    selectedPool = shopPool;
  } else if (
    normalized.includes('course') ||
    normalized.includes('lesson') ||
    normalized.includes('enroll') ||
    context?.route === '/courses' ||
    context?.route === '/course-detail'
  ) {
    selectedPool = coursePool;
  } else if (
    normalized.includes('event') ||
    normalized.includes('register') ||
    normalized.includes('booking') ||
    context?.route === '/events' ||
    context?.route === '/event-detail'
  ) {
    selectedPool = eventPool;
  } else if (
    normalized.includes('membership') ||
    normalized.includes('plan') ||
    normalized.includes('subscription') ||
    context?.route === '/my-membership'
  ) {
    selectedPool = membershipPool;
  } else if (
    normalized.includes('support') ||
    normalized.includes('help') ||
    normalized.includes('issue')
  ) {
    selectedPool = supportPool;
  }

  // Shuffle and pick 3 random stages
  const shuffled = [...selectedPool].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, 3);
};

// Returns true when the message is about checking counselor availability
const isCounselorAvailabilityCheck = (message: string): boolean => {
  const n = message.toLowerCase();
  return (
    n.includes('availab') ||
    n.includes('slot') ||
    (n.includes('counsel') && (n.includes('check') || n.includes('when') || n.includes('free') || n.includes('book'))) ||
    n.includes('for tomorrow') ||
    n.includes('for today') ||
    n.includes('free slot') ||
    n.includes('book a session')
  );
};

const getThinkingSubtext = (message: string, context?: AIScreenContext) => {
  const normalized = message.toLowerCase();

  const coursePool = [
    'ParamSukh AI is reviewing your learning data and the best next step.',
    'ParamSukh AI is scanning your lesson milestones and syllabus logs.',
    'ParamSukh AI is retrieving matching meditation curriculums from the registry.',
  ];
  const eventPool = [
    'ParamSukh AI is checking live event information before replying.',
    'ParamSukh AI is locating matching venues, dates, and ticket spaces.',
    'ParamSukh AI is consulting the event scheduler for open availability.',
  ];
  const membershipPool = [
    'ParamSukh AI is reviewing plan access and available options.',
    'ParamSukh AI is analyzing active subscription status and premium benefits.',
    'ParamSukh AI is calculating pricing details and subscription structures.',
  ];
  const supportPool = [
    'ParamSukh AI is searching help articles and ticket records.',
    'ParamSukh AI is analyzing the issue to locate matching support documentation.',
    'ParamSukh AI is preparing clear help troubleshooting steps.',
  ];
  const counselorPool = [
    'ParamSukh AI is contacting the counselor calendar to find open slots.',
    'ParamSukh AI is checking real-time session availability for you.',
    'ParamSukh AI is reaching out to the scheduling system to confirm free times.',
  ];
  const wellnessPool = [
    'ParamSukh AI is consulting traditional wisdom repositories for your daily guidance.',
    'ParamSukh AI is generating a personalized spiritual affirmation for you.',
    'ParamSukh AI is interpreting cosmic alignments to outline your daily horoscope.',
  ];
  const defaultPool = [
    'ParamSukh AI is reviewing the right app data before replying.',
    'ParamSukh AI is analyzing server catalog registries for matching updates.',
    'ParamSukh AI is compiling dynamic database outputs to form your response.',
  ];
  const shopPool = [
    'ParamSukh AI is scanning the product catalog registries for spiritual items.',
    'ParamSukh AI is searching the store inventory for matching products.',
    'ParamSukh AI is retrieving product specifications, pricing, and availability.',
  ];

  let selectedPool = defaultPool;
  if (
    (normalized.includes('availab') && (normalized.includes('counsel') || normalized.includes('therapist') || normalized.includes('session') || normalized.includes('booking') || normalized.includes('slot'))) ||
    normalized.includes('slot') ||
    (normalized.includes('counsel') && (normalized.includes('check') || normalized.includes('when') || normalized.includes('free') || normalized.includes('book'))) ||
    normalized.includes('for tomorrow') ||
    normalized.includes('for today') ||
    normalized.includes('free slot') ||
    normalized.includes('book a session')
  ) {
    selectedPool = counselorPool;
  } else if (
    normalized.includes('guidance') ||
    normalized.includes('horoscope') ||
    normalized.includes('quote') ||
    normalized.includes('affirmation') ||
    normalized.includes('daily') ||
    normalized.includes('zodiac') ||
    normalized.includes('mood')
  ) {
    selectedPool = wellnessPool;
  } else if (
    normalized.includes('product') ||
    normalized.includes('item') ||
    normalized.includes('shop') ||
    normalized.includes('buy') ||
    normalized.includes('order') ||
    normalized.includes('price') ||
    normalized.includes('purchase')
  ) {
    selectedPool = shopPool;
  } else if (
    normalized.includes('course') ||
    normalized.includes('lesson') ||
    normalized.includes('enroll') ||
    context?.route === '/courses' ||
    context?.route === '/course-detail'
  ) {
    selectedPool = coursePool;
  } else if (
    normalized.includes('event') ||
    normalized.includes('register') ||
    normalized.includes('booking') ||
    context?.route === '/events' ||
    context?.route === '/event-detail'
  ) {
    selectedPool = eventPool;
  } else if (
    normalized.includes('membership') ||
    normalized.includes('plan') ||
    normalized.includes('subscription') ||
    context?.route === '/my-membership'
  ) {
    selectedPool = membershipPool;
  } else if (
    normalized.includes('support') ||
    normalized.includes('help') ||
    normalized.includes('issue')
  ) {
    selectedPool = supportPool;
  }

  // Pick a random subtext from the pool
  const randomIndex = Math.floor(Math.random() * selectedPool.length);
  return selectedPool[randomIndex];
};

const toolLabelMap: Record<string, string> = {
  search_courses: 'Courses',
  recommend_courses: 'Recommendations',
  compare_courses: 'Course Comparison',
  search_events: 'Events',
  search_podcasts: 'Podcasts',
  get_membership_plans: 'Memberships',
  get_my_subscription: 'Your Plan',
  get_my_enrollments: 'Enrollments',
  get_continue_learning: 'Continue Learning',
  get_course_progress: 'Course Progress',
  get_my_event_registrations: 'Event Registrations',
  register_for_event: 'Event Registration',
  cancel_event_registration: 'Registration Update',
  enroll_in_course: 'Course Enrollment',
  play_current_lesson: 'Lesson Playback',
  start_membership_purchase: 'Membership Purchase',
  search_support_content: 'Help Content',
  get_support_messages: 'Support',
};

const formatMessageTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
};

type QuickReply = {
  label: string;
  prompt: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
};

const getContextIcon = (
  context?: AIScreenContext
): React.ComponentProps<typeof Ionicons>['name'] => {
  const route = context?.route || '';

  if (route.includes('cart') || route.includes('order')) return 'cart-outline';
  if (route.includes('course')) return 'book-outline';
  if (route.includes('event')) return 'calendar-outline';
  if (route.includes('community')) return 'people-outline';
  if (route.includes('membership')) return 'card-outline';
  if (route.includes('podcast')) return 'mic-outline';
  if (route.includes('shop') || route.includes('product')) return 'storefront-outline';
  return 'compass-outline';
};

const getComposerPlaceholder = (context?: AIScreenContext) => {
  const route = context?.route || '';
  if (route.includes('cart') || route.includes('order')) {
    return 'Ask about products, orders, payments...';
  }
  if (route.includes('course')) return 'Ask about courses, lessons, progress...';
  if (route.includes('event')) return 'Ask about events, tickets, bookings...';
  if (route.includes('community')) return 'Ask about groups, posts, comments...';
  return 'Ask about courses, events, plans...';
};

const getQuickReplies = (messageText: string, context?: AIScreenContext): QuickReply[] => {
  const normalized = messageText.toLowerCase();
  const route = context?.route || '';

  if (
    normalized.includes('payment') ||
    normalized.includes('contact number') ||
    route.includes('cart') ||
    route.includes('order')
  ) {
    return [
      { label: 'Update number', prompt: 'Help me update my contact number.', icon: 'person-outline' },
      { label: 'Choose COD', prompt: 'Proceed using Cash on Delivery.', icon: 'cash-outline' },
      { label: 'Try payment again', prompt: 'Please try the online payment again.', icon: 'refresh-outline' },
    ];
  }

  if (normalized.includes('event') || route.includes('event')) {
    return [
      { label: 'Free events', prompt: 'Show me only the free upcoming events.', icon: 'ticket-outline' },
      { label: 'My bookings', prompt: 'Show the events I am registered for.', icon: 'calendar-outline' },
      { label: 'Best for me', prompt: 'Which upcoming event is best for me?', icon: 'sparkles-outline' },
    ];
  }

  if (
    normalized.includes('course') ||
    normalized.includes('lesson') ||
    route.includes('course')
  ) {
    return [
      { label: 'My progress', prompt: 'Show my enrolled courses and progress.', icon: 'analytics-outline' },
      { label: 'Compare courses', prompt: 'Compare the best matching courses for me.', icon: 'git-compare-outline' },
      { label: 'Continue learning', prompt: 'Play my current lesson.', icon: 'play-outline' },
    ];
  }

  if (
    normalized.includes('community') ||
    normalized.includes('post') ||
    route.includes('community')
  ) {
    return [
      { label: 'Latest posts', prompt: 'Show the latest posts in my communities.', icon: 'newspaper-outline' },
      { label: 'My groups', prompt: 'Show me my community groups.', icon: 'people-outline' },
      { label: 'Create a post', prompt: 'Help me create a community post.', icon: 'create-outline' },
    ];
  }

  return [];
};

const getFriendlyToolLabels = (toolsUsed: any[]) => {
  const labels = toolsUsed
    .map((tool) => {
      const toolName = String(tool?.tool_name || '').trim();
      if (!toolName) {
        return null;
      }

      return (
        toolLabelMap[toolName] ||
        toolName
          .split('_')
          .filter(Boolean)
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(' ')
      );
    })
    .filter(Boolean) as string[];

  return Array.from(new Set(labels));
};

export default function AIChatPanel({
  title = 'Ask ParamSukh AI',
  subtitle = 'Guiding your journey in the app',
  onClose,
  compact = false,
  context,
}: AIChatPanelProps) {
  const scrollViewRef = useRef<ScrollView>(null);
  const { width } = useWindowDimensions();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  const messages = useAIAssistantStore((state) => state.messages);
  const sessionId = useAIAssistantStore((state) => state.sessionId);
  const hydrated = useAIAssistantStore((state) => state.hydrated);
  const conversations = useAIAssistantStore((state) => state.conversations);
  const memoryItems = useAIAssistantStore((state) => state.memoryItems);
  const conversationsLoading = useAIAssistantStore((state) => state.conversationsLoading);
  const memoryLoading = useAIAssistantStore((state) => state.memoryLoading);
  const activeConversationLoading = useAIAssistantStore((state) => state.activeConversationLoading);
  const appendMessage = useAIAssistantStore((state) => state.appendMessage);
  const updateMessage = useAIAssistantStore((state) => state.updateMessage);
  const replaceMessages = useAIAssistantStore((state) => state.replaceMessages);
  const setSessionId = useAIAssistantStore((state) => state.setSessionId);
  const fetchConversations = useAIAssistantStore((state) => state.fetchConversations);
  const loadConversation = useAIAssistantStore((state) => state.loadConversation);
  const startNewChat = useAIAssistantStore((state) => state.startNewChat);
  const renameConversation = useAIAssistantStore((state) => state.renameConversation);
  const deleteConversation = useAIAssistantStore((state) => state.deleteConversation);
  const clearAllConversations = useAIAssistantStore((state) => state.clearAllConversations);
  const fetchMemoryItems = useAIAssistantStore((state) => state.fetchMemoryItems);
  const deleteMemoryItem = useAIAssistantStore((state) => state.deleteMemoryItem);
  const clearAllMemory = useAIAssistantStore((state) => state.clearAllMemory);

  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [memoryVisible, setMemoryVisible] = useState(false);
  const [thinkingStageIndex, setThinkingStageIndex] = useState(0);
  const [activeThinkingMessage, setActiveThinkingMessage] = useState('');
  const activeThinkingStages = useMemo(
    () => getThinkingStages(activeThinkingMessage, context),
    [activeThinkingMessage, context]
  );
  const activeThinkingSubtext = useMemo(
    () => getThinkingSubtext(activeThinkingMessage, context),
    [activeThinkingMessage, context]
  );

  // --- Streaming text buffer (requestAnimationFrame) ---
  // Chunks arrive faster than React can render. We accumulate text in a plain
  // JS ref and commit to the Zustand store at most once per animation frame,
  // batching multiple chunks into a single render pass for 60fps smoothness.
  const streamBufferRef = useRef<{ text: string; messageId: string; rafId: number | null; dirty: boolean }>({
    text: '',
    messageId: '',
    rafId: null,
    dirty: false,
  });

  const flushStreamBuffer = useCallback(() => {
    const buf = streamBufferRef.current;
    if (buf.dirty && buf.messageId) {
      const textSnapshot = buf.text;
      buf.dirty = false;
      updateMessage(buf.messageId, (msg) => ({ ...msg, text: textSnapshot }));
    }
    buf.rafId = null;
  }, [updateMessage]);

  const appendStreamChunk = useCallback((chunk: string) => {
    const buf = streamBufferRef.current;
    buf.text += chunk;
    buf.dirty = true;
    if (buf.rafId === null) {
      buf.rafId = requestAnimationFrame(flushStreamBuffer);
    }
  }, [flushStreamBuffer]);

  // Scroll-to-bottom: throttle during streaming to avoid layout thrashing
  const lastScrollRef = useRef(0);
  useEffect(() => {
    const now = Date.now();
    // During active streaming, throttle scrolls to once every 300ms
    if (isSending && now - lastScrollRef.current < 300) {
      return;
    }
    lastScrollRef.current = now;
    const timer = setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 80);
    return () => clearTimeout(timer);
  }, [messages, isSending]);

  useEffect(() => {
    if (!isSending) {
      setThinkingStageIndex(0);
      return;
    }

    const interval = setInterval(() => {
      setThinkingStageIndex((current) => (current + 1) % activeThinkingStages.length);
    }, 1400);

    return () => clearInterval(interval);
  }, [activeThinkingStages.length, isSending]);

  useEffect(() => {
    const loadPersistedConversation = async () => {
      if (!hydrated || !sessionId || messages.length > 1) {
        return;
      }

      try {
        const response = await apiClient.get(`/chat/conversations/${sessionId}`);
        const serverMessages = Array.isArray(response.data?.data?.messages)
          ? response.data.data.messages
          : [];

        if (serverMessages.length === 0) {
          return;
        }

        await replaceMessages(
          serverMessages
            .map((message: any) => {
              const role = message.role === 'user' ? 'user' : message.role === 'assistant' ? 'assistant' : null;
              const text = String(message.content || '').trim();

              if (!role || !text) {
                return null;
              }

              return {
                id: String(message.id),
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
            })
            .filter(Boolean) as any
        );
      } catch {
        // Keep local cache if conversation reload fails.
      }
    };

    void loadPersistedConversation();
  }, [hydrated, messages.length, replaceMessages, sessionId]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    void fetchConversations();
    void fetchMemoryItems();
  }, [fetchConversations, fetchMemoryItems, hydrated]);

  const canSend = useMemo(() => input.trim().length > 0 && !isSending, [input, isSending]);
  const isCompactHeader = width < 390;

  const sendMessage = useCallback(async (rawText?: string) => {
    const text = (rawText ?? input).trim();
    if (!text || isSending) return;

    await appendMessage('user', text);
    setInput('');
    setIsSending(true);
    setActiveThinkingMessage(text);

    try {
      const messageId = await appendMessage('assistant', '', { actionStatus: 'Thinking...' });

      const token = await getTokenSecurely();
      const payload = {
        message: text,
        conversation_id: sessionId || undefined,
        metadata: {
          source: compact
            ? Platform.OS === 'web'
              ? 'floating-widget-web'
              : 'floating-widget-mobile'
            : Platform.OS === 'web'
              ? 'mobile-web'
              : 'mobile-app',
          current_screen: context,
          visible_screen_label: context?.label,
        },
      };

      const es = new EventSource(`${API_URL}/chat/stream`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        method: 'POST',
        body: JSON.stringify(payload),
      });

      let isDone = false;

      // Initialize the streaming buffer for this message
      streamBufferRef.current = { text: '', messageId, rafId: null, dirty: false };

      es.addEventListener('message', (e) => {
        try {
          if (!e.data) return;
          const payload = JSON.parse(e.data);
          const event = payload.event;
          const data = payload.data;

          if (event === 'text_delta') {
            appendStreamChunk(data.text || '');
          } else if (event === 'action_status') {
            updateMessage(messageId, (msg) => ({ ...msg, actionStatus: data.message || null }));
          } else if (event === 'results') {
            updateMessage(messageId, (msg) => ({
              ...msg,
              presentation: data,
            }));
          } else if (event === 'follow_up') {
            updateMessage(messageId, (msg) => ({
              ...msg,
              narrative: { ...msg.narrative, outro: data.message },
            }));
          } else if (event === 'done') {
            isDone = true;
            // Flush any remaining buffered text before finishing
            const buf = streamBufferRef.current;
            if (buf.rafId !== null) {
              cancelAnimationFrame(buf.rafId);
              buf.rafId = null;
            }
            if (buf.dirty && buf.messageId) {
              updateMessage(buf.messageId, (msg) => ({ ...msg, text: buf.text }));
              buf.dirty = false;
            }
            if (data.session_id) {
              setSessionId(data.session_id);
              fetchConversations();
              fetchMemoryItems();
            }
            es.close();
            setIsSending(false);
            setActiveThinkingMessage('');
            // Persist full finished message state to AsyncStorage once at the end
            useAIAssistantStore.getState().replaceMessages(useAIAssistantStore.getState().messages);
          } else if (event === 'error') {
            updateMessage(messageId, (msg) => ({
              ...msg,
              text: msg.text + (msg.text ? '\n\n' : '') + 'Error: ' + data.message,
            }));
            es.close();
            setIsSending(false);
            setActiveThinkingMessage('');
            useAIAssistantStore.getState().replaceMessages(useAIAssistantStore.getState().messages);
          }
        } catch (err) {
          // ignore parsing errors
        }
      });

      es.addEventListener('error', (err) => {
        if (!isDone) {
          es.close();
          updateMessage(messageId, (msg) => ({
             ...msg,
             text: msg.text || 'Sorry, I could not reach the AI assistant right now. Please try again.',
             actionStatus: null,
          }));
          setIsSending(false);
          setActiveThinkingMessage('');
          useAIAssistantStore.getState().replaceMessages(useAIAssistantStore.getState().messages);
        }
      });

    } catch (error: any) {
      const fallback =
        error?.response?.data?.message ||
        'Sorry, I could not reach the AI assistant right now. Please try again.';
      await appendMessage('assistant', fallback);
      setIsSending(false);
      setActiveThinkingMessage('');
    }
  }, [input, isSending, sessionId, compact, context, appendMessage, updateMessage, setSessionId, fetchConversations, fetchMemoryItems]);

  const handlePresentationAction = useCallback(async (section: AIToolPresentationSection) => {
    const ctaType = section.ctaType;
    const payload = section.ctaPayload || section.metadata || {};

    try {
      await Haptics.selectionAsync();
    } catch {
      // Haptics are optional.
    }

    try {
      if (ctaType === 'navigate_membership') {
        router.push((payload.route as any) || '/(home)/my-membership');
        return;
      }

      if (ctaType === 'event_payment') {
        const eventId = String(payload.eventId || '').trim();
        const paymentLinkId = String(payload.paymentLinkId || '').trim();
        const paymentUrl = String(payload.paymentUrl || section.paymentUrl || '').trim();
        const isTestMode = Boolean(payload.isTestMode);

        if (!eventId || !paymentLinkId || (!paymentUrl && !isTestMode)) {
          await appendMessage(
            'assistant',
            'I could not open the event payment flow because a required payment detail is missing.'
          );
          return;
        }

        if (isTestMode) {
          const confirmRes = await apiClient.post(`/events/${eventId}/register/confirm-link`, {
            paymentLinkId,
          });

          await appendMessage(
            'assistant',
            confirmRes.data?.success
              ? confirmRes.data?.message || 'The test payment was completed and your event registration is confirmed.'
              : confirmRes.data?.message || 'The test payment could not be confirmed right now. Please try again.'
          );
          return;
        }

        if (Platform.OS === 'web') {
          await Linking.openURL(paymentUrl);
          await appendMessage(
            'assistant',
            'I opened the payment page in a new tab. After payment, ask me to refresh your registration status.'
          );
          return;
        }

        await WebBrowser.openBrowserAsync(paymentUrl, {
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
          enableBarCollapsing: true,
          showTitle: true,
        });

        const confirmRes = await apiClient.post(`/events/${eventId}/register/confirm-link`, {
          paymentLinkId,
        });

        await appendMessage(
          'assistant',
          confirmRes.data?.success
            ? confirmRes.data?.message || 'Your event payment was confirmed.'
            : confirmRes.data?.message || 'Payment is not completed yet. You can try confirming again after payment.'
        );
        return;
      }

      if (ctaType === 'membership_payment') {
        const plan = String(payload.plan || '').trim();
        const variantSlug = payload.variantSlug ? String(payload.variantSlug).trim() : null;
        const paymentLinkId = String(payload.paymentLinkId || '').trim();
        const paymentUrl = String(payload.paymentUrl || section.paymentUrl || '').trim();

        if (!plan || !paymentLinkId || !paymentUrl) {
          await appendMessage(
            'assistant',
            'I could not open the membership payment flow because a required payment detail is missing.'
          );
          return;
        }

        if (Platform.OS === 'web') {
          await Linking.openURL(paymentUrl);
          await appendMessage(
            'assistant',
            'I opened the membership payment page in a new tab. After payment, ask me to refresh your plan status.'
          );
          return;
        }

        await WebBrowser.openBrowserAsync(paymentUrl, {
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
          enableBarCollapsing: true,
          showTitle: true,
        });

        const confirmRes = await apiClient.post('/payments/membership-link/confirm', {
          paymentLinkId,
          plan,
          variantSlug,
        });

        if (confirmRes.data?.success) {
          await fetchMemoryItems();
        }

        await appendMessage(
          'assistant',
          confirmRes.data?.success
            ? confirmRes.data?.message || 'Your membership payment was confirmed.'
            : confirmRes.data?.message || 'Payment is not completed yet. You can try confirming again after payment.'
        );
        return;
      }

      if (ctaType === 'booking_payment') {
        const bookingId = String(payload.bookingId || '').trim();
        const paymentLinkId = String(payload.paymentLinkId || '').trim();
        const paymentUrl = String(payload.paymentUrl || section.paymentUrl || '').trim();

        if (!bookingId || !paymentLinkId || !paymentUrl) {
          await appendMessage(
            'assistant',
            'I could not open the booking payment flow because a required payment detail is missing.'
          );
          return;
        }

        if (Platform.OS === 'web') {
          await Linking.openURL(paymentUrl);
          await appendMessage(
            'assistant',
            'I opened the session payment page in a new tab. After payment, ask me to refresh your booking status.'
          );
          return;
        }

        await WebBrowser.openBrowserAsync(paymentUrl, {
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
          enableBarCollapsing: true,
          showTitle: true,
        });

        // Read LIVE messages from the store (avoids stale closure when browser returns)
        const liveMessages = useAIAssistantStore.getState().messages;
        const lastMsg = [...liveMessages].reverse().find(
          (msg) =>
            msg.role === 'assistant' &&
            msg.presentation?.sections?.some(
              (sec) => sec.ctaType === 'booking_payment' && sec.ctaPayload?.bookingId === bookingId
            )
        );
        const lastMsgId = lastMsg?.id;

        // Step 1: Update UI to show verification state immediately
        if (lastMsgId) {
          updateMessage(lastMsgId, (msg) => {
            if (!msg.presentation) return msg;
            const updatedSections = msg.presentation.sections.map((sec) => {
              if (sec.ctaType === 'booking_payment' && sec.ctaPayload?.bookingId === bookingId) {
                return {
                  ...sec,
                  title: 'Verifying Payment...',
                  status: 'verifying',
                  ctaLabel: 'Verifying...',
                  animation: 'payment' as const, // Keep pulsing during verification!
                };
              }
              return sec;
            });
            return {
              ...msg,
              presentation: {
                ...msg.presentation,
                sections: updatedSections,
              },
              actionStatus: 'Confirming payment with Razorpay...',
            };
          });
        }

        // Step 2: Trigger backend confirmation
        try {
          const confirmRes = await apiClient.post('/payments/booking-link/confirm', {
            paymentLinkId,
            bookingId,
          });

          const isSuccess = !!confirmRes.data?.success;

          // Step 3: Update presentation card with final payment state (success checkmark or failure)
          if (lastMsgId) {
            updateMessage(lastMsgId, (msg) => {
              if (!msg.presentation) return msg;
              const updatedSections = msg.presentation.sections.map((sec) => {
                if (sec.ctaType === 'booking_payment' && sec.ctaPayload?.bookingId === bookingId) {
                  if (isSuccess) {
                    return {
                      ...sec,
                      kind: 'action_status' as const,
                      title: 'Session Booking Confirmed!',
                      status: 'confirmed',
                      tone: 'green' as const,
                      icon: 'checkmark-circle-outline',
                      animation: 'settled' as const,
                      ctaLabel: null,
                      ctaType: null,
                      ctaPayload: null,
                      message: confirmRes.data?.message || 'Your session booking payment was confirmed!',
                    };
                  } else {
                    return {
                      ...sec,
                      title: 'Payment Verification Failed',
                      status: 'failed',
                      tone: 'red' as const,
                      icon: 'alert-circle-outline',
                      animation: 'settled' as const,
                      ctaLabel: 'Retry Payment',
                      message: confirmRes.data?.message || 'Payment is not completed yet.',
                    };
                  }
                }
                return sec;
              });
              return {
                ...msg,
                presentation: {
                  ...msg.presentation,
                  sections: updatedSections,
                },
                actionStatus: null, // Clear calling/thinking status
              };
            });
          }

          await appendMessage(
            'assistant',
            isSuccess
              ? confirmRes.data?.message || 'Your session booking payment was confirmed!'
              : confirmRes.data?.message || 'Payment is not completed yet. You can try confirming again after payment.'
          );
        } catch (err: any) {
          // Revert verification status on request error
          if (lastMsgId) {
            updateMessage(lastMsgId, (msg) => {
              if (!msg.presentation) return msg;
              const updatedSections = msg.presentation.sections.map((sec) => {
                if (sec.ctaType === 'booking_payment' && sec.ctaPayload?.bookingId === bookingId) {
                  return {
                    ...sec,
                    title: 'Payment Verification Error',
                    status: 'failed',
                    tone: 'red' as const,
                    icon: 'alert-circle-outline',
                    animation: 'settled' as const,
                    ctaLabel: 'Retry Payment',
                    message: 'A connection error occurred during verification. Please try again.',
                  };
                }
                return sec;
              });
              return {
                ...msg,
                presentation: {
                  ...msg.presentation,
                  sections: updatedSections,
                },
                actionStatus: null,
              };
            });
          }

          await appendMessage(
            'assistant',
            'I encountered a network issue while confirming your payment. Please tap Retry Payment to verify again.'
          );
        }
        return;
      }

      if (ctaType === 'course_playback') {
        const route = String(payload.route || '').trim();
        const params = payload.params && typeof payload.params === 'object' ? payload.params : {};

        if (!route) {
          await appendMessage(
            'assistant',
            'I could not open the lesson because the playback route is missing.'
          );
          return;
        }

        router.push({
          pathname: route as any,
          params,
        } as any);
        return;
      }

      if (ctaType === 'podcast_playback') {
        const route = String(payload.route || '').trim();
        const params = payload.params && typeof payload.params === 'object' ? payload.params : {};

        if (!route) {
          await appendMessage(
            'assistant',
            'I could not play the podcast because the playback route is missing.'
          );
          return;
        }

        router.push({
          pathname: route as any,
          params,
        } as any);
        return;
      }

      if (ctaType === 'select_address') {
        const addressId = payload.addressId;
        const fullName = payload.fullName || 'selected address';
        await sendMessage(`Deliver to address: ${fullName} (${addressId})`);
        return;
      }

      if (ctaType === 'confirm_order') {
        const { productId, addressId, paymentMethod, customerNotes } = payload;
        const q = payload.quantity || section.quantity || 1;
        const pName = payload.productName || section.product_name || 'product';
        const pPrice = payload.price || section.price || 0;
        await sendMessage(`Confirm purchase: ${q}x ${pName} (ID: ${productId}, Price: ${pPrice}) to address ID ${addressId} with payment ${paymentMethod}`);
        return;
      }

      if (ctaType === 'confirm_order_cancellation') {
        const { orderId, orderNumber, reason } = payload;
        await sendMessage(`Yes, please cancel order ${orderNumber} (${orderId})`);
        return;
      }

      if (ctaType === 'cancel_order') {
        const orderNumber = payload.orderNumber || payload.metadata?.orderNumber;
        if (orderNumber) {
          await sendMessage(`Cancel order ${orderNumber}`);
        }
        return;
      }

      if (ctaType === 'view_posts') {
        const groupId = payload.groupId || payload.metadata?.groupId;
        const groupName = payload.groupName || payload.metadata?.groupName || 'this group';
        if (groupId) {
          await sendMessage(`Show posts in ${groupName} (${groupId})`);
        }
        return;
      }

      if (ctaType === 'like_post') {
        const postId = payload.postId || payload.metadata?.postId;
        if (postId) {
          await sendMessage(`Like post ${postId}`);
        }
        return;
      }

      if (ctaType === 'confirm_community_post') {
        const groupId = payload.groupId || payload.metadata?.groupId;
        const groupName = payload.groupName || payload.metadata?.groupName || 'this group';
        const content = payload.content || payload.metadata?.content || '';
        const tags = Array.isArray(payload.tags || payload.metadata?.tags) ? (payload.tags || payload.metadata?.tags) : [];
        const tagText = tags.length ? ` with tags ${tags.join(', ')}` : '';
        if (groupId && content) {
          await sendMessage(`Yes, publish this community post in ${groupName} (${groupId}): ${content}${tagText}`);
        }
        return;
      }

      if (ctaType === 'confirm_post_comment') {
        const postId = payload.postId || payload.metadata?.postId;
        const postContent = payload.postContent || payload.metadata?.postContent || 'this post';
        const content = payload.content || payload.metadata?.content || '';
        if (postId && content) {
          await sendMessage(`Yes, post this reply on ${postContent} (${postId}): ${content}`);
        }
        return;
      }

      if (ctaType === 'confirm_comment_reply') {
        const commentId = payload.commentId || payload.metadata?.commentId;
        const commentContent = payload.commentContent || payload.metadata?.commentContent || 'this comment';
        const content = payload.content || payload.metadata?.content || '';
        if (commentId && content) {
          await sendMessage(`Yes, reply to comment ${commentContent} (${commentId}): ${content}`);
        }
        return;
      }

      if (ctaType === 'view_comments') {
        const postId = payload.postId || payload.metadata?.postId;
        if (postId) {
          await sendMessage(`Show comments for post ${postId}`);
        }
        return;
      }

      if (ctaType === 'open_payment_link') {
        const paymentUrl = section.paymentUrl || payload.paymentUrl;
        if (!paymentUrl) {
          await appendMessage('assistant', 'I could not open the payment page because the payment URL is missing.');
          return;
        }

        if (Platform.OS === 'web') {
          await Linking.openURL(paymentUrl);
          await appendMessage('assistant', 'I opened the payment page in a new tab. After making the payment, tell me to check status.');
          return;
        }

        await WebBrowser.openBrowserAsync(paymentUrl, {
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
          enableBarCollapsing: true,
          showTitle: true,
        });

        await appendMessage('assistant', 'I opened the checkout window. Once paid, let me know to confirm.');
        return;
      }

    } catch (error: any) {
      await appendMessage(
        'assistant',
        error?.response?.data?.message || 'I could not complete that action right now. Please try again.'
      );
    }
  }, [router, appendMessage, updateMessage, fetchMemoryItems, sendMessage]);

  const handleOpenHistory = async () => {
    await fetchConversations();
    setHistoryVisible(true);
  };

  const handleOpenMemory = async () => {
    await fetchMemoryItems();
    setMemoryVisible(true);
  };

  const handleStartNewChat = async () => {
    await startNewChat();
    setHistoryVisible(false);
  };

  const handleLoadConversation = async (conversationId: string) => {
    await loadConversation(conversationId);
    setHistoryVisible(false);
  };

  const handleRenameConversation = async (conversationId: string, title: string) => {
    const ok = await renameConversation(conversationId, title);
    if (ok) {
      await fetchConversations();
    }
    return ok;
  };

  const handleDeleteConversation = async (conversationId: string) => {
    const ok = await deleteConversation(conversationId);
    if (ok) {
      await fetchConversations();
    }
    return ok;
  };

  const handleClearAllConversations = async () => {
    const ok = await clearAllConversations();
    if (ok) {
      await fetchConversations();
      setHistoryVisible(false);
    }
    return ok;
  };

  const handleDeleteMemoryItem = async (memoryId: string) => {
    const ok = await deleteMemoryItem(memoryId);
    if (ok) {
      await fetchMemoryItems();
    }
    return ok;
  };

  const handleClearAllMemory = async () => {
    const ok = await clearAllMemory();
    if (ok) {
      await fetchMemoryItems();
    }
    return ok;
  };

  const handleOpenProfile = () => {
    onClose?.();
    router.push('/profile-menu');
  };

  const handleClosePanel = () => {
    if (onClose) {
      onClose();
      return;
    }
    router.back();
  };

  const assistantSheets = (
    <>
      <AIHistorySheet
        visible={historyVisible}
        activeConversationId={sessionId}
        conversations={conversations}
        loading={conversationsLoading}
        onClose={() => setHistoryVisible(false)}
        onNewChat={handleStartNewChat}
        onOpenConversation={handleLoadConversation}
        onRenameConversation={handleRenameConversation}
        onDeleteConversation={handleDeleteConversation}
        onClearAll={handleClearAllConversations}
      />

      <AIMemorySheet
        visible={memoryVisible}
        loading={memoryLoading}
        memoryItems={memoryItems}
        onClose={() => setMemoryVisible(false)}
        onDeleteItem={handleDeleteMemoryItem}
        onClearAll={handleClearAllMemory}
      />
    </>
  );

  if (!hydrated) {
    return (
      <View style={styles.loadingState}>
        <ActivityIndicator size="large" color="#F1842D" />
        <Text style={styles.loadingStateText}>Loading your AI workspace...</Text>
      </View>
    );
  }

  if (messages.length <= 1 && !activeConversationLoading && !isSending) {
    return (
      <>
        <AIChatHome
          displayName={user?.displayName}
          photoURL={user?.photoURL}
          input={input}
          canSend={canSend}
          isSending={isSending}
          compact={compact}
          conversations={conversations}
          conversationsLoading={conversationsLoading}
          onChangeInput={setInput}
          onSend={sendMessage}
          onOpenConversation={handleLoadConversation}
          onOpenHistory={handleOpenHistory}
          onOpenMemory={handleOpenMemory}
          onOpenProfile={handleOpenProfile}
          onClose={onClose}
        />
        {assistantSheets}
      </>
    );
  }

  return (
    <>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.header, compact && styles.headerCompact]}>
          <View style={styles.headerTopRow}>
            <View style={styles.headerLeft}>
              <View style={styles.headerBadge}>
                <Ionicons name="sparkles" size={28} color="#F26716" />
                <View style={styles.headerBadgeSpark} />
              </View>
              <View style={styles.headerTextWrap}>
                <Text
                  style={[styles.headerTitle, isCompactHeader && styles.headerTitleCompact]}
                  numberOfLines={1}
                >
                  {title}
                </Text>
                <Text
                  style={[styles.headerSubtitle, isCompactHeader && styles.headerSubtitleCompact]}
                  numberOfLines={1}
                >
                  {subtitle}
                </Text>
              </View>
            </View>

            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.headerActionButton} onPress={handleOpenHistory}>
                <Ionicons name="time-outline" size={19} color="#263142" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerActionButton} onPress={handleOpenMemory}>
                <Ionicons name="library-outline" size={19} color="#263142" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerActionButton} onPress={handleStartNewChat}>
                <Ionicons name="add" size={23} color="#263142" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerActionButton} onPress={handleClosePanel}>
                <Ionicons name="close" size={21} color="#111827" />
              </TouchableOpacity>
            </View>
          </View>

          {context ? (
            <View style={styles.contextCard}>
              <View style={styles.contextIconWrap}>
                <Ionicons name={getContextIcon(context)} size={23} color="#F26716" />
              </View>
              <View style={styles.contextTextWrap}>
                <Text style={styles.contextLabel}>Current Screen</Text>
                <Text style={styles.contextValue} numberOfLines={1}>
                  {context.label}
                </Text>
              </View>
            </View>
          ) : null}
        </View>

        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        >
          {context ? (
            <View style={styles.contextAcknowledgement}>
              <Ionicons name="checkmark-circle-outline" size={19} color="#C65D13" />
              <Text style={styles.contextAcknowledgementText}>
                I understand you&apos;re on the{' '}
                <Text style={styles.contextAcknowledgementStrong}>{context.label}</Text> screen.
              </Text>
            </View>
          ) : null}

          {activeConversationLoading ? (
            <View style={styles.inlineLoadingCard}>
              <ActivityIndicator size="small" color="#F1842D" />
              <Text style={styles.inlineLoadingText}>Loading conversation...</Text>
            </View>
          ) : null}

          {messages.map((message, index) => {
            const isLast = index === messages.length - 1;
            const isLatestAssistantThinking = isLast && message.role === 'assistant' && !message.text.trim() && !message.presentation?.sections?.length;
            const quickReplies =
              isLast && message.role === 'assistant' && message.text.trim() && !isSending
                ? getQuickReplies(message.text, context)
                : [];
            return (
              <React.Fragment key={message.id}>
                <ChatMessageRow
                  message={message}
                  onPresentationAction={handlePresentationAction}
                  thinkingText={isLatestAssistantThinking ? activeThinkingStages[thinkingStageIndex] : undefined}
                  thinkingSubtext={isLatestAssistantThinking ? activeThinkingSubtext : undefined}
                />
                {quickReplies.length ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.quickReplyRow}
                  >
                    {quickReplies.map((reply) => (
                      <TouchableOpacity
                        key={reply.label}
                        style={styles.quickReplyChip}
                        onPress={() => sendMessage(reply.prompt)}
                      >
                        <Ionicons name={reply.icon} size={17} color="#F26716" />
                        <Text style={styles.quickReplyText}>{reply.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                ) : null}
              </React.Fragment>
            );
          })}

          {isSending && (!messages.length || messages[messages.length - 1].role !== 'assistant') ? (
            <View style={styles.messageBlock}>
              <View style={styles.assistantRow}>
                <View style={styles.assistantAvatar}>
                  <Ionicons name="sparkles" size={18} color="#F1842D" />
                </View>
                  <View style={styles.assistantContentWrap}>
                    <View style={[styles.messageBubble, styles.assistantBubble, styles.loadingBubble]}>
                      <View style={styles.loadingHeaderRow}>
                        <ActivityIndicator size="small" color="#F1842D" />
                        <Text style={styles.loadingText}>{activeThinkingStages[thinkingStageIndex]}</Text>
                      </View>
                      <Text style={styles.loadingSubtext}>
                        {activeThinkingSubtext}
                      </Text>
                    </View>
                  </View>
              </View>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.composerShell}>
          <View style={styles.composer}>
            <View style={styles.composerLeading}>
              <Ionicons name="sparkles-outline" size={22} color="#F26716" />
            </View>
            <View style={styles.composerDivider} />
            <TextInput
              style={styles.input}
              placeholder={getComposerPlaceholder(context)}
              placeholderTextColor="#9CA3AF"
              value={input}
              onChangeText={setInput}
              multiline
              editable={!isSending}
            />
            <TouchableOpacity
              style={styles.sendButtonPressable}
              onPress={() => sendMessage()}
              disabled={!canSend}
            >
              <LinearGradient
                colors={canSend ? ['#FF9C45', '#F26716'] : ['#F8C49D', '#F4A971']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.sendButton}
              >
                <Ionicons name="paper-plane" size={20} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {assistantSheets}
    </>
  );
}

interface ChatMessageRowProps {
  message: any;
  onPresentationAction: (section: AIToolPresentationSection) => void;
  thinkingText?: string;
  thinkingSubtext?: string;
  showCounselorCalling?: boolean;
  counselorServiceName?: string;
}

// ─── CounselorCallingIndicator ────────────────────────────────────────────────
interface CounselorCallingProps {
  serviceName?: string;
  statusText?: string;
}

const CounselorCallingIndicator = React.memo<CounselorCallingProps>(({ serviceName, statusText }) => {
  // Three concentric ring animations, staggered for depth
  const ring1 = useSharedValue(0);
  const ring2 = useSharedValue(0);
  const ring3 = useSharedValue(0);
  const phoneScale = useSharedValue(1);
  const phoneRotate = useSharedValue(0);

  useEffect(() => {
    const ringConfig = { duration: 1800, easing: Easing.out(Easing.ease) };

    ring1.value = withRepeat(
      withSequence(
        withTiming(1, ringConfig),
        withTiming(0, { duration: 0 }),
      ),
      -1,
      false,
    );
    ring2.value = withRepeat(
      withDelay(450,
        withSequence(
          withTiming(1, ringConfig),
          withTiming(0, { duration: 0 }),
        )
      ),
      -1,
      false,
    );
    ring3.value = withRepeat(
      withDelay(900,
        withSequence(
          withTiming(1, ringConfig),
          withTiming(0, { duration: 0 }),
        )
      ),
      -1,
      false,
    );

    // Phone shake: subtle wiggle to simulate ringing
    phoneRotate.value = withRepeat(
      withSequence(
        withTiming(-6, { duration: 80, easing: Easing.inOut(Easing.ease) }),
        withTiming(6, { duration: 80, easing: Easing.inOut(Easing.ease) }),
        withTiming(-4, { duration: 70, easing: Easing.inOut(Easing.ease) }),
        withTiming(4, { duration: 70, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 80, easing: Easing.out(Easing.ease) }),
        withTiming(0, { duration: 700 }), // pause between shakes
      ),
      -1,
      false,
    );

    phoneScale.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 180 }),
        withTiming(1, { duration: 180 }),
        withTiming(1, { duration: 700 }),
      ),
      -1,
      false,
    );

    return () => {
      cancelAnimation(ring1);
      cancelAnimation(ring2);
      cancelAnimation(ring3);
      cancelAnimation(phoneRotate);
      cancelAnimation(phoneScale);
    };
  }, []);

  const ringStyle1 = useAnimatedStyle(() => ({
    opacity: (1 - ring1.value) * 0.55,
    transform: [{ scale: 1 + ring1.value * 1.5 }],
  }));
  const ringStyle2 = useAnimatedStyle(() => ({
    opacity: (1 - ring2.value) * 0.4,
    transform: [{ scale: 1 + ring2.value * 1.5 }],
  }));
  const ringStyle3 = useAnimatedStyle(() => ({
    opacity: (1 - ring3.value) * 0.25,
    transform: [{ scale: 1 + ring3.value * 1.5 }],
  }));
  const phoneStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${phoneRotate.value}deg` },
      { scale: phoneScale.value },
    ],
  }));

  const label = serviceName ? serviceName : 'counselor';

  return (
    <View style={styles.callingCard}>
      {/* Pulse rings + phone icon cluster */}
      <View style={styles.callingIconCluster}>
        {/* Rings expand outward from the circle */}
        <Animated.View style={[styles.callingRing, styles.callingRing3, ringStyle3]} />
        <Animated.View style={[styles.callingRing, styles.callingRing2, ringStyle2]} />
        <Animated.View style={[styles.callingRing, styles.callingRing1, ringStyle1]} />
        {/* Phone button in the centre */}
        <View style={styles.callingPhoneButton}>
          <Animated.View style={phoneStyle}>
            <Ionicons name="call" size={22} color="#FFFFFF" />
          </Animated.View>
        </View>
      </View>

      {/* Text section */}
      <View style={styles.callingTextWrap}>
        <Text style={styles.callingLabel}>Calling Counselor</Text>
        <Text style={styles.callingService} numberOfLines={2}>
          {statusText || `Checking availability for ${label}`}
        </Text>
        <View style={styles.callingDotsRow}>
          <Text style={styles.callingDot}>●</Text>
          <Text style={styles.callingDot}>●</Text>
          <Text style={styles.callingDot}>●</Text>
        </View>
      </View>
    </View>
  );
});

CounselorCallingIndicator.displayName = 'CounselorCallingIndicator';

const renderInlineMessage = (text: string) =>
  text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    const isBold = part.startsWith('**') && part.endsWith('**');
    return (
      <Text key={`${part}-${index}`} style={isBold ? styles.formattedBold : undefined}>
        {isBold ? part.slice(2, -2) : part}
      </Text>
    );
  });

function FormattedAssistantText({
  text,
  compact = false,
}: {
  text: string;
  compact?: boolean;
}) {
  const lines = text.split(/\r?\n/);

  return (
    <View style={styles.formattedMessage}>
      {lines.map((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <View key={`space-${index}`} style={styles.formattedSpacer} />;
        }

        const bulletMatch = trimmed.match(/^[-*•]\s+(.+)$/);
        if (bulletMatch) {
          return (
            <View key={`bullet-${index}`} style={styles.formattedBulletRow}>
              <Text style={styles.formattedBullet}>•</Text>
              <Text
                style={[
                  styles.messageText,
                  styles.assistantText,
                  compact && styles.assistantSummaryText,
                  styles.formattedBulletText,
                ]}
              >
                {renderInlineMessage(bulletMatch[1])}
              </Text>
            </View>
          );
        }

        const isHeading =
          trimmed.length <= 72 &&
          (trimmed.endsWith(':') || (trimmed.startsWith('**') && trimmed.endsWith('**')));

        return (
          <Text
            key={`line-${index}`}
            style={[
              styles.messageText,
              styles.assistantText,
              compact && styles.assistantSummaryText,
              isHeading && styles.formattedHeading,
            ]}
          >
            {renderInlineMessage(trimmed)}
          </Text>
        );
      })}
    </View>
  );
}

// ─── ChatMessageRow ───────────────────────────────────────────────────────────
const ChatMessageRow = React.memo<ChatMessageRowProps>(({ message, onPresentationAction, thinkingText, thinkingSubtext, showCounselorCalling, counselorServiceName }) => {
  const hasPresentation = !!message.presentation?.sections?.length;
  const introText = message.narrative?.intro?.trim() || message.text;
  const outroText = message.narrative?.outro?.trim() || '';

  // Detect if the current action_status is the counselor-calling status emitted by the backend
  const isCallingStatus =
    showCounselorCalling ||
    (typeof message.actionStatus === 'string' &&
      (message.actionStatus.toLowerCase().includes('clinical calendar') ||
       message.actionStatus.toLowerCase().includes('counselor') ||
       message.actionStatus.toLowerCase().includes('booking slot')));

  return (
    <View style={styles.messageBlock}>
      {message.role === 'assistant' ? (
        <View style={styles.assistantRow}>
          <View style={styles.assistantAvatar}>
            <Ionicons name="sparkles" size={18} color="#F1842D" />
          </View>
          <View style={styles.assistantContentWrap}>
            {!introText.trim() && !hasPresentation ? (
              isCallingStatus ? (
                // Premium counselor calling animation card
                <CounselorCallingIndicator
                  serviceName={counselorServiceName}
                  statusText={
                    message.actionStatus === 'Thinking...' || !message.actionStatus
                      ? undefined
                      : message.actionStatus
                  }
                />
              ) : (
                <View style={[styles.messageBubble, styles.assistantBubble, styles.loadingBubble]}>
                  <View style={styles.loadingHeaderRow}>
                    <ActivityIndicator size="small" color="#F1842D" />
                    <Text style={styles.loadingText}>
                      {message.actionStatus === 'Thinking...' || !message.actionStatus
                        ? (thinkingText || 'Thinking...')
                        : message.actionStatus}
                    </Text>
                  </View>
                  {thinkingSubtext && (message.actionStatus === 'Thinking...' || !message.actionStatus) ? (
                    <Text style={styles.loadingSubtext}>{thinkingSubtext}</Text>
                  ) : null}
                </View>
              )
            ) : null}
            {introText ? (
              <View
                style={[
                  styles.messageBubble,
                  styles.assistantBubble,
                  hasPresentation && styles.assistantSummaryBubble,
                ]}
              >
                {!hasPresentation ? <View style={styles.assistantBubbleAccent} /> : null}
                <Text style={[styles.assistantEyebrow, hasPresentation && styles.assistantEyebrowCompact]}>
                  ParamSukh AI
                </Text>
                <FormattedAssistantText text={introText} compact={hasPresentation} />
              </View>
            ) : null}
            {message.presentation ? (
              <AIToolPresentation
                presentation={message.presentation}
                onActionPress={onPresentationAction}
              />
            ) : null}
            {hasPresentation && outroText ? (
              <View style={[styles.messageBubble, styles.assistantFollowupBubble]}>
                <Text style={[styles.messageText, styles.assistantFollowupText]}>
                  {outroText}
                </Text>
              </View>
            ) : null}
            {message.toolLabels?.length ? (
              <View style={styles.toolSummaryWrap}>
                <Text style={styles.toolSummaryLabel}>Live App Data</Text>
                <View style={styles.toolChipRow}>
                  {message.toolLabels.map((label: string) => (
                    <View key={`${message.id}-${label}`} style={styles.toolChip}>
                      <Ionicons name="sparkles-outline" size={11} color="#C26D1D" />
                      <Text style={styles.toolChipText}>{label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
            <View style={styles.assistantMetaRow}>
              <Text style={styles.assistantTimestamp}>
                {formatMessageTime(message.createdAt)}
              </Text>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.userRow}>
          <View style={styles.userContentWrap}>
            <LinearGradient
              colors={['#FF913A', '#F47A20']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.messageBubble, styles.userBubble]}
            >
              <Text style={[styles.messageText, styles.userText]}>
                {message.text}
              </Text>
            </LinearGradient>
            <View style={styles.userMetaRow}>
              <Text style={styles.userTimestamp}>
                {formatMessageTime(message.createdAt)}
              </Text>
              <Ionicons name="checkmark-done" size={13} color="#F1842D" />
            </View>
          </View>
        </View>
      )}
    </View>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.message.text === nextProps.message.text &&
    prevProps.message.actionStatus === nextProps.message.actionStatus &&
    prevProps.message.presentation === nextProps.message.presentation &&
    prevProps.message.narrative === nextProps.message.narrative &&
    prevProps.thinkingText === nextProps.thinkingText &&
    prevProps.thinkingSubtext === nextProps.thinkingSubtext &&
    prevProps.showCounselorCalling === nextProps.showCounselorCalling &&
    prevProps.counselorServiceName === nextProps.counselorServiceName &&
    prevProps.onPresentationAction === nextProps.onPresentationAction
  );
});

ChatMessageRow.displayName = 'ChatMessageRow';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FCF8F3',
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F3EC',
    gap: 12,
  },
  loadingStateText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 12,
    backgroundColor: '#FCF8F3',
  },
  headerCompact: {
    paddingTop: 14,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTopRowStacked: {
    alignItems: 'flex-start',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  headerLeftStacked: {
    width: '100%',
  },
  headerTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
    color: '#172033',
  },
  headerTitleCompact: {
    fontSize: 17,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#667085',
    marginTop: 4,
  },
  headerSubtitleCompact: {
    fontSize: 11,
    marginTop: 2,
  },
  headerBadge: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
  },
  headerBadgeSpark: {
    position: 'absolute',
    right: 4,
    bottom: 8,
    width: 7,
    height: 7,
    borderRadius: 2,
    backgroundColor: '#F26716',
    transform: [{ rotate: '45deg' }],
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginLeft: 8,
  },
  headerActionsStacked: {
    width: '100%',
    marginLeft: 0,
    marginTop: 10,
    justifyContent: 'flex-end',
  },
  headerActionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EEE6DE',
    shadowColor: '#684A36',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 2,
  },
  contextCard: {
    marginTop: 18,
    minHeight: 82,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EEE5DC',
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#71513B',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 3,
  },
  contextIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: '#FFF2E6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  contextTextWrap: {
    flex: 1,
  },
  contextLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#C65D13',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  contextValue: {
    marginTop: 5,
    fontSize: 17,
    fontWeight: '800',
    color: '#182131',
  },
  newChatChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 10,
    minHeight: 46,
    borderRadius: 16,
    backgroundColor: '#F1842D',
    borderWidth: 0,
  },
  newChatChipStacked: {
    alignSelf: 'stretch',
  },
  newChatChipText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  activeConversationPill: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F6EBDD',
  },
  activeConversationText: {
    maxWidth: 210,
    color: '#A16207',
    fontSize: 11,
    fontWeight: '700',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 18,
    paddingBottom: 16,
    paddingTop: 6,
  },
  contextAcknowledgement: {
    alignSelf: 'flex-start',
    marginBottom: 18,
    paddingHorizontal: 16,
    minHeight: 44,
    borderRadius: 22,
    backgroundColor: '#FFF0DF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  contextAcknowledgementText: {
    flexShrink: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: '#A64B0E',
  },
  contextAcknowledgementStrong: {
    fontWeight: '800',
    color: '#E35F0F',
  },
  inlineLoadingCard: {
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#FFF7EC',
    borderWidth: 1,
    borderColor: '#F3DEC5',
  },
  inlineLoadingText: {
    color: '#7C4A23',
    fontSize: 13,
    fontWeight: '600',
  },
  messageBlock: {
    marginBottom: 13,
  },
  assistantRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  assistantAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF9F3',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 2,
    borderWidth: 1,
    borderColor: '#EFE4D8',
    shadowColor: '#7A4F30',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  assistantContentWrap: {
    flex: 1,
    alignItems: 'flex-start',
    gap: 4,
  },
  userRow: {
    alignItems: 'flex-end',
  },
  userContentWrap: {
    maxWidth: '76%',
    alignItems: 'flex-end',
  },
  messageBubble: {
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  userBubble: {
    backgroundColor: '#F1842D',
    borderTopRightRadius: 12,
    borderBottomRightRadius: 8,
    borderTopLeftRadius: 24,
    borderBottomLeftRadius: 24,
    shadowColor: '#F1842D',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 4,
  },
  assistantBubble: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
    borderWidth: 1,
    borderColor: '#EEE6DE',
    shadowColor: '#694D3B',
    shadowOffset: { width: 0, height: 9 },
    shadowOpacity: 0.07,
    shadowRadius: 18,
    elevation: 3,
    maxWidth: '90%',
    position: 'relative',
    overflow: 'hidden',
  },
  assistantSummaryBubble: {
    maxWidth: '100%',
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    borderColor: '#EEE6DE',
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  assistantBubbleAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 3,
    bottom: 0,
    backgroundColor: '#FFB574',
  },
  assistantEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: '#B75B16',
    letterSpacing: 0.65,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  assistantEyebrowCompact: {
    marginBottom: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  userText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  assistantText: {
    color: '#202938',
  },
  assistantSummaryText: {
    fontSize: 14,
    lineHeight: 21,
    color: '#374151',
  },
  assistantFollowupBubble: {
    maxWidth: '100%',
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: '#FFFDF9',
    borderWidth: 1,
    borderColor: '#EEDFCF',
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  assistantFollowupLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#A16207',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 5,
  },
  assistantFollowupText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#4B5563',
  },
  assistantMetaRow: {
    marginTop: 6,
    marginLeft: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  assistantTimestamp: {
    fontSize: 11,
    color: '#8B95A5',
  },
  toolSummaryWrap: {
    marginTop: 8,
    gap: 6,
  },
  toolSummaryLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    color: '#B7791F',
  },
  toolChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  toolChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#FFF3E3',
    borderWidth: 1,
    borderColor: '#F0D6B6',
  },
  toolChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#A85D18',
  },
  userMetaRow: {
    marginTop: 7,
    marginRight: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  userTimestamp: {
    fontSize: 11,
    color: '#8B95A5',
  },
  loadingBubble: {
    gap: 8,
    minWidth: 230,
  },
  loadingHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingSubtext: {
    color: '#9A6B44',
    fontSize: 12,
    lineHeight: 18,
  },
  formattedMessage: {
    gap: 8,
  },
  formattedSpacer: {
    height: 3,
  },
  formattedHeading: {
    marginTop: 2,
    fontWeight: '800',
    color: '#E86110',
  },
  formattedBold: {
    fontWeight: '800',
    color: '#192231',
  },
  formattedBulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  formattedBullet: {
    marginTop: 1,
    color: '#F26716',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '900',
  },
  formattedBulletText: {
    flex: 1,
  },
  quickReplyRow: {
    paddingLeft: 54,
    paddingRight: 2,
    paddingBottom: 3,
    gap: 9,
  },
  quickReplyChip: {
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#ECE2D9',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#634936',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  quickReplyText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#283141',
  },
  composerShell: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 12 : 10,
    backgroundColor: '#FCF8F3',
  },
  composer: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 34,
    marginHorizontal: 0,
    marginBottom: 0,
    paddingLeft: 14,
    paddingRight: 7,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#EDE4DB',
    shadowColor: '#624733',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 22,
    elevation: 7,
    gap: 9,
  },
  composerLeading: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerDivider: {
    width: 1,
    height: 29,
    backgroundColor: '#E7D8C9',
  },
  input: {
    flex: 1,
    minHeight: 38,
    maxHeight: 88,
    paddingHorizontal: 5,
    paddingVertical: 7,
    color: '#111827',
    fontSize: 14,
    lineHeight: 20,
  },
  sendButtonPressable: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  sendButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#DB5D0D',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  sendButtonDisabled: {
    backgroundColor: '#F9B680',
  },
  callingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 8,
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
    borderWidth: 1,
    borderColor: '#F8E6D5',
    padding: 16,
    gap: 16,
    width: '88%',
    shadowColor: '#F1842D',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
    marginBottom: 4,
  },
  callingIconCluster: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  callingRing: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#F9B680',
    backgroundColor: '#FFF4EA',
  },
  callingRing1: {
    zIndex: 1,
  },
  callingRing2: {
    zIndex: 2,
  },
  callingRing3: {
    zIndex: 3,
  },
  callingPhoneButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1842D',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
  },
  callingTextWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  callingLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#E06B13',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  callingService: {
    fontSize: 13,
    fontWeight: '700',
    color: '#253243',
    lineHeight: 18,
  },
  callingDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  callingDot: {
    fontSize: 8,
    color: '#F1842D',
    opacity: 0.7,
  },
});
