import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect } from "react";

import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

import LecturerLogin from "./pages/auth/LecturerLogin";
import StudentLogin from "./pages/auth/StudentLogin";
import LecturerRegister from "./pages/auth/LecturerRegister";
import StudentRegister from "./pages/auth/StudentRegister";

import LecturerDashboard from "./pages/dashboard/LecturerDashboard";
import LecturerOverview from "./pages/dashboard/LecturerOverview";
import StudentDashboard from "./pages/dashboard/StudentDashboard";
import StudentPlanner from "./pages/dashboard/StudentPlanner";
import StudentProgress from "./pages/dashboard/StudentProgress";
import StudentWeeklySchedule from "./pages/dashboard/StudentWeeklySchedule";

import LecturerSessions from "./pages/dashboard/LecturerSessions";
import LecturerClasses from "./pages/dashboard/LecturerClasses";

import StudentEnrollment from "./pages/dashboard/StudentEnrollment";
import StudentSessions from "./pages/dashboard/StudentSessions";
import StudentFaceSetup from "./pages/dashboard/StudentFaceSetup";

import { AuthProvider } from "@/context/AuthContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import FaceSetupGate from "@/components/auth/FaceSetupGate";
import { API_BASE_URL } from "@/lib/config";

// Small helper page for routes we haven't built yet
const ComingSoon = ({ title }: { title: string }) => (
  <div className="min-h-screen p-6">
    <div className="max-w-2xl mx-auto border rounded-xl p-6 bg-white">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="text-sm text-muted-foreground mt-2">
        This page is not finished yet.
      </p>
    </div>
  </div>
);

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 5000);

    fetch(`${API_BASE_URL}/health`, { signal: controller.signal }).catch(() => {
      // Ignore wake-up failures; the backend may be asleep.
    });

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
          <BrowserRouter>
            <Routes>
            {/* Public */}
            <Route path="/" element={<Index />} />

            {/* Auth */}
            <Route path="/login/lecturer" element={<LecturerLogin />} />
            <Route path="/login/student" element={<StudentLogin />} />
            <Route path="/register/lecturer" element={<LecturerRegister />} />
            <Route path="/register/student" element={<StudentRegister />} />

            {/* Lecturer */}
            <Route
              path="/dashboard/lecturer"
              element={
                <ProtectedRoute role="lecturer">
                  <LecturerDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/lecturer/overview"
              element={
                <ProtectedRoute role="lecturer">
                  <LecturerOverview />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/lecturer/sessions"
              element={
                <ProtectedRoute role="lecturer">
                  <LecturerSessions />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/lecturer/classes"
              element={
                <ProtectedRoute role="lecturer">
                  <LecturerClasses />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/lecturer/insights"
              element={
                <ProtectedRoute role="lecturer">
                  <ComingSoon title="AI Insights" />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/lecturer/components"
              element={
                <ProtectedRoute role="lecturer">
                  <ComingSoon title="Shared Components" />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/lecturer/settings"
              element={
                <ProtectedRoute role="lecturer">
                  <ComingSoon title="AI Settings" />
                </ProtectedRoute>
              }
            />

            {/* Student: Face setup route is allowed immediately after login */}
            <Route
              path="/dashboard/student/face-setup"
              element={
                <ProtectedRoute role="student">
                  <StudentFaceSetup />
                </ProtectedRoute>
              }
            />

            {/* Student: everything else is gated */}
            <Route
              path="/dashboard/student"
              element={
                <ProtectedRoute role="student">
                  <FaceSetupGate>
                    <StudentDashboard />
                  </FaceSetupGate>
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/student/planner"
              element={
                <ProtectedRoute role="student">
                  <FaceSetupGate>
                    <StudentPlanner />
                  </FaceSetupGate>
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/student/progress"
              element={
                <ProtectedRoute role="student">
                  <FaceSetupGate>
                    <StudentProgress />
                  </FaceSetupGate>
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/student/weekly-schedule"
              element={
                <ProtectedRoute role="student">
                  <FaceSetupGate>
                    <StudentWeeklySchedule />
                  </FaceSetupGate>
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/student/enrollment"
              element={
                <ProtectedRoute role="student">
                  <FaceSetupGate>
                    <StudentEnrollment />
                  </FaceSetupGate>
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/student/sessions"
              element={
                <ProtectedRoute role="student">
                  <FaceSetupGate>
                    <StudentSessions />
                  </FaceSetupGate>
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/student/materials"
              element={
                <ProtectedRoute role="student">
                  <FaceSetupGate>
                    <ComingSoon title="Learning Materials" />
                  </FaceSetupGate>
                </ProtectedRoute>
              }
            />

            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
