import apiClient from "./api.js";

export const authService = {
  login: async (email, password) => {
    const response = await apiClient.post("/auth/login", { email, password });
    return response.data;
  },

  register: async (email, password, displayName, role) => {
    const response = await apiClient.post("/auth/register", {
      email,
      password,
      displayName,
      role,
    });
    return response.data;
  },

  logout: async () => {
    return apiClient.post("/auth/logout");
  },

  refreshToken: async (refreshToken) => {
    const response = await apiClient.post("/auth/refresh", { refreshToken });
    return response.data;
  },
};

export const dashboardService = {
  getStats: async () => {
    const response = await apiClient.get("/dashboard/stats");
    return response.data;
  },
};

export const papersService = {
  getPaperFilters: async () => {
    const response = await apiClient.get('/papers/filters');
    return response.data;
  },

  getAssignedPapers: async (page = 1, pageSize = 10, filters = {}) => {
    const response = await apiClient.get('/papers', {
      params: { page, pageSize, ...filters },
    });
    return response.data;
  },

  getPaperDetails: async (id) => {
    const response = await apiClient.get(`/papers/${id}`);
    return response.data;
  },

  searchPapers: async (query, page = 1, pageSize = 10) => {
    const response = await apiClient.get("/papers/search", {
      params: { query, page, pageSize },
    });
    return response.data;
  },
};

export const evaluationService = {
  getEvaluation: async (answerSheetId) => {
    const response = await apiClient.get(`/evaluations/${answerSheetId}`);
    return response.data;
  },

  saveDraft: async (answerSheetId, marks, remarks, targetMarks, customMarks = []) => {
    const response = await apiClient.post(
      `/evaluations/${answerSheetId}/draft`,
      { marks, remarks, targetMarks, customMarks },
    );
    return response.data;
  },

  submitEvaluation: async (answerSheetId, marks, remarks, targetMarks, customMarks = []) => {
    const response = await apiClient.post(
      `/evaluations/${answerSheetId}/submit`,
      { marks, remarks, targetMarks, customMarks },
    );
    return response.data;
  },
};

export const teacherAnswerKeyService = {
  list: async () => (await apiClient.get('/answer-keys/teacher')).data,
  upload: async (formData) =>
    (await apiClient.post('/answer-keys/teacher/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } })).data,
  remove: async (id) => (await apiClient.delete(`/answer-keys/teacher/${id}`)).data,
};

export const adminService = {
  // Firebase users
  listUsers: async () => (await apiClient.get('/admin/users')).data,
  createUser: async (email, password, displayName, role) =>
    (await apiClient.post('/admin/users', { email, password, displayName, role })).data,
  setUserRole: async (uid, role) =>
    (await apiClient.patch(`/admin/users/${uid}/role`, { role })).data,
  deleteUser: async (uid) => (await apiClient.delete(`/admin/users/${uid}`)).data,

  // Students
  listStudents: async (params = {}) => (await apiClient.get('/admin/students', { params })).data,
  getStudentFilters: async () => (await apiClient.get('/admin/students/filters')).data,
  createStudent: async (data) => (await apiClient.post('/admin/students', data)).data,
  updateStudent: async (id, data) => (await apiClient.patch(`/admin/students/${id}`, data)).data,
  deleteStudent: async (id) => (await apiClient.delete(`/admin/students/${id}`)).data,

  // Sheet upload
  listExams: async () => (await apiClient.get('/admin/exams')).data,
  listFaculty: async () => (await apiClient.get('/admin/faculty')).data,
  syncTeacher: async (email, displayName) =>
    (await apiClient.post('/admin/faculty/sync', { email, displayName })).data,
  uploadSheet: async (formData) =>
    (await apiClient.post('/admin/upload-sheet', formData, { headers: { 'Content-Type': 'multipart/form-data' } })).data,
};
