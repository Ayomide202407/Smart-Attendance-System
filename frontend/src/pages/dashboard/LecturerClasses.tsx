import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import { apiRequest } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";

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
};

export default function LecturerClasses() {
  const { user } = useAuth();
  const lecturerId = useMemo(() => (user?.id ? String(user.id) : null), [user?.id]);

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
    try {
      const res: any = await apiRequest(endpoints.reports.courseStudentsSummaryJSON(courseId));
      setSummaryRows(res?.students ?? []);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load attendance summary");
      setSummaryRows([]);
    } finally {
      setLoadingSummaryFor(null);
    }
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

  useEffect(() => {
    loadDepartments().catch(console.error);
    loadCourses().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lecturerId]);

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
        <div className="rounded-xl border bg-white p-6 space-y-5">
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
            <div className="rounded-lg border bg-white max-h-56 overflow-auto">
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
              Selected: {selectedDepts.length === 0 ? "None" : selectedDepts.join(", ")}
            </p>
          </div>

          <Button onClick={createCourse} disabled={working === "create"}>
            {working === "create" ? "Creating..." : "Create Course"}
          </Button>
        </div>

        {/* Manage Courses */}
        <div className="rounded-xl border bg-white p-6 space-y-4">
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
            <div className="rounded-xl border bg-gray-50 p-6">
              <p className="text-sm text-muted-foreground">No courses yet.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {courses.map((c) => (
                <div key={c.id} className="rounded-xl border bg-white p-5 space-y-4">
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
                      Enrolled: {c.enrolled_count} · Sessions: {c.sessions_count ?? 0} · Attendance: {c.attendance_rate ?? 0}%
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

                      <Button variant="outline" onClick={() => downloadCourseCSV(c.id)}>
                        Course CSV
                      </Button>
                      <Button variant="outline" onClick={() => downloadCoursePDF(c.id)}>
                        Course PDF
                      </Button>
                      <Button variant="outline" onClick={() => viewAttendanceSummary(c.id)}>
                        Attendance Summary
                      </Button>
                      <Button variant="outline" onClick={() => downloadStudentsSummaryCSV(c.id)}>
                        Summary CSV
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-lg border bg-gray-50 p-4 space-y-2">
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

                  {expandedCourseId === c.id && (
                    <div className="rounded-lg border bg-gray-50 p-4">
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

      {summaryCourseId && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-5xl rounded-xl bg-white border shadow-lg">
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <p className="font-semibold">Attendance Summary</p>
                <p className="text-xs text-muted-foreground">
                  Per-student totals, missed sessions, and percentages.
                </p>
              </div>
              <button
                className="px-3 py-1 rounded-lg border hover:bg-gray-50"
                onClick={() => {
                  setSummaryCourseId(null);
                  setSummaryRows([]);
                }}
              >
                Close
              </button>
            </div>

            <div className="p-4">
              {loadingSummaryFor === summaryCourseId ? (
                <p className="text-sm text-muted-foreground">Loading summary...</p>
              ) : summaryRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No data yet for this course.</p>
              ) : (
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
                      </tr>
                    </thead>
                    <tbody>
                      {summaryRows.map((r) => (
                        <tr key={r.student_id} className="border-t">
                          <td className="py-2 pr-3">{r.student_name}</td>
                          <td className="py-2 pr-3">{r.student_identifier}</td>
                          <td className="py-2 pr-3">{r.department}</td>
                          <td className="py-2 pr-3">{r.total_sessions}</td>
                          <td className="py-2 pr-3">{r.attended}</td>
                          <td className="py-2 pr-3">{r.missed}</td>
                          <td className="py-2 pr-3">{r.percentage.toFixed(2)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
