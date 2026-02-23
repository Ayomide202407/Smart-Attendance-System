import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import { apiRequest } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import { Button } from "@/components/ui/button";
import TakeAttendanceModal from "@/components/attendance/TakeAttendanceModal";
import { toast } from "@/components/ui/sonner";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000";

type Course = {
  id: string;
  course_code: string;
  course_title: string;
  is_open_for_enrollment: boolean;
};

type CourseSummarySession = {
  session_id: string;
  status: "active" | "ended";
  start_time: string | null;
  end_time: string | null;
  marked_count: number;
  enrolled_count?: number;
  attendance_rate?: number;
};

type CourseSummary = {
  ok: boolean;
  course: Course;
  count: number;
  sessions: CourseSummarySession[];
};

type AttendanceRow = {
  attendance_id: string;
  student_id: string;
  student_identifier?: string | null;
  student_name?: string | null;
  method?: string | null;
  status?: string | null;
  confidence?: number | null;
  timestamp?: string | null;
};

type SessionReport = {
  ok: boolean;
  count: number;
  meta: any;
  records: AttendanceRow[];
};

type CourseAnalytics = {
  totals: {
    enrolled: number;
    sessions: number;
    marked: number;
    attendance_rate: number;
  };
  methods: Record<string, number>;
  average_confidence: number | null;
  disputes: Record<string, number>;
};

type Dispute = {
  id: string;
  session_id: string;
  course_id: string;
  student_id: string;
  dispute_type: "missing" | "incorrect";
  status: "pending" | "approved" | "rejected";
  reason?: string | null;
  created_at?: string | null;
  resolution_note?: string | null;
};

