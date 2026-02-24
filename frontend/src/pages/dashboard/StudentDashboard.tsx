
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock3, MapPin, BellRing } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

const StudentDashboard = () => {
  const { user } = useAuth();
  const studentId = useMemo(() => (user?.id ? String(user.id) : ""), [user?.id]);

  const [courses, setCourses] = useState<EnrollmentCourse[]>([]);
  const [schedulesByCourse, setSchedulesByCourse] = useState<Record<string, CourseSchedule[]>>({});
  const [now, setNow] = useState(() => new Date());
  const [showSchedulePopup, setShowSchedulePopup] = useState(false);

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
  }

  useEffect(() => {
    loadData().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

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
      is_recurring?: boolean;
    }> = [];
    Object.entries(schedulesByCourse).forEach(([courseId, scheds]) => {
      const course = courses.find((c) => c.course_id === courseId);
      scheds.forEach((s) => {
        const when = dateFromSchedule(s);
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

  const todaySchedule = useMemo(() => {
    const today = new Date(now);
    const dayLabel = (today.getDay() + 6) % 7; // JS Sunday=0 -> Monday=0
    const items: Array<{
      when: Date;
      course_id: string;
      course_code?: string;
      course_title?: string;
      location?: string | null;
      duration_minutes?: number;
    }> = [];
    Object.entries(schedulesByCourse).forEach(([courseId, scheds]) => {
      const course = courses.find((c) => c.course_id === courseId);
      scheds.forEach((s) => {
        if (s.is_recurring === false && s.schedule_date) {
          const when = dateFromSchedule(s);
          if (isSameDay(when, today)) {
            items.push({
              when,
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
          items.push({
            when,
            course_id: courseId,
            course_code: course?.course_code,
            course_title: course?.course_title,
            location: s.location,
            duration_minutes: s.duration_minutes,
          });
        }
      });
    });
    return items.sort((a, b) => a.when.getTime() - b.when.getTime());
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
      const course = courses.find((c) => c.course_id === courseId);
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
    const key = `student-popup-${popupItem.course_id}-${popupItem.when.toISOString()}`;
    if (sessionStorage.getItem(key)) return;
    setShowSchedulePopup(true);
  }, [popupItem]);

  function dismissPopup() {
    if (!popupItem) {
      setShowSchedulePopup(false);
      return;
    }
    const key = `student-popup-${popupItem.course_id}-${popupItem.when.toISOString()}`;
    sessionStorage.setItem(key, "1");
    setShowSchedulePopup(false);
  }

  return (
    <DashboardLayout userType="student">
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
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Welcome back{user?.first_name ? `, ${user.first_name}` : ""}
          </h1>
          <p className="text-muted-foreground mt-1">
            Your schedule for today is front and center.
          </p>
        </div>
        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 border-0 shadow-large bg-gradient-to-br from-white via-white to-secondary/10">
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-2">
                <CalendarDays className="w-6 h-6 text-secondary" />
                Today's classes
              </CardTitle>
              <CardDescription className="text-base">
                High-visibility schedule so you do not miss class.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {todaySchedule.length === 0 ? (
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
                        <div className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
                          Reminder only. Attendance is taken by your lecturer.
                        </div>
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
                        {c.course_code ?? "Course"} {c.when.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {c.when.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} {c.duration_minutes ?? 60} mins
                        {c.location ? ` ${c.location}` : ""}
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

export default StudentDashboard;
