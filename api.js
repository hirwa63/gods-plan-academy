// ============================================================
// GOD'S PLAN ACADEMY — API CONNECTION
// This file connects the frontend to the backend
// ============================================================

const API_URL = 'http://localhost:5000/api';

// ── Helper: get token from localStorage ──────────────────
const getToken = () => localStorage.getItem('gpa_token');
const getUser  = () => JSON.parse(localStorage.getItem('gpa_user') || 'null');
const setAuth  = (token, user) => {
  localStorage.setItem('gpa_token', token);
  localStorage.setItem('gpa_user', JSON.stringify(user));
};
const clearAuth = () => {
  localStorage.removeItem('gpa_token');
  localStorage.removeItem('gpa_user');
};

// ── Helper: make API request ──────────────────────────────
const apiRequest = async (method, endpoint, data = null, requiresAuth = false) => {
  const headers = { 'Content-Type': 'application/json' };
  if (requiresAuth) {
    const token = getToken();
    if (!token) throw new Error('Not logged in. Please login first.');
    headers['Authorization'] = `Bearer ${token}`;
  }

  const options = { method, headers };
  if (data && method !== 'GET') options.body = JSON.stringify(data);

  const response = await fetch(`${API_URL}${endpoint}`, options);
  const result   = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Something went wrong.');
  }
  return result;
};

// ============================================================
// AUTH API
// ============================================================
const Auth = {

  // Register new account
  register: async (userData) => {
    const result = await apiRequest('POST', '/auth/register', userData);
    if (result.token) setAuth(result.token, result.user);
    return result;
  },

  // Login
  login: async (login, password) => {
    const result = await apiRequest('POST', '/auth/login', { login, password });
    if (result.token) setAuth(result.token, result.user);
    return result;
  },

  // Logout
  logout: () => {
    clearAuth();
    window.location.reload();
  },

  // Get current user
  me: () => getUser(),

  // Check if logged in
  isLoggedIn: () => !!getToken(),

  // Change password
  changePassword: async (old_password, new_password) => {
    return apiRequest('PUT', '/auth/change-password', { old_password, new_password }, true);
  },

  // Forgot password
  forgotPassword: async (login) => {
    return apiRequest('POST', '/auth/forgot-password', { login });
  }
};

// ============================================================
// STUDENTS API
// ============================================================
const Students = {

  // Get all students (admin/director only)
  getAll: async (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    return apiRequest('GET', `/students?${params}`, null, true);
  },

  // Get one student by reg number
  getOne: async (regNumber) => {
    return apiRequest('GET', `/students/${regNumber}`, null, true);
  },

  // Add student
  add: async (studentData) => {
    return apiRequest('POST', '/students', studentData, true);
  },

  // Update student
  update: async (id, studentData) => {
    return apiRequest('PUT', `/students/${id}`, studentData, true);
  },

  // Delete student
  delete: async (id) => {
    return apiRequest('DELETE', `/students/${id}`, null, true);
  },

  // Update fee status
  updateFeeStatus: async (id, fee_status) => {
    return apiRequest('PATCH', `/students/${id}/fee-status`, { fee_status }, true);
  }
};

// ============================================================
// MARKS API
// ============================================================
const Marks = {

  // Access results (parent pays 100 RWF)
  accessResults: async (reg_number, parent_name, transaction_code) => {
    return apiRequest('POST', '/marks/access', { reg_number, parent_name, transaction_code });
  },

  // Post marks (teacher/admin)
  post: async (marksData) => {
    return apiRequest('POST', '/marks', marksData, true);
  },

  // Post discipline marks
  postDiscipline: async (disciplineData) => {
    return apiRequest('POST', '/marks/discipline', disciplineData, true);
  },

  // Get student marks (staff only)
  getStudentMarks: async (regNumber) => {
    return apiRequest('GET', `/marks/student/${regNumber}`, null, true);
  }
};

// ============================================================
// FEES API
// ============================================================
const Fees = {

  // Submit fee payment
  pay: async (paymentData) => {
    return apiRequest('POST', '/fees/pay', paymentData);
  },

  // Check balance
  checkBalance: async (regNumber) => {
    return apiRequest('GET', `/fees/balance/${regNumber}`);
  },

  // Get all transactions (admin/director)
  getTransactions: async () => {
    return apiRequest('GET', '/fees/transactions', null, true);
  },

  // Verify payment (admin/director)
  verifyPayment: async (id, status) => {
    return apiRequest('PATCH', `/fees/transactions/${id}/verify`, { status }, true);
  }
};

// ============================================================
// NEWS API
// ============================================================
const News = {

  // Get all news (public)
  getAll: async (category = null, limit = null) => {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (limit)    params.append('limit', limit);
    return apiRequest('GET', `/news?${params.toString()}`);
  },

  // Post news (admin/director)
  post: async (newsData) => {
    return apiRequest('POST', '/news', newsData, true);
  },

  // Update news
  update: async (id, newsData) => {
    return apiRequest('PUT', `/news/${id}`, newsData, true);
  },

  // Delete news
  delete: async (id) => {
    return apiRequest('DELETE', `/news/${id}`, null, true);
  }
};

// ============================================================
// STAFF API
// ============================================================
const Staff = {

  // Get all staff (director only)
  getAll: async (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    return apiRequest('GET', `/staff?${params}`, null, true);
  },

  // Add staff
  add: async (staffData) => {
    return apiRequest('POST', '/staff', staffData, true);
  },

  // Update staff
  update: async (id, staffData) => {
    return apiRequest('PUT', `/staff/${id}`, staffData, true);
  },

  // Delete staff
  delete: async (id) => {
    return apiRequest('DELETE', `/staff/${id}`, null, true);
  }
};

// ============================================================
// COMMENTS API
// ============================================================
const Comments = {

  // Send message to director (public)
  send: async (name, role, subject, message) => {
    return apiRequest('POST', '/comments', { sender_name: name, sender_role: role, subject, message });
  },

  // Get all comments (admin/director)
  getAll: async () => {
    return apiRequest('GET', '/comments', null, true);
  },

  // Get public comments
  getPublic: async () => {
    return apiRequest('GET', '/comments/public');
  },

  // Mark as read
  markRead: async (id) => {
    return apiRequest('PATCH', `/comments/${id}/read`, null, true);
  }
};

// ============================================================
// SETTINGS API
// ============================================================
const Settings = {

  // Get all settings (public)
  getAll: async () => {
    return apiRequest('GET', '/settings');
  },

  // Update settings (admin/director)
  update: async (settingsData) => {
    return apiRequest('PUT', '/settings', settingsData, true);
  },

  // Submit admission application (public)
  applyAdmission: async (admissionData) => {
    return apiRequest('POST', '/settings/admissions', admissionData);
  },

  // Get all admissions (admin/director)
  getAdmissions: async () => {
    return apiRequest('GET', '/settings/admissions', null, true);
  }
};

// ============================================================
// EXPORT ALL
// ============================================================
window.GPA = {
  API_URL,
  Auth,
  Students,
  Marks,
  Fees,
  News,
  Staff,
  Comments,
  Settings,
  getToken,
  getUser,
  isLoggedIn: Auth.isLoggedIn
};

console.log('✅ GPA API loaded — God\'s Plan Academy Backend Connected');