import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';

interface AssessmentModalProps {
  visible: boolean;
  onClose: () => void;
  onComplete: (answers: Record<string, string>) => void;
}

export default function AssessmentModal({ visible, onClose, onComplete }: AssessmentModalProps) {
  const { colors } = useTheme();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [textInputs, setTextInputs] = useState({
    number: '',
    age: '',
    occupation: '',
    location: '',
  });

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      paddingHorizontal: 20,
      paddingTop: Platform.OS === 'ios' ? 60 : 40,
      paddingBottom: 20,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    closeButton: {
      padding: 4,
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
      color: colors.text,
      marginBottom: 8,
    },
    required: {
      color: colors.danger,
    },
    textInput: {
      backgroundColor: colors.surfaceSecondary,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 14,
      fontSize: 15,
      color: colors.text,
    },
    questionBlock: {
      marginBottom: 24,
    },
    questionNumber: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.primary,
      marginBottom: 8,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    questionText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
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
      backgroundColor: colors.surfaceSecondary,
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: 12,
      paddingVertical: 12,
      gap: 6,
    },
    yesButtonSelected: {
      backgroundColor: colors.success,
      borderColor: colors.success,
    },
    noButtonSelected: {
      backgroundColor: colors.danger,
      borderColor: colors.danger,
    },
    yesNoText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    selectedYesNoText: {
      color: '#FFFFFF',
    },
    optionsGrid: {
      gap: 10,
    },
    optionCard: {
      backgroundColor: colors.surfaceSecondary,
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 14,
    },
    selectedOptionCard: {
      backgroundColor: colors.surfaceSecondary,
      borderColor: colors.primary,
    },
    optionContent: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    optionText: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.text,
      flex: 1,
    },
    selectedOptionText: {
      color: colors.text,
      fontWeight: '600',
    },
    footer: {
      backgroundColor: colors.surface,
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: Platform.OS === 'ios' ? 34 : 20,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    progressInfo: {
      marginBottom: 16,
    },
    progressText: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 8,
      fontWeight: '500',
    },
    progressBar: {
      height: 8,
      backgroundColor: colors.surfaceSecondary,
      borderRadius: 4,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: '#3B82F6',
      borderRadius: 4,
    },
    submitButton: {
      backgroundColor: '#3B82F6',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      borderRadius: 12,
      gap: 8,
    },
    submitButtonDisabled: {
      backgroundColor: colors.border,
    },
    submitButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: '#FFFFFF',
    },
  }), [colors]);

  const textFields = [
    { id: 'number', label: 'Number', placeholder: 'Enter your phone number', keyboardType: 'phone-pad' as const },
    { id: 'age', label: 'Age', placeholder: 'Enter your age', keyboardType: 'numeric' as const },
    { id: 'occupation', label: 'Occupation', placeholder: 'Enter your occupation', keyboardType: 'default' as const },
    { id: 'location', label: 'Location', placeholder: 'Enter your location', keyboardType: 'default' as const },
  ];

  const questions = [
    {
      id: 'physical_issue',
      question: 'Physical Issue',
      options: ['Yes', 'No'],
    },
    {
      id: 'special_disease_issue',
      question: 'Special Disease Issue',
      options: ['Yes', 'No'],
    },
    {
      id: 'relationship_issue',
      question: 'Relationship Issue',
      options: ['Yes', 'No'],
    },
    {
      id: 'emotional_issue',
      question: 'Emotional Issue',
      options: ['Yes', 'No'],
    },
    {
      id: 'intellectual_issue',
      question: 'Intellectual Issue',
      options: ['Yes', 'No'],
    },
    {
      id: 'financial_issue',
      question: 'Financial Issue',
      options: ['Yes', 'No'],
    },
    {
      id: 'social_issue',
      question: 'Social Issue',
      options: ['Yes', 'No'],
    },
    {
      id: 'spiritual_issue',
      question: 'Spiritual Issue',
      options: ['Yes', 'No'],
    },
  ];  const handleAnswer = (questionId: string, answer: string) => {
    setAnswers({ ...answers, [questionId]: answer });
  };

  const handleTextInput = (fieldId: string, value: string) => {
    setTextInputs({ ...textInputs, [fieldId]: value });
  };

  const handleSubmit = () => {
    const answeredCount = Object.keys(answers).length;
    const filledTextInputs = Object.values(textInputs).filter(val => val.trim() !== '').length;
    const totalFields = questions.length + textFields.length;
    const totalAnswered = answeredCount + filledTextInputs;

    if (totalAnswered < totalFields) {
      Alert.alert(
        'Incomplete Assessment',
        `You've completed ${totalAnswered} of ${totalFields} fields. Submit anyway?`,
        [
          { text: 'Continue', style: 'cancel' },
          {
            text: 'Submit',
            onPress: () => {
              onComplete({ ...answers, ...textInputs });
              setAnswers({});
              setTextInputs({ number: '', age: '', occupation: '', location: '' });
            },
          },
        ]
      );
    } else {
      onComplete({ ...answers, ...textInputs });
      setAnswers({});
      setTextInputs({ number: '', age: '', occupation: '', location: '' });
    }
  };

  const handleSkip = () => {
    Alert.alert(
      'Skip Assessment',
      'You can complete this later from your profile.',
      [
        { text: 'Continue', style: 'cancel' },
        {
          text: 'Skip',
          style: 'destructive',
          onPress: () => {
            setAnswers({});
            setTextInputs({ number: '', age: '', occupation: '', location: '' });
            onClose();
          },
        },
      ]
    );
  };

  const answeredCount = Object.keys(answers).length;
  const filledTextInputs = Object.values(textInputs).filter(val => val.trim() !== '').length;
  const totalFields = questions.length + textFields.length;
  const totalAnswered = answeredCount + filledTextInputs;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={handleSkip}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Welcome! 👋</Text>
            <Text style={styles.subtitle}>Help us personalize your experience</Text>
          </View>
          <TouchableOpacity onPress={handleSkip} style={styles.closeButton}>
            <Ionicons name="close" size={28} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Text Input Fields */}
          {textFields.map((field, index) => (
            <View key={field.id} style={styles.inputBlock}>
              <Text style={styles.inputLabel}>
                {field.label} <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.textInput}
                placeholder={field.placeholder}
                placeholderTextColor={colors.textSecondary}
                value={textInputs[field.id as keyof typeof textInputs]}
                onChangeText={(value) => handleTextInput(field.id, value)}
                keyboardType={field.keyboardType}
              />
            </View>
          ))}

          {/* Yes/No Questions */}
          {questions.map((question, index) => (
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

        <View style={styles.footer}>
          <View style={styles.progressInfo}>
            <Text style={styles.progressText}>
              {totalAnswered} of {totalFields} completed
            </Text>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${(totalAnswered / totalFields) * 100}%` },
                ]}
              />
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.submitButton,
              totalAnswered === 0 && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={totalAnswered === 0}
          >
            <Text style={styles.submitButtonText}>
              {totalAnswered === totalFields ? 'Complete Assessment' : 'Submit'}
            </Text>
            <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
