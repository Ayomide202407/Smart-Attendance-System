import { useEffect, useMemo, useState, useRef } from "react";
import { createPortal } from "react-dom";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import { apiRequest } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import { Button } from "@/components/ui/button";
import TimePicker from "@/components/ui/time-picker";
import { toast } from "@/components/ui/sonner";
import { useLocation } from "react-router-dom";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000";

type Course = {
  id: string;
  course_code: string;
  course_title: string;
  is_open_for_enrollment: boolean;
  allowed_departments?: string[];
  enrollment_open_at?: string | null;
  enrollment_close_at?: string | null;
  is_effectively_open?: boolean;
  enrolled_count?: number;
  sessions_count?: number;
  attendance_rate?: number;
};

type Student = {
  id: string;
  full_name: string;
  identifier: string;
  department: string;
  enrolled_at: string | null;
};

type StudentSummaryRow = {
  student_id: string;
  student_identifier: string;
  student_name: string;
  department: string;
  total_sessions: number;
  attended: number;
  missed: number;
  percentage: number;
  attended_session_ids?: string[];
  missed_session_ids?: string[];
};

type CourseAnalytics = {
  totals?: {
    enrolled: number;
    sessions: number;
    marked: number;
    attendance_rate: number;
  };
  methods?: Record<string, number>;
  average_confidence?: number | null;
  disputes?: {
    pending: number;
    approved: number;
    rejected: number;
  };
};

type CourseSummarySession = {
  session_id: string;
  status: string;
  start_time?: string | null;
  end_time?: string | null;
  marked_count?: number;
  enrolled_count?: number;
  attendance_rate?: number;
};

type CourseMeta = {
  id?: string;
  course_code?: string;
  course_title?: string;
};

type CourseSchedule = {
  id: string;
  course_id: string;
  day_of_week: number;
  start_time: string;
  duration_minutes: number;
  location?: string | null;
  is_recurring?: boolean;
  schedule_date?: string | null;
};

