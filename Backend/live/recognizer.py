from typing import Optional, Tuple

import numpy as np

from utils.recognition import load_gallery_cached, best_match_vectorized
from utils.face_engine import extract_best_embedding


class FaceRecognizer:
    """
    Fast vectorized matcher:
    - loads embeddings (.npy) which can be (K,D)
    - builds one big gallery matrix G (N,D)
    - cosine similarity via matrix multiply
    """

    def __init__(self, emb_root: str, threshold: float = 0.4):
        self.emb_root = emb_root
        self.threshold = float(threshold)
        self.G = None
        self.meta = []
        self.reload()

    def reload(self):
        self.G, self.meta = load_gallery_cached(self.emb_root)

    def recognize_embedding(self, embedding: np.ndarray) -> Tuple[Optional[str], float]:
        if self.G is None or len(self.meta) == 0:
            return None, -1.0

        q = embedding.astype(np.float32)
        q = q / (np.linalg.norm(q) + 1e-8)
        sid, view, sim = best_match_vectorized(q, self.G, self.meta)

        if sim >= self.threshold:
            return sid, sim
        return None, sim

    def recognize(self, face_bgr) -> Tuple[Optional[str], float]:
        best = extract_best_embedding(face_bgr)
        if not best:
            return None, -1.0
        emb, bbox, det_score = best
        return self.recognize_embedding(emb)
