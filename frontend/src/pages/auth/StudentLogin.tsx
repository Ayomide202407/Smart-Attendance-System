import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Hash, Lock, AlertCircle, User, Sparkles, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";

export default function StudentLogin() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const user = await login({ identifier: identifier.trim(), password });
      if (user.role !== "student") throw new Error("This ID is not a student account.");
      navigate("/dashboard/student");
    } catch (err: any) {
      setError(err?.message || "Login failed");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex relative overflow-hidden">
      <div className="absolute -top-24 -left-20 w-96 h-96 bg-secondary/10 rounded-full blur-3xl" />
      <div className="absolute -bottom-24 -right-20 w-[28rem] h-[28rem] bg-accent/10 rounded-full blur-3xl" />

      <div className="w-full lg:w-1/2 flex flex-col justify-center px-6 md:px-10 lg:px-16 py-12 relative z-10">
        <Link
          to="/"
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-10"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        <div className="max-w-md w-full animate-slide-up">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl gradient-secondary flex items-center justify-center shadow-soft">
              <User className="w-6 h-6 text-secondary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Student Portal</h1>
              <p className="text-sm text-muted-foreground">Sign in with your matric number</p>
            </div>
          </div>

          {error && (
            <div className="mt-4 p-4 rounded-xl bg-destructive/10 border border-destructive/30 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6 mt-8" autoComplete="off">
            <div className="space-y-2">
              <Label htmlFor="identifier">Matric No</Label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="identifier"
                  type="text"
                  placeholder="e.g., EEG/TEST/002"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="pl-10 h-12 bg-card/80"
                  autoComplete="off"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 h-12 bg-card/80"
                  autoComplete="new-password"
                  required
                />
              </div>
            </div>

            <Button type="submit" variant="hero" size="lg" className="w-full" disabled={isLoading}>
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-muted-foreground">
              No account?{" "}
              <Link to="/register/student" className="text-secondary font-medium hover:underline">
                Register here
              </Link>
            </p>
          </div>
        </div>
      </div>

      <div className="hidden lg:flex w-1/2 items-center justify-center p-10 relative z-10">
        <div className="surface-card hover-lift animate-scale-in p-8 max-w-xl">
          <div className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 bg-secondary/10 border border-secondary/20 mb-4">
            <Sparkles className="w-4 h-4 text-secondary" />
            <span className="text-xs font-medium text-secondary">Student Access</span>
          </div>
          <h2 className="text-3xl font-bold mb-3">Secure Smart Attendance</h2>
          <p className="text-muted-foreground mb-8">
            Join sessions, verify attendance, and track your participation history from one dashboard.
          </p>
          <div className="space-y-3">
            <div className="rounded-xl border border-border/60 bg-card p-4 flex items-center gap-3 hover-lift">
              <ShieldCheck className="w-5 h-5 text-secondary" />
              <p className="text-sm">Role-based access and verified student identity</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-card p-4 flex items-center gap-3 hover-lift">
              <Sparkles className="w-5 h-5 text-accent" />
              <p className="text-sm">Fast onboarding with guided face setup</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
