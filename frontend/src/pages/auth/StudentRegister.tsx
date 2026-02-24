import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, AlertCircle, User, Hash, Lock, Building2, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { apiRequest } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";

type FormErrors = Partial<
  Record<"first_name" | "last_name" | "identifier" | "department" | "password" | "confirm" | "general", string>
>;

const StudentRegister = () => {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [departments, setDepartments] = useState<string[]>([]);
  const [deptQuery, setDeptQuery] = useState("");
  const [departmentsLoading, setDepartmentsLoading] = useState(true);
  const [departmentsError, setDepartmentsError] = useState<string | null>(null);

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    identifier: "",
    department: "",
    password: "",
    confirm: "",
  });

  const canSubmit = useMemo(() => {
    return (
      form.first_name.trim() &&
      form.last_name.trim() &&
      form.identifier.trim() &&
      form.department.trim() &&
      form.password.trim() &&
      form.confirm.trim()
    );
  }, [form]);

  const filteredDepartments = useMemo(() => {
    const q = deptQuery.trim().toLowerCase();
    if (!q) return departments;
    return departments.filter((d) => d.toLowerCase().includes(q));
  }, [departments, deptQuery]);

  const setField = (k: keyof typeof form, v: string) => {
    setForm((p) => ({ ...p, [k]: v }));
    if (errors[k as keyof FormErrors]) setErrors((p) => ({ ...p, [k]: undefined }));
    if (errors.general) setErrors((p) => ({ ...p, general: undefined }));
  };

  const validate = () => {
    const e: FormErrors = {};
    if (!form.first_name.trim()) e.first_name = "First name is required";
    if (!form.last_name.trim()) e.last_name = "Last name is required";
    if (!form.identifier.trim()) e.identifier = "Matric number is required";
    if (!form.department.trim()) e.department = "Department is required";
    if (!form.password.trim()) e.password = "Password is required";
    if (form.password.length < 6) e.password = "Password must be at least 6 characters";
    if (form.confirm !== form.password) e.confirm = "Passwords do not match";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    try {
      const payload = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        identifier: form.identifier.trim(),
        role: "student",
        department: form.department.trim(),
        password: form.password,
      };

      const user = await register(payload);
      if (user.role !== "student") throw new Error("Registered account is not a student (unexpected).");

      navigate("/dashboard/student/face-setup");
    } catch (err: any) {
      setErrors({ general: err?.message || "Registration failed" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    async function loadDepartments() {
      setDepartmentsLoading(true);
      setDepartmentsError(null);
      try {
        const res: any = await apiRequest(endpoints.meta.departments);
        const list: string[] = Array.isArray(res) ? res : res?.departments ?? [];
        if (!mounted) return;
        setDepartments(list);
        if (list.length > 0) {
          setForm((p) => ({ ...p, department: p.department || list[0] }));
        }
      } catch (e: any) {
        if (!mounted) return;
        setDepartmentsError(e?.message || "Failed to load departments");
      } finally {
        if (mounted) setDepartmentsLoading(false);
      }
    }
    loadDepartments();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="absolute -top-24 -left-20 w-96 h-96 bg-secondary/10 rounded-full blur-3xl" />
      <div className="absolute -bottom-24 -right-20 w-[30rem] h-[30rem] bg-primary/10 rounded-full blur-3xl" />

      <div className="container mx-auto px-4 py-8 md:py-12 relative z-10">
        <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        <div className="grid lg:grid-cols-5 gap-8 items-start">
          <aside className="lg:col-span-2 surface-card hover-lift animate-scale-in p-6 md:p-8">
            <div className="w-14 h-14 rounded-xl gradient-secondary flex items-center justify-center mb-4">
              <GraduationCap className="w-7 h-7 text-secondary-foreground" />
            </div>
            <h1 className="text-3xl font-bold mb-2">Student Registration</h1>
            <p className="text-muted-foreground mb-6">
              Create your account, select your department, then complete face setup to unlock attendance sessions.
            </p>
            <div className="space-y-3">
              <div className="rounded-xl border border-border/60 bg-card p-4 text-sm">1. Create profile and password</div>
              <div className="rounded-xl border border-border/60 bg-card p-4 text-sm">2. Select your department</div>
              <div className="rounded-xl border border-border/60 bg-card p-4 text-sm">3. Complete face setup after signup</div>
            </div>
          </aside>

          <div className="lg:col-span-3 surface-card animate-slide-up p-6 md:p-8">
            {errors.general && (
              <div className="mb-6 p-4 rounded-xl bg-destructive/10 border border-destructive/30 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-destructive mt-0.5" />
                <p className="text-destructive text-sm">{errors.general}</p>
              </div>
            )}

            <form onSubmit={onSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>First Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      name="first_name"
                      className={`pl-10 h-12 ${errors.first_name ? "border-destructive" : ""}`}
                      value={form.first_name}
                      onChange={(e) => setField("first_name", e.target.value)}
                      placeholder="e.g., Ayomide"
                    />
                  </div>
                  {errors.first_name && <p className="text-destructive text-sm">{errors.first_name}</p>}
                </div>

                <div className="space-y-2">
                  <Label>Last Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      name="last_name"
                      className={`pl-10 h-12 ${errors.last_name ? "border-destructive" : ""}`}
                      value={form.last_name}
                      onChange={(e) => setField("last_name", e.target.value)}
                      placeholder="e.g., Abilewa"
                    />
                  </div>
                  {errors.last_name && <p className="text-destructive text-sm">{errors.last_name}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Matric Number</Label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    name="identifier"
                    className={`pl-10 h-12 ${errors.identifier ? "border-destructive" : ""}`}
                    value={form.identifier}
                    onChange={(e) => setField("identifier", e.target.value)}
                    placeholder="e.g., EEG/2021/001"
                  />
                </div>
                {errors.identifier && <p className="text-destructive text-sm">{errors.identifier}</p>}
              </div>

              <div className="space-y-2">
                <Label>Department</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    name="department-search"
                    className={`pl-10 h-12 ${errors.department ? "border-destructive" : ""}`}
                    value={deptQuery}
                    onChange={(e) => setDeptQuery(e.target.value)}
                    placeholder={departmentsLoading ? "Loading departments..." : "Search department"}
                    disabled={departmentsLoading}
                  />
                </div>
                <div className="mt-2 max-h-48 overflow-auto rounded-xl border bg-card">
                  {departmentsLoading ? (
                    <p className="p-3 text-sm text-muted-foreground">Loading departments...</p>
                  ) : filteredDepartments.length === 0 ? (
                    <p className="p-3 text-sm text-muted-foreground">No match found.</p>
                  ) : (
                    filteredDepartments.map((dept) => {
                      const active = form.department === dept;
                      return (
                        <button
                          key={dept}
                          type="button"
                          onClick={() => {
                            setField("department", dept);
                            setDeptQuery("");
                          }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-secondary/10 ${
                            active ? "bg-secondary/15 text-foreground font-medium" : ""
                          }`}
                        >
                          {dept}
                        </button>
                      );
                    })
                  )}
                </div>
                {form.department && (
                  <p className="text-xs text-muted-foreground">
                    Selected:{" "}
                    <span className="inline-flex items-center rounded-full bg-secondary/15 px-3 py-1 text-xs font-semibold text-foreground">
                      {form.department}
                    </span>
                  </p>
                )}
                {departmentsError && <p className="text-amber-700 text-sm">{departmentsError}. Try refreshing the page.</p>}
                {errors.department && <p className="text-destructive text-sm">{errors.department}</p>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      type="password"
                      name="password"
                      className={`pl-10 h-12 ${errors.password ? "border-destructive" : ""}`}
                      value={form.password}
                      onChange={(e) => setField("password", e.target.value)}
                      placeholder="******"
                    />
                  </div>
                  {errors.password && <p className="text-destructive text-sm">{errors.password}</p>}
                </div>

                <div className="space-y-2">
                  <Label>Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      type="password"
                      name="confirm"
                      className={`pl-10 h-12 ${errors.confirm ? "border-destructive" : ""}`}
                      value={form.confirm}
                      onChange={(e) => setField("confirm", e.target.value)}
                      placeholder="******"
                    />
                  </div>
                  {errors.confirm && <p className="text-destructive text-sm">{errors.confirm}</p>}
                </div>
              </div>

              <Button type="submit" disabled={isLoading || !canSubmit} variant="hero" size="lg" className="w-full">
                {isLoading ? "Creating account..." : "Create Student Account"}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-muted-foreground">
                Already have an account?{" "}
                <Link to="/login/student" className="text-secondary font-medium hover:underline">
                  Login
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentRegister;
