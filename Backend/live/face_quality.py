import cv2


def is_blurry(face_img, threshold=100.0):
    gray = cv2.cvtColor(face_img, cv2.COLOR_BGR2GRAY)
    variance = cv2.Laplacian(gray, cv2.CV_64F).var()
    return variance < threshold
