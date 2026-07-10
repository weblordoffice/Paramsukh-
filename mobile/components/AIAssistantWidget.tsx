import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useGlobalSearchParams, usePathname } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AIChatPanel from './AIChatPanel';
import { useAIAssistantStore } from '../store/aiAssistantStore';
import { useAuthStore } from '../store/authStore';
import { buildAIScreenContext } from '../utils/aiScreenContext';

const HIDDEN_PATHS = new Set([
  '/signin',
  '/signup',
  '/assessment',
  '/ai-chat',
]);

const TAB_SCREEN_PATHS = new Set([
  '/menu',
  '/courses',
  '/events',
  '/my-membership',
  '/community',
  '/notifications',
  '/edit-profile',
  '/settings',
  '/my-progress',
  '/help-support',
  '/downloads',
  '/podcasts',
  '/terms-privacy',
]);

const FAB_SIZE = 68;
const FAB_MARGIN = 16;
const TOP_SAFE_OFFSET = 96;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export default function AIAssistantWidget() {
  const pathname = usePathname();
  const params = useGlobalSearchParams();
  const insets = useSafeAreaInsets();
  const { width: initialWidth, height: initialHeight } = Dimensions.get('window');
  const user = useAuthStore((state) => state.user);

  const widgetPosition = useAIAssistantStore((state) => state.widgetPosition);
  const hydrated = useAIAssistantStore((state) => state.hydrated);
  const hasActiveChat = useAIAssistantStore((state) => state.messages.length > 1);
  const hydrateAssistant = useAIAssistantStore((state) => state.hydrate);
  const setWidgetPosition = useAIAssistantStore((state) => state.setWidgetPosition);

  const [isOpen, setIsOpen] = useState(false);
  const [layout, setLayout] = useState({ width: initialWidth, height: initialHeight });
  const position = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const interactionScale = useRef(new Animated.Value(1)).current;
  const dragStateRef = useRef({ moved: false, releasedAt: 0 });

  const shouldShow = useMemo(() => !HIDDEN_PATHS.has(pathname), [pathname]);
  const isTabScreen = useMemo(() => TAB_SCREEN_PATHS.has(pathname), [pathname]);
  const bottomOffset = useMemo(
    () => (isTabScreen ? 94 + insets.bottom : 28 + insets.bottom),
    [insets.bottom, isTabScreen]
  );
  const screenContext = useMemo(
    () => buildAIScreenContext(pathname, params),
    [pathname, params]
  );

  const getBounds = useCallback(() => {
    const minY = insets.top + TOP_SAFE_OFFSET;
    const maxY = Math.max(minY, layout.height - FAB_SIZE - bottomOffset);
    const leftX = FAB_MARGIN;
    const rightX = Math.max(FAB_MARGIN, layout.width - FAB_SIZE - FAB_MARGIN);

    return { minY, maxY, leftX, rightX };
  }, [bottomOffset, insets.top, layout.height, layout.width]);

  useEffect(() => {
    hydrateAssistant(user?._id ?? null);
  }, [hydrateAssistant, user?._id]);

  useEffect(() => {
    if (!hydrated || !shouldShow) {
      return;
    }

    const { minY, maxY, leftX, rightX } = getBounds();
    const nextX = widgetPosition.side === 'left' ? leftX : rightX;
    const nextY = clamp(widgetPosition.offsetY, minY, maxY);
    position.setValue({ x: nextX, y: nextY });
  }, [getBounds, hydrated, position, shouldShow, widgetPosition.offsetY, widgetPosition.side]);

  const finalizePosition = useCallback(async (rawX: number, rawY: number) => {
    const { minY, maxY, leftX, rightX } = getBounds();
    const nextY = clamp(rawY, minY, maxY);
    const nextSide = rawX + FAB_SIZE / 2 <= layout.width / 2 ? 'left' : 'right';
    const nextX = nextSide === 'left' ? leftX : rightX;

    Animated.spring(position, {
      toValue: { x: nextX, y: nextY },
      useNativeDriver: false,
      friction: 8,
      tension: 80,
    }).start();

    await setWidgetPosition({ side: nextSide, offsetY: nextY });
  }, [getBounds, layout.width, position, setWidgetPosition]);

  const animateInteractionScale = useCallback(
    (toValue: number) => {
      Animated.spring(interactionScale, {
        toValue,
        useNativeDriver: true,
        friction: 7,
        tension: 150,
      }).start();
    },
    [interactionScale]
  );

  const panResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dx) > 4 || Math.abs(gestureState.dy) > 4,
      onPanResponderGrant: () => {
        dragStateRef.current.moved = false;
        animateInteractionScale(1.06);
        position.stopAnimation((value) => {
          position.setOffset(value);
          position.setValue({ x: 0, y: 0 });
        });
      },
      onPanResponderMove: (_, gestureState) => {
        dragStateRef.current.moved = true;
        position.setValue({ x: gestureState.dx, y: gestureState.dy });
      },
      onPanResponderRelease: (_, gestureState) => {
        position.flattenOffset();
        dragStateRef.current.releasedAt = Date.now();
        animateInteractionScale(1);
        void finalizePosition(gestureState.moveX - FAB_SIZE / 2, gestureState.moveY - FAB_SIZE / 2);
      },
      onPanResponderTerminate: () => {
        position.flattenOffset();
        animateInteractionScale(1);
      },
    }),
    [animateInteractionScale, finalizePosition, position]
  );

  if (!shouldShow || !hydrated) {
    return null;
  }

  return (
    <>
      <View
        pointerEvents="box-none"
        style={StyleSheet.absoluteFill}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          setLayout({ width, height });
        }}
      >
        <Animated.View
          {...panResponder.panHandlers}
          style={[
            styles.fabWrap,
            {
              width: FAB_SIZE,
              height: FAB_SIZE,
              transform: position.getTranslateTransform(),
            },
          ]}
        >
          <Animated.View
            style={[
              styles.fabMotion,
              {
                transform: [{ scale: interactionScale }],
              },
            ]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open ParamSukh AI"
              accessibilityHint="Tap to ask a question, or drag to reposition"
              hitSlop={8}
              style={styles.fabPressable}
              onPressIn={() => animateInteractionScale(0.95)}
              onPressOut={() => animateInteractionScale(1)}
              onPress={() => {
                const draggedRecently =
                  dragStateRef.current.moved &&
                  Date.now() - dragStateRef.current.releasedAt < 180;
                if (draggedRecently) {
                  return;
                }
                setIsOpen(true);
              }}
            >
              <View style={styles.fabHalo} />
              <LinearGradient
                colors={['#FFB56F', '#F47A20', '#D9570B']}
                locations={[0, 0.55, 1]}
                start={{ x: 0.1, y: 0 }}
                end={{ x: 0.9, y: 1 }}
                style={styles.fab}
              >
                <View style={styles.fabHighlight} />
                <View style={styles.fabOrbit} />
                <LinearGradient
                  colors={['#354052', '#111827']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.fabInnerCore}
                >
                  <Ionicons name="sparkles" size={25} color="#FFF8EF" />
                  <View style={styles.fabCoreGlint} />
                </LinearGradient>
                <View style={styles.fabStatusWrap}>
                  <View style={styles.fabStatusDot} />
                </View>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        </Animated.View>
      </View>

      <Modal
        visible={isOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsOpen(false)}
      >
        <View style={styles.overlay}>
          {!hasActiveChat ? (
            <Pressable style={styles.overlayDismiss} onPress={() => setIsOpen(false)} />
          ) : null}
          <View
            style={[
              styles.sheet,
              hasActiveChat && styles.sheetChat,
              {
                paddingTop: hasActiveChat ? insets.top : 0,
                paddingBottom: Math.max(insets.bottom, 12),
              },
            ]}
          >
            <LinearGradient
              colors={['rgba(255,248,239,0.95)', 'rgba(248,243,236,1)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.sheetGlow}
            />
            {!hasActiveChat ? <View style={styles.handle} /> : null}
            <AIChatPanel
              compact
              title="Ask ParamSukh AI"
              subtitle="Guidance that follows your journey in the app"
              onClose={() => setIsOpen(false)}
              context={screenContext}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fabWrap: {
    position: 'absolute',
    borderRadius: FAB_SIZE / 2,
    shadowColor: '#B94D0B',
    shadowOffset: { width: 0, height: 11 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 14,
  },
  fabMotion: {
    flex: 1,
    borderRadius: FAB_SIZE / 2,
  },
  fabPressable: {
    flex: 1,
    borderRadius: FAB_SIZE / 2,
  },
  fab: {
    flex: 1,
    borderRadius: FAB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.72)',
  },
  fabHalo: {
    position: 'absolute',
    top: -4,
    right: -4,
    bottom: -4,
    left: -4,
    borderRadius: (FAB_SIZE + 8) / 2,
    borderWidth: 1,
    borderColor: 'rgba(244,122,32,0.18)',
    backgroundColor: 'rgba(255,245,235,0.3)',
  },
  fabHighlight: {
    position: 'absolute',
    top: 5,
    left: 11,
    width: 31,
    height: 15,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.32)',
    transform: [{ rotate: '-16deg' }],
  },
  fabOrbit: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  fabInnerCore: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.34)',
    shadowColor: '#7D2E00',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  fabCoreGlint: {
    position: 'absolute',
    top: 8,
    left: 10,
    width: 10,
    height: 4,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.18)',
    transform: [{ rotate: '-20deg' }],
  },
  fabStatusWrap: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: '#FFF8F0',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(220,93,15,0.16)',
  },
  fabStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#31B878',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(35, 24, 15, 0.28)',
    justifyContent: 'flex-end',
  },
  overlayDismiss: {
    flex: 1,
  },
  sheet: {
    backgroundColor: '#F8F3EC',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    height: Platform.OS === 'web' ? '94%' : '92%',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 14,
  },
  sheetChat: {
    height: '100%',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  sheetGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  handle: {
    width: 50,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#D8C8B5',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 0,
  },
});
