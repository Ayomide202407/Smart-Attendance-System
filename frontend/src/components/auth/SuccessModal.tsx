import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";

interface SuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  redirectPath: string;
  redirectLabel: string;
}

const SuccessModal = ({
  isOpen,
  onClose,
  title,
  message,
  redirectPath,
  redirectLabel,
}: SuccessModalProps) => {
  const handleRedirect = () => {
    onClose();
    window.location.href = redirectPath;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
        <div className="mx-auto w-16 h-16 rounded-full bg-secondary/10 flex items-center justify-center mb-4">
            <CheckCircle className="w-8 h-8 text-secondary" />
          </div>
          <DialogTitle className="text-xl font-bold text-center">{title}</DialogTitle>
          <DialogDescription className="text-center text-muted-foreground">
            {message}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-center mt-4">
          <Button variant="hero" onClick={handleRedirect}>
            {redirectLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SuccessModal;
