import { useRouter } from 'expo-router';
import React, { useRef } from 'react';
import { ScrollView, Text, TouchableOpacity, View, Linking, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Header from '../../components/Header';
import { useBottomTabBarHeight } from '../../hooks/useBottomTabBarHeight';

interface FeatureCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  color: string;
  bgColor: string;
  onPress?: () => void;
}

interface QuickAccessItemProps {
  icon?: keyof typeof Ionicons.glyphMap;
  emoji?: string;
  title: string;
  description: string;
  iconBg: string;
  iconColor?: string;
  onPress: () => void;
}

function FeatureCard({ icon, title, description, color, bgColor, onPress }: FeatureCardProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={0.8}
      style={[styles.featureCard, { transform: [{ scale: scaleAnim }] }]}
    >
      <View style={[styles.iconContainer, { backgroundColor: bgColor }]}>
        <Ionicons name={icon} size={28} color={color} />
      </View>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureDescription}>{description}</Text>
    </TouchableOpacity>
  );
}

function QuickAccessItem({ icon, emoji, title, description, iconBg, iconColor, onPress }: QuickAccessItemProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={0.7}
      style={[styles.quickAccessItem, { transform: [{ scale: scaleAnim }] }]}
    >
      <View style={[styles.quickAccessIcon, { backgroundColor: iconBg }]}>
        {icon ? (
          <Ionicons name={icon} size={22} color={iconColor || '#F1842D'} />
        ) : (
          <Text style={styles.quickAccessEmoji}>{emoji}</Text>
        )}
      </View>
      <View style={styles.quickAccessContent}>
        <Text style={styles.quickAccessTitle}>{title}</Text>
        <Text style={styles.quickAccessDescription}>{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#8C7B73" />
    </TouchableOpacity>
  );
}

export default function HomeTab() {
  const router = useRouter();
  const scrollY = useRef(new Animated.Value(0)).current;
  const bottomTabHeight = useBottomTabBarHeight();
  const heroScale = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [1, 0.92],
    extrapolate: 'clamp',
  });

  const handleWatchIntro = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Linking.openURL('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  };

  return (
    <View style={styles.container}>
      <Header />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomTabHeight }]}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
      >
        {/* Hero Section - Premium Gradient */}
        <Animated.View style={[styles.heroSection, { transform: [{ scale: heroScale }] }]}>
          <View style={styles.heroGradient} />
          <View style={styles.heroContent}>
            <View style={styles.heroHeader}>
              <View style={styles.heroIconContainer}>
                <Ionicons name="sparkles" size={32} color="#FFFFFF" />
              </View>
              <View style={styles.heroTextContainer}>
                <Text style={styles.heroGreeting}>Welcome to</Text>
                <Text style={styles.heroTitle}>ParamSukh Gurukool</Text>
              </View>
            </View>
            
            <Text style={styles.heroDescription}>
              Your spiritual companion for meditation, learning & community
            </Text>

            <TouchableOpacity
              style={styles.heroButton}
              onPress={handleWatchIntro}
              activeOpacity={0.8}
            >
              <Ionicons name="play" size={16} color="#F1842D" style={{ marginRight: 6 }} />
              <Text style={styles.heroButtonText}>Watch Intro Video</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Feature Cards - Warm Neumorphic */}
        <View style={styles.featureSection}>
          <Text style={styles.sectionTitle}>What We Offer</Text>
          <View style={styles.featureGrid}>
            <FeatureCard
              icon="book"
              title="Courses"
              description="Learn at your own pace"
              color="#8B5CF6"
              bgColor="rgba(139, 92, 246, 0.12)"
              onPress={() => router.push('/(home)/courses')}
            />
            <FeatureCard
              icon="people"
              title="Community"
              description="Connect with others"
              color="#2DD4BF"
              bgColor="rgba(45, 212, 191, 0.12)"
              onPress={() => router.push('/(home)/community')}
            />
            <FeatureCard
              icon="calendar"
              title="Events"
              description="Join live sessions"
              color="#F1842D"
              bgColor="rgba(241, 132, 45, 0.15)"
              onPress={() => router.push('/(home)/events')}
            />
            <FeatureCard
              icon="headset"
              title="Podcasts"
              description="Audio wisdom"
              color="#FB7185"
              bgColor="rgba(251, 113, 133, 0.12)"
              onPress={() => router.push('/(home)/podcasts')}
            />
          </View>
        </View>

        {/* Quick Access - Warm Elevated List */}
        <View style={styles.quickAccessSection}>
          <Text style={styles.sectionTitle}>Quick Access</Text>
          <View style={styles.quickAccessList}>
            <QuickAccessItem
              icon="people"
              title="Counseling"
              description="Book 1-on-1 guidance sessions"
              iconBg="rgba(139, 92, 246, 0.12)"
              iconColor="#8B5CF6"
              onPress={() => router.push('/counseling')}
            />
            <View style={styles.divider} />
            <QuickAccessItem
              emoji="🛍️"
              title="Shops"
              description="Pooja items, idols, books & frames"
              iconBg="rgba(92, 74, 66, 0.08)"
              onPress={() => router.push('/shops')}
            />
            <View style={styles.divider} />
            <QuickAccessItem
              emoji="💝"
              title="Donations"
              description="Support ParamSukh initiatives"
              iconBg="rgba(92, 74, 66, 0.08)"
              onPress={() => router.push('/donations')}
            />
            <View style={styles.divider} />
            <QuickAccessItem
              emoji="🎙️"
              title="Podcasts"
              description="Audio talks and meditations"
              iconBg="rgba(92, 74, 66, 0.08)"
              onPress={() => router.push('/(home)/podcasts')}
            />
            
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FDF8F3',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    // paddingBottom is now handled dynamically via useBottomTabBarHeight hook
  },
  // Hero Section - Premium Gradient
  heroSection: {
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 24,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    shadowColor: '#F1842D',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 6,
  },
  heroGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#2C2420',
    opacity: 0.92,
  },
  heroContent: {
    padding: 28,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  heroIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(241, 132, 45, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(241, 132, 45, 0.4)',
  },
  heroTextContainer: {
    flex: 1,
  },
  heroGreeting: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 3,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  heroDescription: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.85)',
    lineHeight: 22,
    marginBottom: 22,
  },
  heroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    alignSelf: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  heroButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F1842D',
  },
  // Feature Section
  featureSection: {
    marginHorizontal: 20,
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#2C2420',
    marginBottom: 18,
    letterSpacing: 0.3,
  },
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  featureCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#5C4A42',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  iconContainer: {
    width: 58,
    height: 58,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2C2420',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 13,
    fontWeight: '500',
    color: '#5C4A42',
    textAlign: 'center',
    lineHeight: 19,
  },
  // Quick Access Section
  quickAccessSection: {
    marginHorizontal: 20,
    marginBottom: 24,
  },
  quickAccessList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    shadowColor: '#5C4A42',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
  },
  quickAccessItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  quickAccessIcon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  quickAccessEmoji: {
    fontSize: 22,
  },
  quickAccessContent: {
    flex: 1,
  },
  quickAccessTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2C2420',
    marginBottom: 3,
  },
  quickAccessDescription: {
    fontSize: 13,
    fontWeight: '500',
    color: '#5C4A42',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(244, 243, 235, 0.9)',
    marginHorizontal: 20,
  },
});
