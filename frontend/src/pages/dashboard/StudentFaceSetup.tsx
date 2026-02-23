import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import { endpoints } from "@/lib/endpoints";
import { toast } from "@/components/ui/sonner";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000";
const LIVENESS_REQUIRED = import.meta.env.VITE_LIVENESS_REQUIRED === "1";

type Emb = { view_type: "front" | "left" | "right" };

export default function StudentFaceSetup() {
  const { user } = useAuth();
  const studentId = useMemo(() => (user?.id ? String(user.id) : ""), [user?.id]);
  const navigate = useNavigate();

  const [done, setDone] = useState<Record<string, boolean>>({ front: false, left: false, right: false });
  const [loading, setLoading] = useState(false);
  const [challengeStatus, setChallengeStatus] = useState<string>("");
  const [challengeBusy, setChallengeBusy] = useState(false);
  const [challengeFiles, setChallengeFiles] = useState<{ center?: File; left?: File; right?: File }>({});
  const [challengePassed, setChallengePassed] = useState(false);
  const completed = Object.values(done).filter(Boolean).length;

  async function refreshStatus() {
    if (!studentId) return;
    try {
      const res = await fetch(`${API_BASE_URL}${endpoints.embeddings.list(studentId)}`, { credentials: "include" });
      const data = await res.json();
      const views = (data?.embeddings ?? []).map((e: any) => e.view_type) as Emb["view_type"][];
      setDone({
        front: views.includes("front"),
        left: views.includes("left"),
        right: views.includes("right"),
      });
    } catch {}
  }

  async function upload(view: "front" | "left" | "right", file: File) {
    if (!studentId) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("student_id", studentId);
      fd.append("view_type", view);
      fd.append("image", file);

      const res = await fetch(`${API_BASE_URL}${endpoints.embeddings.add}`, {
        method: "POST",
        body: fd,
        credentials: "include",
      });

      const data = await res.json();
      if (!res.ok || data?.ok === false) throw new Error(data?.error || "Upload failed");

      await refreshStatus();
      toast.success(`${view.toUpperCase()} uploaded`);
    } catch (e: any) {
      toast.error(e?.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  async function runLivenessChallenge() {
    const center = challengeFiles.center;
    const left = challengeFiles.left;
    const right = challengeFiles.right;
    if (!center || !left || !right) {
      setChallengeStatus("Please select center, left, and right images.");
      return;
    }
    setChallengeBusy(true);
    setChallengeStatus("");
    try {
      const fd = new FormData();
      fd.append("challenge", "left_right");
      fd.append("frames", center, "center.jpg");
      fd.append("frames", left, "left.jpg");
      fd.append("frames", right, "right.jpg");

      const res = await fetch(`${API_BASE_URL}${endpoints.embeddings.livenessChallenge}`, {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok || data?.ok === false) throw new Error(data?.error || "Challenge failed");

      const passed = Boolean(data?.pass);
      setChallengePassed(passed);
      setChallengeStatus(passed ? "Liveness check passed." : "Liveness check failed. Try again.");
    } catch (e: any) {
      setChallengeStatus(e?.message || "Liveness check failed");
    } finally {
      setChallengeBusy(false);
    }
  }

  useEffect(() => { refreshStatus(); }, [studentId]);
  useEffect(() => {
    if (completed === 3) {
      navigate("/dashboard/student", { replace: true });
    }
  }, [completed, navigate]);

  return (
    <DashboardLayout userType="student">
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-2xl font-bold">Face Setup</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upload 3 clear photos: <b>Front</b>, <b>Left</b>, <b>Right</b>.
          </p>
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Progress</span>
              <span>{completed}/3 completed</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-muted">
              <div
                className="h-2 rounded-full gradient-secondary"
                style={{ width: `${(completed / 3) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {(["front","left","right"] as const).map((view) => (
          <div key={view} className="rounded-xl border bg-white p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{view.toUpperCase()} Photo</p>
                <p className="text-xs text-muted-foreground">
                  Status: {done[view] ? "Uploaded" : "Not uploaded"}
                </p>
              </div>

              <label
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer hover:bg-gray-50 ${
                  LIVENESS_REQUIRED && !challengePassed ? "opacity-60 cursor-not-allowed" : ""
                }`}
              >
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={loading || (LIVENESS_REQUIRED && !challengePassed)}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) upload(view, f);
                  }}
                />
                Upload
              </label>
            </div>
          </div>
        ))}

        <div className="rounded-xl border bg-white p-5 space-y-3">
          <div>
            <p className="font-semibold">Liveness Challenge (Optional)</p>
            <p className="text-xs text-muted-foreground mt-1">
              Capture three images: center, turn left, turn right. This checks head movement.
            </p>
            {LIVENESS_REQUIRED && !challengePassed && (
              <p className="text-xs text-red-600 mt-2">
                Liveness is required before uploads. Complete the challenge to continue.
              </p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {(["center", "left", "right"] as const).map((pos) => (
              <label
                key={pos}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border cursor-pointer hover:bg-gray-50 text-sm"
              >
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={challengeBusy}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    setChallengeFiles((prev) => ({ ...prev, [pos]: f }));
                  }}
                />
                {pos.toUpperCase()} Image
              </label>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              className="px-4 py-2 rounded-lg border text-sm hover:bg-gray-50 disabled:opacity-60"
              onClick={runLivenessChallenge}
              disabled={challengeBusy}
            >
              {challengeBusy ? "Checking..." : "Run Liveness Check"}
            </button>
            {challengeStatus && (
              <span className="text-sm text-muted-foreground">{challengeStatus}</span>
            )}
          </div>
        </div>

        <div className="rounded-xl border bg-gray-50 p-4 text-sm">
          <b>Tips:</b> good lighting, face centered, no cap/blur. Left/right should show your face turned.
        </div>
      </div>
    </DashboardLayout>
  );
}
