import React, { useMemo, useState, useEffect } from 'react';
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
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import { Country, State } from 'country-state-city';
import Constants from 'expo-constants';

import apiClient from '../utils/apiClient';
import { useAssessmentStore } from '../store/assessmentStore';

function ScaleInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <View style={styles.scaleBlock}>
      <View style={styles.scaleHeader}>
        <Text style={styles.scaleLabel}>{label}</Text>
        <Text style={styles.scaleValue}>{value}/10</Text>
      </View>
      <View style={styles.scaleDots}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
          <TouchableOpacity
            key={n}
            style={[styles.scaleDot, value >= n && styles.scaleDotActive]}
            onPress={() => onChange(n)}
          >
            <Text style={[styles.scaleDotText, value >= n && styles.scaleDotTextActive]}>
              {n}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.scaleLabels}>
        <Text style={styles.scaleMinLabel}>Low</Text>
        <Text style={styles.scaleMaxLabel}>High</Text>
      </View>
    </View>
  );
}

function DetailInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <View style={styles.detailBlock}>
      <Text style={styles.detailLabel}>{label}</Text>
      <TextInput
        style={styles.detailTextInput}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        value={value}
        onChangeText={onChange}
        multiline
        numberOfLines={2}
        textAlignVertical="top"
      />
    </View>
  );
}

const ACTIVITY_LEVELS = [
  { value: 'sedentary', label: 'Sedentary', desc: 'Little to no exercise' },
  { value: 'light', label: 'Light', desc: 'Light activity 1-3 days/week' },
  { value: 'moderate', label: 'Moderate', desc: 'Moderate activity 3-5 days/week' },
  { value: 'active', label: 'Active', desc: 'Active 5-7 days/week' },
  { value: 'very_active', label: 'Very Active', desc: 'Intense daily training' },
];

