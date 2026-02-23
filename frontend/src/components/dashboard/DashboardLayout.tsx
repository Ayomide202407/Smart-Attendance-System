import { ReactNode, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Brain, LayoutDashboard, Camera, Users, LogOut, Menu, X, Image } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";

interface DashboardLayoutProps {
  children: ReactNode;
  userType: "lecturer" | "student";
}

const lecturerNavItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard/lecturer" },
  { icon: Users, label: "Classes", path: "/dashboard/lecturer/classes" },
  { icon: Camera, label: "Sessions", path: "/dashboard/lecturer/sessions" },
];

const studentNavItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard/student" },
  { icon: Users, label: "Enrollment", path: "/dashboard/student/enrollment" },
  { icon: Image, label: "Face Setup", path: "/dashboard/student/face-setup" },
  { icon: Camera, label: "Sessions", path: "/dashboard/student/sessions" },
];

export default function DashboardLayout({ children, userType }: DashboardLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [faceSetupComplete, setFaceSetupComplete] = useState(false);

  const navItems = useMemo(() => {
    if (userType === "lecturer") return lecturerNavItems;
    if (!faceSetupComplete) return studentNavItems;
    return studentNavItems.filter((item) => item.path !== "/dashboard/student/face-setup");
  }, [userType, faceSetupComplete]);

  useEffect(() => {
    let mounted = true;
    async function checkFaceSetup() {
      if (!user || user.role !== "student") {
        if (mounted) setFaceSetupComplete(false);
        return;
      }
      try {
        const res: any = await apiRequest(endpoints.embeddings.list(String(user.id)));
        const embeddings = res?.embeddings ?? [];
        const views = new Set<string>(embeddings.map((e: any) => e.view_type));
        const ok = views.has("front") && views.has("left") && views.has("right");
        if (mounted) setFaceSetupComplete(ok);
      } catch {
        if (mounted) setFaceSetupComplete(false);
      }
    }
    checkFaceSetup();
    return () => {
      mounted = false;
    };
  }, [user, location.pathname]);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const currentLabel = navItems.find((n) => n.path === location.pathname)?.label ?? "Dashboard";

  return (
    <div className="min-h-screen bg-background flex w-full">
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-card border border-border shadow"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Toggle sidebar"
      >
        {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-72 bg-slate-950 text-slate-100 border-r border-slate-800 transform transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-slate-800">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-teal-400 flex items-center justify-center">
                <Brain className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold">
                Edu<span className="text-teal-300">Vision</span>
              </span>
            </Link>
          </div>

          <div className="px-4 py-4">
            <div className="px-3 py-2 rounded-lg bg-slate-900/70">
              <p className="text-xs uppercase tracking-wider text-slate-300">
                {userType === "lecturer" ? "Lecturer Portal" : "Student Portal"}
              </p>
            </div>
          </div>

          <nav className="flex-1 px-4 py-2 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${
                    isActive
                      ? "bg-slate-800/80 text-white shadow-soft"
                      : "text-slate-300 hover:bg-slate-900/70"
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-slate-800">
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-slate-200 hover:bg-slate-900/70"
              onClick={handleLogout}
            >
              <LogOut className="w-5 h-5" />
              Sign Out
            </Button>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <main className="flex-1 min-h-screen overflow-auto">
        <div className="p-6 lg:p-10">
          <div className="flex flex-col gap-4 mb-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Smart Attendance</p>
                <h2 className="text-2xl font-semibold">{currentLabel}</h2>
              </div>
              <div className="rounded-xl border bg-white/80 backdrop-blur px-4 py-2">
                <p className="text-xs text-muted-foreground">Signed in as</p>
                <p className="text-sm font-medium">
                  {user?.first_name} {user?.last_name} - {user?.role}
                </p>
              </div>
            </div>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
