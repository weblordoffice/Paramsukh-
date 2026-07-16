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
    age: '',
    occupation: '',
    location: '',
    physicalIssue: false,
    specialDiseaseIssue: false,
    relationshipIssue: false,
    financialIssue: false,
    mentalHealthIssue: false,
    spiritualGrowth: false
  });

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    try {
      const token = await useAuthStore.getState().token;
      const response = await axios.get(`${API_URL}/user/profile`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (response.data.success) {
        const userData = response.data.user;
        const details = response.data.profileDetails || {};
        setFormData({
          displayName: userData.displayName || '',
          age: details.age ? details.age.toString() : '',
          occupation: details.occupation || '',
          location: details.location || '',
          physicalIssue: !!details.physicalIssue,
          specialDiseaseIssue: !!details.specialDiseaseIssue,
          relationshipIssue: !!details.relationshipIssue,
          financialIssue: !!details.financialIssue,
          mentalHealthIssue: !!details.mentalHealthIssue,
          spiritualGrowth: !!details.spiritualGrowth
        });
      }
    } catch (error) {
      console.error('❌ Failed to fetch profile details:', error);
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
        {
          displayName: formData.displayName.trim(),
          age: formData.age ? parseInt(formData.age, 10) : undefined,
          occupation: formData.occupation.trim() || undefined,
          location: formData.location.trim() || undefined,
          physicalIssue: formData.physicalIssue,
          specialDiseaseIssue: formData.specialDiseaseIssue,
          relationshipIssue: formData.relationshipIssue,
          financialIssue: formData.financialIssue,
          mentalHealthIssue: formData.mentalHealthIssue,
          spiritualGrowth: formData.spiritualGrowth
        },
        { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
      );

      if (response.data.success) {
        await fetchCurrentUser();
        Alert.alert('Success', 'Profile updated successfully', [
          { text: 'OK', onPress: () => { if (router.canGoBack()) router.back(); } }
        ]);
      }
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Failed to update profile';
      Alert.alert('Error', msg);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleFocus = (key: keyof typeof formData) => {
    setFormData(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const focusAreas = [
    { key: 'physicalIssue', label: 'Physical Wellness', icon: 'fitness-outline' },
    { key: 'specialDiseaseIssue', label: 'Chronic Illness Recovery', icon: 'medical-outline' },
    { key: 'relationshipIssue', label: 'Healthy Relationships', icon: 'heart-outline' },
    { key: 'financialIssue', label: 'Financial Freedom', icon: 'cash-outline' },
    { key: 'mentalHealthIssue', label: 'Mental Clarity & Peace', icon: 'brain-outline' },
    { key: 'spiritualGrowth', label: 'Spiritual Growth', icon: 'rose-outline' }
  ];

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
                <View className="w-[100px] h-[100px] rounded-full bg-blue-100 items-center justify-center">
                  <Ionicons name="person" size={50} color="#3B82F6" />
                </View>  
              </View>
              <Text className="text-lg font-bold text-gray-800">{formData.displayName || 'Gurukul Learner'}</Text>
            </View>
                     
            {/* Form Fields */}      
            <View className="gap-5">    
              <View className="gap-2">
                <Text className="text-sm font-semibold text-gray-700">Display Name</Text>
                <TextInput       
                  className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900 shadow-sm"
                  value={formData.displayName}    
                  onChangeText={(text) => setFormData({ ...formData, displayName: text })}
                  placeholder="Enter your name"
                />      
              </View>

              <View className="gap-2">
                <Text className="text-sm font-semibold text-gray-700">Age</Text>
                <TextInput       
                  className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900 shadow-sm"
                  value={formData.age}
                  keyboardType="numeric"
                  onChangeText={(text) => setFormData({ ...formData, age: text.replace(/[^0-9]/g, '') })}
                  placeholder="Enter your age"
                />      
              </View>

              <View className="gap-2">
                <Text className="text-sm font-semibold text-gray-700">Occupation</Text>
                <TextInput       
                  className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900 shadow-sm"
                  value={formData.occupation}
                  onChangeText={(text) => setFormData({ ...formData, occupation: text })}
                  placeholder="e.g. Professional, Entrepreneur"
                />      
              </View>

              <View className="gap-2">
                <Text className="text-sm font-semibold text-gray-700">Location</Text>
                <TextInput       
                  className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900 shadow-sm"
                  value={formData.location}
                  onChangeText={(text) => setFormData({ ...formData, location: text })}
                  placeholder="e.g. New Delhi, India"
                />      
              </View>

              {/* Wellness Goals / Focus Areas */}
              <View className="gap-3 mt-2">
                <Text className="text-base font-bold text-gray-900">Your Wellness Focus Areas</Text>
                <Text className="text-xs text-gray-500 -mt-1">Select focus areas to align your Gurukul experience</Text>
                
                <View className="flex-row flex-wrap gap-2 mt-1">
                  {focusAreas.map((area) => {
                    const isActive = formData[area.key as keyof typeof formData] as boolean;
                    return (
                      <TouchableOpacity
                        key={area.key}
                        onPress={() => toggleFocus(area.key as any)}
                        className={`flex-row items-center px-4 py-3 rounded-full border shadow-sm ${
                          isActive 
                            ? 'bg-blue-500 border-blue-500' 
                            : 'bg-white border-gray-200'
                        }`}
                      >
                        <Ionicons 
                          name={area.icon as any} 
                          size={16} 
                          color={isActive ? '#FFFFFF' : '#4B5563'} 
                          style={{ marginRight: 6 }}
                        />
                        <Text 
                          className={`text-sm font-semibold ${
                            isActive ? 'text-white' : 'text-gray-700'
                          }`}
                        >
                          {area.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>

            {/* Save Button */}
            <TouchableOpacity 
              className="bg-blue-500 py-4 rounded-xl items-center mt-10 shadow-md" 
              onPress={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text className="text-base font-bold text-white">Save Profile Details</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
