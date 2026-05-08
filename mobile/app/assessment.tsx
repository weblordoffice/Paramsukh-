import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import { Country, State } from 'country-state-city';

import apiClient from '../utils/apiClient';

export default function AssessmentScreen() {
  const router = useRouter();

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [textInputs, setTextInputs] = useState({
    age: '',
    occupation: '',
  });
  const [selectedCountryCode, setSelectedCountryCode] = useState('');
  const [selectedStateCode, setSelectedStateCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const textFields = [
    { id: 'age', label: 'Age', placeholder: 'Enter your age', keyboardType: 'numeric' as const, required: true },
    { id: 'occupation', label: 'Occupation', placeholder: 'Enter your occupation', keyboardType: 'default' as const, required: true },
  ];

  const countries = useMemo(() => Country.getAllCountries(), []);
  const states = useMemo(
    () => (selectedCountryCode ? State.getStatesOfCountry(selectedCountryCode) : []),
    [selectedCountryCode]
  );
  const selectedCountry = countries.find((country) => country.isoCode === selectedCountryCode);
  const selectedState = states.find((state) => state.isoCode === selectedStateCode);
            
  const questions = [
    {
      id: 'physical_issue',
      question: 'Do you have any Physical Issues?',
      options: ['Yes', 'No'],
    },
    {
      id: 'special_disease_issue',
      question: 'Do you have any Special Disease Issues?',
      options: ['Yes', 'No'],
    },    
    {
      id: 'relationship_issue',
      question: 'Do you have any Relationship Issues?',
      options: ['Yes', 'No'],
    },
    {
      id: 'financial_issue',
      question: 'Do you have any Financial Issues?',
      options: ['Yes', 'No'],
    },
    {
      id: 'emotional_issue',
      question: 'Do you have any Mental Health Issues?',
      options: ['Yes', 'No'],
    },
    {
      id: 'spiritual_issue',
      question: 'Do you have any Spiritual Growth Interests?',
      options: ['Yes', 'No'],
    },
  ];

  const handleAnswer = (questionId: string, answer: string) => {
    setAnswers({ ...answers, [questionId]: answer });
  };

  const handleTextInput = (fieldId: string, value: string) => {
    setTextInputs({ ...textInputs, [fieldId]: value });
  };

  const handleCountryChange = (countryCode: string) => {
    setSelectedCountryCode(countryCode);
    setSelectedStateCode('');
  };

  const handleSubmit = async () => {
    // Validate age first
    const ageValue = parseInt(textInputs.age);
    if (isNaN(ageValue) || ageValue < 1 || ageValue > 150) {
      Alert.alert('Invalid Age', 'Please enter a valid age between 1 and 150.');
      return;
    }

    // Check if all fields are filled
    const answeredCount = Object.keys(answers).length;
    const filledTextInputs = Object.values(textInputs).filter(val => val.trim() !== '').length;
    const locationSelections = (selectedCountryCode ? 1 : 0) + (selectedStateCode ? 1 : 0);
    const totalFields = questions.length + textFields.length + 2;
    const totalAnswered = answeredCount + filledTextInputs + locationSelections;

    if (totalAnswered < totalFields) {
      const missingFields = totalFields - totalAnswered;
      Alert.alert(
        'Incomplete Assessment',
        `Please complete all fields before proceeding. You have ${missingFields} field${missingFields > 1 ? 's' : ''} remaining.`,
        [{ text: 'OK' }]
      );
      return;
    }

    // All fields completed - submit
    setIsSubmitting(true);
    
    try {
      // Prepare assessment data for API
      const assessmentData = {
        age: parseInt(textInputs.age),
        occupation: textInputs.occupation,
        countryCode: selectedCountry?.isoCode || '',
        countryName: selectedCountry?.name || '',
        stateCode: selectedState?.isoCode || '',
        stateName: selectedState?.name || '',
        location: selectedState && selectedCountry ? `${selectedState.name}, ${selectedCountry.name}` : '',
        physicalIssue: answers.physical_issue === 'Yes',
        physicalIssueDetails: '',
        specialDiseaseIssue: answers.special_disease_issue === 'Yes',
        specialDiseaseDetails: '',
        relationshipIssue: answers.relationship_issue === 'Yes',
        relationshipIssueDetails: '',
        financialIssue: answers.financial_issue === 'Yes',
        financialIssueDetails: '',
        mentalHealthIssue: answers.emotional_issue === 'Yes',
        mentalHealthIssueDetails: '',
        spiritualGrowth: answers.spiritual_issue === 'Yes',
        spiritualGrowthDetails: ''
      };

      // Submit to backend API (apiClient automatically adds auth token)
      const response = await apiClient.post('/assessment/submit', assessmentData);

      if (response.data.success) {
        // Save assessment completion locally
        await AsyncStorage.setItem('assessment_completed', 'true');
        const allAnswers = {
          ...answers,
          ...textInputs,
          countryCode: selectedCountry?.isoCode || '',
          countryName: selectedCountry?.name || '',
          stateCode: selectedState?.isoCode || '',
          stateName: selectedState?.name || '',
        };
        await AsyncStorage.setItem('assessment_answers', JSON.stringify(allAnswers));
        
        // Small delay for better UX
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Navigate to home
        router.replace('/(home)/menu');
      } else {
        throw new Error(response.data.message || 'Failed to submit assessment');
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message || 'Failed to submit assessment. Please try again.';
      Alert.alert('Error', errorMsg);
      setIsSubmitting(false);
    }
  };

  const answeredCount = Object.keys(answers).length;
  const filledTextInputs = Object.values(textInputs).filter(val => val.trim() !== '').length;
  const locationSelections = (selectedCountryCode ? 1 : 0) + (selectedStateCode ? 1 : 0);
  const totalFields = questions.length + textFields.length + 2;
  const totalAnswered = answeredCount + filledTextInputs + locationSelections;
  const progressPercentage = (totalAnswered / totalFields) * 100;
  const isComplete = totalAnswered === totalFields;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Welcome to ParamSukh! 🙏</Text>
            <Text style={styles.subtitle}>Please complete your assessment to continue</Text>
          </View>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressInfo}>
            <Text style={styles.progressText}>
              {totalAnswered} of {totalFields} completed
            </Text>
            <Text style={styles.progressPercent}>{Math.round(progressPercentage)}%</Text>
          </View>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${progressPercentage}%` },
              ]}
            />
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Text Input Fields */}
          {textFields.map((field) => (
            <View key={field.id} style={styles.inputBlock}>
              <Text style={styles.inputLabel}>
                {field.label} <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  textInputs[field.id as keyof typeof textInputs] && styles.textInputFilled
                ]}
                placeholder={field.placeholder}
                placeholderTextColor="#9CA3AF"
                value={textInputs[field.id as keyof typeof textInputs]}
                onChangeText={(value) => handleTextInput(field.id, value)}
                keyboardType={field.keyboardType}
              />
            </View>
          ))}

          <View style={styles.inputBlock}>
            <Text style={styles.inputLabel}>
              Country <Text style={styles.required}>*</Text>
            </Text>
            <View style={[styles.pickerWrapper, selectedCountryCode ? styles.textInputFilled : null]}>
              <Picker
                selectedValue={selectedCountryCode}
                onValueChange={(value) => handleCountryChange(String(value))}
                style={styles.picker}
              >
                <Picker.Item label="Select your country" value="" />
                {countries.map((country) => (
                  <Picker.Item key={country.isoCode} label={country.name} value={country.isoCode} />
                ))}
              </Picker>
            </View>
          </View>

          <View style={styles.inputBlock}>
            <Text style={styles.inputLabel}>
              State <Text style={styles.required}>*</Text>
            </Text>
            <View
              style={[
                styles.pickerWrapper,
                !selectedCountryCode ? styles.pickerWrapperDisabled : null,
                selectedStateCode ? styles.textInputFilled : null,
              ]}
            >
              <Picker
                enabled={!!selectedCountryCode}
                selectedValue={selectedStateCode}
                onValueChange={(value) => setSelectedStateCode(String(value))}
                style={styles.picker}
              >
                <Picker.Item
                  label={selectedCountryCode ? 'Select your state' : 'Select country first'}
                  value=""
                />
                {states.map((state) => (
                  <Picker.Item key={state.isoCode} label={state.name} value={state.isoCode} />
                ))}
              </Picker>
            </View>
          </View>

          {/* Yes/No Questions */}
          {questions.map((question) => (
            <View key={question.id} style={styles.questionBlock}>
              <Text style={styles.questionText}>
                {question.question} <Text style={styles.required}>*</Text>
              </Text>

              <View style={styles.yesNoContainer}>
                {question.options.map((option) => {
                  const isSelected = answers[question.id] === option;
                  return (
                    <TouchableOpacity
                      key={option}
                      style={[
                        styles.yesNoButton,
                        isSelected && (option === 'Yes' ? styles.yesButtonSelected : styles.noButtonSelected),
                      ]}
                      onPress={() => handleAnswer(question.id, option)}
                    >
                      <Text
                        style={[
                          styles.yesNoText,
                          isSelected && styles.selectedYesNoText,
                        ]}
                      >
                        {option}
                      </Text>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.submitButton,
              (!isComplete || isSubmitting) && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!isComplete || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <ActivityIndicator color="#FFFFFF" size="small" />
                <Text style={styles.submitButtonText}>Submitting...</Text>
              </>
            ) : (
              <>
                <Text style={styles.submitButtonText}>
                  {isComplete ? 'Complete Assessment & Continue' : 'Complete All Fields to Continue'}
                </Text>
                <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  progressContainer: {
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  progressPercent: {
    fontSize: 13,
    color: '#3B82F6',
    fontWeight: '600',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3B82F6',
    borderRadius: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  inputBlock: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  required: {
    color: '#EF4444',
  },
  textInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: '#111827',
  },
  textInputFilled: {
    borderColor: '#3B82F6',
    backgroundColor: '#FFFFFF',
  },
  pickerWrapper: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    overflow: 'hidden',
  },
  pickerWrapperDisabled: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
  },
  picker: {
    color: '#111827',
  },
  questionBlock: {
    marginBottom: 24,
  },
  questionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  yesNoContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  yesNoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 6,
  },
  yesButtonSelected: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  noButtonSelected: {
    backgroundColor: '#EF4444',
    borderColor: '#EF4444',
  },
  yesNoText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  selectedYesNoText: {
    color: '#FFFFFF',
  },
  footer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  submitButton: {
    backgroundColor: '#3B82F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
