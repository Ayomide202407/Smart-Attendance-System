import os
from typing import List, Tuple, Optional

import numpy as np

_GALLERY_CACHE = {}


def _latest_embedding_mtime(emb_root: str) -> float:
    latest = 0.0
    if not os.path.exists(emb_root):
        return latest
    for root, _, files in os.walk(emb_root):
        for fname in files:
            if not fname.endswith(".npy"):
                continue
            path = os.path.join(root, fname)
            try:
                mtime = os.path.getmtime(path)
                if mtime > latest:
                    latest = mtime
            except Exception:
                continue
    return latest


def load_all_embeddings(emb_root: str) -> List[Tuple[str, str, np.ndarray]]:
    """
    Returns list of (student_id, view_type, embedding_matrix)
    embedding_matrix is (K, D) for each view.
    """
    items: List[Tuple[str, str, np.ndarray]] = []

    if not os.path.exists(emb_root):
        return items

    for student_id in os.listdir(emb_root):
        student_dir = os.path.join(emb_root, student_id)
        if not os.path.isdir(student_dir):
            continue

        for fname in os.listdir(student_dir):
            if not fname.endswith(".npy"):
                continue

            view_type = os.path.splitext(fname)[0]
            path = os.path.join(student_dir, fname)

            try:
                mat = np.load(path)
                if mat is None or mat.size == 0:
                    continue
                if mat.ndim == 1:
                    mat = mat.reshape(1, -1)   # (1, D)
                items.append((student_id, view_type, mat.astype(np.float32)))
            except Exception:
                continue

    return items


def build_gallery(db_items: List[Tuple[str, str, np.ndarray]]):
    """
    Build a big matrix gallery for fast vectorized matching.

    Output:
    - G: (N, D) float32, L2-normalized rows
    - meta: list of (student_id, view_type) length N
    """
    meta = []
    rows = []

    for sid, view, mat in db_items:
        # mat: (K, D)
        for k in range(mat.shape[0]):
            v = mat[k].astype(np.float32)
            # L2 normalize
            v = v / (np.linalg.norm(v) + 1e-8)
            rows.append(v)
            meta.append((sid, view))

    if not rows:
        return None, []

    G = np.vstack(rows).astype(np.float32)  # (N, D)
    return G, meta


def load_gallery_cached(emb_root: str) -> Tuple[Optional[np.ndarray], list]:
    """
    Cache gallery based on latest embedding file mtime.
    """
    latest = _latest_embedding_mtime(emb_root)
    cached = _GALLERY_CACHE.get(emb_root)
    if cached and cached["mtime"] == latest:
        return cached["G"], cached["meta"]

    items = load_all_embeddings(emb_root)
    G, meta = build_gallery(items)
    _GALLERY_CACHE[emb_root] = {"mtime": latest, "G": G, "meta": meta}
    return G, meta


def best_match_vectorized(query_vec: np.ndarray, G: np.ndarray, meta):
    """
    query_vec: (D,) L2 normalized
    G: (N, D) L2 normalized
    returns: (student_id, view_type, similarity)
    """
    if G is None or G.size == 0:
        return "", "", -1.0

    q = query_vec.astype(np.float32)
    q = q / (np.linalg.norm(q) + 1e-8)

    # cosine sim for all at once: (N,)
    sims = G @ q
    idx = int(np.argmax(sims))
    best_sim = float(sims[idx])
    sid, view = meta[idx]
    return sid, view, best_sim


def top_k_matches(query_vec: np.ndarray, G: np.ndarray, meta, k: int = 5):
    """
    Return top-k matches as list of (student_id, view_type, similarity)
    """
    if G is None or G.size == 0:
        return []

    q = query_vec.astype(np.float32)
    q = q / (np.linalg.norm(q) + 1e-8)
    sims = G @ q
    if sims.size == 0:
        return []
    k = max(1, min(int(k), sims.size))
    idxs = np.argpartition(-sims, k - 1)[:k]
    idxs = idxs[np.argsort(-sims[idxs])]
    out = []
    for idx in idxs:
        sid, view = meta[int(idx)]
        out.append((sid, view, float(sims[int(idx)])))
    return out
