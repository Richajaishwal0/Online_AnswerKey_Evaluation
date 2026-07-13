import {
  comparePassword,
  generateAccessToken,
  generateRefreshToken,
} from "../utils/index.js";
import { FacultyRepository } from "../repositories/index.js";
import { getAuth } from "../config/firebase.js";

const facultyRepository = new FacultyRepository();

export class AuthService {
  async register(email, password, displayName = "", role = "teacher") {
    const validRoles = ["admin", "teacher", "student"];
    if (!validRoles.includes(role)) {
      throw { statusCode: 400, message: `Role must be one of: ${validRoles.join(", ")}` };
    }
    const firebaseAuth = getAuth();
    const userRecord = await firebaseAuth.createUser({ email, password, displayName: displayName || undefined });
    await firebaseAuth.setCustomUserClaims(userRecord.uid, { role });
    return { uid: userRecord.uid, email: userRecord.email, displayName: userRecord.displayName, role };
  }

  async login(email, password) {
    const faculty = await facultyRepository.findByEmail(email);
    if (!faculty) throw { statusCode: 401, message: "Invalid email or password" };
    const isPasswordValid = await comparePassword(password, faculty.password);
    if (!isPasswordValid) throw { statusCode: 401, message: "Invalid email or password" };
    const accessToken = generateAccessToken({ id: faculty.id, email: faculty.email, firstName: faculty.firstName, lastName: faculty.lastName });
    const refreshToken = generateRefreshToken({ id: faculty.id });
    return {
      accessToken,
      refreshToken,
      faculty: { id: faculty.id, email: faculty.email, firstName: faculty.firstName, lastName: faculty.lastName, department: faculty.department },
    };
  }

  async refreshToken(refreshToken) {
    const decoded = this.verifyRefreshToken(refreshToken);
    if (!decoded) throw { statusCode: 401, message: "Invalid refresh token" };
    const faculty = await facultyRepository.findById(decoded.id);
    if (!faculty) throw { statusCode: 401, message: "Faculty not found" };
    const newAccessToken = generateAccessToken({ id: faculty.id, email: faculty.email, firstName: faculty.firstName, lastName: faculty.lastName });
    return { accessToken: newAccessToken, refreshToken };
  }

  verifyRefreshToken(token) {
    return null;
  }
}

export class AdminService {
  async addStudent(data) {
    const { StudentRepository } = await import("../repositories/index.js");
    const repo = new StudentRepository();
    const existing = await repo.findByRollNumber(data.rollNumber);
    if (existing) throw { statusCode: 409, message: "Student with this roll number already exists." };
    return repo.create(data);
  }

  async updateStudent(id, data) {
    const { StudentRepository } = await import("../repositories/index.js");
    return new StudentRepository().update(id, data);
  }

  async deleteStudent(id) {
    const { StudentRepository } = await import("../repositories/index.js");
    return new StudentRepository().delete(id);
  }

  async listStudents(filters = {}) {
    const { StudentRepository } = await import("../repositories/index.js");
    return new StudentRepository().findMany(filters);
  }

  async getStudentFilters() {
    const { StudentRepository } = await import("../repositories/index.js");
    return new StudentRepository().getDistinctFilters();
  }

  async uploadSheet({ studentId, facultyId, examId, studentAnswerSheetUrl, answerKeyUrl }) {
    const { AnswerSheetRepository, StudentRepository } = await import("../repositories/index.js");
    const student = await new StudentRepository().findById(studentId);
    if (!student) throw { statusCode: 404, message: "Student not found." };
    return new AnswerSheetRepository().create({
      studentId,
      facultyId,
      examId,
      studentAnswerSheetUrl,
      answerKeyUrl: answerKeyUrl || "",
      status: "ASSIGNED",
    });
  }

  async listExams() {
    const prisma = (await import("../config/database.js")).default;
    return prisma.exam.findMany({ include: { subject: true }, orderBy: { createdAt: "desc" } });
  }

