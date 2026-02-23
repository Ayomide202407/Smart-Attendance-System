import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { apiRequest } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";

/**
 * Forces students to complete face setup (front/left/right)
 * before they can access the student dashboard routes.
 */
export default function FaceSetupGate({ children }: { children: JSX.Element }) {
  const { user } = useAuth();
  const [checking, setChecking] = useState(true);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function run() {
      // Only applies to students
      if (!user || user.role !== "student") {
        if (mounted) setChecking(false);
        return;
      }

      try {
        const res: any = await apiRequest(endpoints.embeddings.list(String(user.id)));
        const embeddings = res?.embeddings ?? [];
        const views = new Set<string>(embeddings.map((e: any) => e.view_type));
        const ok = views.has("front") && views.has("left") && views.has("right");

        if (mounted) setComplete(ok);
      } catch {
        if (mounted) setComplete(false);
      } finally {
        if (mounted) setChecking(false);
      }
    }

    run();
    return () => {
      mounted = false;
    };
  }, [user]);

  if (checking) return null;

  // If student has not completed face setup, force them to the setup page
  if (user?.role === "student" && !complete) {
    return <Navigate to="/dashboard/student/face-setup" replace />;
  }

  return children;
}
