import math
from typing import List, Tuple, Dict


def _centroid(box: Tuple[int, int, int, int]):
    x, y, w, h = box
    return (x + w / 2.0, y + h / 2.0)


def _distance(c1, c2):
    return math.sqrt((c1[0] - c2[0]) ** 2 + (c1[1] - c2[1]) ** 2)


class CentroidTracker:
    """
    Simple but effective tracker:
    - assigns track IDs based on nearest centroid
    - keeps tracks alive for `max_missing` frames
    """

    def __init__(self, max_missing: int = 10, max_distance: float = 80.0):
        self.next_id = 1
        self.max_missing = int(max_missing)
        self.max_distance = float(max_distance)

        # track_id -> state
        self.tracks: Dict[int, Dict] = {}

    def update(self, detections: List[Tuple[int, int, int, int]]):
        """
        detections: list of (x,y,w,h)
        returns list of {"track_id": id, "box": (x,y,w,h)}
        """
        # No detections: increment missing counters
        if not detections:
            to_delete = []
            for tid, st in self.tracks.items():
                st["missing"] += 1
                if st["missing"] > self.max_missing:
                    to_delete.append(tid)
            for tid in to_delete:
                del self.tracks[tid]
            return [{"track_id": tid, "box": st["box"]} for tid, st in self.tracks.items()]

        det_centroids = [_centroid(b) for b in detections]

        # If no existing tracks: create tracks for all detections
        if not self.tracks:
            for box in detections:
                self.tracks[self.next_id] = {"box": box, "centroid": _centroid(box), "missing": 0}
                self.next_id += 1
            return [{"track_id": tid, "box": st["box"]} for tid, st in self.tracks.items()]

        # Match detections to existing tracks by nearest centroid
        track_ids = list(self.tracks.keys())
        track_centroids = [self.tracks[tid]["centroid"] for tid in track_ids]

        # Greedy matching
        used_dets = set()
        used_tracks = set()

        # compute all pair distances
        pairs = []
        for ti, tc in enumerate(track_centroids):
            for di, dc in enumerate(det_centroids):
                pairs.append((ti, di, _distance(tc, dc)))
        pairs.sort(key=lambda p: p[2])

        for ti, di, dist in pairs:
            if ti in used_tracks or di in used_dets:
                continue
            if dist > self.max_distance:
                continue

            tid = track_ids[ti]
            box = detections[di]
            self.tracks[tid]["box"] = box
            self.tracks[tid]["centroid"] = det_centroids[di]
            self.tracks[tid]["missing"] = 0

            used_tracks.add(ti)
            used_dets.add(di)

        # tracks not matched: increment missing
        for ti, tid in enumerate(track_ids):
            if ti not in used_tracks:
                self.tracks[tid]["missing"] += 1

        # delete old tracks
        to_delete = [tid for tid, st in self.tracks.items() if st["missing"] > self.max_missing]
        for tid in to_delete:
            del self.tracks[tid]

        # detections not matched: create new tracks
        for di, box in enumerate(detections):
            if di not in used_dets:
                self.tracks[self.next_id] = {"box": box, "centroid": _centroid(box), "missing": 0}
                self.next_id += 1

        return [{"track_id": tid, "box": st["box"]} for tid, st in self.tracks.items()]
