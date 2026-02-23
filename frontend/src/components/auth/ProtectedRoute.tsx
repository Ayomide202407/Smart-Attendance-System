import { Navigate } from "react-router-dom";
import { getUser } from "@/lib/storage";

export default function ProtectedRoute({
  children,
  role,
}: {
  children: JSX.Element;
  role?: "student" | "lecturer";
}) {
  const user = getUser();

  if (!user) return <Navigate to="/" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;

  return children;
}