  async listFaculty() {
    const prisma = (await import("../config/database.js")).default;
    return prisma.faculty.findMany({
      select: { id: true, firstName: true, lastName: true, department: true, email: true },
      orderBy: { firstName: "asc" },
    });
  }

  async syncTeacherToFaculty({ email, displayName }) {
    const prisma = (await import("../config/database.js")).default;
    const existing = await prisma.faculty.findUnique({ where: { email } });
    if (existing) return { alreadyExists: true, faculty: existing };
    const parts = (displayName || '').trim().split(' ');
    const firstName = parts[0] || email.split('@')[0];
    const lastName  = parts.slice(1).join(' ') || '';
    const faculty = await prisma.faculty.create({
      data: { email, firstName, lastName, password: '' },
      select: { id: true, firstName: true, lastName: true, email: true },
    });
    return { alreadyExists: false, faculty };
  }
}

export class DashboardService {
  async getDashboardStats(facultyId) {
    const { AnswerSheetRepository } = await import("../repositories/index.js");
    const repo = new AnswerSheetRepository();
    const total = await repo.countByFacultyId(facultyId);
    const completed = await repo.countByFacultyIdAndStatus(facultyId, "COMPLETED");
    const assigned = await repo.countByFacultyIdAndStatus(facultyId, "ASSIGNED");
    const inProgress = await repo.countByFacultyIdAndStatus(facultyId, "IN_PROGRESS");
    return {
      totalPapers: total,
      completedPapers: completed,
      assignedPapers: assigned,
      inProgressPapers: inProgress,
      pendingPapers: total - completed,
    };
  }
}

export class PapersService {
  async getAssignedPapers(facultyId, skip = 0, take = 10, filters = {}) {
    const { AnswerSheetRepository } = await import("../repositories/index.js");
    const repo = new AnswerSheetRepository();
    const [papers, total] = await Promise.all([
      repo.findByFacultyId(facultyId, skip, take, filters),
      repo.countByFacultyId(facultyId, filters),
    ]);
    return {
      data: papers.map((paper) => ({
        id: paper.id,
        rollNumber: paper.student.rollNumber,
        studentName: `${paper.student.firstName} ${paper.student.lastName}`,
        department: paper.student.department || "",
        section: paper.student.section || "",
        year: paper.student.year || "",
        subject: paper.exam.subject.name,
        examName: paper.exam.name,
        status: paper.status,
        examCode: paper.exam.code,
        date: paper.exam.date,
      })),
      total,
      page: Math.floor(skip / take) + 1,
      pageSize: take,
    };
  }

  async getPaperFilters(facultyId) {
    const prisma = (await import("../config/database.js")).default;
    const sheets = await prisma.answerSheet.findMany({
      where: { facultyId },
      select: { student: { select: { department: true, section: true, year: true } }, status: true },
    });
    return {
      departments: [...new Set(sheets.map(s => s.student.department).filter(Boolean))].sort(),
      sections:    [...new Set(sheets.map(s => s.student.section).filter(Boolean))].sort(),
      years:       [...new Set(sheets.map(s => s.student.year).filter(Boolean))].sort(),
      statuses:    [...new Set(sheets.map(s => s.status).filter(Boolean))].sort(),
    };
  }

