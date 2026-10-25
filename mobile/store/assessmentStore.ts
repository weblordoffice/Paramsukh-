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
    wants_to_become_counsellor: string;
    ready_to_invest_lifetime: string;
    can_invest_one_year: string;
    investment_amount: string;
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

export interface WellnessGoals {
    physical: string;
    mental: string;
    relationship: string;
    financial: string;
    spiritual: string;
}

interface AssessmentState {
    answers: AssessmentAnswers;
    textInputs: { birthDate: string; occupation: string };
    scales: WellnessScales;
    issueDetails: IssueDetails;
    wellnessGoals: WellnessGoals;
    investmentOther: string;
    selectedCountryCode: string;
    selectedStateCode: string;
    isComplete: boolean;
    progressPercentage: number;

    setAnswer: (questionId: string, answer: string) => void;
    setTextInput: (fieldId: string, value: string) => void;
    setScale: (key: keyof WellnessScales, value: number | string) => void;
    setIssueDetail: (key: keyof IssueDetails, value: string) => void;
    setWellnessGoal: (key: keyof WellnessGoals, value: string) => void;
    setInvestmentOther: (value: string) => void;
    setCountryCode: (code: string) => void;
    setStateCode: (code: string) => void;
    hydrateFromStorage: () => Promise<void>;
    reset: () => void;
}

const initialState = {
    answers: {} as AssessmentAnswers,
    textInputs: { birthDate: '', occupation: '' },
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
    wellnessGoals: {
        physical: '',
        mental: '',
        relationship: '',
        financial: '',
        spiritual: '',
    } as WellnessGoals,
    investmentOther: '',
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

    setWellnessGoal: (key, value) => {
        set((state) => ({
            wellnessGoals: { ...state.wellnessGoals, [key]: value },
        }));
    },

    setInvestmentOther: (value) => {
        set({ investmentOther: value });
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
                        wants_to_become_counsellor: parsed.wants_to_become_counsellor || '',
                        ready_to_invest_lifetime: parsed.ready_to_invest_lifetime || '',
                        can_invest_one_year: parsed.can_invest_one_year || '',
                        investment_amount: parsed.investment_amount || '',
                    },
                    investmentOther: parsed.investmentOther || '',
                    textInputs: {
                        birthDate: parsed.birthDate || parsed.age || '',
                        occupation: parsed.occupation || '',
                    },
                    wellnessGoals: {
                        physical: parsed.wellnessGoals?.physical || '',
                        mental: parsed.wellnessGoals?.mental || '',
                        relationship: parsed.wellnessGoals?.relationship || '',
                        financial: parsed.wellnessGoals?.financial || '',
                        spiritual: parsed.wellnessGoals?.spiritual || '',
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
