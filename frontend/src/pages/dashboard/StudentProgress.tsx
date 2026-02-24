import { useEffect, useMemo, useState } from "react";
import { BookOpen, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { apiRequest } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import { useAuth } from "@/context/AuthContext";

type EnrollmentCourse = {
  course_id: string;
  course_code: string;
  course_title: string;
};

type StudentSummary = {
  overall: {
    total_sessions: number;
    attended: number;
    missed: number;
    percentage: number;
  };
  per_course: Array<{
    course_id: string;
    course_code?: string;
    course_title?: string;
    total_sessions: number;
    attended: number;
    missed: number;
    percentage: number;
    attended_session_ids?: string[];
    missed_session_ids?: string[];
  }>;
};

type StudentHistoryRow = {
  session_id: string;
  course_code?: string | null;
  course_title?: string | null;
  timestamp?: string | null;
};

type Dispute = {
  id: string;
  session_id: string;
  course_id: string;
  dispute_type: "missing" | "incorrect";
  status: "pending" | "approved" | "rejected";
  reason?: string | null;
  created_at?: string | null;
  resolution_note?: string | null;
};

const StudentProgress = () => {
  const { user } = useAuth();
  const studentId = useMemo(() => (user?.id ? String(user.id) : ""), [user?.id]);

  const [courses, setCourses] = useState<EnrollmentCourse[]>([]);
  const [summary, setSummary] = useState<StudentSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<StudentHistoryRow[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [courseSessionsByCourse, setCourseSessionsByCourse] = useState<Record<string, Record<string, string>>>({});
  const [disputeType, setDisputeType] = useState<"missing" | "incorrect">("missing");
  const [disputeSessionId, setDisputeSessionId] = useState<string>("");
  const [disputeReason, setDisputeReason] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  async function loadData() {
    if (!studentId) return;
    setLoading(true);
    try {
      const resCourses: any = await apiRequest(endpoints.enrollments.my(studentId));
      const list =
        Array.isArray(resCourses) ? resCourses :
        resCourses?.courses ? resCourses.courses :
        resCourses?.enrollments ? resCourses.enrollments :
        [];
      setCourses(list);

      const resSummary: any = await apiRequest(`${endpoints.reports.studentSummaryJSON(studentId)}?include_sessions=1`);
      setSummary(resSummary as StudentSummary);

      const perCourse = (resSummary?.per_course ?? []) as StudentSummary["per_course"];
      if (perCourse.length > 0) {
        const courseIds = perCourse.map((c) => c.course_id);
        const results = await Promise.all(
          courseIds.map((cid) =>
            apiRequest(endpoints.reports.courseSummaryJSON(cid)).catch(() => null)
          )
        );
        const map: Record<string, Record<string, string>> = {};
        results.forEach((res: any, idx) => {
          const cid = courseIds[idx];
          const sess: any[] = res?.sessions ?? [];
          const inner: Record<string, string> = {};
          sess.forEach((s) => {
            if (s?.session_id && s?.start_time) inner[s.session_id] = s.start_time;
          });
          map[cid] = inner;
        });
        setCourseSessionsByCourse(map);
      } else {
        setCourseSessionsByCourse({});
      }

      const resHistory: any = await apiRequest(endpoints.reports.studentHistoryJSON(studentId));
      setHistory(resHistory?.records ?? []);

      const resDisputes: any = await apiRequest(endpoints.attendance.disputesByStudent(studentId));
      setDisputes(resDisputes?.disputes ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  const overall = summary?.overall;
  const attendancePct = overall?.percentage ?? 0;
  const missedOptions = (summary?.per_course ?? []).flatMap((c) =>
    (c.missed_session_ids ?? []).map((sid) => ({
      session_id: sid,
      label: `${c.course_title ?? "Course"} ${c.course_code ? `(${c.course_code})` : ""} - ${sid.slice(0, 8)}...`,
    }))
  );
  const attendedOptions = (history ?? []).map((h) => ({
    session_id: h.session_id,
    label: `${h.course_title ?? "Course"} ${h.course_code ? `(${h.course_code})` : ""} - ${h.session_id.slice(0, 8)}...`,
  }));

  function patternForCourse(c: StudentSummary["per_course"][number]) {
    const map = courseSessionsByCourse[c.course_id] ?? {};
    const attendedIds = c.attended_session_ids ?? [];
    const missedIds = c.missed_session_ids ?? [];
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
      const t = map[sid];
      if (!t) return;
      const dt = new Date(t);
      const day = dayNames[dt.getDay()];
      const bucket = timeBucket(dt);
      attendDayCounts[day] = (attendDayCounts[day] || 0) + 1;
      attendTimeCounts[bucket] = (attendTimeCounts[bucket] || 0) + 1;
    });

    const missedDayCounts: Record<string, number> = {};
    missedIds.forEach((sid) => {
      const t = map[sid];
      if (!t) return;
      const dt = new Date(t);
      const day = dayNames[dt.getDay()];
      missedDayCounts[day] = (missedDayCounts[day] || 0) + 1;
    });

    const topAttendTime = Object.entries(attendTimeCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
    const topAttendDay = Object.entries(attendDayCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
    const topMissDay = Object.entries(missedDayCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

    const pieces: string[] = [];
    if (topAttendTime) pieces.push(`Mostly ${topAttendTime}`);
    if (topAttendDay) pieces.push(`Best on ${topAttendDay}s`);
    if (topMissDay && missedIds.length >= 2) pieces.push(`Misses most on ${topMissDay}s`);

    return pieces.length ? pieces.join(" - ") : "No clear pattern";
  }

  async function submitDispute() {
    if (!studentId || !disputeSessionId) return;
    setSubmitting(true);
    try {
      await apiRequest(endpoints.attendance.dispute, {
        method: "POST",
        body: {
          student_id: studentId,
          session_id: disputeSessionId,
          dispute_type: disputeType,
          reason: disputeReason || null,
        },
      });
      const resDisputes: any = await apiRequest(endpoints.attendance.disputesByStudent(studentId));
      setDisputes(resDisputes?.disputes ?? []);
      setDisputeReason("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DashboardLayout userType="student">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Attendance progress{user?.first_name ? `, ${user.first_name}` : ""}
          </h1>
          <p className="text-muted-foreground mt-1">
            See your attendance totals, trends, and session history.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-6">
          <Card className="shadow-soft border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl gradient-secondary flex items-center justify-center shadow-soft">
                  <BookOpen className="w-6 h-6 text-secondary-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{courses.length}</p>
                  <p className="text-sm text-muted-foreground">Enrolled Courses</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-soft border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center shadow-soft">
                  <CheckCircle2 className="w-6 h-6 text-primary-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{overall?.attended ?? 0}</p>
                  <p className="text-sm text-muted-foreground">Sessions Attended</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-soft border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl gradient-accent flex items-center justify-center shadow-soft">
                  <XCircle className="w-6 h-6 text-accent-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{overall?.missed ?? 0}</p>
                  <p className="text-sm text-muted-foreground">Sessions Missed</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-soft border-border/50">
          <CardHeader>
            <CardTitle>Overall Attendance</CardTitle>
            <CardDescription>
              Percentage across all courses and sessions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold text-foreground">{attendancePct.toFixed(2)}%</p>
              <p className="text-sm text-muted-foreground">
                Total sessions: {overall?.total_sessions ?? 0}
              </p>
            </div>
            <div className="mt-4 h-3 rounded-full bg-muted">
              <div
                className="h-3 rounded-full gradient-secondary"
                style={{ width: `${Math.min(100, Math.max(0, attendancePct))}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-soft border-border/50">
          <CardHeader>
            <CardTitle>Course Attendance Breakdown</CardTitle>
            <CardDescription>Per-course totals, missed sessions, and percentage.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : (summary?.per_course?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">No attendance records yet.</p>
            ) : (
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th className="py-2 pr-3">Course</th>
                      <th className="py-2 pr-3">Total</th>
                      <th className="py-2 pr-3">Attended</th>
                      <th className="py-2 pr-3">Missed</th>
                      <th className="py-2 pr-3">%</th>
                      <th className="py-2 pr-3">Pattern</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary!.per_course.map((c) => (
                      <tr key={c.course_id} className="border-t">
                        <td className="py-2 pr-3">
                          {c.course_title ?? "Course"}{" "}
                          {c.course_code ? (
                            <span className="text-muted-foreground">({c.course_code})</span>
                          ) : null}
                        </td>
                        <td className="py-2 pr-3">{c.total_sessions}</td>
                        <td className="py-2 pr-3">{c.attended}</td>
                        <td className="py-2 pr-3">{c.missed}</td>
                        <td className="py-2 pr-3">{c.percentage.toFixed(2)}%</td>
                        <td className="py-2 pr-3 text-xs text-muted-foreground">
                          {patternForCourse(c)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-soft border-border/50">
          <CardHeader>
            <CardTitle>Attendance Disputes</CardTitle>
            <CardDescription>Report missing or incorrect attendance records.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="text-sm text-muted-foreground">Dispute Type</label>
                <select
                  className="mt-1 w-full rounded-lg border border-border/60 bg-card px-3 py-2 text-sm"
                  value={disputeType}
                  onChange={(e) => setDisputeType(e.target.value as "missing" | "incorrect")}
                >
                  <option value="missing">Missing (not marked)</option>
                  <option value="incorrect">Incorrect (marked wrongly)</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm text-muted-foreground">Session</label>
                <select
                  className="mt-1 w-full rounded-lg border border-border/60 bg-card px-3 py-2 text-sm"
                  value={disputeSessionId}
                  onChange={(e) => setDisputeSessionId(e.target.value)}
                >
                  <option value="">Select session</option>
                  {(disputeType === "missing" ? missedOptions : attendedOptions).map((o) => (
                    <option key={o.session_id} value={o.session_id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-3">
              <label className="text-sm text-muted-foreground">Reason (optional)</label>
              <input
                className="mt-1 w-full rounded-lg border border-border/60 bg-card px-3 py-2 text-sm"
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                placeholder="Short note about the issue"
              />
            </div>

            <div className="mt-3">
              <Button
                variant="outline"
                onClick={submitDispute}
                disabled={submitting || !disputeSessionId}
              >
                {submitting ? "Submitting..." : "Submit Dispute"}
              </Button>
            </div>

            <div className="mt-5">
              <p className="text-sm font-semibold">Your Disputes</p>
              {(disputes?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground mt-2">No disputes submitted yet.</p>
              ) : (
                <div className="overflow-auto mt-2">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-muted-foreground">
                        <th className="py-2 pr-3">Session</th>
                        <th className="py-2 pr-3">Type</th>
                        <th className="py-2 pr-3">Status</th>
                        <th className="py-2 pr-3">Reason</th>
                        <th className="py-2 pr-3">Resolution</th>
                      </tr>
                    </thead>
                    <tbody>
                      {disputes.map((d) => (
                        <tr key={d.id} className="border-t">
                          <td className="py-2 pr-3">{d.session_id.slice(0, 8)}...</td>
                          <td className="py-2 pr-3">{d.dispute_type}</td>
                          <td className="py-2 pr-3">{d.status}</td>
                          <td className="py-2 pr-3">{d.reason ?? "-"}</td>
                          <td className="py-2 pr-3">{d.resolution_note ?? "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default StudentProgress;
