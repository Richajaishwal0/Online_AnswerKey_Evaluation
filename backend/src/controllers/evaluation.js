import { EvaluationService } from '../services/index.js';
import { sendResponse, sendErrorResponse } from '../utils/index.js';
import { HTTP_STATUS, ERROR_MESSAGES, SUCCESS_MESSAGES } from '../constants/index.js';
import { submitEvaluationValidator } from '../validators/index.js';

const evaluationService = new EvaluationService();

export class EvaluationController {
  async getEvaluation(req, res) {
    try {
      const { answerSheetId } = req.params;
      const evaluation = await evaluationService.getEvaluation(answerSheetId);
      sendResponse(res, HTTP_STATUS.OK, evaluation, 'Evaluation retrieved successfully');
    } catch (error) {
      if (error.statusCode) {
        sendErrorResponse(res, error.statusCode, error.message);
      } else {
        sendErrorResponse(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, ERROR_MESSAGES.INTERNAL_SERVER_ERROR);
      }
    }
  }

  async saveDraft(req, res) {
    try {
      const { answerSheetId } = req.params;
      const { marks, remarks, targetMarks, customMarks } = req.body;

      if (!marks || !Array.isArray(marks)) {
        return sendErrorResponse(res, HTTP_STATUS.BAD_REQUEST, 'Marks array required');
      }

      const result = await evaluationService.saveEvaluationDraft(
        answerSheetId,
        marks,
        remarks || '',
        targetMarks || 0,
        customMarks || [],
      );

      sendResponse(res, HTTP_STATUS.OK, result, SUCCESS_MESSAGES.DRAFT_SAVED);
    } catch (error) {
      if (error.statusCode) {
        sendErrorResponse(res, error.statusCode, error.message);
      } else {
        sendErrorResponse(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, ERROR_MESSAGES.INTERNAL_SERVER_ERROR);
      }
    }
  }

  async submitEvaluation(req, res) {
    try {
      const { answerSheetId } = req.params;
      const { marks, remarks, targetMarks, customMarks } = req.body;

      const { error } = submitEvaluationValidator({ marks });

      if (error) {
        const errors = error.details.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        return sendErrorResponse(res, HTTP_STATUS.BAD_REQUEST, ERROR_MESSAGES.VALIDATION_ERROR, errors);
      }

      const result = await evaluationService.submitEvaluation(
        answerSheetId,
        marks,
        remarks || '',
        targetMarks || 0,
        customMarks || [],
      );

      sendResponse(res, HTTP_STATUS.OK, result, SUCCESS_MESSAGES.SUBMISSION_SUCCESS);
    } catch (error) {
      if (error.statusCode) {
        sendErrorResponse(res, error.statusCode, error.message);
      } else {
        sendErrorResponse(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, ERROR_MESSAGES.INTERNAL_SERVER_ERROR);
      }
    }
  }
}

export const evaluationController = new EvaluationController();
