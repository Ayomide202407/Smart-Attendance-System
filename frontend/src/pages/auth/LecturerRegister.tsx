import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, AlertCircle, User, Hash, Lock, GraduationCap, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";

type FormErrors = Partial<Record<
  "first_name" | "last_name" | "identifier" | "access_code" | "password" | "confirm" | "general",
  string
>>;

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 px-4 py-8">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-800 text-white mb-4">
            <GraduationCap className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Lecturer Registration</h1>
          <p className="text-gray-600 mt-2">Create your lecturer account</p>
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
                    placeholder="e.g., Test"
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
                    placeholder="e.g., Lecturer"
                  />
                </div>
                {errors.last_name && <p className="text-red-600 text-sm">{errors.last_name}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-gray-700 font-medium">Staff ID</Label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  name="identifier"
                  className={`pl-10 h-12 ${errors.identifier ? "border-red-300" : ""}`}
                  value={form.identifier}
                  onChange={(e) => setField("identifier", e.target.value)}
                  placeholder="e.g., STAFF/001"
                />
              </div>
              {errors.identifier && <p className="text-red-600 text-sm">{errors.identifier}</p>}
            </div>

            <div className="space-y-2">
              <Label className="text-gray-700 font-medium">Lecturer Access Code</Label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  name="access_code"
                  className={`pl-10 h-12 ${errors.access_code ? "border-red-300" : ""}`}
                  value={form.access_code}
                  onChange={(e) => setField("access_code", e.target.value)}
                  placeholder="Provided by admin"
                />
              </div>
              {errors.access_code && <p className="text-red-600 text-sm">{errors.access_code}</p>}
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
              className="w-full h-12 bg-slate-800 hover:bg-slate-900 text-white font-medium rounded-xl"
            >
              {isLoading ? "Creating account..." : "Create Lecturer Account"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-600">
              Already have an account?{" "}
              <Link to="/login/lecturer" className="text-slate-800 hover:underline font-medium">
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
}
