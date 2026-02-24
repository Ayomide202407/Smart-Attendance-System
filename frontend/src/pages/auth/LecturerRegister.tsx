import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, AlertCircle, User, Hash, Lock, GraduationCap, KeyRound, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";

type FormErrors = Partial<
  Record<"first_name" | "last_name" | "identifier" | "access_code" | "password" | "confirm" | "general", string>
>;

export default function LecturerRegister() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    identifier: "",
    access_code: "",
    password: "",
    confirm: "",
  });

  const canSubmit = useMemo(() => {
    return (
      form.first_name.trim() &&
      form.last_name.trim() &&
      form.identifier.trim() &&
      form.access_code.trim() &&
      form.password.trim() &&
      form.confirm.trim()
    );
  }, [form]);

  const setField = (k: keyof typeof form, v: string) => {
    setForm((p) => ({ ...p, [k]: v }));
    if (errors[k as keyof FormErrors]) setErrors((p) => ({ ...p, [k]: undefined }));
    if (errors.general) setErrors((p) => ({ ...p, general: undefined }));
  };

  const validate = () => {
    const e: FormErrors = {};
    if (!form.first_name.trim()) e.first_name = "First name is required";
    if (!form.last_name.trim()) e.last_name = "Last name is required";
    if (!form.identifier.trim()) e.identifier = "Staff ID is required";
    if (!form.access_code.trim()) e.access_code = "Access code is required";
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
        role: "lecturer",
        lecturer_code: form.access_code.trim(),
        password: form.password,
      };

      const user = await register(payload);
      if (user.role !== "lecturer") throw new Error("Registered account is not a lecturer (unexpected).");

      navigate("/dashboard/lecturer");
    } catch (err: any) {
      setErrors({ general: err?.message || "Registration failed" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="absolute -top-24 -right-20 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute -bottom-24 -left-20 w-[30rem] h-[30rem] bg-accent/10 rounded-full blur-3xl" />

      <div className="container mx-auto px-4 py-8 md:py-12 relative z-10">
        <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        <div className="grid lg:grid-cols-5 gap-8 items-start">
          <aside className="lg:col-span-2 surface-card hover-lift animate-scale-in p-6 md:p-8">
            <div className="w-14 h-14 rounded-xl gradient-primary flex items-center justify-center mb-4">
              <GraduationCap className="w-7 h-7 text-primary-foreground" />
            </div>
            <h1 className="text-3xl font-bold mb-2">Lecturer Registration</h1>
            <p className="text-muted-foreground mb-6">
              Set up your teaching workspace to create classes, launch sessions, and review attendance insights.
            </p>
            <div className="space-y-3">
              <div className="rounded-xl border border-border/60 bg-card p-4 text-sm">1. Create your staff profile</div>
              <div className="rounded-xl border border-border/60 bg-card p-4 text-sm">2. Verify lecturer access code</div>
              <div className="rounded-xl border border-border/60 bg-card p-4 text-sm">3. Start managing classes instantly</div>
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
                      placeholder="e.g., Test"
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
                      placeholder="e.g., Lecturer"
                    />
                  </div>
                  {errors.last_name && <p className="text-destructive text-sm">{errors.last_name}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Staff ID</Label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    name="identifier"
                    className={`pl-10 h-12 ${errors.identifier ? "border-destructive" : ""}`}
                    value={form.identifier}
                    onChange={(e) => setField("identifier", e.target.value)}
                    placeholder="e.g., STAFF/001"
                  />
                </div>
                {errors.identifier && <p className="text-destructive text-sm">{errors.identifier}</p>}
              </div>

              <div className="space-y-2">
                <Label>Lecturer Access Code</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    name="access_code"
                    className={`pl-10 h-12 ${errors.access_code ? "border-destructive" : ""}`}
                    value={form.access_code}
                    onChange={(e) => setField("access_code", e.target.value)}
                    placeholder="Provided by admin"
                  />
                </div>
                {errors.access_code && <p className="text-destructive text-sm">{errors.access_code}</p>}
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
                {isLoading ? "Creating account..." : "Create Lecturer Account"}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-muted-foreground">
                Already have an account?{" "}
                <Link to="/login/lecturer" className="text-secondary font-medium hover:underline">
                  Login
                </Link>
              </p>
            </div>

            <div className="mt-6 rounded-xl border border-border/60 bg-muted/40 p-4 flex items-center gap-3 text-sm text-muted-foreground">
              <BarChart3 className="w-4 h-4 text-secondary" />
              Lecturer dashboards include live session controls and class analytics after login.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