export default function LecturerClasses() {
  const { user } = useAuth();
  const location = useLocation();
  const lecturerId = useMemo(() => (user?.id ? String(user.id) : null), [user?.id]);
  const manageRef = useRef<HTMLDivElement | null>(null);

  const [courses, setCourses] = useState<Course[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [deptQuery, setDeptQuery] = useState("");

  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState<string | null>(null);

  // Create course form
  const [courseCode, setCourseCode] = useState("");
  const [courseTitle, setCourseTitle] = useState("");
  const [enrollmentOpenAt, setEnrollmentOpenAt] = useState("");
  const [enrollmentCloseAt, setEnrollmentCloseAt] = useState("");

  // Bulk enroll
  const [bulkByCourse, setBulkByCourse] = useState<Record<string, string>>({});
  const [bulkWorking, setBulkWorking] = useState<string | null>(null);

  // Students view
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(null);
  const [studentsByCourse, setStudentsByCourse] = useState<Record<string, Student[]>>({});
  const [loadingStudentsFor, setLoadingStudentsFor] = useState<string | null>(null);

  // Attendance summary
  const [summaryCourseId, setSummaryCourseId] = useState<string | null>(null);
  const [summaryRows, setSummaryRows] = useState<StudentSummaryRow[]>([]);
  const [loadingSummaryFor, setLoadingSummaryFor] = useState<string | null>(null);
  const [summaryAnalytics, setSummaryAnalytics] = useState<CourseAnalytics | null>(null);
  const [loadingAnalyticsFor, setLoadingAnalyticsFor] = useState<string | null>(null);
  const [summarySessions, setSummarySessions] = useState<CourseSummarySession[]>([]);
  const [loadingSummarySessions, setLoadingSummarySessions] = useState(false);
  const [summaryMeta, setSummaryMeta] = useState<CourseMeta | null>(null);

  const sessionStartById = useMemo(() => {
    const map = new Map<string, Date>();
    summarySessions.forEach((s) => {
      if (s.session_id && s.start_time) map.set(s.session_id, new Date(s.start_time));
    });
    return map;
  }, [summarySessions]);

  const [schedulesByCourse, setSchedulesByCourse] = useState<Record<string, CourseSchedule[]>>({});
  const [loadingScheduleFor, setLoadingScheduleFor] = useState<string | null>(null);
  const [scheduleFormByCourse, setScheduleFormByCourse] = useState<
    Record<string, {
      day_of_week: number;
      start_time: string;
      duration_minutes: number;
      location: string;
      is_recurring: boolean;
      schedule_date: string;
      editing_id?: string | null;
    }>
  >({});

  async function loadDepartments() {
    const res: any = await apiRequest(endpoints.meta.departments);
    const list: string[] = Array.isArray(res) ? res : res?.departments ?? [];
    setDepartments(list);
  }

  async function loadCourses() {
    if (!lecturerId) return;
    setLoading(true);
    try {
      const res: any = await apiRequest(endpoints.courses.lecturer(lecturerId));
      setCourses(res?.courses ?? []);
    } finally {
      setLoading(false);
    }
  }

  function toggleDept(dept: string) {
    setSelectedDepts((prev) =>
      prev.includes(dept) ? prev.filter((d) => d !== dept) : [...prev, dept]
    );
    setDeptQuery("");
  }

  const filteredDepartments = useMemo(() => {
    const q = deptQuery.trim().toLowerCase();
    if (!q) return departments;
    return departments.filter((d) => d.toLowerCase().includes(q));
  }, [departments, deptQuery]);

  async function createCourse() {
    if (!lecturerId) return;

    const code = courseCode.trim();
    const title = courseTitle.trim();
    if (!code || !title) return toast.error("Enter course code and course title.");
    if (selectedDepts.length === 0) return toast.error("Select at least one allowed department.");

    setWorking("create");
    try {
      await apiRequest(endpoints.courses.create, {
        method: "POST",
        body: {
          lecturer_id: lecturerId,
          course_code: code,
          course_title: title,
          allowed_departments: selectedDepts,
          is_open_for_enrollment: true,
          enrollment_open_at: enrollmentOpenAt ? new Date(enrollmentOpenAt).toISOString() : null,
          enrollment_close_at: enrollmentCloseAt ? new Date(enrollmentCloseAt).toISOString() : null,
        },
      });

      toast.success("Course created");
      setCourseCode("");
      setCourseTitle("");
      setEnrollmentOpenAt("");
      setEnrollmentCloseAt("");
      await loadCourses();
    } catch (e: any) {
      toast.error(e?.message || "Failed to create course");
    } finally {
      setWorking(null);
    }
  }

  async function setEnrollment(courseId: string, open: boolean) {
    if (!lecturerId) return;
    setWorking(courseId);
    try {
      await apiRequest(endpoints.courses.setEnrollment, {
        method: "POST",
        body: { lecturer_id: lecturerId, course_id: courseId, is_open_for_enrollment: open },
      });
      await loadCourses();
    } catch (e: any) {
      toast.error(e?.message || "Failed to update enrollment status");
    } finally {
      setWorking(null);
    }
  }

  async function loadStudents(courseId: string) {
    if (!lecturerId) return;
    setLoadingStudentsFor(courseId);
    try {
      const url = `${endpoints.courses.students(courseId)}?lecturer_id=${encodeURIComponent(
        lecturerId
      )}`;
      const res: any = await apiRequest(url);
      setStudentsByCourse((prev) => ({ ...prev, [courseId]: res?.students ?? [] }));
    } catch (e: any) {
      toast.error(e?.message || "Failed to load students");
      setStudentsByCourse((prev) => ({ ...prev, [courseId]: [] }));
    } finally {
      setLoadingStudentsFor(null);
    }
  }

  async function viewStudents(courseId: string) {
    if (!lecturerId) return;

    if (expandedCourseId === courseId) {
      setExpandedCourseId(null);
      return;
    }

    setExpandedCourseId(courseId);

    if (studentsByCourse[courseId]) return;

    await loadStudents(courseId);
  }

  function downloadCourseCSV(courseId: string) {
    window.open(`${API_BASE_URL}${endpoints.reports.courseSummaryCSV(courseId)}`, "_blank");
  }

  function downloadCoursePDF(courseId: string) {
    window.open(`${API_BASE_URL}${endpoints.reports.courseSummaryPDF(courseId)}`, "_blank");
  }

  function downloadStudentsSummaryCSV(courseId: string) {
    window.open(`${API_BASE_URL}${endpoints.reports.courseStudentsSummaryCSV(courseId)}`, "_blank");
  }

  async function viewAttendanceSummary(courseId: string) {
    setSummaryCourseId(courseId);
    setLoadingSummaryFor(courseId);
    setSummaryAnalytics(null);
    setSummarySessions([]);
    setSummaryMeta(null);
    setLoadingSummarySessions(true);
    try {
      const res: any = await apiRequest(
        `${endpoints.reports.courseStudentsSummaryJSON(courseId)}?include_sessions=1`
      );
      setSummaryRows(res?.students ?? []);
      loadAnalytics(courseId).catch(() => null);
      const sessRes: any = await apiRequest(endpoints.reports.courseSummaryJSON(courseId));
      setSummarySessions(sessRes?.sessions ?? []);
      setSummaryMeta(sessRes?.course ?? null);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load attendance summary");
      setSummaryRows([]);
      setSummaryAnalytics(null);
      setSummarySessions([]);
      setSummaryMeta(null);
    } finally {
      setLoadingSummaryFor(null);
      setLoadingSummarySessions(false);
    }
  }

  function csvEscape(value: string | number | null | undefined) {
    if (value === null || value === undefined) return "";
    const s = String(value);
    if (/[",\n]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }

  function patternForRow(r: StudentSummaryRow, sessionStartById: Map<string, Date>) {
    const attendedIds = r.attended_session_ids ?? [];
    const missedIds = r.missed_session_ids ?? [];
    if (attendedIds.length === 0 && missedIds.length === 0) return "No sessions yet";

    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const timeBucket = (d: Date) => {
      const h = d.getHours();
      if (h >= 5 && h <= 11) return "morning";
      if (h >= 12 && h <= 16) return "afternoon";
      if (h >= 17 && h <= 21) return "evening";
      return "late";
    };

    const attendDayCounts: Record<string, number> = {};
    const attendTimeCounts: Record<string, number> = {};
    attendedIds.forEach((sid) => {
      const dt = sessionStartById.get(sid);
      if (!dt) return;
      const day = dayNames[dt.getDay()];
      const t = timeBucket(dt);
      attendDayCounts[day] = (attendDayCounts[day] || 0) + 1;
      attendTimeCounts[t] = (attendTimeCounts[t] || 0) + 1;
    });

    const missedDayCounts: Record<string, number> = {};
    missedIds.forEach((sid) => {
      const dt = sessionStartById.get(sid);
      if (!dt) return;
      const day = dayNames[dt.getDay()];
      missedDayCounts[day] = (missedDayCounts[day] || 0) + 1;
    });

    const topAttendTime = Object.entries(attendTimeCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
    const topAttendDay = Object.entries(attendDayCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
    const topMissDay = Object.entries(missedDayCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

    const pieces: string[] = [];
    if (topAttendTime) pieces.push(`Mostly ${topAttendTime} classes`);
    if (topAttendDay) pieces.push(`Best on ${topAttendDay}s`);
    if (topMissDay && missedIds.length >= 2) pieces.push(`Misses most on ${topMissDay}s`);

    return pieces.length ? pieces.join(" - ") : "No clear pattern";
  }

  function downloadInsightsCSV() {
    if (summaryRows.length === 0) {
      toast.error("No attendance data to export.");
      return;
    }
    const header = [
      "student_identifier",
      "student_name",
      "department",
      "total_sessions",
      "attended",
      "missed",
      "percentage",
      "remark",
      "pattern",
    ];

    const lines = [header.join(",")];
    summaryRows.forEach((r) => {
      const remark = remarkForRow(r).label;
      const pattern = patternForRow(r, sessionStartById);
      lines.push(
        [
          csvEscape(r.student_identifier),
          csvEscape(r.student_name),
          csvEscape(r.department),
          csvEscape(r.total_sessions),
          csvEscape(r.attended),
          csvEscape(r.missed),
          csvEscape(r.percentage.toFixed(2)),
          csvEscape(remark),
          csvEscape(pattern),
        ].join(",")
      );
    });

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const code = summaryMeta?.course_code ? summaryMeta.course_code.replace(/\s+/g, "_") : "course";
    a.href = url;
    a.download = `attendance_insights_${code}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function parseIdentifiers(input: string) {
    return input
      .split(/[\n,;\t]+/g)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  async function bulkEnroll(courseId: string) {
    if (!lecturerId) return;
    const raw = bulkByCourse[courseId] || "";
    const identifiers = parseIdentifiers(raw);
    if (identifiers.length === 0) return toast.error("Paste student identifiers (matric numbers) first.");

    setBulkWorking(courseId);
    try {
      const res: any = await apiRequest(endpoints.enrollments.bulk, {
        method: "POST",
        body: {
          lecturer_id: lecturerId,
          course_id: courseId,
          identifiers,
        },
      });
      toast.success(`Bulk enroll complete: ${res?.success ?? 0} success, ${res?.failed ?? 0} failed`);
      setBulkByCourse((prev) => ({ ...prev, [courseId]: "" }));
      await loadCourses();
      await loadStudents(courseId);
    } catch (e: any) {
      toast.error(e?.message || "Bulk enroll failed");
    } finally {
      setBulkWorking(null);
    }
  }

  const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  function getScheduleForm(courseId: string) {
    return (
      scheduleFormByCourse[courseId] || {
        day_of_week: 0,
        start_time: "09:00",
        duration_minutes: 60,
        location: "",
        is_recurring: true,
        schedule_date: new Date().toISOString().slice(0, 10),
        editing_id: null,
      }
    );
  }

  async function loadSchedule(courseId: string) {
    if (!lecturerId) return;
    setLoadingScheduleFor(courseId);
    try {
      const res: any = await apiRequest(
        `${endpoints.courses.scheduleList(courseId)}?lecturer_id=${encodeURIComponent(lecturerId)}`
      );
      setSchedulesByCourse((prev) => ({ ...prev, [courseId]: res?.schedules ?? [] }));
    } catch (e: any) {
      toast.error(e?.message || "Failed to load schedule");
      setSchedulesByCourse((prev) => ({ ...prev, [courseId]: [] }));
    } finally {
      setLoadingScheduleFor(null);
    }
  }

  async function addSchedule(courseId: string) {
    if (!lecturerId) return;
    const form = getScheduleForm(courseId);
    if (form.editing_id) {
      return updateSchedule(courseId, form.editing_id);
    }
    setWorking(`schedule-${courseId}`);
    try {
      await apiRequest(endpoints.courses.scheduleCreate, {
        method: "POST",
        body: {
          lecturer_id: lecturerId,
          course_id: courseId,
          day_of_week: form.day_of_week,
          start_time: form.start_time,
          duration_minutes: form.duration_minutes,
          location: form.location || null,
          is_recurring: form.is_recurring,
          schedule_date: form.is_recurring ? null : form.schedule_date,
        },
      });
      toast.success("Schedule added");
      await loadSchedule(courseId);
    } catch (e: any) {
      toast.error(e?.message || "Failed to add schedule");
    } finally {
      setWorking(null);
    }
  }

  async function updateSchedule(courseId: string, scheduleId: string) {
    if (!lecturerId) return;
    const form = getScheduleForm(courseId);
    setWorking(`schedule-${courseId}`);
    try {
      await apiRequest(endpoints.courses.scheduleUpdate, {
        method: "POST",
        body: {
          lecturer_id: lecturerId,
          schedule_id: scheduleId,
          day_of_week: form.day_of_week,
          start_time: form.start_time,
          duration_minutes: form.duration_minutes,
          location: form.location || null,
          is_recurring: form.is_recurring,
          schedule_date: form.is_recurring ? null : form.schedule_date,
        },
      });
      toast.success("Schedule updated");
      setScheduleFormByCourse((prev) => ({
        ...prev,
        [courseId]: { ...getScheduleForm(courseId), editing_id: null },
      }));
      await loadSchedule(courseId);
    } catch (e: any) {
      toast.error(e?.message || "Failed to update schedule");
    } finally {
      setWorking(null);
    }
  }

  async function removeSchedule(courseId: string, scheduleId: string) {
    if (!lecturerId) return;
    setWorking(`schedule-${courseId}`);
    try {
      await apiRequest(endpoints.courses.scheduleRemove, {
        method: "POST",
        body: { lecturer_id: lecturerId, schedule_id: scheduleId },
      });
      toast.success("Schedule removed");
      await loadSchedule(courseId);
    } catch (e: any) {
      toast.error(e?.message || "Failed to remove schedule");
    } finally {
      setWorking(null);
    }
  }

  useEffect(() => {
    loadDepartments().catch(console.error);
    loadCourses().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lecturerId]);

  useEffect(() => {
    courses.forEach((c) => {
      if (schedulesByCourse[c.id] === undefined) {
        loadSchedule(c.id).catch(() => null);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courses]);

  useEffect(() => {
    if (location.hash === "#manage" && manageRef.current) {
      manageRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [location.hash]);

  function remarkForRow(r: StudentSummaryRow) {
    if (r.percentage >= 90) return { label: "Excellent", tone: "text-green-700 bg-green-50 border-green-200" };
    if (r.percentage >= 75) return { label: "Good", tone: "text-emerald-700 bg-emerald-50 border-emerald-200" };
    if (r.percentage >= 60) return { label: "Fair", tone: "text-amber-700 bg-amber-50 border-amber-200" };
    return { label: "At Risk", tone: "text-red-700 bg-red-50 border-red-200" };
  }

  async function loadAnalytics(courseId: string) {
    try {
      setLoadingAnalyticsFor(courseId);
      const res: any = await apiRequest(
        `${endpoints.reports.courseAnalyticsJSON(courseId)}?lecturer_id=${encodeURIComponent(lecturerId || "")}`
      );
      setSummaryAnalytics(res ?? null);
    } catch {
      setSummaryAnalytics(null);
    } finally {
      setLoadingAnalyticsFor(null);
    }
  }

  return (
    <DashboardLayout userType="lecturer">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Class Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create courses, open enrollment, view students, download reports.
          </p>
        </div>

        {/* Create Course */}
        <div className="surface-card animate-slide-up p-6 space-y-5">
          <div>
            <h2 className="font-semibold text-lg">Create a Course</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Set course details, enrollment window, and allowed departments.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-sm text-muted-foreground">Course Code</label>
              <input
                value={courseCode}
                onChange={(e) => setCourseCode(e.target.value)}
                placeholder="EEE 351"
                className="mt-1 w-full rounded-lg border px-3 py-2 outline-none"
              />
            </div>

            <div>
              <label className="text-sm text-muted-foreground">Course Title</label>
              <input
                value={courseTitle}
                onChange={(e) => setCourseTitle(e.target.value)}
                placeholder="Signals and Systems"
                className="mt-1 w-full rounded-lg border px-3 py-2 outline-none"
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-sm text-muted-foreground">Enrollment Opens (optional)</label>
              <input
                type="datetime-local"
                value={enrollmentOpenAt}
                onChange={(e) => setEnrollmentOpenAt(e.target.value)}
                className="mt-1 w-full rounded-lg border px-3 py-2 outline-none"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Enrollment Closes (optional)</label>
              <input
                type="datetime-local"
                value={enrollmentCloseAt}
                onChange={(e) => setEnrollmentCloseAt(e.target.value)}
                className="mt-1 w-full rounded-lg border px-3 py-2 outline-none"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Allowed Departments</label>
            <input
              value={deptQuery}
              onChange={(e) => setDeptQuery(e.target.value)}
              placeholder="Search departments"
              className="w-full rounded-lg border px-3 py-2 outline-none"
            />
            <div className="rounded-lg border border-border/60 bg-card max-h-56 overflow-auto">
              {filteredDepartments.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground">No match found.</p>
              ) : (
                filteredDepartments.map((dept) => {
                  const active = selectedDepts.includes(dept);
                  return (
                    <button
                      key={dept}
                      type="button"
                      onClick={() => toggleDept(dept)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 ${
                        active ? "bg-blue-100 text-blue-900 font-medium" : ""
                      }`}
                    >
                      {dept}
                    </button>
                  );
                })
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Selected:{" "}
              {selectedDepts.length === 0 ? (
                <span className="text-muted-foreground">None</span>
              ) : (
                <span className="inline-flex flex-wrap gap-2">
                  {selectedDepts.map((dept) => (
                    <span
                      key={dept}
                      className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-900"
                    >
                      {dept}
                    </span>
                  ))}
                </span>
              )}
            </p>
          </div>

          <Button onClick={createCourse} disabled={working === "create"}>
            {working === "create" ? "Creating..." : "Create Course"}
          </Button>
        </div>

        {/* Manage Courses */}
        <div id="manage" ref={manageRef} className="surface-card animate-slide-up p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-lg">Manage Courses</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Open/close enrollment, view students, and download reports.
              </p>
            </div>
            <Button variant="secondary" onClick={loadCourses} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
          </div>

          {courses.length === 0 ? (
            <div className="rounded-xl border border-border/60 bg-muted/40 p-6">
              <p className="text-sm text-muted-foreground">No courses yet.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {courses.map((c) => (
                <div key={c.id} className="rounded-xl border border-border/60 bg-card p-5 space-y-4 hover-lift">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">
                        {c.course_title}{" "}
                        <span className="text-muted-foreground">({c.course_code})</span>
                      </p>
                    <p
                      className={`text-xs mt-1 ${
                        (c.is_effectively_open ?? c.is_open_for_enrollment)
                          ? "text-green-700"
                          : "text-muted-foreground"
                      }`}
                    >
                      Enrollment: {(c.is_effectively_open ?? c.is_open_for_enrollment) ? "Open" : "Closed"}
                    </p>
                  {c.enrollment_open_at || c.enrollment_close_at ? (
                    <p className="text-xs text-muted-foreground mt-1">
                      Window:{" "}
                      {c.enrollment_open_at ? new Date(c.enrollment_open_at).toLocaleString() : "Now"} {" "}
                      -{" "}
                      {c.enrollment_close_at ? new Date(c.enrollment_close_at).toLocaleString() : "No end"}
                    </p>
                  ) : null}
                  {typeof c.enrolled_count === "number" && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Enrolled: {c.enrolled_count} - Sessions: {c.sessions_count ?? 0} - Attendance: {c.attendance_rate ?? 0}%
                    </p>
                  )}
                </div>

                    <div className="flex gap-2 flex-wrap">
                      <Button onClick={() => setEnrollment(c.id, true)} disabled={working === c.id}>
                        Open
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => setEnrollment(c.id, false)}
                        disabled={working === c.id}
                      >
                        Close
                      </Button>

                      <Button
                        variant="outline"
                        onClick={() => viewStudents(c.id)}
                        disabled={loadingStudentsFor === c.id}
                      >
                        {loadingStudentsFor === c.id
                          ? "Loading..."
                          : expandedCourseId === c.id
                          ? "Hide Students"
                          : "View Students"}
                      </Button>

                      <Button variant="outline" onClick={() => viewAttendanceSummary(c.id)}>
                        Attendance Insights
                      </Button>
                      <Button variant="outline" onClick={() => downloadStudentsSummaryCSV(c.id)}>
                        Student Summary CSV
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border/60 bg-muted/40 p-4 space-y-2">
                    <p className="text-sm font-semibold">Bulk Enroll (by matric/ID)</p>
                    <textarea
                      className="w-full min-h-[80px] rounded-lg border px-3 py-2 text-sm"
                      placeholder="Paste identifiers separated by comma or new line"
                      value={bulkByCourse[c.id] ?? ""}
                      onChange={(e) =>
                        setBulkByCourse((prev) => ({ ...prev, [c.id]: e.target.value }))
                      }
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => bulkEnroll(c.id)}
                        disabled={bulkWorking === c.id}
                      >
                        {bulkWorking === c.id ? "Enrolling..." : "Bulk Enroll"}
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        Students must belong to allowed departments and complete face setup.
                      </span>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border/60 bg-muted/40 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">Class Schedule</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => loadSchedule(c.id)}
                        disabled={loadingScheduleFor === c.id}
                      >
                        {loadingScheduleFor === c.id ? "Loading..." : "Refresh Schedule"}
                      </Button>
                    </div>

                    {(schedulesByCourse[c.id] ?? []).length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No schedule set. Add weekly class times below.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {(schedulesByCourse[c.id] ?? []).map((s) => (
                          <div
                            key={s.id}
                            className="flex items-center justify-between gap-3 rounded-lg border bg-white px-3 py-2 text-sm"
                          >
                            <div className="min-w-0">
                              <p className="font-medium">
                                {s.is_recurring === false && s.schedule_date
                                  ? `${s.schedule_date} - ${dayNames[s.day_of_week]}`
                                  : dayNames[s.day_of_week]}{" "}
                                - {s.start_time} - {s.duration_minutes} mins
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {s.is_recurring === false ? "One-time" : "Weekly"}
                              </p>
                              {s.location && (
                                <p className="text-xs text-muted-foreground">Location: {s.location}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setScheduleFormByCourse((prev) => ({
                                    ...prev,
                                    [c.id]: {
                                      day_of_week: s.day_of_week,
                                      start_time: s.start_time,
                                      duration_minutes: s.duration_minutes,
                                      location: s.location || "",
                                      is_recurring: s.is_recurring !== false,
                                      schedule_date: s.schedule_date || new Date().toISOString().slice(0, 10),
                                      editing_id: s.id,
                                    },
                                  }))
                                }
                                disabled={working === `schedule-${c.id}`}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => removeSchedule(c.id, s.id)}
                                disabled={working === `schedule-${c.id}`}
                              >
                                Remove
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="grid gap-3 md:grid-cols-5">
                      <div>
                        <label className="text-xs text-muted-foreground">Type</label>
                        <select
                          className="mt-1 w-full rounded-lg border px-2 py-2 text-sm"
                          value={getScheduleForm(c.id).is_recurring ? "weekly" : "one-time"}
                          onChange={(e) =>
                            setScheduleFormByCourse((prev) => ({
                              ...prev,
                              [c.id]: {
                                ...getScheduleForm(c.id),
                                is_recurring: e.target.value === "weekly",
                              },
                            }))
                          }
                        >
                          <option value="weekly">Weekly</option>
                          <option value="one-time">One-time</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">
                          {getScheduleForm(c.id).is_recurring ? "Day" : "Date"}
                        </label>
                        {getScheduleForm(c.id).is_recurring ? (
                          <select
                            className="mt-1 w-full rounded-lg border px-2 py-2 text-sm"
                            value={getScheduleForm(c.id).day_of_week}
                            onChange={(e) =>
                              setScheduleFormByCourse((prev) => ({
                                ...prev,
                                [c.id]: {
                                  ...getScheduleForm(c.id),
                                  day_of_week: Number(e.target.value),
                                },
                              }))
                            }
                          >
                            {dayNames.map((d, idx) => (
                              <option key={d} value={idx}>{d}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="date"
                            className="mt-1 w-full rounded-lg border px-2 py-2 text-sm"
                            value={getScheduleForm(c.id).schedule_date}
                            onChange={(e) =>
                              setScheduleFormByCourse((prev) => ({
                                ...prev,
                                [c.id]: { ...getScheduleForm(c.id), schedule_date: e.target.value },
                              }))
                            }
                          />
                        )}
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Start Time</label>
                        <div className="mt-1">
                          <TimePicker
                            value={getScheduleForm(c.id).start_time}
                            onChange={(val) =>
                              setScheduleFormByCourse((prev) => ({
                                ...prev,
                                [c.id]: { ...getScheduleForm(c.id), start_time: val },
                              }))
                            }
                            start="07:00"
                            end="19:00"
                            stepMinutes={30}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Duration (mins)</label>
                        <input
                          type="number"
                          min={15}
                          max={300}
                          className="mt-1 w-full rounded-lg border px-2 py-2 text-sm"
                          value={getScheduleForm(c.id).duration_minutes}
                          onChange={(e) =>
                            setScheduleFormByCourse((prev) => ({
                              ...prev,
                              [c.id]: {
                                ...getScheduleForm(c.id),
                                duration_minutes: Number(e.target.value),
                              },
                            }))
                          }
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Location</label>
                        <input
                          className="mt-1 w-full rounded-lg border px-2 py-2 text-sm"
                          placeholder="e.g., EE Lab 2"
                          value={getScheduleForm(c.id).location}
                          onChange={(e) =>
                            setScheduleFormByCourse((prev) => ({
                              ...prev,
                              [c.id]: { ...getScheduleForm(c.id), location: e.target.value },
                            }))
                          }
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => addSchedule(c.id)}
                        disabled={working === `schedule-${c.id}`}
                      >
                        {working === `schedule-${c.id}` ? "Saving..." : getScheduleForm(c.id).editing_id ? "Update Schedule" : "Add Schedule"}
                      </Button>
                      {getScheduleForm(c.id).editing_id && (
                        <Button
                          variant="outline"
                          onClick={() =>
                            setScheduleFormByCourse((prev) => ({
                              ...prev,
                              [c.id]: { ...getScheduleForm(c.id), editing_id: null },
                            }))
                          }
                        >
                          Cancel
                        </Button>
                      )}
                      <span className="text-xs text-muted-foreground">
                        Attendance can be taken anytime within the scheduled duration.
                      </span>
                    </div>
                  </div>

                  {expandedCourseId === c.id && (
                    <div className="rounded-lg border border-border/60 bg-muted/40 p-4">
                      <p className="text-sm font-semibold mb-3">Enrolled Students</p>

                      {(studentsByCourse[c.id] ?? []).length === 0 ? (
                        <p className="text-sm text-muted-foreground">No students enrolled yet.</p>
                      ) : (
                        <div className="overflow-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left text-muted-foreground">
                                <th className="py-2 pr-3">Name</th>
                                <th className="py-2 pr-3">Matric/ID</th>
                                <th className="py-2 pr-3">Department</th>
                                <th className="py-2 pr-3">Enrolled At</th>
                              </tr>
                            </thead>
                            <tbody>
                              {studentsByCourse[c.id].map((s) => (
                                <tr key={s.id} className="border-t">
                                  <td className="py-2 pr-3">{s.full_name}</td>
                                  <td className="py-2 pr-3">{s.identifier}</td>
                                  <td className="py-2 pr-3">{s.department}</td>
                                  <td className="py-2 pr-3">
                                    {s.enrolled_at ? new Date(s.enrolled_at).toLocaleString() : "-"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {summaryCourseId &&
        createPortal(
          <div className="fixed inset-0 z-[999] bg-black/40 flex items-center justify-center p-4">
            <div className="w-full max-w-5xl rounded-2xl bg-card border border-border/70 shadow-large">
              <div className="p-4 border-b flex items-center justify-between">
                <div>
                  <p className="font-semibold">Attendance Insights</p>
                  <p className="text-xs text-muted-foreground">
                    Per-student totals, missed sessions, and AI-style remarks.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="px-3 py-1 rounded-lg border border-border/60 hover:bg-muted/60 text-sm"
                    onClick={downloadInsightsCSV}
                  >
                    Download Insights CSV
                  </button>
                  <button
                    className="px-3 py-1 rounded-lg border border-border/60 hover:bg-muted/60 text-sm"
                    onClick={() => {
                      setSummaryCourseId(null);
                      setSummaryRows([]);
                      setSummaryAnalytics(null);
                      setSummarySessions([]);
                      setSummaryMeta(null);
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>

              <div className="p-4">
                {(loadingSummaryFor === summaryCourseId || loadingAnalyticsFor === summaryCourseId || loadingSummarySessions) ? (
                  <p className="text-sm text-muted-foreground">Loading insights...</p>
                ) : summaryRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No data yet for this course.</p>
                ) : (
                  <>
                    {summarySessions.length > 0 && (
                      <div className="rounded-xl border bg-muted/30 p-3 mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-semibold">Session Trends</p>
                          <p className="text-xs text-muted-foreground">
                            {summaryMeta?.course_code} {summaryMeta?.course_title ? `- ${summaryMeta.course_title}` : ""}
                          </p>
                        </div>
                        <ChartContainer
                          config={{
                            attendance: { label: "Attendance %", color: "hsl(var(--secondary))" },
                          }}
                          className="h-56"
                        >
                          <LineChart
                            data={[...summarySessions].reverse().map((s, idx) => ({
                              label: s.start_time ? new Date(s.start_time).toLocaleDateString() : `S${idx + 1}`,
                              attendance: Math.round((s.attendance_rate ?? 0) * 100) / 100,
                            }))}
                            margin={{ left: 8, right: 8, top: 8, bottom: 8 }}
                          >
                            <CartesianGrid vertical={false} />
                            <XAxis dataKey="label" tickLine={false} axisLine={false} />
                            <YAxis domain={[0, 100]} tickLine={false} axisLine={false} />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Line
                              type="monotone"
                              dataKey="attendance"
                              stroke="var(--color-attendance)"
                              strokeWidth={2}
                              dot={false}
                            />
                          </LineChart>
                        </ChartContainer>
                      </div>
                    )}

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-4">
                      <div className="rounded-xl border bg-muted/40 p-3">
                        <p className="text-xs text-muted-foreground">Class Attendance Rate</p>
                        <p className="text-lg font-semibold">
                          {summaryAnalytics?.totals?.attendance_rate ?? 0}%
                        </p>
                      </div>
                      <div className="rounded-xl border bg-muted/40 p-3">
                        <p className="text-xs text-muted-foreground">Total Sessions</p>
                        <p className="text-lg font-semibold">
                          {summaryAnalytics?.totals?.sessions ?? 0}
                        </p>
                      </div>
                      <div className="rounded-xl border bg-muted/40 p-3">
                        <p className="text-xs text-muted-foreground">Enrolled Students</p>
                        <p className="text-lg font-semibold">
                          {summaryAnalytics?.totals?.enrolled ?? summaryRows.length}
                        </p>
                      </div>
                      <div className="rounded-xl border bg-muted/40 p-3">
                        <p className="text-xs text-muted-foreground">At Risk</p>
                        <p className="text-lg font-semibold">
                          {summaryRows.filter((r) => r.percentage < 60).length}
                        </p>
                      </div>
                    </div>

                    <div className="overflow-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-muted-foreground">
                            <th className="py-2 pr-3">Student</th>
                            <th className="py-2 pr-3">Matric/ID</th>
                            <th className="py-2 pr-3">Department</th>
                            <th className="py-2 pr-3">Total</th>
                            <th className="py-2 pr-3">Attended</th>
                            <th className="py-2 pr-3">Missed</th>
                            <th className="py-2 pr-3">%</th>
                            <th className="py-2 pr-3">Remark</th>
                            <th className="py-2 pr-3">Pattern</th>
                          </tr>
                        </thead>
                        <tbody>
                          {summaryRows.map((r) => {
                            const remark = remarkForRow(r);
                            const pattern = patternForRow(r, sessionStartById);
                            return (
                              <tr key={r.student_id} className="border-t">
                                <td className="py-2 pr-3">{r.student_name}</td>
                                <td className="py-2 pr-3">{r.student_identifier}</td>
                                <td className="py-2 pr-3">{r.department}</td>
                                <td className="py-2 pr-3">{r.total_sessions}</td>
                                <td className="py-2 pr-3">{r.attended}</td>
                                <td className="py-2 pr-3">{r.missed}</td>
                                <td className="py-2 pr-3">{r.percentage.toFixed(2)}%</td>
                                <td className="py-2 pr-3">
                                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${remark.tone}`}>
                                    {remark.label}
                                  </span>
                                </td>
                                <td className="py-2 pr-3 text-xs text-muted-foreground">
                                  {pattern}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </DashboardLayout>
  );
}
