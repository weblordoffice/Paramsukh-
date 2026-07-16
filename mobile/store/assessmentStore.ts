import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AssessmentAnswers {
    [key: string]: string;
    physical_issue: string;
    special_disease_issue: string;
    relationship_issue: string;
    financial_issue: string;
    emotional_issue: string;
    spiritual_issue: string;
}

export interface WellnessScales {
    stressLevel: number;
    sleepQuality: number;
    energyLevel: number;
    moodRating: number;
    physicalActivityLevel: string;
}

export interface IssueDetails {
    physicalIssueDetails: string;
    specialDiseaseDetails: string;
    relationshipIssueDetails: string;
    financialIssueDetails: string;
    mentalHealthIssueDetails: string;
    spiritualGrowthDetails: string;
}

interface AssessmentState {
    answers: AssessmentAnswers;
    textInputs: { age: string; occupation: string };
    scales: WellnessScales;
    issueDetails: IssueDetails;
    selectedCountryCode: string;
    selectedStateCode: string;
    isComplete: boolean;
    progressPercentage: number;

    setAnswer: (questionId: string, answer: string) => void;
    setTextInput: (fieldId: string, value: string) => void;
    setScale: (key: keyof WellnessScales, value: number | string) => void;
    setIssueDetail: (key: keyof IssueDetails, value: string) => void;
    setCountryCode: (code: string) => void;
    setStateCode: (code: string) => void;
    hydrateFromStorage: () => Promise<void>;
    reset: () => void;
}

const initialState = {
    answers: {} as AssessmentAnswers,
    textInputs: { age: '', occupation: '' },
    scales: {
        stressLevel: 5,
        sleepQuality: 5,
        energyLevel: 5,
        moodRating: 5,
        physicalActivityLevel: 'moderate',
    } as WellnessScales,
    issueDetails: {
        physicalIssueDetails: '',
        specialDiseaseDetails: '',
        relationshipIssueDetails: '',
        financialIssueDetails: '',
        mentalHealthIssueDetails: '',
        spiritualGrowthDetails: '',
    } as IssueDetails,
    selectedCountryCode: '',
    selectedStateCode: '',
    isComplete: false,
    progressPercentage: 0,
};

export const useAssessmentStore = create<AssessmentState>((set, get) => ({
    ...initialState,

    setAnswer: (questionId, answer) => {
        set((state) => ({
            answers: { ...state.answers, [questionId]: answer },
        }));
    },

    setTextInput: (fieldId, value) => {
        set((state) => ({
            textInputs: { ...state.textInputs, [fieldId]: value },
        }));
    },

    setScale: (key, value) => {
        set((state) => ({
            scales: { ...state.scales, [key]: value },
        }));
    },

    setIssueDetail: (key, value) => {
        set((state) => ({
            issueDetails: { ...state.issueDetails, [key]: value },
        }));
    },

    setCountryCode: (code) => {
        set({ selectedCountryCode: code, selectedStateCode: '' });
    },

    setStateCode: (code) => {
        set({ selectedStateCode: code });
    },

    hydrateFromStorage: async () => {
        try {
            const raw = await AsyncStorage.getItem('assessment_answers');
            if (raw) {
                const parsed = JSON.parse(raw);
                set({
                    answers: {
                        physical_issue: parsed.physical_issue || '',
                        special_disease_issue: parsed.special_disease_issue || '',
                        relationship_issue: parsed.relationship_issue || '',
                        financial_issue: parsed.financial_issue || '',
                        emotional_issue: parsed.emotional_issue || '',
                        spiritual_issue: parsed.spiritual_issue || '',
                    },
                    textInputs: {
                        age: parsed.age || '',
                        occupation: parsed.occupation || '',
                    },
                    selectedCountryCode: parsed.countryCode || '',
                    selectedStateCode: parsed.stateCode || '',
                });
            }
        } catch (error) {
            // Ignore hydration errors
        }
    },

    reset: () => set(initialState),
}));
