import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Brain, ArrowLeft, AlertCircle, User, Hash, Lock, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { apiRequest } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";

type FormErrors = Partial<Record<
  "first_name" | "last_name" | "identifier" | "department" | "password" | "confirm" | "general",
  string
>>;

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-50 px-4 py-8">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-600 text-white mb-4">
            <Brain className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Student Registration</h1>
          <p className="text-gray-600 mt-2">Create your student account</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          {errors.general && (
            <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
              <p className="text-red-700 text-sm">{errors.general}</p>
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-700 font-medium">First Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    name="first_name"
                    className={`pl-10 h-12 ${errors.first_name ? "border-red-300" : ""}`}
                    value={form.first_name}
                    onChange={(e) => setField("first_name", e.target.value)}
                    placeholder="e.g., Ayomide"
                  />
                </div>
                {errors.first_name && <p className="text-red-600 text-sm">{errors.first_name}</p>}
              </div>

              <div className="space-y-2">
                <Label className="text-gray-700 font-medium">Last Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    name="last_name"
                    className={`pl-10 h-12 ${errors.last_name ? "border-red-300" : ""}`}
                    value={form.last_name}
                    onChange={(e) => setField("last_name", e.target.value)}
                    placeholder="e.g., Abilewa"
                  />
                </div>
                {errors.last_name && <p className="text-red-600 text-sm">{errors.last_name}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-gray-700 font-medium">Matric Number</Label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  name="identifier"
                  className={`pl-10 h-12 ${errors.identifier ? "border-red-300" : ""}`}
                  value={form.identifier}
                  onChange={(e) => setField("identifier", e.target.value)}
                  placeholder="e.g., EEG/2021/001"
                />
              </div>
              {errors.identifier && <p className="text-red-600 text-sm">{errors.identifier}</p>}
            </div>

            <div className="space-y-2">
              <Label className="text-gray-700 font-medium">Department</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  name="department-search"
                  className={`pl-10 h-12 ${errors.department ? "border-red-300" : ""}`}
                  value={deptQuery}
                  onChange={(e) => setDeptQuery(e.target.value)}
                  placeholder={departmentsLoading ? "Loading departments..." : "Search department"}
                  disabled={departmentsLoading}
                />
              </div>
              <div className="mt-2 max-h-48 overflow-auto rounded-lg border bg-white">
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
                        onClick={() => setField("department", dept)}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-emerald-50 ${
                          active ? "bg-emerald-100 text-emerald-800 font-medium" : ""
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
                  Selected: <span className="font-medium">{form.department}</span>
                </p>
              )}
              {departmentsError && (
                <p className="text-amber-700 text-sm">
                  {departmentsError}. Try refreshing the page.
                </p>
              )}
              {errors.department && <p className="text-red-600 text-sm">{errors.department}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-700 font-medium">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    type="password"
                    name="password"
                    className={`pl-10 h-12 ${errors.password ? "border-red-300" : ""}`}
                    value={form.password}
                    onChange={(e) => setField("password", e.target.value)}
                    placeholder="******"
                  />
                </div>
                {errors.password && <p className="text-red-600 text-sm">{errors.password}</p>}
              </div>

              <div className="space-y-2">
                <Label className="text-gray-700 font-medium">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    type="password"
                    name="confirm"
                    className={`pl-10 h-12 ${errors.confirm ? "border-red-300" : ""}`}
                    value={form.confirm}
                    onChange={(e) => setField("confirm", e.target.value)}
                    placeholder="******"
                  />
                </div>
                {errors.confirm && <p className="text-red-600 text-sm">{errors.confirm}</p>}
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading || !canSubmit}
              className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl"
            >
              {isLoading ? "Creating account..." : "Create Student Account"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-600">
              Already have an account?{" "}
              <Link to="/login/student" className="text-emerald-600 hover:text-emerald-700 font-medium">
                Login
              </Link>
            </p>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-100">
            <Link to="/" className="flex items-center justify-center gap-2 text-gray-600 hover:text-gray-800">
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentRegister;
