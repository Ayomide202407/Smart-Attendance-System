import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import { apiRequest } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";

type Course = {
  id: string;
  course_code?: string;
  course_title?: string;
  title?: string;
  code?: string;
  lecturer_name?: string;
  is_open_for_enrollment?: boolean;
  is_effectively_open?: boolean;
};

function getTitle(c: Course) {
  return c.course_title ?? c.title ?? "Untitled Course";
}
function getCode(c: Course) {
  return c.course_code ?? c.code ?? "";
}

export default function StudentEnrollment() {
  const { user } = useAuth();
  const studentId = user?.id?.toString();

  const [courses, setCourses] = useState<Course[]>([]);
  const [myCourses, setMyCourses] = useState<Course[]>([]);
  const [working, setWorking] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"title" | "code">("title");
  const [showClosed, setShowClosed] = useState(false);

  const availableEndpoint = useMemo(() => {
    if (!studentId) return "";
    return showClosed
      ? `${endpoints.enrollments.available(studentId)}?include_closed=1`
      : endpoints.enrollments.available(studentId);
  }, [studentId, showClosed]);

  async function loadAvailableCourses() {
    if (!studentId) return;
    const res: any = await apiRequest(availableEndpoint);

    const list =
      Array.isArray(res) ? res :
      res?.courses ? res.courses :
      res?.available ? res.available :
      [];

    setCourses(list);
  }

  async function loadMyCourses() {
    if (!studentId) return;
    const res: any = await apiRequest(endpoints.enrollments.my(studentId));
    const list =
      Array.isArray(res) ? res :
      res?.courses ? res.courses :
      res?.enrollments ? res.enrollments :
      [];
    setMyCourses(list);
  }

  async function enroll(courseId: string) {
    if (!studentId) return;
    setWorking(courseId);
    try {
      await apiRequest(endpoints.enrollments.enroll, {
        method: "POST",
        body: {
          student_id: studentId,
          course_id: courseId,
        },
      });
      toast.success("Enrolled successfully");
      await loadAvailableCourses();
      await loadMyCourses();
    } catch (e: any) {
      toast.error(e?.message || "Enrollment failed");
    } finally {
      setWorking(null);
    }
  }

  async function unenroll(courseId: string) {
    if (!studentId) return;
    setWorking(courseId);
    try {
      await apiRequest(endpoints.enrollments.unenroll, {
        method: "POST",
        body: {
          student_id: studentId,
          course_id: courseId,
        },
      });
      toast.success("Unenrolled");
      await loadAvailableCourses();
      await loadMyCourses();
    } catch (e: any) {
      toast.error(e?.message || "Unenroll failed");
    } finally {
      setWorking(null);
    }
  }

  useEffect(() => {
    loadAvailableCourses().catch(console.error);
    loadMyCourses().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, availableEndpoint]);

  const filteredCourses = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = [...courses];
    if (q) {
      list = list.filter((c) =>
        [getTitle(c), getCode(c), c.lecturer_name ?? ""].some((v) =>
          v.toLowerCase().includes(q)
        )
      );
    }
    if (!showClosed) {
      list = list.filter((c) => (c.is_effectively_open ?? c.is_open_for_enrollment) !== false);
    }
    list.sort((a, b) => {
      const av = (sortBy === "title" ? getTitle(a) : getCode(a)).toLowerCase();
      const bv = (sortBy === "title" ? getTitle(b) : getCode(b)).toLowerCase();
      return av.localeCompare(bv);
    });
    return list;
  }, [courses, query, showClosed, sortBy]);

  return (
    <DashboardLayout userType="student">
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold">Course Enrollment</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Enroll in available courses to participate in lecture sessions.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Available courses are filtered by your department and enrollment status.
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5">
          <h2 className="font-semibold">My Enrolled Courses</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Courses you are already enrolled in.
          </p>
          <div className="mt-4 space-y-3">
            {myCourses.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                You have not enrolled in any course yet.
              </p>
            ) : (
              myCourses.map((c) => (
                <div
                  key={c.id}
                  className="rounded-lg border bg-gray-50 p-4 flex items-center justify-between gap-4"
                >
                  <div>
                    <p className="font-semibold">
                      {getTitle(c)}{" "}
                      {getCode(c) && (
                        <span className="text-muted-foreground">
                          ({getCode(c)})
                        </span>
                      )}
                    </p>
                    {(c.is_effectively_open ?? c.is_open_for_enrollment) === false && (
                      <p className="text-xs text-amber-700 mt-1">Enrollment closed</p>
                    )}
                    {c.lecturer_name && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Lecturer: {c.lecturer_name}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => unenroll(c.id)}
                    disabled={working === c.id}
                  >
                    {working === c.id ? "Working..." : "Unenroll"}
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border bg-white p-4 flex flex-col md:flex-row md:items-center gap-3">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by course title, code, or lecturer"
            className="md:flex-1"
          />
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Sort:</label>
            <select
              className="border rounded-md px-2 py-2 text-sm"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "title" | "code")}
            >
              <option value="title">Title</option>
              <option value="code">Code</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showClosed}
              onChange={(e) => setShowClosed(e.target.checked)}
            />
            Show closed
          </label>
        </div>

        {filteredCourses.length === 0 ? (
          <div className="rounded-xl border bg-white p-6">
            <p className="text-sm text-muted-foreground">
              No available courses at the moment.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredCourses.map((c) => (
              <div
                key={c.id}
                className="rounded-xl border bg-white p-5 flex items-center justify-between gap-4"
              >
                <div>
                  <p className="font-semibold">
                    {getTitle(c)}{" "}
                    {getCode(c) && (
                      <span className="text-muted-foreground">
                        ({getCode(c)})
                      </span>
                    )}
                  </p>
                  {(c.is_effectively_open ?? c.is_open_for_enrollment) === false && (
                    <p className="text-xs text-amber-700 mt-1">Enrollment closed</p>
                  )}
                  {c.lecturer_name && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Lecturer: {c.lecturer_name}
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => enroll(c.id)}
                    disabled={working === c.id}
                  >
                    {working === c.id ? "Enrolling..." : "Enroll"}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => unenroll(c.id)}
                    disabled={working === c.id}
                  >
                    Unenroll
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
