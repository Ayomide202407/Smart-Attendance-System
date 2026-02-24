import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000";

type Props = {
  open: boolean;
  onClose: () => void;
  lecturerId: string;
  courseId: string;
  courseLabel?: string;
};

type Student = {
  id: string;
  full_name: string;
  identifier: string;
};

export default function TakeAttendanceModal({
  open,
  onClose,
  lecturerId,
  courseId,
  courseLabel,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<number | null>(null);

  const [busy, setBusy] = useState(false);
  const [liveOn, setLiveOn] = useState(false);
  const [threshold, setThreshold] = useState(0.4);
  const [blurThreshold, setBlurThreshold] = useState(80);
  const [status, setStatus] = useState<string>("");
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [markedIds, setMarkedIds] = useState<Set<string>>(new Set());
  const [lastMatched, setLastMatched] = useState<string[]>([]);
  const [scanStats, setScanStats] = useState<{ detectedFaces?: number; matchedCount?: number } | null>(null);

  useEffect(() => {
    if (!open) {
      stopLive();
      setStatus("");
      setStudents([]);
      setMarkedIds(new Set());
      setLastMatched([]);
      setScanStats(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!lecturerId || !courseId) return;
    let mounted = true;
    async function loadStudents() {
      setLoadingStudents(true);
      try {
        const url = `${endpoints.courses.students(courseId)}?lecturer_id=${encodeURIComponent(
          lecturerId
        )}`;
        const res: any = await apiRequest(url);
        if (mounted) setStudents(res?.students ?? []);
      } catch {
        if (mounted) setStudents([]);
      } finally {
        if (mounted) setLoadingStudents(false);
      }
    }
    loadStudents();
    return () => {
      mounted = false;
    };
  }, [open, lecturerId, courseId]);

  const studentsById = useMemo(() => {
    const map = new Map<string, Student>();
    students.forEach((s) => map.set(s.id, s));
    return map;
  }, [students]);

  const totalEnrolled = students.length;
  const totalMarked = markedIds.size;

  function stopLive() {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setLiveOn(false);
  }

  function summarizeSkips(skipped: any[]) {
    if (!Array.isArray(skipped) || skipped.length === 0) return "";
    const counts: Record<string, number> = {};
    skipped.forEach((s) => {
      const reason = String(s?.reason || "unknown");
      counts[reason] = (counts[reason] || 0) + 1;
    });
    const parts = Object.entries(counts).map(([reason, count]) => `${reason.replace(/_/g, " ")}: ${count}`);
    return parts.length ? ` Skipped (${parts.join(", ")}).` : "";
  }

  async function scanAndMark(blob: Blob, method: "live_video" | "image_upload") {
    const fd = new FormData();
    fd.append("lecturer_id", lecturerId);
    fd.append("course_id", courseId);
    fd.append("threshold", String(threshold));
    fd.append("blur_threshold", String(blurThreshold));
    fd.append("image", blob, "frame.jpg");

    const scanRes = await fetch(`${API_BASE_URL}${endpoints.attendance.scanImage}`, {
      method: "POST",
      body: fd,
      credentials: "include",
    });

    const scanData = await scanRes.json().catch(() => null);

    if (!scanRes.ok || scanData?.ok === false) {
      throw new Error(scanData?.error || `Scan failed (HTTP ${scanRes.status})`);
    }

    const detectedFaces = scanData?.detected_faces;
    const matchedCount = scanData?.matched_count;
    setScanStats({ detectedFaces, matchedCount });
    const studentIds: string[] = scanData?.student_ids ?? [];
    const confidenceMap: Record<string, number> = {};
    const matches: Array<{ student_id: string; similarity: number }> = scanData?.matches ?? [];
    matches.forEach((m) => {
      if (m?.student_id && typeof m.similarity === "number") {
        confidenceMap[m.student_id] = m.similarity;
      }
    });
    setLastMatched(studentIds);
    if (studentIds.length === 0) {
      if (typeof detectedFaces === "number" && detectedFaces === 0) {
        setStatus("No faces detected. Improve lighting and keep faces visible.");
      } else if (typeof detectedFaces === "number") {
        setStatus(`Faces detected: ${detectedFaces}, but no enrolled students matched.`);
      } else {
        setStatus("No enrolled student faces matched in this frame/photo.");
      }
      return;
    }

    const markRes: any = await apiRequest(endpoints.attendance.mark, {
      method: "POST",
      body: {
        lecturer_id: lecturerId,
        course_id: courseId,
        method,
        student_ids: studentIds,
        confidences: confidenceMap,
      },
    });

    const newlyMarked: string[] = (markRes?.marked ?? [])
      .map((m: any) => m.student_id)
      .filter(Boolean);

    setMarkedIds((prev) => {
      const next = new Set(prev);
      newlyMarked.forEach((id) => next.add(id));
      return next;
    });

    const skippedInfo = summarizeSkips(markRes?.skipped ?? []);
    setStatus(
      `Marked ${markRes?.marked_count ?? 0} student(s). Total marked: ${
        totalMarked + newlyMarked.length
      }.${skippedInfo}`
    );
  }

  async function startLive() {
    setBusy(true);
    setStatus("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });

      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) throw new Error("Video element not ready");

      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;

      await new Promise<void>((resolve) => {
        video.onloadedmetadata = () => resolve();
      });

      await video.play();

      setLiveOn(true);

      intervalRef.current = window.setInterval(async () => {
        try {
          const v = videoRef.current;
          const canvas = canvasRef.current;
          if (!v || !canvas) return;

          canvas.width = v.videoWidth || 640;
          canvas.height = v.videoHeight || 480;

          const ctx = canvas.getContext("2d");
          if (!ctx) return;

          ctx.drawImage(v, 0, 0, canvas.width, canvas.height);

          const blob: Blob | null = await new Promise((resolve) =>
            canvas.toBlob((b) => resolve(b), "image/jpeg", 0.85)
          );

          if (!blob) return;

          await scanAndMark(blob, "live_video");
        } catch (e: any) {
          setStatus(e?.message || "Live scan error");
        }
      }, 2000);
    } catch (e: any) {
      setStatus(e?.message || "Could not access camera (permission or insecure origin)");
      stopLive();
    } finally {
      setBusy(false);
    }
  }

  async function onUpload(file: File) {
    setBusy(true);
    setStatus("");
    try {
      await scanAndMark(file, "image_upload");
    } catch (e: any) {
      setStatus(e?.message || "Upload scan failed");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[999] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-white border shadow-lg overflow-hidden">
        <div className="p-5 border-b flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Take Attendance</h2>
            <p className="text-sm text-muted-foreground">
              {courseLabel ? courseLabel : "Course"} - Live scan or upload class photo.
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              stopLive();
              onClose();
            }}
          >
            Close
          </Button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-muted-foreground">Threshold</label>
              <input
                className="mt-1 w-full rounded-lg border px-3 py-2"
                type="number"
                step="0.01"
                min="0.5"
                max="0.99"
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Blur Threshold</label>
              <input
                className="mt-1 w-full rounded-lg border px-3 py-2"
                type="number"
                step="1"
                min="0"
                value={blurThreshold}
                onChange={(e) => setBlurThreshold(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            {!liveOn ? (
              <Button onClick={startLive} disabled={busy}>
                {busy ? "Starting..." : "Live Scan (Tracker)"}
              </Button>
            ) : (
              <Button variant="secondary" onClick={stopLive}>
                Stop Live Scan
              </Button>
            )}

            <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer hover:bg-gray-50">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onUpload(f);
                }}
              />
              Upload Class Photo
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border bg-gray-50 p-4">
              <p className="text-sm font-semibold">Enrollment</p>
              <p className="text-sm text-muted-foreground mt-1">
                {loadingStudents ? "Loading students..." : `${totalMarked} marked / ${totalEnrolled} enrolled`}
              </p>
            </div>
            <div className="rounded-xl border bg-gray-50 p-4">
              <p className="text-sm font-semibold">Last Matched</p>
              {lastMatched.length === 0 ? (
                <p className="text-sm text-muted-foreground mt-1">No matches yet.</p>
              ) : (
                <p className="text-sm text-muted-foreground mt-1">
                  {lastMatched.length} student(s) matched in last scan.
                </p>
              )}
              {scanStats && (
                <p className="text-xs text-muted-foreground mt-1">
                  Faces detected: {scanStats.detectedFaces ?? "-"} · Matched: {scanStats.matchedCount ?? "-"}
                </p>
              )}
            </div>
          </div>

          <div className={`space-y-2 ${liveOn ? "block" : "hidden"}`}>
            <video
              ref={videoRef}
              className="w-full rounded-xl border bg-black"
              autoPlay
              playsInline
              muted
            />
            <canvas ref={canvasRef} className="hidden" />
            <p className="text-xs text-muted-foreground">
              Captures a frame every 2 seconds and marks matched enrolled students.
            </p>
          </div>

          {status && (
            <div className="rounded-xl border bg-gray-50 p-3 text-sm">
              {status}
            </div>
          )}

          <div className="rounded-xl border bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Marked Students</p>
              <p className="text-xs text-muted-foreground">{totalMarked} total</p>
            </div>
            {totalMarked === 0 ? (
              <p className="text-sm text-muted-foreground mt-2">No students marked yet.</p>
            ) : (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {[...markedIds].map((id) => {
                  const s = studentsById.get(id);
                  return (
                    <div key={id} className="rounded-lg border bg-gray-50 px-3 py-2 text-sm">
                      <p className="font-medium">{s?.full_name ?? id}</p>
                      <p className="text-xs text-muted-foreground">{s?.identifier ?? "Unknown ID"}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
