import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import apiClient from '../../utils/apiClient';
import { API_URL } from '../../config/api';

interface DeviceSession {
  deviceId: string;
  deviceName: string;
  browser: string;
  os: string;
  authProvider: string;
  lastSeen: string;
  createdAt: string;
  isCurrentDevice: boolean;
}

export default function DevicesScreen() {
  const router = useRouter();
  const [devices, setDevices] = useState<DeviceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    fetchDevices();
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchDevices = async () => {
    try {
      const response = await apiClient.get(`${API_URL}/auth/devices`);
      if (!isMountedRef.current) return;
      if (response.data?.success && response.data?.devices) {
        setDevices(response.data.devices);
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to fetch active devices.');
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchDevices();
  };

  const handleRevokeDevice = (device: DeviceSession) => {
    Alert.alert(
      'Remove Device',
      `Are you sure you want to terminate the session on ${device.deviceName}? They will be logged out immediately.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await apiClient.delete(`${API_URL}/auth/devices/${device.deviceId}`);
              if (response.data?.success) {
                fetchDevices();
              } else {
                Alert.alert('Error', response.data?.message || 'Failed to remove device.');
              }
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.message || 'Failed to remove device.');
            }
          },
        },
      ]
    );
  };

  const handleLogoutOthers = () => {
    Alert.alert(
      'Log Out Other Devices',
      'Are you sure you want to terminate all other active device sessions? Only your current device will remain logged in.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out Others',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await apiClient.post(`${API_URL}/auth/devices/logout-others`);
              if (response.data?.success) {
                Alert.alert('Success', 'Successfully terminated other sessions.');
                fetchDevices();
              } else {
                Alert.alert('Error', response.data?.message || 'Failed to logout other devices.');
              }
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.message || 'Failed to logout other devices.');
            }
          },
        },
      ]
    );
  };

  const formatLastSeen = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const diffMs = Date.now() - date.getTime();
      const diffMins = Math.floor(diffMs / (60 * 1000));
      const diffHours = Math.floor(diffMs / (60 * 60 * 1000));

      if (diffMins < 1) return 'Active now';
      if (diffMins < 60) return `Active ${diffMins}m ago`;
      if (diffHours < 24) return `Active ${diffHours}h ago`;
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return 'Unknown';
    }
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
        <Text style={{ fontSize: 20, fontWeight: '700', color: '#111827' }}>Active Devices</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={{ fontSize: 14, color: '#6B7280', marginBottom: 20 }}>
          You can be logged in on up to 2 active devices. Review and manage your active sessions below.
        </Text>

        <View style={{ marginBottom: 24 }}>
          {devices.map((device) => (
            <View
              key={device.deviceId}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: '#FFFFFF',
                padding: 16,
                borderRadius: 12,
                marginBottom: 12,
                borderWidth: device.isCurrentDevice ? 1.5 : 0,
                borderColor: device.isCurrentDevice ? '#3B82F6' : 'transparent',
                shadowColor: '#000',
                shadowOpacity: 0.05,
                shadowRadius: 2,
                elevation: 1
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: device.isCurrentDevice ? '#EFF6FF' : '#F3F4F6',
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: 14
                  }}
                >
                  <Ionicons
                    name={device.os.toLowerCase().includes('ios') || device.os.toLowerCase().includes('android') ? 'phone-portrait-outline' : 'desktop-outline'}
                    size={24}
                    color={device.isCurrentDevice ? '#3B82F6' : '#6B7280'}
                  />
                </View>

                <View style={{ flex: 1, marginRight: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginRight: 8 }}>
                      {device.deviceName}
                    </Text>
                    {device.isCurrentDevice && (
                      <View style={{ backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, borderWidth: 1, borderColor: '#BFDBFE' }}>
                        <Text style={{ fontSize: 11, fontWeight: '600', color: '#1D4ED8' }}>This Device</Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 3 }}>
                    {device.os} • {device.browser}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
                    {formatLastSeen(device.lastSeen)}
                  </Text>
                </View>
              </View>

              {!device.isCurrentDevice && (
                <TouchableOpacity
                  onPress={() => handleRevokeDevice(device)}
                  style={{
                    padding: 8,
                    borderRadius: 8,
                    backgroundColor: '#FEF2F2',
                    justifyContent: 'center',
                    alignItems: 'center'
                  }}
                >
                  <Ionicons name="trash-outline" size={20} color="#EF4444" />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>

        {devices.length > 1 && (
          <TouchableOpacity
            onPress={handleLogoutOthers}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#FEF2F2',
              borderWidth: 1,
              borderColor: '#FCA5A5',
              paddingVertical: 14,
              borderRadius: 12,
              gap: 8,
              marginTop: 10
            }}
          >
            <Ionicons name="log-out-outline" size={20} color="#EF4444" />
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#B91C1C' }}>
              Log Out All Other Devices
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
