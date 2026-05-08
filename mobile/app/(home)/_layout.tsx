import { Ionicons } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import { Platform, View, TouchableOpacity, Modal, ScrollView, Text, StyleSheet } from 'react-native';
import { useState } from 'react';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeAreaView } from 'react-native-safe-area-context';



// Add profile screen to tabs


export default function HomeLayout() {
  const [menuModalVisible, setMenuModalVisible] = useState(false);
  const insets = useSafeAreaInsets();
  const router = useRouter();



  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#F1842D',
          tabBarInactiveTintColor: '#8C7B73',
          tabBarStyle: {
            backgroundColor: '#FFFFFF',
            borderTopWidth: 0,
            height: 60 + insets.bottom,
            paddingBottom: insets.bottom,
            paddingTop: 8,
            paddingHorizontal: 0,
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            elevation: 0,
            shadowOpacity: 0,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
            marginTop: 4,
            marginBottom: 0,
            letterSpacing: 0.3,
          },
          tabBarItemStyle: {
            paddingVertical: 4,
            paddingHorizontal: 8,
          },
        }}
      >
        <Tabs.Screen
          name="menu"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'home' : 'home-outline'} size={24} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="courses"
          options={{
            title: 'Courses',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'book' : 'book-outline'} size={24} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="events"
          options={{
            title: 'Events',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'calendar' : 'calendar-outline'} size={24} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="membership-new"
          options={{
            href: null, // Hidden — replaced by my-membership tab
          }}
        />
        <Tabs.Screen
          name="my-membership"
          options={{
            title: 'Membership',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'card' : 'card-outline'} size={24} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="community"
          options={{
            title: 'Community',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'people' : 'people-outline'} size={24} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="notifications"
          options={{
            href: null, // Hide from tabs navigation
          }}
        />
        <Tabs.Screen
          name="edit-profile"
          options={{
            href: null, // Hide from tabs navigation
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            href: null, // Hide from tabs navigation
          }}
        />
        <Tabs.Screen
          name="my-progress"
          options={{
            href: null, // Hide from tabs navigation
          }}
        />
        <Tabs.Screen
          name="help-support"
          options={{
            href: null, // Hide from tabs navigation
          }}
        />
        <Tabs.Screen
          name="downloads"
          options={{
            href: null, // Hide from tabs navigation
          }}
        />
        <Tabs.Screen
          name="podcasts"
          options={{
            href: null, // Hide from tabs navigation
          }}
        />
        <Tabs.Screen
          name="terms-privacy"
          options={{
            href: null, // Hide from tabs navigation
          }}
        />
      </Tabs>

      {/* Menu Bottom Sheet Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={menuModalVisible}
        onRequestClose={() => setMenuModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setMenuModalVisible(false)}
        >
          <TouchableOpacity
            style={styles.modalContent}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Handle Bar */}
            <View style={styles.handleBar} />

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Header */}
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Quick Access</Text>
              </View>

              {/* Menu Options - Only Shops and Donations */}
              <View style={styles.menuOptions}>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    setMenuModalVisible(false);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setTimeout(() => {
                      router.push('/shops');
                    }, 300);
                  }}
                >
                  <View style={styles.menuItemContent}>
                    <Text style={styles.menuEmoji}>🛍️</Text>
                    <Text style={styles.menuText}>Shops</Text>
                  </View>
                  <Text style={styles.menuArrow}>›</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    setMenuModalVisible(false);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setTimeout(() => {
                      router.push('/donations');
                    }, 300);
                  }}
                >
                  <View style={styles.menuItemContent}>
                    <Text style={styles.menuEmoji}>💝</Text>
                    <Text style={styles.menuText}>Donations</Text>
                  </View>
                  <Text style={styles.menuArrow}>›</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    setMenuModalVisible(false);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setTimeout(() => {
                      // @ts-ignore - Route will be available after restart
                      router.push('/(home)/podcasts');
                    }, 300);
                  }}
                >
                  <View style={styles.menuItemContent}>
                    <Text style={styles.menuEmoji}>🎙️</Text>
                    <Text style={styles.menuText}>Podcasts</Text>
                  </View>
                  <Text style={styles.menuArrow}>›</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(44, 36, 32, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    maxHeight: '85%',
    shadowColor: '#F1842D',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 16,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: '#F4F3EB',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  modalHeader: {
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F4F3EB',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2C2420',
    textAlign: 'center',
    letterSpacing: 0.25,
  },
  menuOptions: {
    gap: 12,
  },
  menuItem: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F4F3EB',
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#5C4A42',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuEmoji: {
    fontSize: 22,
    marginRight: 16,
  },
  menuText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#2C2420',
  },
  menuArrow: {
    fontSize: 24,
    color: '#8C7B73',
  },
});
