# AI Attendance System - Technical Documentation and Calculations

This document explains how the project works end to end, with detailed calculations, thresholds, and data flow. It is intended for a literature review and technical evaluation.

## 1) System Overview

The system performs attendance using face recognition. It has two main modes:
1. Live scan (video frames captured every few seconds).
2. Image upload (single class photo).

High-level flow:
1. Lecturer starts a session.
2. Student faces are captured (live or upload).
3. Faces are detected and aligned.
4. Face embeddings are computed.
5. Embeddings are matched against the gallery.
6. Matched student IDs are marked present for the active session.

## 2) Data Model Summary

Tables (simplified):
1. users: id, name, role, identifier, department
2. courses: id, course_code, course_title, lecturer_id, enrollment window
3. course_departments: course_id, department
4. enrollments: student_id, course_id
5. sessions: course_id, lecturer_id, status, start_time, end_time
6. attendance: session_id, student_id, timestamp, method, confidence
7. attendance_audit: session_id, student_id, lecturer_id, action, reason, timestamp
8. face_embeddings: student_id, view_type, embedding_path

## 3) Face Detection and Cropping

The system uses OpenCV YuNet (if available) or Haar cascade as fallback.
A face bounding box is produced as (x1, y1, x2, y2). The system pads and crops:

x1' = max(0, x1 - pad)
y1' = max(0, y1 - pad)
x2' = min(W, x2 + pad)
y2' = min(H, y2 + pad)

The cropped face is then used for embedding computation.

## 4) Blur Filtering (Image Quality)

To avoid poor quality frames, the system computes blur using Laplacian variance:

blur_score = Var( Laplacian( grayscale(face) ) )

Rule:
- If blur_score < blur_threshold, the face is skipped.
- Current default blur_threshold for scanning is 80.

Interpretation:
- A lower blur_threshold allows blurrier images.
- A higher blur_threshold requires sharper images.

## 5) Embedding Extraction

If OpenCV SFace is available:
- FaceRecognizerSF generates an embedding vector of dimension D (typically 128 or 512).
- Embeddings are L2 normalized.

Fallback:
- The system uses a simple grayscale embedding (64x64 flattened and normalized).

Let v be the raw embedding vector. L2 normalization is:

v_norm = v / ( ||v||2 + 1e-8 )

## 6) Gallery Construction and Vectorized Matching

Each student has multiple embeddings per view (front, left, right). The gallery matrix G is built as:

G = [ v1^T
      v2^T
      ...
      vN^T ]

where each row is a normalized embedding. The system stores metadata for each row:
(meta[i] = (student_id, view_type)).

For a query embedding q (normalized), cosine similarities are:

sims = G @ q

The best match is:

idx = argmax(sims)
(best_id, best_view, best_sim) = meta[idx], sims[idx]

Decision rule:
- If best_sim >= threshold, accept match.
- Else, no match.

Current default threshold:
- threshold = 0.80

## 7) Threshold Effects (Detailed)

Let threshold = T.
- If T is too high, false negatives increase (students missed).
- If T is too low, false positives increase (wrong student matched).

Typical comparison:
- T = 0.85: strict, fewer false positives, more misses.
- T = 0.80: balanced, better recall, slightly higher risk.
- T = 0.75: aggressive, many matches, risk of wrong matches.

To tune:
1. Collect a validation set.
2. Measure FAR and FRR at multiple thresholds.
3. Choose T based on acceptable error tradeoff.

## 8) Attendance Marking Logic

Attendance is marked only for:
- Active session
- Enrolled student
- Lecturer owns the course

For each matched student_id:
1. Check enrollment.
2. Insert attendance row.
3. If record already exists, skip (UniqueConstraint).

Method values:
- image_upload
- live_video
- manual (lecturer override)

## 9) Liveness Checks (Heuristic)

To reduce spoofing (printed photos, screen replays), the system applies lightweight checks:
- Face size ratio (face area vs image area)
- Eye distance ratio (inter‑ocular distance vs face width)
- Blur score normalization

A liveness score is computed and must exceed a minimum threshold. If landmarks are unavailable (fallback detector), liveness can be required or skipped based on configuration.

Default liveness settings:
- LIVENESS_ENABLED = true
- LIVENESS_REQUIRED = false
- LIVENESS_MIN_SCORE = 0.67
- LIVENESS_MIN_FACE_RATIO = 0.03
- LIVENESS_MIN_EYE_DIST_RATIO = 0.25

Challenge-based liveness:
- The system also supports a multi-frame head‑turn challenge.
- A nose-position shift across frames must satisfy the requested challenge (turn_left, turn_right, or left_right).
- Config: LIVENESS_CHALLENGE_SHIFT = 0.08 (default)

Cooldown logic:
- The system also enforces a cooldown window (default 5 minutes).
- If a student was marked within the cooldown window, new marks are skipped.

