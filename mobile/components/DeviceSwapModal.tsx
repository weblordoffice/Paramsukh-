import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';

interface ActiveDevice {
  deviceId: string;
  deviceName: string;
  os: string;
  browser: string;
  lastSeen: string;
}

interface DeviceSwapModalProps {
  visible: boolean;
  activeDevices: ActiveDevice[];
  onConfirm: (deviceIdToRemove: string) => void;
  onClose: () => void;
  isLoading: boolean;
}

export default function DeviceSwapModal({
  visible,
  activeDevices,
  onConfirm,
  onClose,
  isLoading
}: DeviceSwapModalProps) {
  const { colors } = useTheme();
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);

  const handleConfirm = () => {
    if (selectedDeviceId) {
      onConfirm(selectedDeviceId);
    }
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
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch (e) {
      return 'Unknown';
    }
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-black/50">
        <View
          className="rounded-t-3xl px-6 pt-6 pb-10 max-h-[80%]"
          style={{ backgroundColor: colors.surface }}
        >
          {/* Header */}
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-xl font-bold" style={{ color: colors.text }}>Device Limit Reached</Text>
            <TouchableOpacity onPress={onClose} disabled={isLoading}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Description */}
          <Text className="text-sm mb-6 leading-relaxed" style={{ color: colors.textSecondary }}>
            Your account is already active on 2 other devices. To sign in on this device, select one device to log out and replace:
          </Text>

          {/* Devices List */}
          <ScrollView className="mb-6" showsVerticalScrollIndicator={false}>
            {activeDevices.map((device) => {
              const isSelected = selectedDeviceId === device.deviceId;
              return (
                <TouchableOpacity
                  key={device.deviceId}
                  onPress={() => setSelectedDeviceId(device.deviceId)}
                  disabled={isLoading}
                  className="flex-row items-center justify-between p-4 mb-3 rounded-xl border"
                  style={{
                    borderColor: isSelected ? '#7C3AED' : colors.border,
                    backgroundColor: isSelected ? `${colors.primary}1A` : 'transparent',
                  }}
                >
                  <View className="flex-row items-center flex-1 mr-4">
                    <View
                      className="w-12 h-12 rounded-full justify-center items-center mr-3"
                      style={{
                        backgroundColor: isSelected ? `${colors.primary}30` : colors.surfaceSecondary,
                      }}
                    >
                      <Ionicons
                        name={(device.os || '').toLowerCase().includes('ios') || (device.os || '').toLowerCase().includes('android') ? 'phone-portrait-outline' : 'desktop-outline'}
                        size={22}
                        color={isSelected ? '#7C3AED' : colors.textSecondary}
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="font-semibold text-base" style={{ color: colors.text }}>{device.deviceName}</Text>
                      <Text className="text-xs mt-1" style={{ color: colors.textSecondary }}>
                        {device.os} • {device.browser}
                      </Text>
                      <Text className="text-xs mt-0.5" style={{ color: colors.textSecondary }}>
                        Last seen: {formatLastSeen(device.lastSeen)}
                      </Text>
                    </View>
                  </View>

                  <View
                    className="w-6 h-6 rounded-full border-2 items-center justify-center"
                    style={{
                      borderColor: isSelected ? '#7C3AED' : colors.border,
                      backgroundColor: isSelected ? '#7C3AED' : 'transparent',
                    }}
                  >
                    {isSelected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Confirm Button */}
          <TouchableOpacity
            onPress={handleConfirm}
            disabled={isLoading || !selectedDeviceId}
            className={`w-full py-4 rounded-xl flex-row justify-center items-center shadow-sm ${
              !selectedDeviceId ? 'bg-purple-300' : 'bg-purple-600 active:bg-purple-700'
            }`}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="swap-horizontal-outline" size={18} color="#FFFFFF" className="mr-2" />
                <Text className="text-white font-semibold text-base text-center">
                  Log Out Selected & Sign In
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
