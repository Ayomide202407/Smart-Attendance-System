import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import TimePicker from "@/components/ui/time-picker";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { apiRequest } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import { useAuth } from "@/context/AuthContext";

type EnrollmentCourse = {
  course_id: string;
  course_code: string;
  course_title: string;
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

type ScheduleNotification = {
  id: string;
  course_id: string;
  message: string;
  created_at?: string | null;
  is_read: boolean;
};

type PlannerItem = {
  id: string;
  student_id: string;
  course_id?: string | null;
  item_type: string;
  title?: string | null;
  start_time: string;
  duration_minutes: number;
  status: "planned" | "completed" | "missed";
};

const StudentPlanner = () => {
  const { user } = useAuth();
  const studentId = useMemo(() => (user?.id ? String(user.id) : ""), [user?.id]);

  const [courses, setCourses] = useState<EnrollmentCourse[]>([]);
  const [schedulesByCourse, setSchedulesByCourse] = useState<Record<string, CourseSchedule[]>>({});
  const [notifications, setNotifications] = useState<ScheduleNotification[]>([]);
  const [plannerItems, setPlannerItems] = useState<PlannerItem[]>([]);
  const [plannerForm, setPlannerForm] = useState({
    item_type: "study",
    course_id: "",
    title: "",
    date: new Date().toISOString().slice(0, 10),
    start_time: "10:00",
    duration_minutes: 60,
  });
  const [plannerWorking, setPlannerWorking] = useState(false);

  async function loadData() {
    if (!studentId) return;
    const resCourses: any = await apiRequest(endpoints.enrollments.my(studentId));
    const list =
      Array.isArray(resCourses) ? resCourses :
      resCourses?.courses ? resCourses.courses :
      resCourses?.enrollments ? resCourses.enrollments :
      [];
    setCourses(list);

    if (list.length > 0) {
      const scheduleResults = await Promise.all(
        list.map((c: EnrollmentCourse) =>
          apiRequest(`${endpoints.courses.scheduleList(c.course_id)}?student_id=${encodeURIComponent(studentId)}`).catch(() => null)
        )
      );
      const scheduleMap: Record<string, CourseSchedule[]> = {};
      scheduleResults.forEach((res: any, idx) => {
        const cid = list[idx]?.course_id;
        scheduleMap[cid] = res?.schedules ?? [];
      });
      setSchedulesByCourse(scheduleMap);
    } else {
      setSchedulesByCourse({});
    }

    const resNotes: any = await apiRequest(endpoints.courses.notificationsByStudent(studentId));
    setNotifications(resNotes?.notifications ?? []);

    const resPlans: any = await apiRequest(endpoints.planner.listByStudent(studentId));
    setPlannerItems(resPlans?.plans ?? []);
  }

  useEffect(() => {
    loadData().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  function nextOccurrence(dayOfWeek: number, startTime: string) {
    const now = new Date();
    const [hh, mm] = startTime.split(":").map((v) => Number(v));
    const target = new Date(now);
    target.setHours(hh, mm, 0, 0);

    const jsDay = now.getDay(); // Sunday=0
    const desiredJsDay = (dayOfWeek + 1) % 7; // Monday=0 -> JS=1
    let delta = desiredJsDay - jsDay;
    if (delta < 0 || (delta === 0 && target <= now)) {
      delta += 7;
    }
    target.setDate(now.getDate() + delta);
    return target;
  }

  const nextClass = useMemo(() => {
    const items: Array<{
      when: Date;
      course_id: string;
      course_code?: string;
      course_title?: string;
      location?: string | null;
      duration_minutes?: number;
      is_recurring?: boolean;
    }> = [];
    Object.entries(schedulesByCourse).forEach(([courseId, scheds]) => {
      const course = courses.find((c) => c.course_id === courseId);
      scheds.forEach((s) => {
        let when: Date;
        if (s.is_recurring === false && s.schedule_date) {
          const [y, m, d] = s.schedule_date.split("-").map((v) => Number(v));
          const [hh, mm] = s.start_time.split(":").map((v) => Number(v));
          when = new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0);
        } else {
          when = nextOccurrence(s.day_of_week, s.start_time);
        }
        items.push({
          when,
          course_id: courseId,
          course_code: course?.course_code,
          course_title: course?.course_title,
          location: s.location,
          duration_minutes: s.duration_minutes,
          is_recurring: s.is_recurring !== false,
        });
      });
    });
    items.sort((a, b) => a.when.getTime() - b.when.getTime());
    return items[0] || null;
  }, [schedulesByCourse, courses]);

  const plannerStats = useMemo(() => {
    const total = plannerItems.length;
    const completed = plannerItems.filter((p) => p.status === "completed").length;
    const missed = plannerItems.filter((p) => p.status === "missed").length;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, missed, rate };
  }, [plannerItems]);

  const aiNote = useMemo(() => {
    const seed =
      Number(new Date().toISOString().slice(0, 10).replace(/-/g, "")) +
      plannerStats.total +
      plannerStats.missed * 3;
    const pick = (list: string[]) => list[seed % list.length];

    if (plannerStats.total === 0) {
      return pick([
        "Start with one small block today. Momentum beats perfection.",
        "Add a single 30-minute session to get rolling.",
        "Plan one focused hour. That is enough to build a streak.",
      ]);
    }
    if (plannerStats.rate >= 80) {
      return pick([
        "Strong consistency. Keep the rhythm steady this week.",
        "Great pace. Protect your best time windows.",
        "You are on track. Add one small block to build momentum.",
      ]);
    }
    if (plannerStats.rate >= 50) {
      return pick([
        "You are halfway there. One extra session will lift the week.",
        "Steady effort. Aim for one quick win today.",
        "Plan the next small block now to stay on track.",
      ]);
    }
    return pick([
      "Start light today. Momentum comes after the first win.",
      "Pick your easiest task and get it done first.",
      "Short and focused is better than skipped.",
    ]);
  }, [plannerStats]);

  async function createPlannerItem() {
    if (!studentId) return;
    setPlannerWorking(true);
    try {
      const start_time = new Date(`${plannerForm.date}T${plannerForm.start_time}:00`);
      const payload = {
        student_id: studentId,
        item_type: plannerForm.item_type,
        course_id: plannerForm.course_id || null,
        title: plannerForm.title || null,
        start_time: start_time.toISOString(),
        duration_minutes: plannerForm.duration_minutes,
      };
      await apiRequest(endpoints.planner.create, { method: "POST", body: payload });
      const resPlans: any = await apiRequest(endpoints.planner.listByStudent(studentId));
      setPlannerItems(resPlans?.plans ?? []);
    } finally {
      setPlannerWorking(false);
    }
  }

  async function updatePlannerStatus(id: string, status: "planned" | "completed" | "missed") {
    if (!studentId) return;
    await apiRequest(endpoints.planner.status, { method: "POST", body: { student_id: studentId, plan_id: id, status } });
    const resPlans: any = await apiRequest(endpoints.planner.listByStudent(studentId));
    setPlannerItems(resPlans?.plans ?? []);
  }

  async function deletePlannerItem(id: string) {
    if (!studentId) return;
    await apiRequest(endpoints.planner.delete, { method: "POST", body: { student_id: studentId, plan_id: id } });
    const resPlans: any = await apiRequest(endpoints.planner.listByStudent(studentId));
    setPlannerItems(resPlans?.plans ?? []);
  }

  async function markAllNotificationsRead() {
    if (!studentId) return;
    await apiRequest(endpoints.courses.notificationsMarkRead, {
      method: "POST",
      body: { student_id: studentId, all: true },
    });
    const resNotes: any = await apiRequest(endpoints.courses.notificationsByStudent(studentId));
    setNotifications(resNotes?.notifications ?? []);
  }

  return (
    <DashboardLayout userType="student">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Planner{user?.first_name ? `, ${user.first_name}` : ""}
          </h1>
          <p className="text-muted-foreground mt-1">
            Organize your week, track tasks, and keep pace with class schedules.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="shadow-soft border-border/50">
            <CardHeader>
              <CardTitle>Next Class</CardTitle>
              <CardDescription>Your upcoming scheduled class</CardDescription>
            </CardHeader>
            <CardContent>
              {!nextClass ? (
                <p className="text-sm text-muted-foreground">No schedules found yet.</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-lg font-semibold text-foreground">
                    {nextClass.course_title ?? "Course"}{" "}
                    {nextClass.course_code ? (
                      <span className="text-muted-foreground">({nextClass.course_code})</span>
                    ) : null}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {nextClass.when.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Duration: {nextClass.duration_minutes ?? 60} mins
                    {nextClass.location ? ` - Location: ${nextClass.location}` : ""}
                    {nextClass.is_recurring ? " - Weekly" : " - One-time"}
                  </p>
                  <div className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
                    Attendance is captured by your lecturer. You will get a reminder.
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-soft border-border/50">
            <CardHeader>
              <CardTitle>Personal Planner</CardTitle>
              <CardDescription>Plan your day and mark tasks as completed or missed</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-6">
                <div className="md:col-span-1">
                  <label className="text-xs text-muted-foreground">Type</label>
                  <select
                    className="mt-1 w-full rounded-lg border px-2 py-2 text-sm"
                    value={plannerForm.item_type}
                    onChange={(e) => setPlannerForm((p) => ({ ...p, item_type: e.target.value }))}
                  >
                    <option value="study">Study</option>
                    <option value="tutorial">Tutorial</option>
                    <option value="reading">Reading</option>
                    <option value="project">Project</option>
                    <option value="research">Research</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-muted-foreground">Course (optional)</label>
                  <select
                    className="mt-1 w-full rounded-lg border px-2 py-2 text-sm"
                    value={plannerForm.course_id}
                    onChange={(e) => setPlannerForm((p) => ({ ...p, course_id: e.target.value }))}
                  >
                    <option value="">Select course</option>
                    {courses.map((c) => (
                      <option key={c.course_id} value={c.course_id}>
                        {c.course_title} {c.course_code ? `(${c.course_code})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-muted-foreground">Title (optional)</label>
                  <input
                    className="mt-1 w-full rounded-lg border px-2 py-2 text-sm"
                    placeholder="e.g., Read Chapter 3 / Novel"
                    value={plannerForm.title}
                    onChange={(e) => setPlannerForm((p) => ({ ...p, title: e.target.value }))}
                  />
                </div>
                <div className="md:col-span-1">
                  <label className="text-xs text-muted-foreground">Date</label>
                  <input
                    type="date"
                    className="mt-1 w-full rounded-lg border px-2 py-2 text-sm"
                    value={plannerForm.date}
                    onChange={(e) => setPlannerForm((p) => ({ ...p, date: e.target.value }))}
                  />
                </div>
                <div className="md:col-span-1">
                  <label className="text-xs text-muted-foreground">Start</label>
                  <div className="mt-1">
                    <TimePicker
                      value={plannerForm.start_time}
                      onChange={(val) => setPlannerForm((p) => ({ ...p, start_time: val }))}
                      start="06:00"
                      end="22:00"
                      stepMinutes={30}
                    />
                  </div>
                </div>
                <div className="md:col-span-1">
                  <label className="text-xs text-muted-foreground">Duration (hrs)</label>
                  <select
                    className="mt-1 w-full rounded-lg border px-2 py-2 text-sm"
                    value={plannerForm.duration_minutes}
                    onChange={(e) => setPlannerForm((p) => ({ ...p, duration_minutes: Number(e.target.value) }))}
                  >
                    {[30, 60, 90, 120, 150, 180, 240, 300].map((m) => (
                      <option key={m} value={m}>{m / 60} hr</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-1 flex items-end">
                  <Button onClick={createPlannerItem} disabled={plannerWorking}>
                    {plannerWorking ? "Saving..." : "Add"}
                  </Button>
                </div>
              </div>

              <div className="mt-4 rounded-xl border bg-muted/30 p-3 text-sm">
                <p className="font-semibold">Planner Stats</p>
                <p className="text-xs text-muted-foreground">
                  {plannerStats.completed} completed, {plannerStats.missed} missed, {plannerStats.rate}% completion
                </p>
                <p className="text-xs text-muted-foreground mt-1">AI note: {aiNote}</p>
              </div>

              <div className="mt-4 space-y-2 max-h-64 overflow-auto pr-1">
                {plannerItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No personal plans yet.</p>
                ) : (
                  plannerItems
                    .slice()
                    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
                    .map((p) => {
                      const dt = new Date(p.start_time);
                      const courseCode = courses.find((c) => c.course_id === p.course_id)?.course_code;
                      return (
                        <div key={p.id} className="rounded-lg border bg-white px-3 py-2 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="font-medium capitalize">
                                {p.item_type} {courseCode ? `(${courseCode})` : ""} {p.title ? `- ${p.title}` : ""}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {dt.toLocaleString()} - {p.duration_minutes / 60} hr
                              </p>
                            </div>
                            <span className="text-xs text-muted-foreground">{p.status}</span>
                          </div>
                          <div className="mt-2 flex gap-2">
                            <Button size="sm" variant="secondary" onClick={() => updatePlannerStatus(p.id, "completed")}>
                              Completed
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => updatePlannerStatus(p.id, "missed")}>
                              Missed
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => deletePlannerItem(p.id)}>
                              Delete
                            </Button>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft border-border/50">
            <CardHeader>
              <CardTitle>Schedule Updates</CardTitle>
              <CardDescription>Notifications from lecturers</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-muted-foreground">
                  {notifications.filter((n) => !n.is_read).length} unread
                </p>
                <Button variant="outline" size="sm" onClick={markAllNotificationsRead} disabled={notifications.length === 0}>
                  Mark all read
                </Button>
              </div>
              {notifications.length === 0 ? (
                <p className="text-sm text-muted-foreground">No schedule updates yet.</p>
              ) : (
                <div className="space-y-2 max-h-56 overflow-auto pr-1">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`rounded-lg border px-3 py-2 text-sm ${
                        n.is_read ? "bg-muted/40" : "bg-secondary/10 border-secondary/30"
                      }`}
                    >
                      <p className="font-medium">{n.message}</p>
                      <p className="text-xs text-muted-foreground">
                        {n.created_at ? new Date(n.created_at).toLocaleString() : ""}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default StudentPlanner;