## 10) Enrollment Visibility Logic

A course is visible to a student if:
1. Student department is in allowed_departments.
2. Enrollment is open (boolean).
3. Optional enrollment window checks:

Let now = current time
Course is effectively open if:
- is_open_for_enrollment = True
- if enrollment_open_at exists, now >= enrollment_open_at
- if enrollment_close_at exists, now <= enrollment_close_at

## 11) Attendance Rate Calculation

For a course:

attendance_rate = (total_marked / (enrolled_students * total_sessions)) * 100

If enrolled_students or total_sessions is 0, rate is 0.

For a single session:

session_rate = (marked_count / enrolled_students) * 100

Example:
- enrolled_students = 30
- total_sessions = 4
- total_marked = 90
attendance_rate = (90 / (30*4)) * 100 = 75%

## 12) Benchmark Timing

Benchmark endpoint reports:
- decode: time to read and decode image
- detect_embed: detection + embedding extraction
- match: similarity matching
- total: end-to-end time

This helps compare live vs upload, and impact of thresholds.

## 13) Performance Considerations

Main cost is face detection + embedding. Matching is fast due to vectorization.
If N is total embeddings and D is embedding dimension:
- Matching complexity = O(N * D)
- With matrix multiply, this is highly optimized.

Reducing N can speed up:
- Limit number of samples per student
- Remove obsolete embeddings

Gallery caching:
- Embeddings are cached and only reloaded when `.npy` files change.
- This avoids reloading the entire gallery on every request.

## 14) Practical Quality Tips

1. Capture 3 views (front, left, right).
2. Use good lighting and high-resolution images.
3. Avoid heavy occlusion (caps, masks).
4. Enforce minimum face size to reduce noise.

## 15) What the Frontend Shows

Lecturer portal:
- Create course (code, title, enrollment window, allowed departments)
- Manage course (open/close, students, reports)
- Live and upload attendance
- Marked students list in real-time
- Manual override: mark/unmark a student with a reason (audit logged)

Student portal:
- Register with department
- Enroll in eligible courses
- Complete face setup before enrollment

Disputes:
- Students can submit attendance disputes (missing or incorrect).
- Lecturers can review and approve/reject disputes.
- Approved disputes trigger a manual mark/unmark and are audit logged.

## 16) Suggested Experimental Comparison

1. Threshold sweep:
   - Test T = 0.75, 0.80, 0.85

## 17) Analytics and Reports

The system exposes analytics per course:
- Overall attendance rate across sessions
- Method breakdown (image_upload vs live_video vs manual)
- Average confidence (if available)
- Dispute counts by status
   - Compare FAR and FRR

2. Blur threshold sweep:
   - 60, 80, 100

3. Live vs upload:
   - Compare latency and match rate

4. Lighting variation:
   - Good, medium, poor lighting

## 16) Limitations

1. Thresholds are global and may not adapt per student.
2. Class photos with extreme angles reduce match rate.
3. Model accuracy is limited by training data quality.

## 17) Suggested Future Upgrades

1. Adaptive thresholds per student based on confidence history.
2. Faster embedding models (MobileFaceNet) for real-time use.
3. Quality checks (pose, occlusion) before embedding.

## 18) References (downloaded in /papers)

- YuNet: A Tiny Millisecond-level Face Detector (OpenCV)
- MobileFaceNets (fast face recognition)
- ArcFace (angular margin loss for embedding quality)
- FaceNet (triplet loss embeddings)
- MTCNN (multi-task face detection and alignment)
- RetinaFace (strong face detection)
- IJERT attendance papers (applied face recognition systems)

---

## 19) Literature Review (Summaries + Gap Analysis)

### 19.1 Face Detection
**YuNet (OpenCV)**
- Contribution: A lightweight, millisecond‑level detector suitable for embedded and real‑time use.
- Strength: Low latency and easy deployment in OpenCV.
- Limitation: Detection accuracy can degrade under extreme poses or occlusion.

**MTCNN**
- Contribution: Joint detection + landmark localization via multi‑stage CNN.
- Strength: Robust face detection and alignment in many lighting conditions.
- Limitation: Heavier than ultra‑light detectors; slower at scale.

**RetinaFace**
- Contribution: High‑accuracy detector using dense anchors and multi‑task learning.
- Strength: Very strong accuracy and robustness for detection.
- Limitation: Heavier computational cost; higher latency for live use.

**Gap Observed**
- Accuracy vs speed tradeoff remains the key design choice for real‑time attendance.
- A practical system can favor YuNet for speed and use better embeddings for recognition.

### 19.2 Face Embeddings / Recognition
**FaceNet**
- Contribution: Triplet loss to learn discriminative embeddings.
- Strength: Strong identity separation in embedding space.
- Limitation: Training is expensive; triplet mining is complex.

