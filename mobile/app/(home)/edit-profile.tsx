import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,             
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import axios from 'axios';
import { API_URL } from '../../config/api';

export default function EditProfileScreen() {
  const router = useRouter();
  const { user, fetchCurrentUser } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    displayName: '',
  });

  useEffect(() => {
    if (user) {
      setFormData({
        displayName: user.displayName || '',
      });
      setIsLoading(false);
    } else {
      fetchUserProfile();
    }
  }, [user]);

  const fetchUserProfile = async () => {
    try {
      const token = await useAuthStore.getState().token;
      const response = await axios.get(`${API_URL}/user/profile`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (response.data.success) {
        const userData = response.data.user;
        setFormData({
          displayName: userData.displayName || '',
        });
      }
    } catch (error) {
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.displayName.trim()) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }

    setIsSaving(true);
    try {
      const token = await useAuthStore.getState().token;
      const response = await axios.put(
        `${API_URL}/user/profile`,
        { displayName: formData.displayName.trim() },
        { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
      );

      if (response.data.success) {
        await fetchCurrentUser();
        Alert.alert('Success', 'Profile updated successfully', [
          { text: 'OK', onPress: () => router.back() }
        ]);
      }
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Failed to update profile';
      Alert.alert('Error', msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 py-4 bg-white border-b border-gray-200">
        <TouchableOpacity className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center" onPress={() => router.push('/(home)/menu')}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-gray-900">Edit Profile</Text>
        <View className="w-10" />
      </View>

<ScrollView className="flex-1" contentContainerClassName="p-5">
        {isLoading ? (
          <View className="flex-1 items-center justify-center py-20">
            <ActivityIndicator size="large" color="#3B82F6" />
          </View>
        ) : (
          <>
            {/* Profile Image */}
            <View className="items-center mb-8"> 
              <View className="relative mb-3">
                <View className="w-[120px] h-[120px] rounded-full bg-gray-200 items-center justify-center">
                  <Ionicons name="person" size={60} color="#9CA3AF" />
                </View>  
                <TouchableOpacity className="absolute bottom-0 right-0 w-10 h-10 rounded-full bg-blue-500 items-center justify-center border-[3px] border-white">
                  <Ionicons name="camera" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
              <Text className="text-sm text-blue-500 font-semibold">Change Profile Photo</Text>
            </View>
                     
            {/* Form Fields */}      
            <View className="gap-5">    
              <View className="gap-2">
                <Text className="text-sm font-semibold text-gray-700">Name</Text>
                <TextInput       
                  className="bg-white border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900"
                  value={formData.displayName}    
                  onChangeText={(text) => setFormData({ ...formData, displayName: text })}
                  placeholder="Enter your name"
                />      
              </View>           
            </View>

            {/* Save Button */}
            <TouchableOpacity 
              className="bg-blue-500 py-4 rounded-xl items-center mt-8 shadow-lg" 
              onPress={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text className="text-base font-bold text-white">Save Changes</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
