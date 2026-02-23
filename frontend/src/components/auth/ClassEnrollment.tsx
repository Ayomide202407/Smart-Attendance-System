import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, BookOpen, Clock, Users } from "lucide-react";

interface Course {
  id: string;
  code: string;
  name: string;
  lecturer: string;
  schedule: string;
  credits: number;
  required: boolean;
}

interface ClassEnrollmentProps {
  department: string;
  onEnrollmentComplete: (selectedCourses: string[]) => void;
  onBack: () => void;
}

// Mock course data - in production, this would come from the backend
const getCoursesByDepartment = (department: string): Course[] => {
  const baseCourses: Course[] = [
    {
      id: "cs101",
      code: "CS 101",
      name: "Introduction to Computer Science",
      lecturer: "Dr. Adebayo Johnson",
      schedule: "Mon, Wed 9:00 AM",
      credits: 3,
      required: true,
    },
    {
      id: "cs201",
      code: "CS 201",
      name: "Data Structures & Algorithms",
      lecturer: "Prof. Ngozi Okafor",
      schedule: "Tue, Thu 11:00 AM",
      credits: 4,
      required: true,
    },
    {
      id: "cs301",
      code: "CS 301",
      name: "Database Management Systems",
      lecturer: "Dr. Emeka Eze",
      schedule: "Mon, Fri 2:00 PM",
      credits: 3,
      required: true,
    },
    {
      id: "cs401",
      code: "CS 401",
      name: "Artificial Intelligence",
      lecturer: "Dr. Fatima Ahmed",
      schedule: "Wed, Fri 10:00 AM",
      credits: 4,
      required: false,
    },
    {
      id: "cs402",
      code: "CS 402",
      name: "Computer Networks",
      lecturer: "Prof. Chukwu Nnamdi",
      schedule: "Tue, Thu 3:00 PM",
      credits: 3,
      required: false,
    },
    {
      id: "math201",
      code: "MATH 201",
      name: "Discrete Mathematics",
      lecturer: "Dr. Olumide Bakare",
      schedule: "Mon, Wed 1:00 PM",
      credits: 3,
      required: true,
    },
  ];

  return baseCourses;
};

const ClassEnrollment = ({ department, onEnrollmentComplete, onBack }: ClassEnrollmentProps) => {
  const courses = getCoursesByDepartment(department);
  const [selectedCourses, setSelectedCourses] = useState<string[]>(
    courses.filter((c) => c.required).map((c) => c.id)
  );

  const toggleCourse = (courseId: string, required: boolean) => {
    if (required) return; // Cannot deselect required courses
    
    setSelectedCourses((prev) =>
      prev.includes(courseId)
        ? prev.filter((id) => id !== courseId)
        : [...prev, courseId]
    );
  };

  const totalCredits = courses
    .filter((c) => selectedCourses.includes(c.id))
    .reduce((sum, c) => sum + c.credits, 0);

  const handleComplete = () => {
    onEnrollmentComplete(selectedCourses);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h2 className="text-xl font-bold text-foreground">Class Enrollment</h2>
          <p className="text-sm text-muted-foreground">
            Select your courses for {department} department
          </p>
        </div>
      </div>

      {/* Summary Card */}
      <div className="p-4 rounded-xl bg-secondary/10 border border-secondary/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="w-5 h-5 text-secondary" />
            <span className="font-medium text-foreground">
              {selectedCourses.length} Courses Selected
            </span>
          </div>
          <div className="text-sm text-muted-foreground">
            Total Credits: <span className="font-bold text-secondary">{totalCredits}</span>
          </div>
        </div>
      </div>

      {/* Course List */}
      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
        {courses.map((course) => (
          <div
            key={course.id}
            className={`p-4 rounded-xl border transition-all ${
              selectedCourses.includes(course.id)
                ? "bg-secondary/5 border-secondary/50"
                : "bg-card border-border/50 hover:border-border"
            }`}
          >
            <div className="flex items-start gap-3">
              <Checkbox
                id={course.id}
                checked={selectedCourses.includes(course.id)}
                onCheckedChange={() => toggleCourse(course.id, course.required)}
                disabled={course.required}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground">
                    {course.code}
                  </span>
                  {course.required && (
                    <span className="text-xs px-2 py-0.5 rounded bg-destructive/10 text-destructive">
                      Required
                    </span>
                  )}
                </div>
                <label
                  htmlFor={course.id}
                  className="font-medium text-foreground cursor-pointer"
                >
                  {course.name}
                </label>
                <div className="flex flex-wrap gap-4 mt-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {course.lecturer}
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {course.schedule}
                  </div>
                  <div>{course.credits} Credits</div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t border-border">
        <Button variant="outline" className="flex-1" onClick={onBack}>
          Back to Form
        </Button>
        <Button variant="hero" className="flex-1" onClick={handleComplete}>
          Confirm Enrollment ({selectedCourses.length} courses)
        </Button>
      </div>
    </div>
  );
};

export default ClassEnrollment;
