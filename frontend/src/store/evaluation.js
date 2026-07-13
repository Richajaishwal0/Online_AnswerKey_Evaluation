import { create } from 'zustand';
import { evaluationService } from '../services/index.js';

export const useEvaluationStore = create((set) => ({
  evaluation: null,
  isSaving: false,
  error: null,

  fetchEvaluation: async (answerSheetId) => {
    try {
      const response = await evaluationService.getEvaluation(answerSheetId);
      set({ evaluation: response.data });
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) { set({ evaluation: null }); return null; }
      set({ error: error.response?.data?.message || 'Failed to fetch evaluation' });
      return null;
    }
  },

  saveDraft: async (answerSheetId, marksArray, remarks, targetMarks, customMarks = []) => {
    set({ isSaving: true, error: null });
    try {
      const response = await evaluationService.saveDraft(answerSheetId, marksArray, remarks, targetMarks, customMarks);
      set({ isSaving: false });
      return response.data;
    } catch (error) {
      set({ error: error.response?.data?.message || 'Failed to save draft', isSaving: false });
      return null;
    }
  },

  submitEvaluation: async (answerSheetId, marksArray, remarks, targetMarks, customMarks = []) => {
    set({ isSaving: true, error: null });
    try {
      const response = await evaluationService.submitEvaluation(answerSheetId, marksArray, remarks, targetMarks, customMarks);
      set({ isSaving: false });
      return response.data;
    } catch (error) {
      set({ error: error.response?.data?.message || 'Failed to submit evaluation', isSaving: false });
      return null;
    }
  },

  resetEvaluation: () => set({ evaluation: null, error: null }),
  clearError: () => set({ error: null }),
}));