export default function AssessmentScreen() {
  const router = useRouter();
  const store = useAssessmentStore();

  const {
    answers, textInputs, scales, issueDetails,
    selectedCountryCode, selectedStateCode,
    setAnswer, setTextInput, setScale, setIssueDetail,
    setCountryCode, setStateCode,
  } = store;

  const [isSubmitting, setIsSubmitting] = useState(false);

  const textFields = [
    { id: 'age', label: 'Age', placeholder: 'Enter your age', keyboardType: 'numeric' as const, required: true },
    { id: 'occupation', label: 'Occupation', placeholder: 'Enter your occupation', keyboardType: 'default' as const, required: true },
  ];

  const [countries, setCountries] = useState<ReturnType<typeof Country.getAllCountries>>([]);
  const [countriesLoading, setCountriesLoading] = useState(true);

  useEffect(() => {
    setCountries(Country.getAllCountries());
    setCountriesLoading(false);
  }, []);

  const states = useMemo(
    () => (selectedCountryCode ? State.getStatesOfCountry(selectedCountryCode) : []),
    [selectedCountryCode]
  );
  const selectedCountry = countries.find((country) => country.isoCode === selectedCountryCode);
  const selectedState = states.find((state) => state.isoCode === selectedStateCode);

  const questions = [
    { id: 'physical_issue', question: 'Do you have any Physical Issues?', detailKey: 'physicalIssueDetails' as const, detailLabel: 'Please describe your physical concerns', detailPlaceholder: 'e.g., back pain, joint issues, fatigue...' },
    { id: 'special_disease_issue', question: 'Do you have any Special Disease Issues?', detailKey: 'specialDiseaseDetails' as const, detailLabel: 'Please describe any medical conditions', detailPlaceholder: 'e.g., diabetes, hypertension, thyroid...' },
    { id: 'relationship_issue', question: 'Do you have any Relationship Issues?', detailKey: 'relationshipIssueDetails' as const, detailLabel: 'Please describe your relationship concerns', detailPlaceholder: 'e.g., communication, trust, loneliness...' },
    { id: 'financial_issue', question: 'Do you have any Financial Issues?', detailKey: 'financialIssueDetails' as const, detailLabel: 'Please describe your financial concerns', detailPlaceholder: 'e.g., debt, career uncertainty, budgeting...' },
    { id: 'emotional_issue', question: 'Do you have any Mental Health Issues?', detailKey: 'mentalHealthIssueDetails' as const, detailLabel: 'Please describe your mental health concerns', detailPlaceholder: 'e.g., anxiety, depression, stress...' },
    { id: 'spiritual_issue', question: 'Do you have any Spiritual Growth Interests?', detailKey: 'spiritualGrowthDetails' as const, detailLabel: 'Please describe your spiritual interests', detailPlaceholder: 'e.g., meditation, consciousness, purpose...' },
  ];

  const scaleQuestions = [
    { key: 'stressLevel' as const, label: 'Current Stress Level' },
    { key: 'sleepQuality' as const, label: 'Sleep Quality' },
    { key: 'energyLevel' as const, label: 'Daily Energy Level' },
    { key: 'moodRating' as const, label: 'Overall Mood' },
  ];

  const handleCountryChange = (countryCode: string) => {
    setCountryCode(countryCode);
  };

  const handleSubmit = async () => {
    const ageValue = parseInt(textInputs.age);
    if (isNaN(ageValue) || ageValue < 1 || ageValue > 150) {
      Alert.alert('Invalid Age', 'Please enter a valid age between 1 and 150.');
      return;
    }

    const answeredCount = Object.keys(answers).length;
    const filledTextInputs = Object.values(textInputs).filter(val => val.trim() !== '').length;
    const locationSelections = (selectedCountryCode ? 1 : 0) + (selectedStateCode ? 1 : 0);
    const totalFields = questions.length + textFields.length + 2;
    const totalAnswered = answeredCount + filledTextInputs + locationSelections;

    if (totalAnswered < totalFields) {
      const missingFields = totalFields - totalAnswered;
      Alert.alert(
        'Incomplete Assessment',
        `Please complete all required fields before proceeding. You have ${missingFields} field${missingFields > 1 ? 's' : ''} remaining.`,
        [{ text: 'OK' }]
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const assessmentData = {
        age: parseInt(textInputs.age),
        occupation: textInputs.occupation,
        countryCode: selectedCountry?.isoCode || '',
        countryName: selectedCountry?.name || '',
        stateCode: selectedState?.isoCode || '',
        stateName: selectedState?.name || '',
        location: selectedState && selectedCountry ? `${selectedState.name}, ${selectedCountry.name}` : '',
        stressLevel: scales.stressLevel,
        sleepQuality: scales.sleepQuality,
        energyLevel: scales.energyLevel,
        moodRating: scales.moodRating,
        physicalActivityLevel: scales.physicalActivityLevel,
        physicalIssue: answers.physical_issue === 'Yes',
        physicalIssueDetails: issueDetails.physicalIssueDetails,
        specialDiseaseIssue: answers.special_disease_issue === 'Yes',
        specialDiseaseDetails: issueDetails.specialDiseaseDetails,
        relationshipIssue: answers.relationship_issue === 'Yes',
        relationshipIssueDetails: issueDetails.relationshipIssueDetails,
        financialIssue: answers.financial_issue === 'Yes',
        financialIssueDetails: issueDetails.financialIssueDetails,
        mentalHealthIssue: answers.emotional_issue === 'Yes',
        mentalHealthIssueDetails: issueDetails.mentalHealthIssueDetails,
        spiritualGrowth: answers.spiritual_issue === 'Yes',
        spiritualGrowthDetails: issueDetails.spiritualGrowthDetails
      };

      const response = await apiClient.post('/assessment/submit', assessmentData);

      if (response.data.success) {
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

        await new Promise(resolve => setTimeout(resolve, 500));
        store.reset();
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
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Welcome to ParamSukh! 🙏</Text>
            <Text style={styles.subtitle}>Please complete your assessment to continue</Text>
          </View>
        </View>

        <View style={styles.progressContainer}>
          <View style={styles.progressInfo}>
            <Text style={styles.progressText}>
              {totalAnswered} of {totalFields} required completed
            </Text>
            <Text style={styles.progressPercent}>{Math.round(progressPercentage)}%</Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progressPercentage}%` }]} />
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Health Data Consent Banner */}
          <View style={styles.consentBanner}>
            <View style={styles.consentBannerContent}>
              <Ionicons name="shield-checkmark" size={20} color="#2563EB" style={{ marginRight: 8 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.consentBannerTitle}>Health Data Collection Notice</Text>
                <Text style={styles.consentBannerText}>
                  This assessment collects health-related information including physical conditions, mental health
                  status, and personal data to personalize your experience. By proceeding, you consent to this data
                  collection as described in our{' '}
                  <Text
                    style={styles.consentBannerLink}
                    onPress={() => {
                      const url = Constants.expoConfig?.extra?.privacyPolicyUrl;
                      if (url) Linking.openURL(url);
                    }}
                  >
                    Privacy Policy
                  </Text>
                  .
                </Text>
              </View>
            </View>
          </View>

          {/* Section: Personal Info */}
          <Text style={styles.sectionHeading}>Personal Information</Text>

          {textFields.map((field) => (
            <View key={field.id} style={styles.inputBlock}>
              <Text style={styles.inputLabel}>
                {field.label} <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[styles.textInput, textInputs[field.id as keyof typeof textInputs] && styles.textInputFilled]}
                placeholder={field.placeholder}
                placeholderTextColor="#9CA3AF"
                value={textInputs[field.id as keyof typeof textInputs]}
                onChangeText={(value) => setTextInput(field.id, value)}
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
                enabled={!countriesLoading}
              >
                <Picker.Item label={countriesLoading ? 'Loading countries...' : 'Select your country'} value="" />
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
                onValueChange={(value) => setStateCode(String(value))}
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

          {/* Section: Wellness State */}
          <Text style={styles.sectionHeading}>Your Current State</Text>
          <Text style={styles.sectionSubheading}>Rate how you've been feeling recently (1 = low, 10 = high)</Text>

          {scaleQuestions.map((sq) => (
            <ScaleInput
              key={sq.key}
              label={sq.label}
              value={scales[sq.key]}
              onChange={(v) => setScale(sq.key, v)}
            />
          ))}

          {/* Physical Activity Level */}
          <View style={styles.inputBlock}>
            <Text style={styles.inputLabel}>Physical Activity Level</Text>
            {ACTIVITY_LEVELS.map((level) => (
              <TouchableOpacity
                key={level.value}
                style={[
                  styles.activityOption,
                  scales.physicalActivityLevel === level.value && styles.activityOptionSelected,
                ]}
                onPress={() => setScale('physicalActivityLevel', level.value)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[
                    styles.activityLabel,
                    scales.physicalActivityLevel === level.value && styles.activityLabelSelected,
                  ]}>
                    {level.label}
                  </Text>
                  <Text style={styles.activityDesc}>{level.desc}</Text>
                </View>
                {scales.physicalActivityLevel === level.value && (
                  <Ionicons name="checkmark-circle" size={22} color="#3B82F6" />
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Section: Wellness Areas */}
          <Text style={styles.sectionHeading}>Wellness Areas</Text>
          <Text style={styles.sectionSubheading}>Tell us about any challenges you're facing</Text>

          {questions.map((question) => (
            <View key={question.id} style={styles.questionBlock}>
              <Text style={styles.questionText}>
                {question.question} <Text style={styles.required}>*</Text>
              </Text>

              <View style={styles.yesNoContainer}>
                {['Yes', 'No'].map((option) => {
                  const isSelected = answers[question.id] === option;
                  return (
                    <TouchableOpacity
                      key={option}
                      style={[
                        styles.yesNoButton,
                        isSelected && (option === 'Yes' ? styles.yesButtonSelected : styles.noButtonSelected),
                      ]}
                      onPress={() => setAnswer(question.id, option)}
                    >
                      <Text style={[styles.yesNoText, isSelected && styles.selectedYesNoText]}>
                        {option}
                      </Text>
                      {isSelected && <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {answers[question.id] === 'Yes' && (
                <DetailInput
                  label={question.detailLabel}
                  value={issueDetails[question.detailKey]}
                  onChange={(v) => setIssueDetail(question.detailKey, v)}
                  placeholder={question.detailPlaceholder}
                />
              )}
            </View>
          ))}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.submitButton, (!isComplete || isSubmitting) && styles.submitButtonDisabled]}
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
                  {isComplete ? 'Complete Assessment & Continue' : 'Complete All Required Fields'}
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
  sectionHeading: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginTop: 24,
    marginBottom: 4,
  },
  sectionSubheading: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 16,
  },
  consentBanner: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  consentBannerContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  consentBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E40AF',
    marginBottom: 4,
  },
  consentBannerText: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
  },
  consentBannerLink: {
    color: '#2563EB',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  inputBlock: {
    marginBottom: 20,
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
  scaleBlock: {
    marginBottom: 20,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  scaleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  scaleLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  scaleValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#3B82F6',
  },
  scaleDots: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  scaleDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scaleDotActive: {
    backgroundColor: '#3B82F6',
  },
  scaleDotText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
  },
  scaleDotTextActive: {
    color: '#FFFFFF',
  },
  scaleLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  scaleMinLabel: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  scaleMaxLabel: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  activityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  activityOptionSelected: {
    borderColor: '#3B82F6',
    backgroundColor: '#EFF6FF',
    borderWidth: 2,
  },
  activityLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  activityLabelSelected: {
    color: '#1D4ED8',
  },
  activityDesc: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  questionBlock: {
    marginBottom: 20,
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
  detailBlock: {
    marginTop: 12,
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 6,
  },
  detailTextInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: '#111827',
    minHeight: 50,
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