**ArcFace**
- Contribution: Angular margin loss improves inter‑class separability.
- Strength: State‑of‑the‑art recognition accuracy; widely adopted.
- Limitation: Needs strong backbone; may be slower on edge devices.

**MobileFaceNets**
- Contribution: Lightweight network for fast face verification.
- Strength: Very fast on CPU and mobile; good accuracy for constrained systems.
- Limitation: Slightly lower accuracy than heavier backbones on hard cases.

**Gap Observed**
- For attendance, the key is a balance: slightly lower accuracy may be acceptable if it reduces false negatives and improves speed.
- Multi‑sample embeddings per student (already implemented) help recover accuracy while keeping a light model.

### 19.3 Attendance Systems (Applied)
**IJERT Attendance Papers**
- Contribution: Applied face recognition for attendance with workflow and evaluation.
- Strength: Practical guidance and real‑world constraints.
- Limitation: Often lack rigorous evaluation metrics and reproducibility.

**Gap Observed**
- Many applied systems do not report FAR/FRR or benchmark latency across conditions.
- This project improves on that by adding a benchmark endpoint and explicit evaluation plan.

### 19.4 Literature Review Summary
- **Detection**: YuNet is the best speed choice; RetinaFace is accuracy‑heavy.
- **Recognition**: ArcFace is accuracy‑heavy; MobileFaceNets is speed‑optimized.
- **Applied systems**: emphasize workflow but rarely quantify performance tradeoffs.

---

## 20) System Diagrams

### 20.1 Pipeline Diagram (Text)
```
Lecturer starts session
        |
        v
Capture frame/photo (live or upload)
        |
        v
Face Detection -> Face Crop -> Blur Filter
        |
        v
Embedding Extraction (SFace/MobileFaceNet)
        |
        v
Similarity Matching (cosine, threshold)
        |
        v
Matched IDs -> Enrollment Check -> Attendance Marked
```

### 20.2 Data Flow Diagram (Text)
```
Users -> Courses -> CourseDepartments
  |         |
  v         v
Enrollments Session
    |          |
    v          v
Attendance   FaceEmbeddings
```

### 20.3 Components Diagram (Text)
```
Frontend (React)
 - Student Register / Face Setup
 - Lecturer Dashboard / Classes / Sessions
 - Attendance Modal (live + upload)

Backend (Flask)
 - Auth, Courses, Enrollments, Sessions, Attendance
 - Face detection + embedding + matching
 - Reporting and exports

Storage
 - SQLite DB
 - Embeddings (.npy) + face images
```

---

## 21) Evaluation Plan + Metrics Tables

### 21.1 Key Metrics
1. **TAR (True Accept Rate)** = TP / (TP + FN)
2. **FAR (False Accept Rate)** = FP / (FP + TN)
3. **FRR (False Reject Rate)** = FN / (FN + TP)
4. **Latency** per frame/photo = decode + detect + embed + match
5. **End‑to‑end Attendance Accuracy** = correctly marked / total enrolled

### 21.2 Evaluation Dataset
- Students: 20–50
- Images per student: 3–5 (front/left/right + lighting variation)
- Class photos: 5–10
- Live frames: 50–100

### 21.3 Experimental Matrix

| Experiment | Threshold | Blur Threshold | Mode | Expected Outcome |
|-----------|-----------|----------------|------|------------------|
| A1 | 0.75 | 60 | Upload | High recall, possible false positives |
| A2 | 0.80 | 80 | Upload | Balanced precision/recall |
| A3 | 0.85 | 100 | Upload | High precision, more misses |
| B1 | 0.75 | 60 | Live | Faster but riskier matches |
| B2 | 0.80 | 80 | Live | Balanced live performance |
| B3 | 0.85 | 100 | Live | Strict, may miss more students |

### 21.4 Results Template (Fill in)

| Mode | Threshold | Blur | TAR | FAR | FRR | Avg Latency (ms) |
|------|-----------|------|-----|-----|-----|------------------|
| Upload | 0.80 | 80 |  |  |  |  |
| Live | 0.80 | 80 |  |  |  |  |
| Upload | 0.75 | 60 |  |  |  |  |
| Live | 0.85 | 100 |  |  |  |  |

### 21.5 Interpretation Guide
- If FAR is high, increase threshold or blur threshold.
- If FRR is high, decrease threshold or improve lighting/capture quality.
- If latency is too high, reduce input size, limit embeddings per student, or move to lighter model.

---

## 22) Literature Review Gap Mapping (Project Contribution)

| Observed Gap | Typical Papers | This Project Response |
|-------------|----------------|------------------------|
| Poor latency reporting | Applied attendance papers | Added benchmark endpoint with timing |
| Lack of threshold tradeoff analysis | Many applied systems | Threshold sweep plan and evaluation matrix |
| Limited image quality checks | Some recognition papers | Blur threshold + capture guidance |
| Weak reproducibility | Many applied systems | Documented pipeline + metrics + scripts |
