import { Link } from "react-router-dom";
import { Brain, Mail, MapPin, Phone } from "lucide-react";

const Footer = () => {
  return (
    <footer className="bg-primary text-primary-foreground py-16">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Brand */}
          <div className="lg:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-xl gradient-secondary flex items-center justify-center">
                <Brain className="w-5 h-5 text-secondary-foreground" />
              </div>
              <span className="text-xl font-bold">
                Edu<span className="text-secondary">Vision</span>
              </span>
            </Link>
            <p className="text-primary-foreground/70 text-sm leading-relaxed">
              Transforming education with AI-powered computer vision and natural language processing for universities worldwide.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold mb-4">Quick Links</h4>
            <ul className="space-y-3">
              <li>
                <Link to="/" className="text-primary-foreground/70 hover:text-secondary transition-colors text-sm">
                  Home
                </Link>
              </li>
              <li>
                <Link to="#features" className="text-primary-foreground/70 hover:text-secondary transition-colors text-sm">
                  Features
                </Link>
              </li>
              <li>
                <Link to="#about" className="text-primary-foreground/70 hover:text-secondary transition-colors text-sm">
                  About Us
                </Link>
              </li>
              <li>
                <Link to="#contact" className="text-primary-foreground/70 hover:text-secondary transition-colors text-sm">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Portals */}
          <div>
            <h4 className="font-semibold mb-4">Portals</h4>
            <ul className="space-y-3">
              <li>
                <Link to="/login/lecturer" className="text-primary-foreground/70 hover:text-secondary transition-colors text-sm">
                  Lecturer Login
                </Link>
              </li>
              <li>
                <Link to="/login/student" className="text-primary-foreground/70 hover:text-secondary transition-colors text-sm">
                  Student Login
                </Link>
              </li>
              <li>
                <Link to="/register/lecturer" className="text-primary-foreground/70 hover:text-secondary transition-colors text-sm">
                  Lecturer Registration
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-semibold mb-4">Contact Us</h4>
            <ul className="space-y-3">
              <li className="flex items-center gap-2 text-primary-foreground/70 text-sm">
                <Mail className="w-4 h-4" />
                support@eduvision.edu
              </li>
              <li className="flex items-center gap-2 text-primary-foreground/70 text-sm">
                <Phone className="w-4 h-4" />
                +1 (555) 123-4567
              </li>
              <li className="flex items-start gap-2 text-primary-foreground/70 text-sm">
                <MapPin className="w-4 h-4 mt-0.5" />
                123 University Ave, Academic City
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-primary-foreground/20 mt-12 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-primary-foreground/60 text-sm">
              © 2025 EduVision. All rights reserved.
            </p>
            <div className="flex gap-6">
              <Link to="#" className="text-primary-foreground/60 hover:text-secondary transition-colors text-sm">
                Privacy Policy
              </Link>
              <Link to="#" className="text-primary-foreground/60 hover:text-secondary transition-colors text-sm">
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
