import prisma from '../config/database.js';
import { sendResponse, sendErrorResponse } from '../utils/index.js';
import { HTTP_STATUS } from '../constants/index.js';

export class TeacherAnswerKeyController {

  // GET /api/answer-keys/teacher  — list keys uploaded by this teacher
  async list(req, res) {
    try {
      const facultyId = req.user.id;
      if (!facultyId) return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, 'Faculty record not found.');

      const keys = await prisma.teacherAnswerKey.findMany({
        where: { facultyId },
        orderBy: { createdAt: 'desc' },
      });
      sendResponse(res, HTTP_STATUS.OK, keys, 'Answer keys retrieved successfully');
    } catch (err) {
      sendErrorResponse(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, err.message);
    }
  }

  // POST /api/answer-keys/teacher/upload  — upload a new key with metadata
  async upload(req, res) {
    try {
      const facultyId = req.user.id;
      if (!facultyId) return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, 'Faculty record not found.');
      if (!req.file)  return sendErrorResponse(res, HTTP_STATUS.BAD_REQUEST, 'PDF file is required.');

      const { title, department, subject, examName, year, semester, notes } = req.body;
      if (!title) return sendErrorResponse(res, HTTP_STATUS.BAD_REQUEST, 'Title is required.');

      const fileUrl = `/pdfs/${req.file.filename}`;

      const key = await prisma.teacherAnswerKey.create({
        data: { facultyId, title, department, subject, examName, year, semester, notes, fileUrl },
      });
      sendResponse(res, HTTP_STATUS.CREATED, key, 'Answer key uploaded successfully');
    } catch (err) {
      sendErrorResponse(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, err.message);
    }
  }

  // DELETE /api/answer-keys/teacher/:id
  async remove(req, res) {
    try {
      const facultyId = req.user.id;
      const { id } = req.params;
      const key = await prisma.teacherAnswerKey.findUnique({ where: { id } });
      if (!key) return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, 'Key not found.');
      if (key.facultyId !== facultyId) return sendErrorResponse(res, HTTP_STATUS.FORBIDDEN, 'Not your key.');
      await prisma.teacherAnswerKey.delete({ where: { id } });
      sendResponse(res, HTTP_STATUS.OK, { id }, 'Deleted successfully');
    } catch (err) {
      sendErrorResponse(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, err.message);
    }
  }
}

export const teacherAnswerKeyController = new TeacherAnswerKeyController();
