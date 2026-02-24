export const endpoints = {
  // ================= AUTH =================
  auth: {
    register: "/auth/register",
    login: "/auth/login",
    deleteUser: "/auth/delete-user",
  },

  // ================= META =================
  meta: {
    departments: "/meta/departments",
  },

  // ================= COURSES =================
  courses: {
    create: "/courses/create",
    lecturer: (lecturerId: number | string) => `/courses/lecturer/${lecturerId}`,
    eligible: (studentId: number | string) => `/courses/eligible/${studentId}`,
    setEnrollment: "/courses/set-enrollment",
    scheduleCreate: "/courses/schedule/create",
    scheduleRemove: "/courses/schedule/remove",
    scheduleUpdate: "/courses/schedule/update",
    scheduleList: (courseId: number | string) => `/courses/${courseId}/schedule`,
    notificationsByStudent: (studentId: number | string) => `/courses/notifications/student/${studentId}`,
    notificationsMarkRead: "/courses/notifications/mark-read",

    // Lecturer view enrolled students
    students: (courseId: number | string) => `/courses/${courseId}/students`,
  },

  // ================= ENROLLMENTS =================
  enrollments: {
    enroll: "/enrollments/enroll",
    bulk: "/enrollments/bulk",
    unenroll: "/enrollments/unenroll",
    my: (studentId: number | string) => `/enrollments/my/${studentId}`,
    available: (studentId: number | string) => `/enrollments/available/${studentId}`,
  },

  // ================= SESSIONS =================
  sessions: {
    start: "/sessions/start",
    end: "/sessions/end",
    active: (courseId: number | string) => `/sessions/active/${courseId}`,
  },

  // ================= ATTENDANCE =================
  attendance: {
    scanImage: "/attendance/scan-image",
    mark: "/attendance/mark",
    sessionRecords: (sessionId: string) => `/attendance/session/${sessionId}`,
    dispute: "/attendance/dispute",
    disputesByStudent: (studentId: number | string) => `/attendance/disputes/student/${studentId}`,
    disputesByCourse: (courseId: number | string) => `/attendance/disputes/course/${courseId}`,
    disputesResolve: "/attendance/disputes/resolve",
  },


  // ================= EMBEDDINGS =================
  embeddings: {
    add: "/embeddings/add",
    list: (studentId: number | string) => `/embeddings/list/${studentId}`,
    livenessChallenge: "/embeddings/liveness-challenge",
  },

  // ================= REPORTS =================
  reports: {
    sessionJSON: (sessionId: number | string) => `/reports/session/${sessionId}/json`,
    sessionCSV: (sessionId: number | string) => `/reports/session/${sessionId}/export/csv`,
    sessionPDF: (sessionId: number | string) => `/reports/session/${sessionId}/export/pdf`,

    courseSummaryJSON: (courseId: number | string) => `/reports/course/${courseId}/summary/json`,
    courseSummaryCSV: (courseId: number | string) => `/reports/course/${courseId}/summary/export/csv`,
    courseSummaryPDF: (courseId: number | string) => `/reports/course/${courseId}/summary/export/pdf`,

    studentHistoryJSON: (studentId: number | string) => `/reports/student/${studentId}/history/json`,
    studentSummaryJSON: (studentId: number | string) => `/reports/student/${studentId}/summary/json`,
    courseStudentsSummaryJSON: (courseId: number | string) => `/reports/course/${courseId}/students/summary/json`,
    courseStudentsSummaryCSV: (courseId: number | string) => `/reports/course/${courseId}/students/summary/export/csv`,
    courseAnalyticsJSON: (courseId: number | string) => `/reports/course/${courseId}/analytics/json`,
  },

  // ================= PLANNER =================
  planner: {
    create: "/planner/create",
    update: "/planner/update",
    status: "/planner/status",
    delete: "/planner/delete",
    listByStudent: (studentId: number | string) => `/planner/student/${studentId}`,
  },
};