  async getPaperDetails(paperId) {
    const { AnswerSheetRepository } = await import("../repositories/index.js");
    const repo = new AnswerSheetRepository();
    const paper = await repo.findById(paperId);
    if (!paper) throw { statusCode: 404, message: "Paper not found" };
    return {
      id: paper.id,
      student: {
        rollNumber: paper.student.rollNumber,
        firstName: paper.student.firstName,
        lastName: paper.student.lastName,
        email: paper.student.email,
        department: paper.student.department,
        section: paper.student.section,
        year: paper.student.year,
      },
      exam: {
        id: paper.exam.id,
        code: paper.exam.code,
        name: paper.exam.name,
        totalMarks: paper.exam.totalMarks,
        duration: paper.exam.duration,
        date: paper.exam.date,
        answerKeyUrl: paper.exam.answerKeyUrl,
      },
      subject: {
        code: paper.exam.subject.code,
        name: paper.exam.subject.name,
        maxMarks: paper.exam.subject.maxMarks,
        targetMarks: paper.exam.subject.targetMarks,
      },
      answerSheetUrl: paper.studentAnswerSheetUrl,
      answerKeyUrl: paper.exam.answerKeyUrl || paper.answerKeyUrl,
      status: paper.status,
      questions: paper.exam.questions.map((q) => ({
        id: q.id,
        questionNumber: q.questionNumber,
        maxMarks: q.maxMarks,
      })),
      evaluation: paper.evaluation
        ? {
            id: paper.evaluation.id,
            status: paper.evaluation.status,
            totalObtainedMarks: paper.evaluation.totalObtainedMarks,
            totalConvertedMarks: paper.evaluation.totalConvertedMarks,
            targetMarks: paper.evaluation.targetMarks,
            remarks: paper.evaluation.remarks,
            customMarks: (paper.evaluation.customMarks || []).map((c) => ({
              questionNo:    c.questionNo    || c.label || '',
              label:         c.label         || c.questionNo || '',
              maxMarks:      c.maxMarks      ?? 0,
              obtainedMarks: c.obtainedMarks ?? 0,
              skipped:       c.skipped       ?? false,
            })),
            marks: paper.evaluation.marks.map((m) => ({
              questionId: m.questionId,
              obtainedMarks: m.obtainedMarks,
              convertedMarks: m.convertedMarks,
            })),
          }
        : null,
    };
  }

  async searchPapers(facultyId, query, skip = 0, take = 10) {
    const { AnswerSheetRepository } = await import("../repositories/index.js");
    const repo = new AnswerSheetRepository();
    const papers = await repo.searchByRollOrName(facultyId, query, skip, take);
    return papers.map((paper) => ({
      id: paper.id,
      rollNumber: paper.student.rollNumber,
      studentName: `${paper.student.firstName} ${paper.student.lastName}`,
      department: paper.student.department || "",
      section: paper.student.section || "",
      subject: paper.exam.subject.name,
      status: paper.status,
    }));
  }
}

export class EvaluationService {
  async getEvaluation(answersheetId) {
    const { EvaluationRepository } = await import("../repositories/index.js");
    const repo = new EvaluationRepository();
    const evaluation = await repo.findByAnswerSheetId(answersheetId);
    if (!evaluation) throw { statusCode: 404, message: "Evaluation not found" };
    return evaluation;
  }

