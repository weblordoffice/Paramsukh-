import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StatusBar,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useCourseStore, Assignment, Question } from '../store/courseStore';

export default function AssignmentViewerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { currentCourse } = useCourseStore();

  const assignmentId = params.assignmentId as string;
  const courseColor = (params.courseColor as string) || '#8B5CF6';

  // Find the assignment in the current course
  const assignment = currentCourse?.assignments?.find(a => a._id === assignmentId) || 
                     currentCourse?.videos?.flatMap(v => v.assignments || []).find(a => a._id === assignmentId);

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showExplanation, setShowExplanation] = useState<Record<string, boolean>>({});

  if (!assignment) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Assignment not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleSelectOption = (questionId: string, option: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: option }));
    setShowExplanation(prev => ({ ...prev, [questionId]: true }));
  };

  const handleInputChange = (questionId: string, text: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: text }));
  };

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={28} color="#1E293B" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle} numberOfLines={1}>{assignment.title}</Text>
          <Text style={styles.headerSubtitle}>{assignment.questions?.length || 0} Questions</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {assignment.description ? (
          <Text style={styles.description}>{assignment.description}</Text>
        ) : null}

        {assignment.questions?.map((q, index) => {
          const isSelected = answers[q?._id];
          const isCorrect = isSelected === q?.correctAnswer;
          const showExp = showExplanation[q?._id];

          if (!q) return null;

          return (
            <View key={q._id || index} style={styles.questionCard}>
              <View style={styles.questionHeader}>
                <View style={[styles.qNum, { backgroundColor: courseColor }]}>
                  <Text style={styles.qNumText}>{index + 1}</Text>
                </View>
                <Text style={styles.questionText}>{q.questionText}</Text>
              </View>

              {q.type === 'mcq' ? (
                <View style={styles.optionsContainer}>
                  {q.options?.map((option, oIdx) => {
                    const isCurrentOption = answers[q._id] === option;
                    const isActuallyCorrect = option === q.correctAnswer;
                    
                    let optionStyle: any[] = [styles.option];
                    let textStyle: any[] = [styles.optionText];
                    
                    if (showExp) {
                      if (isActuallyCorrect) {
                        optionStyle.push(styles.optionCorrect);
                        textStyle.push(styles.textCorrect);
                      } else if (isCurrentOption) {
                        optionStyle.push(styles.optionWrong);
                        textStyle.push(styles.textWrong);
                      }
                    } else if (isCurrentOption) {
                      optionStyle.push({ borderColor: courseColor, backgroundColor: courseColor + '10' });
                    }

                    return (
                      <TouchableOpacity
                        key={oIdx}
                        disabled={showExp}
                        onPress={() => handleSelectOption(q._id, option)}
                        style={optionStyle}
                      >
                        <Text style={textStyle}>{option}</Text>
                        {showExp && isActuallyCorrect && (
                          <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                        )}
                        {showExp && isCurrentOption && !isActuallyCorrect && (
                          <Ionicons name="close-circle" size={20} color="#EF4444" />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="Type your answer here..."
                    value={answers[q._id] || ''}
                    onChangeText={(text) => handleInputChange(q._id, text)}
                    placeholderTextColor="#94A3B8"
                  />
                  <TouchableOpacity 
                    onPress={() => setShowExplanation(prev => ({ ...prev, [q._id]: true }))}
                    style={[styles.checkBtn, { backgroundColor: courseColor }]}
                  >
                    <Text style={styles.checkBtnText}>Check</Text>
                  </TouchableOpacity>
                </View>
              )}

              {showExp && (
                <View style={styles.explanationBox}>
                  <View style={styles.expHeader}>
                    <Ionicons name="information-circle-outline" size={18} color="#475569" />
                    <Text style={styles.expTitle}>Explanation</Text>
                  </View>
                  <Text style={styles.expText}>
                    {q.explanation || `The correct answer is: ${q.correctAnswer}`}
                  </Text>
                </View>
              )}
            </View>
          );
        })}

        <TouchableOpacity 
          onPress={() => router.back()} 
          style={[styles.finishBtn, { backgroundColor: courseColor }]}
        >
          <Text style={styles.finishBtnText}>Finish Practice</Text>
        </TouchableOpacity>
        
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFF',
  },
  closeBtn: {
    padding: 4,
  },
  headerTitleContainer: {
    marginLeft: 12,
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  scrollContent: {
    padding: 20,
  },
  description: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
    marginBottom: 24,
  },
  questionCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  questionHeader: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  qNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  qNumText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  questionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    flex: 1,
    lineHeight: 22,
  },
  optionsContainer: {
    gap: 10,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F1F5F9',
  },
  optionText: {
    fontSize: 14,
    color: '#475569',
    flex: 1,
  },
  optionCorrect: {
    borderColor: '#10B981',
    backgroundColor: '#DCFCE7',
  },
  textCorrect: {
    color: '#065F46',
    fontWeight: '600',
  },
  optionWrong: {
    borderColor: '#EF4444',
    backgroundColor: '#FEE2E2',
  },
  textWrong: {
    color: '#991B1B',
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#1E293B',
  },
  checkBtn: {
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
  explanationBox: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  expHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  expTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
  },
  expText: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
  },
  finishBtn: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  finishBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#64748B',
    marginBottom: 20,
  },
  backButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#0F172A',
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFF',
    fontWeight: '600',
  }
});
