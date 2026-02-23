import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import { apiRequest } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

type EnrollmentCourse = {
  id: string; // course_id (sometimes number as string)
  course_id?: string;
  course_code?: string;
  course_title?: string;
  title?: string;
  code?: string;
};

type ActiveSession = {
  id: string; // session_id
  session_id?: string;
  course_id: string;
  started_at?: string;
  created_at?: string;
};

function pickCourseId(c: EnrollmentCourse) {
  return (c.course_id ?? c.id) as string;
}
function pickCourseTitle(c: EnrollmentCourse) {
  return c.course_title ?? c.title ?? "Untitled Course";
}
function pickCourseCode(c: EnrollmentCourse) {
  return c.course_code ?? c.code ?? "";
}

export default function StudentSessions() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<EnrollmentCourse[]>([]);
  const [activeSessions, setActiveSessions] = useState<Record<string, ActiveSession | null>>({});
  const [loading, setLoading] = useState(false);
  const studentId = useMemo(() => (user?.id ? String(user.id) : null), [user?.id]);

  async function loadMyCourses() {
    if (!studentId) return;

    // Expected shapes vary, so we handle both:
    // - { ok: true, courses: [...] }
    // - { ok: true, enrollments: [...] }
    // - direct array [...]
    const res: any = await apiRequest(endpoints.enrollments.my(studentId));

    const list: EnrollmentCourse[] =
      Array.isArray(res) ? res :
      res?.courses ? res.courses :
      res?.enrollments ? res.enrollments :
      res?.data ? res.data :
      [];

    setCourses(list);
    return list;
  }

  async function loadActiveSessions(courseList: EnrollmentCourse[]) {
    const next: Record<string, ActiveSession | null> = {};

    // For each course, check active session
    await Promise.all(
      courseList.map(async (c) => {
        const courseId = String(pickCourseId(c));
        try {
          const res: any = await apiRequest(endpoints.sessions.active(courseId));
          // Possible shapes:
          // - { ok: true, session: {...} }
          // - { ok: true, active_session: {...} }
          // - { ok: false, message: "No active session" }
          // - null
          const session: ActiveSession | null =
            res?.session ?? res?.active_session ?? (res?.id ? res : null);

          next[courseId] = session ?? null;
        } catch {
          // If endpoint returns 404 or error when no session,
          // we treat it as "no active session".
          next[courseId] = null;
        }
      })
    );

    setActiveSessions(next);
  }

  async function refresh() {
    if (!studentId) return;
    setLoading(true);
    try {
      const list = await loadMyCourses();
      await loadActiveSessions(list ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  return (
    <DashboardLayout userType="student">
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">View Sessions</h1>
            <p className="text-sm text-muted-foreground mt-1">
              See active lecture sessions. Attendance is captured by the lecturer.
            </p>
          </div>

          <Button onClick={refresh} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>

        <div className="rounded-xl border bg-white p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Disputes</p>
            <p className="text-xs text-muted-foreground">
              Report missing or incorrect attendance records.
            </p>
          </div>
          <Button asChild variant="secondary">
            <Link to="/dashboard/student">Open Disputes</Link>
          </Button>
        </div>

        {/* Courses */}
        {courses.length === 0 ? (
          <div className="rounded-xl border bg-white p-6">
            <p className="text-sm text-muted-foreground">
              You are not enrolled in any course yet.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {courses.map((c) => {
              const courseId = String(pickCourseId(c));
              const session = activeSessions[courseId];

              return (
                <div
                  key={courseId}
                  className="rounded-xl border bg-white p-5 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <p className="font-semibold truncate">
                      {pickCourseTitle(c)}{" "}
                      {pickCourseCode(c) ? (
                        <span className="text-muted-foreground">
                          ({pickCourseCode(c)})
                        </span>
                      ) : null}
                    </p>

                    {session ? (
                      <p className="text-xs text-green-700 mt-1">
                        Active session available
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-1">
                        No active session right now
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {session ? (
                      <Button variant="secondary" disabled>
                        Attendance In Progress
                      </Button>
                    ) : (
                      <Button variant="secondary" disabled>
                        Not Available
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
