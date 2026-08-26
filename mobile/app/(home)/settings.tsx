import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import apiClient from '../../utils/apiClient';
import { API_URL } from '../../config/api';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../hooks/useTheme';
import { useThemeStore } from '../../store/themeStore';

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
  const { colors, setTheme } = useTheme();
  const [settings, setSettings] = useState<UserSettings>(() => ({
    ...defaultSettings,
    darkMode: useThemeStore.getState().isDark,
  }));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpModalVisible, setOtpModalVisible] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingDelete, setVerifyingDelete] = useState(false);
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
          // Sync global theme so the app chrome applies the saved preference
          setTheme(apiPrefs.theme === 'dark' ? 'dark' : 'light');
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

  const toggleDarkMode = () => {
    const newDark = !settings.darkMode;
    const newSettings = { ...settings, darkMode: newDark };
    setSettings(newSettings);
    setTheme(newDark ? 'dark' : 'light');
    saveSettings(newSettings);
  };

  const sendDeleteOtp = async () => {
    setSendingOtp(true);
    try {
      await apiClient.post(`${API_URL}/user/account/delete-otp`);
      setOtp('');
      setOtpModalVisible(true);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to send OTP. Please try again.');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all associated data. You will need to verify your mobile number with an OTP to proceed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send OTP',
          style: 'destructive',
          onPress: sendDeleteOtp,
        },
      ]
    );
  };

  const confirmDeleteWithOtp = async () => {
    if (!otp || otp.trim().length < 4) {
      Alert.alert('Error', 'Please enter the OTP sent to your phone');
      return;
    }
    setVerifyingDelete(true);
    try {
      const response = await apiClient.delete(`${API_URL}/user/delete-account`, {
        data: { confirmDelete: 'DELETE', otp: otp.trim() },
      });
      if (response.data?.success) {
        setOtpModalVisible(false);
        await useAuthStore.getState().logout();
        router.replace('/signin');
      } else {
        Alert.alert('Error', response.data?.message || 'Failed to delete account');
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Invalid OTP or deletion failed');
    } finally {
      setVerifyingDelete(false);
    }
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
          <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <TouchableOpacity onPress={navigateBack} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceSecondary, justifyContent: 'center', alignItems: 'center' }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>     
        <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text }}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
        {/* Saving indicator */}
        {saving && (
          <View style={{ marginBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={{ fontSize: 14, color: colors.textSecondary }}>Saving...</Text>
          </View>
        )}
        
        {/* Notifications Section */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 12 }}>Notifications</Text>
          
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, padding: 16, borderRadius: 12, marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Ionicons name="notifications-outline" size={24} color={colors.primary} />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>Push Notifications</Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>Receive push notifications</Text>
              </View>
            </View>
            <Switch
              value={settings.pushNotifications}
              onValueChange={() => toggleSetting('pushNotifications')}
              trackColor={{ false: colors.surfaceSecondary, true: colors.primary }}
              thumbColor={settings.pushNotifications ? colors.primary : colors.surfaceSecondary}
            />
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, padding: 16, borderRadius: 12, marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Ionicons name="mail-outline" size={24} color={colors.primary} />
              <View style={{ marginLeft: 12, flex: 1 }}> 
                <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>Email Notifications</Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>Receive email updates</Text>
              </View>
            </View>
            <Switch     
              value={settings.emailNotifications}   
              onValueChange={() => toggleSetting('emailNotifications')}
              trackColor={{ false: colors.surfaceSecondary, true: colors.primary }}
              thumbColor={settings.emailNotifications ? colors.primary : colors.surfaceSecondary}
            />
          </View>   
        </View>
                
        {/* Appearance Section */}
        <View style={{ marginBottom: 24 }}>     
          <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 12 }}>Appearance</Text>
          
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, padding: 16, borderRadius: 12, marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Ionicons name="moon-outline" size={24} color={colors.primary} />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>Dark Mode</Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>Enable dark theme</Text>
              </View>
            </View>   
            <Switch                 
              value={settings.darkMode}     
              onValueChange={toggleDarkMode}
              trackColor={{ false: colors.surfaceSecondary, true: colors.primary }}
              thumbColor={settings.darkMode ? colors.primary : colors.surfaceSecondary}
            />  
          </View>  
        </View>

        {/* Content Preferences */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 12 }}>Content Preferences</Text>
          
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, padding: 16, borderRadius: 12, marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Ionicons name="play-circle-outline" size={24} color={colors.primary} />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>Auto-play Videos</Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>Videos play automatically</Text>
              </View>
            </View>
            <Switch
              value={settings.autoPlay}
              onValueChange={() => toggleSetting('autoPlay')}
              trackColor={{ false: colors.surfaceSecondary, true: colors.primary }}
              thumbColor={settings.autoPlay ? colors.primary : colors.surfaceSecondary}
            />
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, padding: 16, borderRadius: 12, marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Ionicons name="save-outline" size={24} color={colors.primary} />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>Data Saver</Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>Reduce data usage</Text>
              </View>
            </View>
            <Switch
              value={settings.dataSaver}
              onValueChange={() => toggleSetting('dataSaver')}
              trackColor={{ false: colors.surfaceSecondary, true: colors.primary }}
              thumbColor={settings.dataSaver ? colors.primary : colors.surfaceSecondary}
            />
          </View>
        </View>

        {/* Account Section */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 12 }}>Account</Text>
            
          <TouchableOpacity 
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, padding: 16, borderRadius: 12, marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }}
            onPress={() => router.push('/profile-menu')}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Ionicons name="person-outline" size={24} color={colors.primary} />
              <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text, marginLeft: 12 }}>Edit Profile</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, padding: 16, borderRadius: 12, marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }}
            onPress={() => router.push('/orders')}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Ionicons name="receipt-outline" size={24} color={colors.primary} />
              <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text, marginLeft: 12 }}>My Orders</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
                   
          <TouchableOpacity 
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, padding: 16, borderRadius: 12, marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }}
            onPress={() => router.push('/(home)/devices')}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Ionicons name="phone-portrait-outline" size={24} color={colors.primary} />
              <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text, marginLeft: 12 }}>Active Devices</Text>
            </View>  
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, padding: 16, borderRadius: 12, marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }}
            onPress={() => router.push('/(home)/terms-privacy')}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Ionicons name="shield-outline" size={24} color={colors.primary} />
              <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text, marginLeft: 12 }}>Privacy & Security</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, padding: 16, borderRadius: 12, marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }}
            onPress={() => router.push('/(home)/help-support')}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Ionicons name="help-circle-outline" size={24} color={colors.primary} />
              <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text, marginLeft: 12 }}>Help & Support</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, padding: 16, borderRadius: 12, marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }}
            onPress={handleDeleteAccount}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Ionicons name="trash-outline" size={24} color={colors.danger} />
              <Text style={{ fontSize: 16, fontWeight: '600', color: colors.danger, marginLeft: 12 }}>Delete Account</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.danger} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, padding: 16, borderRadius: 12, marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }}
            onPress={handleLogout}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Ionicons name="log-out-outline" size={24} color={colors.danger} />
              <Text style={{ fontSize: 16, fontWeight: '600', color: colors.danger, marginLeft: 12 }}>Logout</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.danger} />
          </TouchableOpacity>
        </View>

        {/* App Info */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 12 }}>About</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, padding: 16, borderRadius: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Ionicons name="information-circle-outline" size={24} color={colors.primary} />
              <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text, marginLeft: 12 }}>App Version</Text>
            </View>
            <Text style={{ fontSize: 14, color: colors.textSecondary }}>
              {Constants.expoConfig?.version ?? '1.0.0'} ({Constants.expoConfig?.android?.versionCode ?? '1'})
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* OTP verification modal for account deletion */}
      {otpModalVisible && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20, zIndex: 50 }}>
          <View style={{ width: '100%', maxWidth: 400, backgroundColor: colors.surface, borderRadius: 16, padding: 24, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, elevation: 6 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>Verify Mobile Number</Text>
            <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 8, lineHeight: 20 }}>
              Enter the OTP sent to your registered mobile number to confirm permanent account deletion.
            </Text>

            <TextInput
              style={{
                marginTop: 16,
                backgroundColor: colors.surfaceSecondary,
                borderRadius: 10,
                paddingHorizontal: 16,
                paddingVertical: 12,
                fontSize: 18,
                letterSpacing: 4,
                color: colors.text,
                borderWidth: 1,
                borderColor: colors.border,
              }}
              placeholder="Enter OTP"
              placeholderTextColor={colors.textSecondary}
              keyboardType="number-pad"
              maxLength={6}
              value={otp}
              onChangeText={setOtp}
            />

            <View style={{ marginTop: 20, flexDirection: 'row', justifyContent: 'space-between' }}>
              <TouchableOpacity
                disabled={sendingOtp}
                onPress={() => setOtpModalVisible(false)}
                style={{ flex: 1, paddingVertical: 12, marginRight: 8, borderRadius: 10, backgroundColor: colors.surfaceSecondary, alignItems: 'center' }}
              >
                <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                disabled={sendingOtp}
                onPress={sendDeleteOtp}
                style={{ flex: 1, paddingVertical: 12, marginHorizontal: 4, borderRadius: 10, backgroundColor: colors.surfaceSecondary, alignItems: 'center' }}
              >
                {sendingOtp ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={{ fontSize: 15, fontWeight: '600', color: colors.primary }}>Resend OTP</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                disabled={verifyingDelete}
                onPress={confirmDeleteWithOtp}
                style={{ flex: 1, paddingVertical: 12, marginLeft: 8, borderRadius: 10, backgroundColor: colors.danger, alignItems: 'center' }}
              >
                {verifyingDelete ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF' }}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}