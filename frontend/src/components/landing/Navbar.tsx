import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, Brain } from "lucide-react";

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-xl border-b border-border/50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16 lg:h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-10 h-10 rounded-xl gradient-secondary flex items-center justify-center shadow-soft group-hover:shadow-glow transition-shadow">
              <Brain className="w-5 h-5 text-secondary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">
              Edu<span className="text-secondary">Vision</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-8">
            <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors font-medium">
              Home
            </Link>
            <Link to="#features" className="text-muted-foreground hover:text-foreground transition-colors font-medium">
              Features
            </Link>
            <Link to="#about" className="text-muted-foreground hover:text-foreground transition-colors font-medium">
              About
            </Link>
            <Link to="#contact" className="text-muted-foreground hover:text-foreground transition-colors font-medium">
              Contact
            </Link>
          </div>

          {/* Login Buttons - Top Right (for existing users) */}
          <div className="hidden lg:flex items-center gap-3">
            <Link to="/login/student">
              <Button variant="ghost" size="lg">
                Student Login
              </Button>
            </Link>
            <Link to="/login/lecturer">
              <Button variant="hero" size="lg">
                Lecturer Login
              </Button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="lg:hidden p-2 text-foreground"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isOpen && (
          <div className="lg:hidden py-4 border-t border-border animate-fade-in">
            <div className="flex flex-col gap-4">
              <Link to="/" className="text-foreground font-medium py-2" onClick={() => setIsOpen(false)}>
                Home
              </Link>
              <Link to="#features" className="text-muted-foreground font-medium py-2" onClick={() => setIsOpen(false)}>
                Features
              </Link>
              <Link to="#about" className="text-muted-foreground font-medium py-2" onClick={() => setIsOpen(false)}>
                About
              </Link>
              <Link to="#contact" className="text-muted-foreground font-medium py-2" onClick={() => setIsOpen(false)}>
                Contact
              </Link>
              <div className="flex flex-col gap-2 pt-4 border-t border-border">
                <Link to="/login/student" onClick={() => setIsOpen(false)}>
                  <Button variant="outline" className="w-full">
                    Student Login
                  </Button>
                </Link>
                <Link to="/login/lecturer" onClick={() => setIsOpen(false)}>
                  <Button variant="hero" className="w-full">
                    Lecturer Login
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
