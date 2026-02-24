import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen,
  Building2,
  Camera,
  CheckCircle2,
  Lock,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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

const LecturerOverview = () => {
  const { user } = useAuth();
  const lecturerId = useMemo(() => (user?.id ? String(user.id) : null), [user?.id]);

  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function loadCourses() {
    if (!lecturerId) {
      setCourses([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const res: any = await apiRequest(endpoints.courses.lecturer(lecturerId));
      setCourses(res?.courses ?? []);
    } catch (e: any) {
      setLoadError(e?.message || "Failed to load courses");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCourses().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lecturerId]);

  const totalCourses = courses.length;
  const openCourses = courses.filter((c) => (c.is_effectively_open ?? c.is_open_for_enrollment)).length;
  const closedCourses = totalCourses - openCourses;
  const coveredDepartments = useMemo(() => {
    const set = new Set<string>();
    courses.forEach((c) => (c.allowed_departments ?? []).forEach((d) => set.add(d)));
    return set.size;
  }, [courses]);

  const recentCourses = useMemo(() => {
    return [...courses]
      .sort((a, b) => {
        const da = a.created_at ? Date.parse(a.created_at) : 0;
        const db = b.created_at ? Date.parse(b.created_at) : 0;
        return db - da;
      })
      .slice(0, 4);
  }, [courses]);

  const statsCards = [
    {
      label: "Total Courses",
      value: String(totalCourses),
      icon: BookOpen,
      change: "Created by you",
      gradient: "gradient-primary",
    },
    {
      label: "Open Enrollment",
      value: String(openCourses),
      icon: CheckCircle2,
      change: `${closedCourses} closed`,
      gradient: "gradient-secondary",
    },
    {
      label: "Closed Courses",
      value: String(closedCourses),
      icon: Lock,
      change: "Ready to open",
      gradient: "gradient-accent",
    },
    {
      label: "Departments Covered",
      value: String(coveredDepartments),
      icon: Building2,
      change: "Across your courses",
      gradient: "gradient-secondary",
    },
  ];

  return (
    <DashboardLayout userType="lecturer">
      <div className="space-y-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Course overview{user?.first_name ? `, ${user.first_name}` : ""}
            </h1>
            <p className="text-muted-foreground mt-1">
              A clearer snapshot of your courses, enrollment, and attendance health.
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

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {statsCards.map((stat) => (
            <Card key={stat.label} className="shadow-soft hover:shadow-medium transition-shadow border-border/50">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-3xl font-bold text-foreground mt-1">{stat.value}</p>
                    <div className="flex items-center gap-1 mt-2">
                      <Sparkles className="w-4 h-4 text-secondary" />
                      <span className="text-sm text-secondary">{stat.change}</span>
                    </div>
                  </div>
                  <div className={`w-12 h-12 rounded-xl ${stat.gradient} flex items-center justify-center shadow-soft`}>
                    <stat.icon className="w-6 h-6 text-primary-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 shadow-soft border-border/50">
            <CardHeader>
              <CardTitle>Course Overview</CardTitle>
              <CardDescription>Quick snapshot of your most recent courses</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading courses...</p>
              ) : loadError ? (
                <p className="text-sm text-red-600">{loadError}</p>
              ) : recentCourses.length === 0 ? (
                <div className="rounded-xl border border-dashed p-6 text-center">
                  <p className="text-sm text-muted-foreground">No courses yet.</p>
                  <Button asChild variant="secondary" className="mt-3">
                    <Link to="/dashboard/lecturer/classes">Create your first course</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentCourses.map((course) => (
                    <div
                      key={course.id}
                      className="flex items-center justify-between gap-3 p-4 rounded-xl bg-muted/50 border border-border/50 hover:border-secondary/30 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            (course.is_effectively_open ?? course.is_open_for_enrollment)
                              ? "gradient-secondary shadow-glow"
                              : "bg-muted"
                          }`}
                        >
                          <Camera
                            className={`w-5 h-5 ${
                              (course.is_effectively_open ?? course.is_open_for_enrollment)
                                ? "text-secondary-foreground"
                                : "text-muted-foreground"
                            }`}
                          />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">
                            {course.course_title} <span className="text-muted-foreground">({course.course_code})</span>
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {course.allowed_departments?.length ?? 0} department(s) allowed
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Enrolled: {course.enrolled_count ?? 0} · Sessions: {course.sessions_count ?? 0} ·
                            Attendance: {course.attendance_rate ?? 0}%
                          </p>
                        </div>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          course.is_effectively_open ?? course.is_open_for_enrollment
                            ? "bg-secondary/20 text-secondary"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {course.is_effectively_open ?? course.is_open_for_enrollment ? "Open" : "Closed"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-soft border-border/50">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Shortcuts to key lecturer tools</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-muted/50 border border-border/50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
                      <BookOpen className="w-4 h-4 text-primary-foreground" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-foreground">Create or edit courses</p>
                      <p className="text-xs text-muted-foreground">Define codes, titles, and departments.</p>
                    </div>
                    <Button asChild size="sm" variant="outline">
                      <Link to="/dashboard/lecturer/classes#manage">Open</Link>
                    </Button>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-secondary/10 border border-secondary/30">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg gradient-secondary flex items-center justify-center shadow-glow">
                      <Camera className="w-4 h-4 text-secondary-foreground" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-foreground">Run attendance sessions</p>
                      <p className="text-xs text-muted-foreground">Start or end camera-based sessions.</p>
                    </div>
                    <Button asChild size="sm" variant="hero">
                      <Link to="/dashboard/lecturer/sessions">Start</Link>
                    </Button>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-accent/10 border border-accent/30">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg gradient-accent flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-accent-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Enrollment status</p>
                      <p className="text-xs text-muted-foreground">
                        {openCourses} course(s) open for student enrollment.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-muted/50 border border-border/50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg gradient-secondary flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-secondary-foreground" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-foreground">Analytics & Disputes</p>
                      <p className="text-xs text-muted-foreground">
                        Review AI insights and resolve disputes.
                      </p>
                    </div>
                    <Button asChild size="sm" variant="outline">
                      <Link to="/dashboard/lecturer/sessions">Open</Link>
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default LecturerOverview;