export default function LecturerSessions() {
  const { user } = useAuth();
  const lecturerId = useMemo(() => (user?.id ? String(user.id) : null), [user?.id]);

  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);

  const [summaryByCourse, setSummaryByCourse] = useState<Record<string, CourseSummarySession[]>>({});
  const [loadingSummaryFor, setLoadingSummaryFor] = useState<string | null>(null);

  const [working, setWorking] = useState<string | null>(null);

  // Attendance view modal state
  const [openSessionId, setOpenSessionId] = useState<string | null>(null);
  const [report, setReport] = useState<SessionReport | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  const [analyticsByCourse, setAnalyticsByCourse] = useState<Record<string, CourseAnalytics | null>>({});
  const [loadingAnalyticsFor, setLoadingAnalyticsFor] = useState<string | null>(null);

  const [disputesByCourse, setDisputesByCourse] = useState<Record<string, Dispute[]>>({});
  const [loadingDisputesFor, setLoadingDisputesFor] = useState<string | null>(null);

  // Take attendance modal state
  const [takeOpen, setTakeOpen] = useState(false);
  const [takeCourseId, setTakeCourseId] = useState<string>("");
  const [takeCourseLabel, setTakeCourseLabel] = useState<string>("");

  async function loadCourses() {
    if (!lecturerId) return;
    setLoading(true);
    try {
      const res: any = await apiRequest(endpoints.courses.lecturer(lecturerId));
      const list: Course[] = res?.courses ?? [];
      setCourses(list);
    } finally {
      setLoading(false);
    }
  }

  async function loadCourseSummary(courseId: string) {
    setLoadingSummaryFor(courseId);
    try {
      const res = await apiRequest<CourseSummary>(endpoints.reports.courseSummaryJSON(courseId));
      setSummaryByCourse((prev) => ({ ...prev, [courseId]: res.sessions ?? [] }));
    } catch {
      setSummaryByCourse((prev) => ({ ...prev, [courseId]: [] }));
    } finally {
      setLoadingSummaryFor(null);
    }
  }

  async function startSession(courseId: string) {
    if (!lecturerId) return;
    setWorking(courseId);
    try {
      await apiRequest(endpoints.sessions.start, {
        method: "POST",
        body: { lecturer_id: lecturerId, course_id: courseId },
      });
      await loadCourseSummary(courseId);
      toast.success("Session started");
    } catch (e: any) {
      toast.error(e?.message || "Failed to start session");
    } finally {
      setWorking(null);
    }
  }

  async function endSession(sessionId: string, courseId: string) {
    if (!lecturerId) return;
    setWorking(sessionId);
    try {
      await apiRequest(endpoints.sessions.end, {
        method: "POST",
        body: { lecturer_id: lecturerId, session_id: sessionId },
      });
      await loadCourseSummary(courseId);
      toast.success("Session ended");
    } catch (e: any) {
      toast.error(e?.message || "Failed to end session");
    } finally {
      setWorking(null);
    }
  }

  async function openAttendance(sessionId: string) {
    setOpenSessionId(sessionId);
    setLoadingReport(true);
    setReport(null);
    try {
      const res = await apiRequest<SessionReport>(endpoints.reports.sessionJSON(sessionId));
      setReport(res);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load attendance");
      setReport({ ok: true, count: 0, meta: {}, records: [] });
    } finally {
      setLoadingReport(false);
    }
  }

  async function loadAnalytics(courseId: string) {
    if (!lecturerId) return;
    setLoadingAnalyticsFor(courseId);
    try {
      const res = await apiRequest<CourseAnalytics>(
        `${endpoints.reports.courseAnalyticsJSON(courseId)}?lecturer_id=${encodeURIComponent(lecturerId)}`
      );
      setAnalyticsByCourse((prev) => ({ ...prev, [courseId]: res }));
    } catch {
      setAnalyticsByCourse((prev) => ({ ...prev, [courseId]: null }));
    } finally {
      setLoadingAnalyticsFor(null);
    }
  }

  async function loadDisputes(courseId: string) {
    if (!lecturerId) return;
    setLoadingDisputesFor(courseId);
    try {
      const res: any = await apiRequest(
        `${endpoints.attendance.disputesByCourse(courseId)}?lecturer_id=${encodeURIComponent(lecturerId)}`
      );
      setDisputesByCourse((prev) => ({ ...prev, [courseId]: res?.disputes ?? [] }));
    } catch {
      setDisputesByCourse((prev) => ({ ...prev, [courseId]: [] }));
    } finally {
      setLoadingDisputesFor(null);
    }
  }

  async function resolveDispute(courseId: string, disputeId: string, action: "approve" | "reject") {
    if (!lecturerId) return;
    const note = window.prompt("Resolution note (optional):") || "";
    try {
      await apiRequest(endpoints.attendance.disputesResolve, {
        method: "POST",
        body: {
          lecturer_id: lecturerId,
          dispute_id: disputeId,
          action,
          resolution_note: note || null,
        },
      });
      toast.success(`Dispute ${action}d`);
      await loadDisputes(courseId);
      await loadAnalytics(courseId);
    } catch (e: any) {
      toast.error(e?.message || "Failed to resolve dispute");
    }
  }

  function downloadCSV(sessionId: string) {
    window.open(`${API_BASE_URL}${endpoints.reports.sessionCSV(sessionId)}`, "_blank");
  }

  function downloadPDF(sessionId: string) {
    window.open(`${API_BASE_URL}${endpoints.reports.sessionPDF(sessionId)}`, "_blank");
  }

  // Open take-attendance modal (only needs course_id; backend uses active session)
  function openTakeAttendance(course: Course) {
    setTakeCourseId(course.id);
    setTakeCourseLabel(`${course.course_title} (${course.course_code})`);
    setTakeOpen(true);
  }

  useEffect(() => {
    loadCourses().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lecturerId]);

  return (
    <DashboardLayout userType="lecturer">
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">AI Sessions</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Start/end sessions, take attendance (live/photo), view attendance, and export reports.
            </p>
          </div>

          <Button variant="secondary" onClick={loadCourses} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>

        {courses.length === 0 ? (
          <div className="rounded-xl border bg-white p-6">
            <p className="text-sm text-muted-foreground">
              No courses found. Create a course first in Class Management.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {courses.map((c) => {
              const sessions = summaryByCourse[c.id] ?? [];
              const active = sessions.find((s) => s.status === "active") || null;
              const analytics = analyticsByCourse[c.id];
              const disputes = disputesByCourse[c.id] ?? [];

              return (
                <div key={c.id} className="rounded-xl border bg-white p-5 space-y-4">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <p className="font-semibold">
                        {c.course_title}{" "}
                        <span className="text-muted-foreground">({c.course_code})</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Sessions tracked: {sessions.length}
                      </p>
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      <Button
                        onClick={() => loadCourseSummary(c.id)}
                        variant="secondary"
                        disabled={loadingSummaryFor === c.id}
                      >
                        {loadingSummaryFor === c.id ? "Loading..." : "Load Sessions"}
                      </Button>

                      <Button
                        onClick={() => loadAnalytics(c.id)}
                        variant="secondary"
                        disabled={loadingAnalyticsFor === c.id}
                      >
                        {loadingAnalyticsFor === c.id ? "Loading..." : "Load Analytics"}
                      </Button>

                      <Button
                        onClick={() => loadDisputes(c.id)}
                        variant="secondary"
                        disabled={loadingDisputesFor === c.id}
                      >
                        {loadingDisputesFor === c.id ? "Loading..." : "Load Disputes"}
                      </Button>

                      <Button
                        onClick={() => startSession(c.id)}
                        disabled={working === c.id || Boolean(active)}
                      >
                        {active ? "Session Active" : working === c.id ? "Starting..." : "Start Session"}
                      </Button>
                    </div>
                  </div>

                  {sessions.length === 0 ? (
                    <div className="rounded-lg border bg-gray-50 p-4">
                      <p className="text-sm text-muted-foreground">
                        Click <b>Load Sessions</b> to see history, or <b>Start Session</b> to begin.
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-lg border bg-gray-50 p-4 overflow-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-muted-foreground">
                            <th className="py-2 pr-3">Session</th>
                            <th className="py-2 pr-3">Status</th>
                            <th className="py-2 pr-3">Start</th>
                            <th className="py-2 pr-3">End</th>
                            <th className="py-2 pr-3">Marked</th>
                            <th className="py-2 pr-3">Rate</th>
                            <th className="py-2 pr-3">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sessions.map((s) => (
                            <tr key={s.session_id} className="border-t">
                              <td className="py-2 pr-3">{s.session_id.slice(0, 8)}...</td>
                              <td className="py-2 pr-3">
                                <span className={s.status === "active" ? "text-green-700" : "text-gray-700"}>
                                  {s.status}
                                </span>
                              </td>
                              <td className="py-2 pr-3">{s.start_time ? new Date(s.start_time).toLocaleString() : "-"}</td>
                              <td className="py-2 pr-3">{s.end_time ? new Date(s.end_time).toLocaleString() : "-"}</td>
                              <td className="py-2 pr-3">{s.marked_count}</td>
                              <td className="py-2 pr-3">
                                {typeof s.attendance_rate === "number" ? `${s.attendance_rate}%` : "-"}
                              </td>
                              <td className="py-2 pr-3">
                                <div className="flex gap-2 flex-wrap">
                                  {s.status === "active" && (
                                    <>
                                      <Button
                                        onClick={() => openTakeAttendance(c)}
                                      >
                                        Take Attendance
                                      </Button>

                                      <Button
                                        variant="secondary"
                                        onClick={() => endSession(s.session_id, c.id)}
                                        disabled={working === s.session_id}
                                      >
                                        {working === s.session_id ? "Ending..." : "End"}
                                      </Button>
                                    </>
                                  )}

                                  <Button variant="outline" onClick={() => openAttendance(s.session_id)}>
                                    View Attendance
                                  </Button>

                                  <Button variant="outline" onClick={() => downloadCSV(s.session_id)}>
                                    CSV
                                  </Button>

                                  <Button variant="outline" onClick={() => downloadPDF(s.session_id)}>
                                    PDF
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {analytics && (
                    <div className="rounded-lg border bg-gray-50 p-4">
                      <p className="text-sm font-semibold">Course Analytics</p>
                      <div className="grid sm:grid-cols-3 gap-3 mt-3 text-sm">
                        <div className="rounded-lg border bg-white p-3">
                          <p className="text-xs text-muted-foreground">Attendance Rate</p>
                          <p className="text-lg font-semibold">{analytics.totals.attendance_rate}%</p>
                        </div>
                        <div className="rounded-lg border bg-white p-3">
                          <p className="text-xs text-muted-foreground">Marked / Enrolled</p>
                          <p className="text-lg font-semibold">
                            {analytics.totals.marked} / {analytics.totals.enrolled}
                          </p>
                        </div>
                        <div className="rounded-lg border bg-white p-3">
                          <p className="text-xs text-muted-foreground">Avg Confidence</p>
                          <p className="text-lg font-semibold">
                            {analytics.average_confidence !== null ? analytics.average_confidence : "-"}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 text-sm text-muted-foreground">
                        Methods: {Object.entries(analytics.methods || {}).map(([k, v]) => `${k}: ${v}`).join(", ") || "—"}
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        Disputes: {Object.entries(analytics.disputes || {}).map(([k, v]) => `${k}: ${v}`).join(", ") || "—"}
                      </div>
                    </div>
                  )}

                  <div className="rounded-lg border bg-gray-50 p-4">
                    <p className="text-sm font-semibold">Disputes</p>
                    {disputes.length === 0 ? (
                      <p className="text-sm text-muted-foreground mt-2">No disputes found.</p>
                    ) : (
                      <div className="overflow-auto mt-3">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-muted-foreground">
                              <th className="py-2 pr-3">Session</th>
                              <th className="py-2 pr-3">Student</th>
                              <th className="py-2 pr-3">Type</th>
                              <th className="py-2 pr-3">Status</th>
                              <th className="py-2 pr-3">Reason</th>
                              <th className="py-2 pr-3">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {disputes.map((d) => (
                              <tr key={d.id} className="border-t">
                                <td className="py-2 pr-3">{d.session_id.slice(0, 8)}...</td>
                                <td className="py-2 pr-3">{d.student_id.slice(0, 8)}...</td>
                                <td className="py-2 pr-3">{d.dispute_type}</td>
                                <td className="py-2 pr-3">{d.status}</td>
                                <td className="py-2 pr-3">{d.reason ?? "-"}</td>
                                <td className="py-2 pr-3">
                                  {d.status === "pending" ? (
                                    <div className="flex gap-2">
                                      <Button
                                        size="sm"
                                        onClick={() => resolveDispute(c.id, d.id, "approve")}
                                      >
                                        Approve
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={() => resolveDispute(c.id, d.id, "reject")}
                                      >
                                        Reject
                                      </Button>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">Resolved</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Take Attendance Modal */}
      {lecturerId && (
        <TakeAttendanceModal
          open={takeOpen}
          onClose={() => setTakeOpen(false)}
          lecturerId={lecturerId}
          courseId={takeCourseId}
          courseLabel={takeCourseLabel}
        />
      )}

      {/* View Attendance Modal */}
      {openSessionId && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-4xl rounded-xl bg-white border shadow-lg">
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <p className="font-semibold">Attendance - Session {openSessionId.slice(0, 8)}...</p>
                <p className="text-xs text-muted-foreground">
                  Download: CSV/PDF buttons are available on the session row.
                </p>
              </div>
              <button
                className="px-3 py-1 rounded-lg border hover:bg-gray-50"
                onClick={() => {
                  setOpenSessionId(null);
                  setReport(null);
                }}
              >
                Close
              </button>
            </div>

            <div className="p-4">
              {loadingReport ? (
                <p className="text-sm text-muted-foreground">Loading attendance...</p>
              ) : (report?.records?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">No attendance marked yet for this session.</p>
              ) : (
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-muted-foreground">
                        <th className="py-2 pr-3">Matric/ID</th>
                        <th className="py-2 pr-3">Student</th>
                        <th className="py-2 pr-3">Status</th>
                        <th className="py-2 pr-3">Method</th>
                        <th className="py-2 pr-3">Confidence</th>
                        <th className="py-2 pr-3">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report!.records.map((r) => (
                        <tr key={r.attendance_id} className="border-t">
                          <td className="py-2 pr-3">{r.student_identifier ?? "-"}</td>
                          <td className="py-2 pr-3">{r.student_name ?? r.student_id}</td>
                          <td className="py-2 pr-3">{r.status ?? "-"}</td>
                          <td className="py-2 pr-3">{r.method ?? "-"}</td>
                          <td className="py-2 pr-3">
                            {typeof r.confidence === "number" ? r.confidence.toFixed(3) : "-"}
                          </td>
                          <td className="py-2 pr-3">
                            {r.timestamp ? new Date(r.timestamp).toLocaleString() : "-"}
                          </td>
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
