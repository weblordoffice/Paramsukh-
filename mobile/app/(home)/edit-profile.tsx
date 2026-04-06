import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,             
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function EditProfileScreen() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: 'User Name',
    email: 'user@example.com',
    phone: '+91 1234567890',
    bio: 'Spiritual seeker on a journey of self-discovery.',
  });

  const handleSave = () => {
    console.log('Profile updated:', formData);
    router.back();
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
              value={formData.name}    
              onChangeText={(text) => setFormData({ ...formData, name: text })}
              placeholder="Enter your name"
            />      
          </View>           
          <View className="gap-2">      
            <Text className="text-sm font-semibold text-gray-700">Email</Text>
            <TextInput
              className="bg-white border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900"
              value={formData.email}
              onChangeText={(text) => setFormData({ ...formData, email: text })}
              placeholder="Enter your email"
              keyboardType="email-address"   
              autoCapitalize="none"    
            /> 
          </View>
           
          <View className="gap-2">
            <Text className="text-sm font-semibold text-gray-700">Phone</Text>
            <TextInput   
              className="bg-white border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900"
              value={formData.phone}
              onChangeText={(text) => setFormData({ ...formData, phone: text })}
              placeholder="Enter your phone"
              keyboardType="phone-pad"
            />
          </View>

          <View className="gap-2">
            <Text className="text-sm font-semibold text-gray-700">Bio</Text>
            <TextInput
              className="bg-white border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900 h-[100px] pt-3"
              value={formData.bio}
              onChangeText={(text) => setFormData({ ...formData, bio: text })}
              placeholder="Tell us about yourself"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity className="bg-blue-500 py-4 rounded-xl items-center mt-8 shadow-lg" onPress={handleSave}>
          <Text className="text-base font-bold text-white">Save Changes</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
