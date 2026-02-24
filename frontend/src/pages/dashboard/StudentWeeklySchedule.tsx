import { useEffect, useMemo, useState } from "react";
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

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const BACKGROUNDS = [
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1482192596544-9eb780fc7f66?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1600&q=80",
];
const QUOTES = [
  "Small steps each day become big results.",
  "Consistency beats intensity when it counts.",
  "Plan the week, win the week.",
  "Focus for one hour, then repeat.",
  "Your future self will thank you for today.",
];

const StudentWeeklySchedule = () => {
  const { user } = useAuth();
  const studentId = useMemo(() => (user?.id ? String(user.id) : ""), [user?.id]);

  const [courses, setCourses] = useState<EnrollmentCourse[]>([]);
  const [schedulesByCourse, setSchedulesByCourse] = useState<Record<string, CourseSchedule[]>>({});
  const [bgUrl, setBgUrl] = useState(BACKGROUNDS[0]);
  const [quote, setQuote] = useState(QUOTES[0]);

  useEffect(() => {
    const pick = BACKGROUNDS[Math.floor(Math.random() * BACKGROUNDS.length)];
    setBgUrl(pick);
    const pickQuote = QUOTES[Math.floor(Math.random() * QUOTES.length)];
    setQuote(pickQuote);
  }, []);

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

  const weekDates = useMemo(() => {
    const today = new Date();
    const start = new Date(today);
    const dayOffset = (today.getDay() + 6) % 7;
    start.setDate(today.getDate() - dayOffset);
    start.setHours(0, 0, 0, 0);
    return DAY_LABELS.map((_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, []);

  const timeSlots = useMemo(() => {
    const slots: string[] = [];
    for (let h = 8; h <= 19; h += 1) {
      slots.push(`${String(h).padStart(2, "0")}:00`);
    }
    return slots;
  }, []);

  const blocks = useMemo(() => {
    const items: Array<{
      id: string;
      dayIdx: number;
      start: string;
      duration: number;
      label: string;
      location?: string | null;
    }> = [];
    Object.entries(schedulesByCourse).forEach(([courseId, scheds]) => {
      const course = courses.find((c) => c.course_id === courseId);
      scheds.forEach((s) => {
        if (s.is_recurring === false || !s.start_time) return;
        items.push({
          id: s.id,
          dayIdx: s.day_of_week,
          start: s.start_time,
          duration: s.duration_minutes,
          label: course?.course_code || course?.course_title || "Class",
          location: s.location,
        });
      });
    });
    return items;
  }, [schedulesByCourse, courses]);

  return (
    <DashboardLayout userType="student">
      <div className="relative overflow-hidden rounded-3xl border bg-slate-900 shadow-large">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${bgUrl})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950/80 via-slate-900/70 to-slate-950/80" />
        <div className="relative z-10 p-6 lg:p-10 text-white">
          <div className="flex flex-col gap-3">
            <p className="text-xs uppercase tracking-[0.3em] text-emerald-200/80">
              Weekly Schedule
            </p>
            <h1 className="text-3xl lg:text-4xl font-semibold">Plan the week, stay on track.</h1>
            <p className="text-sm text-slate-200/90 max-w-xl">
              {quote}
            </p>
          </div>

          <div className="mt-6 overflow-auto">
            <div className="min-w-[900px] rounded-2xl bg-white/90 text-slate-900 shadow-soft backdrop-blur">
              <div className="grid" style={{ gridTemplateColumns: "90px repeat(7, 1fr)" }}>
                <div className="border-r border-slate-200 px-3 py-3 text-xs font-semibold text-slate-500">
                  Time
                </div>
                {DAY_LABELS.map((d, idx) => (
                  <div key={d} className="border-r border-slate-200 px-3 py-3 text-xs font-semibold">
                    <div className="text-slate-500">{d}</div>
                    <div className="text-base font-bold">
                      {weekDates[idx].getMonth() + 1}/{weekDates[idx].getDate()}
                    </div>
                  </div>
                ))}
              </div>
              <div className="relative">
                <div className="grid" style={{ gridTemplateColumns: "90px repeat(7, 1fr)" }}>
                  <div className="border-r border-slate-200 bg-slate-50">
                    {timeSlots.map((t) => (
                      <div key={t} className="h-[50px] border-t border-slate-200 px-3 text-xs text-slate-500">
                        {t}
                      </div>
                    ))}
                  </div>
                  {DAY_LABELS.map((_, dayIdx) => (
                    <div key={dayIdx} className="relative border-r border-slate-200">
                      {timeSlots.map((t) => (
                        <div key={t} className="h-[50px] border-t border-slate-200" />
                      ))}
                      {blocks
                        .filter((b) => b.dayIdx === dayIdx)
                        .map((b) => {
                          const [hh, mm] = b.start.split(":").map((v) => Number(v));
                          const top = ((hh - 8) * 60 + (mm || 0)) * (50 / 60);
                          const height = Math.max(32, b.duration * (50 / 60));
                          return (
                            <div
                              key={b.id}
                              className="absolute left-2 right-2 rounded-xl border border-emerald-300 bg-emerald-50 px-2 py-2 text-xs shadow-sm"
                              style={{ top, height }}
                            >
                              <div className="font-semibold text-emerald-900">{b.label}</div>
                              <div className="text-emerald-700">{b.start} • {b.duration}m</div>
                              {b.location ? <div className="text-emerald-700/80">{b.location}</div> : null}
                            </div>
                          );
                        })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {blocks.length === 0 && (
            <div className="mt-4 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white/90">
              No weekly schedules yet. Enroll in a class or wait for your lecturer to add one.
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default StudentWeeklySchedule;
