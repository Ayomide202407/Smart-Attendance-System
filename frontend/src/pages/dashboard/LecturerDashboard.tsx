import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, Clock3, MapPin, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import { apiRequest } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";

type Course = {
  id: string;
  course_code: string;
  course_title: string;
  is_open_for_enrollment: boolean;
  allowed_departments?: string[];
  created_at?: string;
  enrollment_open_at?: string | null;
  enrollment_close_at?: string | null;
  is_effectively_open?: boolean;
  enrolled_count?: number;
  sessions_count?: number;
  attendance_rate?: number;
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

const LecturerDashboard = () => {
  const { user } = useAuth();
  const lecturerId = useMemo(() => (user?.id ? String(user.id) : null), [user?.id]);

  const [courses, setCourses] = useState<Course[]>([]);
  const [schedulesByCourse, setSchedulesByCourse] = useState<Record<string, CourseSchedule[]>>({});
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [showSchedulePopup, setShowSchedulePopup] = useState(false);

  async function loadCourses() {
    if (!lecturerId) {
      setCourses([]);
      return;
    }
    try {
      const res: any = await apiRequest(endpoints.courses.lecturer(lecturerId));
      setCourses(res?.courses ?? []);
    } catch {
      setCourses([]);
    }
  }

  async function loadSchedules() {
    if (!lecturerId || courses.length === 0) {
      setSchedulesByCourse({});
      return;
    }
    setScheduleError(null);
    try {
      const results = await Promise.all(
        courses.map((c) =>
          apiRequest(`${endpoints.courses.scheduleList(c.id)}?lecturer_id=${encodeURIComponent(lecturerId)}`).catch(() => null)
        )
      );
      const map: Record<string, CourseSchedule[]> = {};
      results.forEach((res: any, idx) => {
        const cid = courses[idx]?.id;
        if (!cid) return;
        map[cid] = res?.schedules ?? [];
      });
      setSchedulesByCourse(map);
    } catch (e: any) {
      setScheduleError(e?.message || "Failed to load schedules");
    }
  }

  useEffect(() => {
    loadCourses().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lecturerId]);

  useEffect(() => {
    loadSchedules().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lecturerId, courses]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(id);
  }, []);

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

  function dateFromSchedule(s: CourseSchedule) {
    if (s.is_recurring === false && s.schedule_date) {
      const [y, m, d] = s.schedule_date.split("-").map((v) => Number(v));
      const [hh, mm] = s.start_time.split(":").map((v) => Number(v));
      return new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0);
    }
    return nextOccurrence(s.day_of_week, s.start_time);
  }

  function isSameDay(a: Date, b: Date) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  const nextClass = useMemo(() => {
    const items: Array<{
      when: Date;
      course_id: string;
      course_code?: string;
      course_title?: string;
      location?: string | null;
      duration_minutes?: number;
    }> = [];
    Object.entries(schedulesByCourse).forEach(([courseId, scheds]) => {
      const course = courses.find((c) => c.id === courseId);
      scheds.forEach((s) => {
        const when = dateFromSchedule(s);
        items.push({
          when,
          course_id: courseId,
          course_code: course?.course_code,
          course_title: course?.course_title,
          location: s.location,
          duration_minutes: s.duration_minutes,
        });
      });
    });
    items.sort((a, b) => a.when.getTime() - b.when.getTime());
    return items[0] || null;
  }, [schedulesByCourse, courses]);

  const todaySchedule = useMemo(() => {
    const today = new Date(now);
    const dayLabel = (today.getDay() + 6) % 7; // JS Sunday=0 -> Monday=0
    const items: Array<{
      when: Date;
      endsAt: Date;
      course_id: string;
      course_code?: string;
      course_title?: string;
      location?: string | null;
      duration_minutes?: number;
    }> = [];
    Object.entries(schedulesByCourse).forEach(([courseId, scheds]) => {
      const course = courses.find((c) => c.id === courseId);
      scheds.forEach((s) => {
        if (s.is_recurring === false && s.schedule_date) {
          const when = dateFromSchedule(s);
          if (isSameDay(when, today)) {
            const duration = s.duration_minutes ?? 60;
            const endsAt = new Date(when.getTime() + duration * 60000);
            items.push({
              when,
              endsAt,
              course_id: courseId,
              course_code: course?.course_code,
              course_title: course?.course_title,
              location: s.location,
              duration_minutes: s.duration_minutes,
            });
          }
        } else if (s.day_of_week === dayLabel) {
          const [hh, mm] = s.start_time.split(":").map((v) => Number(v));
          const when = new Date(today);
          when.setHours(hh || 0, mm || 0, 0, 0);
          const duration = s.duration_minutes ?? 60;
          const endsAt = new Date(when.getTime() + duration * 60000);
          items.push({
            when,
            endsAt,
            course_id: courseId,
            course_code: course?.course_code,
            course_title: course?.course_title,
            location: s.location,
            duration_minutes: s.duration_minutes,
          });
        }
      });
    });
    const upcomingOrOngoing = items.filter((i) => now <= i.endsAt);
    return upcomingOrOngoing.sort((a, b) => a.when.getTime() - b.when.getTime());
  }, [schedulesByCourse, courses, now]);

  const weekSchedule = useMemo(() => {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
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
      const course = courses.find((c) => c.id === courseId);
      scheds.forEach((s) => {
        const when = dateFromSchedule(s);
        if (when >= start && when < end) {
          items.push({
            when,
            course_id: courseId,
            course_code: course?.course_code,
            course_title: course?.course_title,
            location: s.location,
            duration_minutes: s.duration_minutes,
            is_recurring: s.is_recurring !== false,
          });
        }
      });
    });
    return items.sort((a, b) => a.when.getTime() - b.when.getTime());
  }, [schedulesByCourse, courses, now]);

  const popupItem = useMemo(() => {
    if (!nextClass) return null;
    const mins = Math.round((nextClass.when.getTime() - now.getTime()) / 60000);
    const duration = nextClass.duration_minutes ?? 60;
    const endsAt = new Date(nextClass.when.getTime() + duration * 60000);
    const inProgress = now >= nextClass.when && now <= endsAt;
    if (inProgress || (mins >= 0 && mins <= 15)) {
      return { ...nextClass, mins, inProgress };
    }
    return null;
  }, [nextClass, now]);

  useEffect(() => {
    if (!popupItem) return;
    const key = `lecturer-popup-${popupItem.course_id}-${popupItem.when.toISOString()}`;
    if (sessionStorage.getItem(key)) return;
    setShowSchedulePopup(true);
  }, [popupItem]);

  function dismissPopup() {
    if (!popupItem) {
      setShowSchedulePopup(false);
      return;
    }
    const key = `lecturer-popup-${popupItem.course_id}-${popupItem.when.toISOString()}`;
    sessionStorage.setItem(key, "1");
    setShowSchedulePopup(false);
  }

  return (
    <DashboardLayout userType="lecturer">
      <Dialog open={showSchedulePopup} onOpenChange={(open) => (!open ? dismissPopup() : null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl">Class alert</DialogTitle>
            <DialogDescription>
              {popupItem?.inProgress
                ? "Your class is happening now."
                : `Your next class starts in ${popupItem?.mins ?? 0} minutes.`}
            </DialogDescription>
          </DialogHeader>
          {popupItem ? (
            <div className="rounded-2xl border bg-muted/30 p-4">
              <p className="text-lg font-semibold">
                {popupItem.course_title ?? "Course"}{" "}
                {popupItem.course_code ? (
                  <span className="text-muted-foreground">({popupItem.course_code})</span>
                ) : null}
              </p>
              <p className="text-sm text-muted-foreground">
                {popupItem.when.toLocaleString()} · {popupItem.duration_minutes ?? 60} mins
                {popupItem.location ? ` · ${popupItem.location}` : ""}
              </p>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={dismissPopup}>Dismiss</Button>
            <Button asChild variant="hero">
              <Link to="/dashboard/lecturer/sessions">Start Session</Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Welcome back{user?.first_name ? `, ${user.first_name}` : ""}!
            </h1>
            <p className="text-muted-foreground mt-1">
              Track your courses, manage enrollment, and run attendance sessions.
            </p>
          </div>
          <div className="flex gap-3">
            <Button asChild variant="outline" size="lg">
              <Link to="/dashboard/lecturer/classes#manage">Manage Classes</Link>
            </Button>
            <Button asChild variant="hero" size="lg">
              <Link to="/dashboard/lecturer/sessions">Start a Session</Link>
            </Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 border-0 shadow-large bg-gradient-to-br from-white via-white to-secondary/10">
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-2">
                <CalendarDays className="w-6 h-6 text-secondary" />
                Today's teaching schedule
              </CardTitle>
              <CardDescription className="text-base">
                Big, visible schedule so you never miss a class.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {scheduleError ? (
                <p className="text-sm text-red-600">{scheduleError}</p>
              ) : todaySchedule.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-6 text-center bg-white/80">
                  <p className="text-lg font-semibold">No classes today</p>
                  <p className="text-sm text-muted-foreground mt-1">Check the weekly view for upcoming classes.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {todaySchedule.map((c) => (
                    <div key={`${c.course_id}-${c.when.toISOString()}`} className="rounded-2xl border bg-white px-4 py-3 shadow-soft">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div>
                          <p className="text-lg font-semibold">
                            {c.course_title ?? "Course"}{" "}
                            {c.course_code ? <span className="text-muted-foreground">({c.course_code})</span> : null}
                          </p>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                            <span className="inline-flex items-center gap-1">
                              <Clock3 className="w-4 h-4" />
                              {c.when.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                            <span>{c.duration_minutes ?? 60} mins</span>
                            {c.location ? (
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="w-4 h-4" />
                                {c.location}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        {now >= c.when && now <= c.endsAt ? (
                          <Button asChild variant="hero" size="lg">
                            <Link to="/dashboard/lecturer/sessions">Start Attendance</Link>
                          </Button>
                        ) : (
                          <div className="text-xs text-muted-foreground">
                            Starts at {c.when.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-large bg-gradient-to-br from-white via-white to-accent/10">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <BellRing className="w-5 h-5 text-accent" />
                This week
              </CardTitle>
              <CardDescription className="text-base">Next 7 days of classes</CardDescription>
            </CardHeader>
            <CardContent>
              {weekSchedule.length === 0 ? (
                <p className="text-sm text-muted-foreground">No classes scheduled this week.</p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-auto pr-1">
                  {weekSchedule.map((c) => (
                    <div key={`${c.course_id}-${c.when.toISOString()}`} className="rounded-xl border bg-white/90 px-3 py-2">
                      <p className="font-semibold text-foreground text-sm">
                        {c.course_code ?? "Course"} · {c.when.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {c.when.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {c.duration_minutes ?? 60} mins
                        {c.location ? ` · ${c.location}` : ""}
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

export default LecturerDashboard;

