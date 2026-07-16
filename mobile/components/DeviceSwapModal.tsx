import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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
        <View className="bg-white rounded-t-3xl px-6 pt-6 pb-10 max-h-[80%]">
          {/* Header */}
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-xl font-bold text-gray-900">Device Limit Reached</Text>
            <TouchableOpacity onPress={onClose} disabled={isLoading}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Description */}
          <Text className="text-gray-600 text-sm mb-6 leading-relaxed">
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
                  className={`flex-row items-center justify-between p-4 mb-3 rounded-xl border ${
                    isSelected ? 'border-purple-600 bg-purple-50/50' : 'border-gray-200 bg-gray-50/30'
                  }`}
                >
                  <View className="flex-row items-center flex-1 mr-4">
                    <View className={`w-12 h-12 rounded-full justify-center items-center mr-3 ${
                      isSelected ? 'bg-purple-100' : 'bg-gray-100'
                    }`}>
                      <Ionicons
                        name={device.os.toLowerCase().includes('ios') || device.os.toLowerCase().includes('android') ? 'phone-portrait-outline' : 'desktop-outline'}
                        size={22}
                        color={isSelected ? '#7C3AED' : '#4B5563'}
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="font-semibold text-gray-900 text-base">{device.deviceName}</Text>
                      <Text className="text-gray-500 text-xs mt-1">
                        {device.os} • {device.browser}
                      </Text>
                      <Text className="text-gray-400 text-xs mt-0.5">
                        Last seen: {formatLastSeen(device.lastSeen)}
                      </Text>
                    </View>
                  </View>

                  <View className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
                    isSelected ? 'border-purple-600 bg-purple-600' : 'border-gray-300'
                  }`}>
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
