import cv2

from utils.face_engine import get_engine


class FaceDetector:
    def __init__(self):
        self.engine = get_engine()
        if self.engine is None:
            self.detector = cv2.CascadeClassifier(
                cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
            )
        else:
            self.detector = self.engine["detector"]

    def detect(self, frame):
        """
        Returns list of dicts:
        - box: (x, y, w, h)
        - score: float
        - raw: YuNet detection row or None (for Haar)
        """
        if self.engine is None:
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            faces = self.detector.detectMultiScale(
                gray,
                scaleFactor=1.2,
                minNeighbors=5,
                minSize=(60, 60)
            )
            out = []
            if faces is None:
                return out
            for (x, y, w, h) in faces:
                out.append({"box": (int(x), int(y), int(w), int(h)), "score": 1.0, "raw": None})
            return out

        h, w = frame.shape[:2]
        self.detector.setInputSize((w, h))
        _, faces = self.detector.detect(frame)
        out = []
        if faces is None:
            return out
        for f in faces:
            x, y, fw, fh = f[:4]
            score = float(f[4]) if len(f) > 4 else 1.0
            out.append({
                "box": (int(x), int(y), int(fw), int(fh)),
                "score": score,
                "raw": f,
            })
        return out
