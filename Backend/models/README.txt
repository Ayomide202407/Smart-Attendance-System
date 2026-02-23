Place the OpenCV YuNet and SFace ONNX models in this folder.

Expected filenames (default):
  - face_detection_yunet_2023mar.onnx
  - face_recognition_sface_2021dec.onnx

You can change paths via environment variables:
  OPENCV_DET_MODEL
  OPENCV_REC_MODEL
  OPENCV_DET_SIZE
  OPENCV_DET_THRESH

If these files are missing, the backend falls back to the basic Haar + grayscale embedding.
