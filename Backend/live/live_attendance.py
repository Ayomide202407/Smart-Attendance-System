import os
import time
import cv2
import requests

from live.camera import Camera
from live.face_detector import FaceDetector
from live.face_quality import is_blurry
from live.tracker import CentroidTracker
from live.recognizer import FaceRecognizer
from utils.face_engine import embedding_from_detection
from config import Config


BACKEND_URL = "http://127.0.0.1:5000"


def run_live_attendance(
    lecturer_id: str,
    course_id: str,
    threshold: float = 0.45,
    confirm_frames: int = 2,
    cooldown_seconds: int = 30,
    recognize_every_n_frames: int = 3,
    capture_zone: bool = False,
):
    """
    Batch 12 improvements:
    - CentroidTracker for stable track IDs
    - recognize_every_n_frames: reduces CPU load in crowded scenes
    - optional capture_zone: only mark if face is inside center box
    """

    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    emb_root = os.path.join(base_dir, "embeddings", "students")

    cam = Camera()
    detector = FaceDetector()
    tracker = CentroidTracker(max_missing=10, max_distance=90.0)
    recognizer = FaceRecognizer(emb_root=emb_root, threshold=threshold)

    last_marked = {}  # student_id -> timestamp
    track_votes = {}  # track_id -> (candidate_student_id, count)
    track_identity = {}  # track_id -> last best student_id (for display)
    track_sim = {}  # track_id -> last sim

    last_reload = time.time()
    frame_i = 0

    try:
        while True:
            frame = cam.read()
            if frame is None:
                break
            frame_i += 1

            detections = detector.detect(frame)
            boxes = [d["box"] for d in detections]
            tracked = tracker.update(boxes)
            det_by_box = {tuple(d["box"]): d for d in detections}

            # Reload embeddings periodically
            if time.time() - last_reload > 10:
                recognizer.reload()
                last_reload = time.time()

            H, W = frame.shape[:2]

            # Optional capture zone (center box)
            if capture_zone:
                zx1, zy1 = int(W * 0.25), int(H * 0.20)
                zx2, zy2 = int(W * 0.75), int(H * 0.8)
                cv2.rectangle(frame, (zx1, zy1), (zx2, zy2), (255, 255, 255), 1)
            else:
                zx1 = zy1 = zx2 = zy2 = None

            now = time.time()

            for item in tracked:
                tid = item["track_id"]
                x, y, w, h = item["box"]
                det = det_by_box.get(tuple(item["box"]))
                if det and det.get("raw") is not None:
                    if det.get("score", 1.0) < Config.OPENCV_DET_THRESH:
                        continue

                # Capture zone filtering
                if capture_zone:
                    cx, cy = x + w / 2.0, y + h / 2.0
                    if not (zx1 <= cx <= zx2 and zy1 <= cy <= zy2):
                        continue

                face = frame[y:y+h, x:x+w]
                if face.size == 0:
                    continue
                if is_blurry(face):
                    continue

                # Reduce compute: only run recognition every N frames per track
                do_recognize = (frame_i % recognize_every_n_frames == 0)

                student_id = None
                sim = -1.0

                if do_recognize and det is not None:
                    if det.get("raw") is not None:
                        emb = embedding_from_detection(frame, det["raw"])
                        if emb is not None:
                            student_id, sim = recognizer.recognize_embedding(emb)
                    else:
                        student_id, sim = recognizer.recognize(face)
                    if student_id:
                        track_identity[tid] = student_id
                        track_sim[tid] = sim
                    else:
                        # keep last identity for display, but sim updates
                        track_sim[tid] = sim

                # Show label (use last known identity)
                show_id = track_identity.get(tid)
                show_sim = track_sim.get(tid, -1.0)

                label = f"T{tid} UNKNOWN ({show_sim:.2f})"
                if show_id:
                    label = f"T{tid} {show_id[:8]}... ({show_sim:.2f})"

                # Marking logic only when we got a fresh recognized id
                if do_recognize and student_id:
                    last = last_marked.get(student_id, 0)
                    if now - last >= cooldown_seconds:
                        prev_sid, cnt = track_votes.get(tid, ("", 0))
                        if prev_sid == student_id:
                            cnt += 1
                        else:
                            prev_sid = student_id
                            cnt = 1
                        track_votes[tid] = (prev_sid, cnt)

                        if cnt >= confirm_frames:
                            payload = {
                                "lecturer_id": lecturer_id,
                                "course_id": course_id,
                                "method": "live_video",
                                "confidence": float(sim),
                                "student_ids": [student_id],
                            }
                            try:
                                r = requests.post(f"{BACKEND_URL}/attendance/mark", json=payload, timeout=3)
                                last_marked[student_id] = now
                                print(f"MARKED: {student_id} sim={sim:.2f} status={r.status_code}")
                            except Exception as e:
                                print("POST failed:", e)

                            track_votes[tid] = ("", 0)

                # draw
                cv2.rectangle(frame, (x, y), (x+w, y+h), (0, 255, 0), 2)
                cv2.putText(frame, label, (x, y - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)

            cv2.imshow("Live Attendance (press q to quit)", frame)
            if cv2.waitKey(1) & 0xFF == ord("q"):
                break

    finally:
        cam.release()
        cv2.destroyAllWindows()
