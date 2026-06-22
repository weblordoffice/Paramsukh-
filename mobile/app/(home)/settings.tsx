import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import apiClient from '../../utils/apiClient';
import { API_URL } from '../../config/api';
import { useAuthStore } from '../../store/authStore';

const SETTINGS_STORAGE_KEY = 'user_settings';

interface UserSettings {
  pushNotifications: boolean;
  emailNotifications: boolean;
  darkMode: boolean;
  autoPlay: boolean;
  dataSaver: boolean;
}

const defaultSettings: UserSettings = {
  pushNotifications: true,
  emailNotifications: false,
  darkMode: false,
  autoPlay: true,
  dataSaver: false,
};

export default function SettingsScreen() {
  const router = useRouter();
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    loadSettings();
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadSettings = async () => {
    try {
      // Load from AsyncStorage first
      const stored = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
      if (!isMountedRef.current) return;
      if (stored) {
        setSettings({ ...defaultSettings, ...JSON.parse(stored) });
      }

      // Then try to fetch from API
      const response = await apiClient.get(`${API_URL}/user/profile`);
      if (!isMountedRef.current) return;
      if (response.data?.success && response.data?.user?.preferences) {
          const apiPrefs = response.data.user.preferences;
          const loadedSettings = {
            pushNotifications: apiPrefs.notifications ?? defaultSettings.pushNotifications,
            emailNotifications: apiPrefs.emailNotifications ?? defaultSettings.emailNotifications,
            darkMode: apiPrefs.theme === 'dark',
            autoPlay: apiPrefs.autoPlay ?? defaultSettings.autoPlay,
            dataSaver: apiPrefs.dataSaver ?? defaultSettings.dataSaver,
          };
          setSettings(loadedSettings);
          await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(loadedSettings));
      }
    } catch (error) {
      // Silently handle load errors (e.g. offline)
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  };

  const saveSettings = async (newSettings: UserSettings) => {
    setSaving(true);
    try {
      // Save to AsyncStorage
      await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(newSettings));

      // Sync to API
      await apiClient.put(
        `${API_URL}/user/preferences`,
        {
          theme: newSettings.darkMode ? 'dark' : 'light',
          notifications: newSettings.pushNotifications,
          emailNotifications: newSettings.emailNotifications,
          autoPlay: newSettings.autoPlay,
          dataSaver: newSettings.dataSaver,
        },
      );
    } catch (error) {
      // Silently fail - local storage already saved
    } finally {
      setSaving(false);
    }
  };

  const toggleSetting = (key: keyof UserSettings) => {
    const newSettings = { ...settings, [key]: !settings[key] };
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This will permanently remove all your data including subscriptions, orders, and progress. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await apiClient.delete(`${API_URL}/user/delete-account`);
              if (response.data?.success) {
                await useAuthStore.getState().logout();
                router.replace('/signin');
              } else {
                Alert.alert('Error', response.data?.message || 'Failed to delete account');
              }
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.message || 'Failed to delete account. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await useAuthStore.getState().logout();
            router.replace('/signin');
          },
        },
      ]
    );
  };

  const navigateBack = () => {
    if (router.canGoBack()) router.back();
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}>
        <TouchableOpacity onPress={navigateBack} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' }}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={{ fontSize: 20, fontWeight: '700', color: '#111827' }}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
        {/* Saving indicator */}
        {saving && (
          <View style={{ marginBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <ActivityIndicator size="small" color="#3B82F6" />
            <Text style={{ fontSize: 14, color: '#6B7280' }}>Saving...</Text>
          </View>
        )}

        {/* Notifications Section */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 12 }}>Notifications</Text>
          
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Ionicons name="notifications-outline" size={24} color="#3B82F6" />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827' }}>Push Notifications</Text>
                <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>Receive push notifications</Text>
              </View>
            </View>
            <Switch
              value={settings.pushNotifications}
              onValueChange={() => toggleSetting('pushNotifications')}
              trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
              thumbColor={settings.pushNotifications ? '#3B82F6' : '#F3F4F6'}
            />
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Ionicons name="mail-outline" size={24} color="#3B82F6" />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827' }}>Email Notifications</Text>
                <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>Receive email updates</Text>
              </View>
            </View>
            <Switch     
              value={settings.emailNotifications}   
              onValueChange={() => toggleSetting('emailNotifications')}
              trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
              thumbColor={settings.emailNotifications ? '#3B82F6' : '#F3F4F6'}
            />
          </View>   
        </View>
                
        {/* Appearance Section */}
        <View style={{ marginBottom: 24 }}>     
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 12 }}>Appearance</Text>
          
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Ionicons name="moon-outline" size={24} color="#3B82F6" />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827' }}>Dark Mode</Text>
                <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>Enable dark theme</Text>
              </View>
            </View>   
            <Switch                 
              value={settings.darkMode}     
              onValueChange={() => toggleSetting('darkMode')}
              trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
              thumbColor={settings.darkMode ? '#3B82F6' : '#F3F4F6'}
            />  
          </View>  
        </View>

        {/* Content Preferences */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 12 }}>Content Preferences</Text>
          
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Ionicons name="play-circle-outline" size={24} color="#3B82F6" />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827' }}>Auto-play Videos</Text>
                <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>Videos play automatically</Text>
              </View>
            </View>
            <Switch
              value={settings.autoPlay}
              onValueChange={() => toggleSetting('autoPlay')}
              trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
              thumbColor={settings.autoPlay ? '#3B82F6' : '#F3F4F6'}
            />
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Ionicons name="save-outline" size={24} color="#3B82F6" />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827' }}>Data Saver</Text>
                <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>Reduce data usage</Text>
              </View>
            </View>
            <Switch
              value={settings.dataSaver}
              onValueChange={() => toggleSetting('dataSaver')}
              trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
              thumbColor={settings.dataSaver ? '#3B82F6' : '#F3F4F6'}
            />
          </View>
        </View>

        {/* Account Section */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 12 }}>Account</Text>
          
          <TouchableOpacity 
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }}
            onPress={() => router.push('/profile-menu')}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Ionicons name="person-outline" size={24} color="#3B82F6" />
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginLeft: 12 }}>Edit Profile</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }}
            onPress={() => router.push('/(home)/terms-privacy')}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Ionicons name="shield-outline" size={24} color="#3B82F6" />
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginLeft: 12 }}>Privacy & Security</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }}
            onPress={() => router.push('/(home)/help-support')}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Ionicons name="help-circle-outline" size={24} color="#3B82F6" />
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginLeft: 12 }}>Help & Support</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }}
            onPress={handleDeleteAccount}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Ionicons name="trash-outline" size={24} color="#EF4444" />
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#EF4444', marginLeft: 12 }}>Delete Account</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#EF4444" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }}
            onPress={handleLogout}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Ionicons name="log-out-outline" size={24} color="#EF4444" />
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#EF4444', marginLeft: 12 }}>Logout</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#EF4444" />
          </TouchableOpacity>
        </View>

        {/* App Info */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 12 }}>About</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Ionicons name="information-circle-outline" size={24} color="#3B82F6" />
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginLeft: 12 }}>App Version</Text>
            </View>
            <Text style={{ fontSize: 14, color: '#6B7280' }}>
              {Constants.expoConfig?.version ?? '1.0.0'} ({Constants.expoConfig?.android?.versionCode ?? '1'})
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}