  // marks        = [{ questionId, obtainedMarks }]          — DB-backed questions
  // customMarks  = [{ label, obtainedMarks, maxMarks }]     — teacher-added free questions
  async saveEvaluationDraft(answersheetId, marks, remarks = "", targetMarks = 0, customMarks = []) {
    const { AnswerSheetRepository, EvaluationRepository, MarkRepository } = await import("../repositories/index.js");
    const answerSheetRepo = new AnswerSheetRepository();
    const evaluationRepo = new EvaluationRepository();
    const markRepo = new MarkRepository();
    const { convertMarks } = await import("../utils/index.js");

    const answerSheet = await answerSheetRepo.findById(answersheetId);
    if (!answerSheet) throw { statusCode: 404, message: "Answer sheet not found" };

    let evaluation = await evaluationRepo.findByAnswerSheetId(answersheetId);
    if (!evaluation) {
      evaluation = await evaluationRepo.create({ answerSheetId: answersheetId, status: "DRAFT" });
    }

    let totalObtained = 0;

    // --- DB questions (validated against exam questions) ---
    for (const mark of marks) {
      const question = answerSheet.exam.questions.find((q) => q.id === mark.questionId);
      if (!question) throw { statusCode: 400, message: `Question ${mark.questionId} not found` };
      // Use teacher-overridden max if provided, else fall back to DB max
      const effectiveMax = (mark.overriddenMax && mark.overriddenMax > 0)
        ? mark.overriddenMax
        : question.maxMarks;
      if (mark.obtainedMarks > effectiveMax)
        throw { statusCode: 400, message: `Marks for Q${question.questionNumber} cannot exceed ${effectiveMax}` };
      if (mark.obtainedMarks < 0)
        throw { statusCode: 400, message: `Marks for Q${question.questionNumber} cannot be negative` };
      // skipped questions contribute 0 and are excluded from total max
      if (!mark.skipped) {
        await markRepo.upsertMark(evaluation.id, mark.questionId, mark.obtainedMarks, 0);
        totalObtained += mark.obtainedMarks;
      }
    }

    // --- Custom questions (free-form, stored as JSON) ---
    const sanitisedCustom = [];
    for (const cm of customMarks) {
      const obtained = parseFloat(cm.obtainedMarks) || 0;
      const max      = parseFloat(cm.maxMarks)      || 0;
      if (!cm.skipped && obtained < 0) throw { statusCode: 400, message: `Marks for "${cm.questionNo || cm.label}" cannot be negative` };
      if (!cm.skipped && max > 0 && obtained > max) throw { statusCode: 400, message: `Marks for "${cm.questionNo || cm.label}" cannot exceed ${max}` };
      sanitisedCustom.push({
        questionNo:    cm.questionNo   || cm.label || '',
        label:         cm.questionNo   || cm.label || '',
        obtainedMarks: cm.skipped ? 0 : obtained,
        maxMarks:      max,
        skipped:       cm.skipped || false,
      });
      if (!cm.skipped) totalObtained += obtained;
    }

    // total max = sum of active (non-skipped) question maxMarks (using overrides) + custom question maxMarks
    const dbMaxTotal = marks
      .filter((m) => !m.skipped)
      .reduce((s, m) => {
        const question = answerSheet.exam.questions.find((q) => q.id === m.questionId);
        const effectiveMax = (m.overriddenMax && m.overriddenMax > 0) ? m.overriddenMax : (question?.maxMarks || 0);
        return s + effectiveMax;
      }, 0);
    const customMaxTotal = sanitisedCustom.reduce((s, c) => s + c.maxMarks, 0);
    // If no marks sent at all (e.g. first save), fall back to exam totalMarks
    const maxMarksTotal = marks.length > 0 ? dbMaxTotal + customMaxTotal : answerSheet.exam.totalMarks + customMaxTotal;

    const totalConverted = targetMarks > 0 ? convertMarks(totalObtained, maxMarksTotal, targetMarks) : 0;

    await evaluationRepo.update(evaluation.id, {
      totalObtainedMarks:  totalObtained,
      totalConvertedMarks: Math.round(totalConverted * 100) / 100,
      targetMarks:         targetMarks || 0,
      remarks,
      customMarks:         sanitisedCustom,
    });
    await answerSheetRepo.updateStatus(answersheetId, "IN_PROGRESS");

    return {
      id:                  evaluation.id,
      totalObtainedMarks:  totalObtained,
      totalConvertedMarks: Math.round(totalConverted * 100) / 100,
      targetMarks:         targetMarks || 0,
      maxMarks:            maxMarksTotal,
      customMarks:         sanitisedCustom,
    };
  }

  async submitEvaluation(answersheetId, marks, remarks = "", targetMarks = 0, customMarks = []) {
    const { AnswerSheetRepository, EvaluationRepository } = await import("../repositories/index.js");
    const answerSheetRepo = new AnswerSheetRepository();
    const evaluationRepo  = new EvaluationRepository();
    const result = await this.saveEvaluationDraft(answersheetId, marks, remarks, targetMarks, customMarks);
    const evaluation = await evaluationRepo.findByAnswerSheetId(answersheetId);
    await evaluationRepo.update(evaluation.id, { status: "SUBMITTED" });
    await answerSheetRepo.updateStatus(answersheetId, "COMPLETED");
    return result;
  }
}
