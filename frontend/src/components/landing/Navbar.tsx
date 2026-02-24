import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, Brain } from "lucide-react";

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? "bg-card/90 backdrop-blur-xl border-b border-border/50 shadow-soft" : "bg-transparent"
      }`}
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16 lg:h-20">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-10 h-10 rounded-xl gradient-secondary flex items-center justify-center shadow-soft group-hover:shadow-glow transition-shadow">
              <Brain className="w-5 h-5 text-secondary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">
              Edu<span className="text-secondary">Vision</span>
            </span>
          </Link>

          <div className="hidden lg:flex items-center gap-8">
            <a href="#home" className="text-muted-foreground hover:text-foreground transition-colors font-medium">
              Home
            </a>
            <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors font-medium">
              Features
            </a>
            <a href="#about" className="text-muted-foreground hover:text-foreground transition-colors font-medium">
              About
            </a>
            <a href="#contact" className="text-muted-foreground hover:text-foreground transition-colors font-medium">
              Contact
            </a>
          </div>

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

          <button
            className="lg:hidden p-2 text-foreground"
            onClick={() => setIsOpen(!isOpen)}
            aria-label={isOpen ? "Close menu" : "Open menu"}
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {isOpen && (
          <div className="lg:hidden py-4 border-t border-border/70 bg-card/95 backdrop-blur-xl rounded-b-2xl animate-fade-in">
            <div className="flex flex-col gap-4">
              <a href="#home" className="text-foreground font-medium py-2" onClick={() => setIsOpen(false)}>
                Home
              </a>
              <a href="#features" className="text-muted-foreground font-medium py-2" onClick={() => setIsOpen(false)}>
                Features
              </a>
              <a href="#about" className="text-muted-foreground font-medium py-2" onClick={() => setIsOpen(false)}>
                About
              </a>
              <a href="#contact" className="text-muted-foreground font-medium py-2" onClick={() => setIsOpen(false)}>
                Contact
              </a>
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
