import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Camera, CheckCircle, AlertCircle, RefreshCw, Sun, User, Focus } from "lucide-react";

interface PhotoCaptureProps {
  onPhotoCapture: (photoData: string) => void;
  capturedPhoto: string | null;
}

interface CaptureConditions {
  lighting: "poor" | "acceptable" | "good";
  faceDetected: boolean;
  facePosition: "centered" | "off-center" | "not-detected";
  clarity: "blurry" | "acceptable" | "clear";
}

const PhotoCapture = ({ onPhotoCapture, capturedPhoto }: PhotoCaptureProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [conditions, setConditions] = useState<CaptureConditions>({
    lighting: "poor",
    faceDetected: false,
    facePosition: "not-detected",
    clarity: "blurry",
  });
  const [canCapture, setCanCapture] = useState(false);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsStreaming(true);
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach((track) => track.stop());
      setIsStreaming(false);
    }
  }, []);

  // Simulate AI detection of capture conditions
  useEffect(() => {
    if (!isStreaming) return;

    const interval = setInterval(() => {
      // Simulate varying conditions - in production, this would use actual AI/CV
      const randomLighting = Math.random();
      const randomFace = Math.random();
      const randomClarity = Math.random();

      const newConditions: CaptureConditions = {
        lighting: randomLighting > 0.6 ? "good" : randomLighting > 0.3 ? "acceptable" : "poor",
        faceDetected: randomFace > 0.3,
        facePosition: randomFace > 0.6 ? "centered" : randomFace > 0.3 ? "off-center" : "not-detected",
        clarity: randomClarity > 0.5 ? "clear" : randomClarity > 0.2 ? "acceptable" : "blurry",
      };

      setConditions(newConditions);
      setCanCapture(
        newConditions.lighting !== "poor" &&
          newConditions.faceDetected &&
          newConditions.facePosition === "centered" &&
          newConditions.clarity !== "blurry"
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [isStreaming]);

  const capturePhoto = useCallback(() => {
    if (!canCapture || !videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext("2d");

    if (ctx) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);
      const photoData = canvas.toDataURL("image/jpeg", 0.8);
      onPhotoCapture(photoData);
      stopCamera();
    }
  }, [canCapture, onPhotoCapture, stopCamera]);

  const retakePhoto = useCallback(() => {
    onPhotoCapture("");
    startCamera();
  }, [onPhotoCapture, startCamera]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "good":
      case "clear":
      case "centered":
        return "text-green-500";
      case "acceptable":
      case "off-center":
        return "text-amber-500";
      default:
        return "text-destructive";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "good":
      case "clear":
      case "centered":
        return <CheckCircle className="w-4 h-4" />;
      case "acceptable":
      case "off-center":
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Camera className="w-5 h-5 text-secondary" />
        <h3 className="font-semibold text-foreground">Photo Capture</h3>
        <span className="text-xs text-muted-foreground">(AI-Assisted)</span>
      </div>

      <div className="relative rounded-xl overflow-hidden bg-muted border border-border">
        {capturedPhoto ? (
          <div className="relative">
            <img src={capturedPhoto} alt="Captured" className="w-full h-64 object-cover" />
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
              <Button variant="outline" size="sm" onClick={retakePhoto}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Retake Photo
              </Button>
            </div>
          </div>
        ) : isStreaming ? (
          <div className="relative">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-64 object-cover"
            />
            {/* Overlay Guide */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div
                className={`w-40 h-48 border-4 rounded-full ${
                  canCapture ? "border-green-500" : "border-amber-500"
                } transition-colors`}
              />
            </div>
            {/* Capture Button */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
              <Button
                variant={canCapture ? "hero" : "outline"}
                size="lg"
                onClick={capturePhoto}
                disabled={!canCapture}
              >
                <Camera className="w-5 h-5 mr-2" />
                {canCapture ? "Capture Photo" : "Adjust Position"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="h-64 flex flex-col items-center justify-center gap-4">
            <div className="w-16 h-16 rounded-full bg-secondary/20 flex items-center justify-center">
              <Camera className="w-8 h-8 text-secondary" />
            </div>
            <p className="text-sm text-muted-foreground">Click to start camera</p>
            <Button variant="hero" onClick={startCamera}>
              <Camera className="w-4 h-4 mr-2" />
              Start Camera
            </Button>
          </div>
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* AI Detection Status Indicators */}
      {isStreaming && !capturedPhoto && (
        <div className="grid grid-cols-3 gap-3">
          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
            <Sun className={`w-4 h-4 ${getStatusColor(conditions.lighting)}`} />
            <div>
              <p className="text-xs text-muted-foreground">Lighting</p>
              <p className={`text-xs font-medium capitalize ${getStatusColor(conditions.lighting)}`}>
                {conditions.lighting}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
            <User className={`w-4 h-4 ${getStatusColor(conditions.facePosition)}`} />
            <div>
              <p className="text-xs text-muted-foreground">Face</p>
              <p className={`text-xs font-medium capitalize ${getStatusColor(conditions.facePosition)}`}>
                {conditions.facePosition.replace("-", " ")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
            <Focus className={`w-4 h-4 ${getStatusColor(conditions.clarity)}`} />
            <div>
              <p className="text-xs text-muted-foreground">Clarity</p>
              <p className={`text-xs font-medium capitalize ${getStatusColor(conditions.clarity)}`}>
                {conditions.clarity}
              </p>
            </div>
          </div>
        </div>
      )}

      {isStreaming && !capturedPhoto && (
        <p className="text-xs text-muted-foreground text-center">
          {canCapture
            ? "✓ Conditions optimal - Ready to capture!"
            : "Please adjust for better lighting, center your face, and hold steady"}
        </p>
      )}
    </div>
  );
};

export default PhotoCapture;
