import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Brain, ArrowRight, BookOpen, Sparkles, GraduationCap, User, UserPlus } from "lucide-react";
import heroBg from "@/assets/hero-bg.jpg";
import student1 from "@/assets/students/student-1.jpg";
import student2 from "@/assets/students/student-2.jpg";
import student3 from "@/assets/students/student-3.jpg";
import student4 from "@/assets/students/student-4.jpg";
import student5 from "@/assets/students/student-5.jpg";
import student6 from "@/assets/students/student-6.jpg";

const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center pt-20 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <img 
          src={heroBg} 
          alt="AI Education Background" 
          className="w-full h-full object-cover opacity-20"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background/95 to-background/80" />
      </div>

      {/* Decorative Elements */}
      <div className="absolute top-1/4 right-1/4 w-72 h-72 bg-secondary/20 rounded-full blur-3xl animate-pulse-soft" />
      <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-pulse-soft" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div className="animate-slide-up">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/10 border border-secondary/20 mb-6">
              <Brain className="w-4 h-4 text-secondary" />
              <span className="text-sm font-medium text-secondary">AI-Powered Learning Platform</span>
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight mb-6">
              Transform Education with{" "}
              <span className="text-gradient-secondary">Computer Vision</span>{" "}
              & AI
            </h1>
            
            <p className="text-lg text-muted-foreground mb-8 max-w-xl">
              Empower your university with intelligent camera-based learning sessions, 
              real-time visual analysis, and AI-generated insights for lecturers and students.
            </p>

            {/* Portal Access Sections - For New Users (Registration) */}
            <div className="grid sm:grid-cols-2 gap-4 mb-8">
              {/* Student Portal */}
              <div className="p-6 rounded-2xl bg-card border border-border/50 shadow-soft hover:shadow-medium transition-shadow">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg gradient-secondary flex items-center justify-center">
                    <User className="w-5 h-5 text-secondary-foreground" />
                  </div>
                  <h3 className="font-semibold text-foreground">Student Portal</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  New students can register here to access AI-powered learning materials.
                </p>
                <Link to="/register/student">
                  <Button variant="heroOutline" size="default" className="w-full">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Register as Student
                  </Button>
                </Link>
              </div>

              {/* Lecturer Portal */}
              <div className="p-6 rounded-2xl bg-card border border-border/50 shadow-soft hover:shadow-medium transition-shadow">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center">
                    <GraduationCap className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <h3 className="font-semibold text-foreground">Lecturer Portal</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Lecturers can register to unlock AI-powered teaching tools and insights.
                </p>
                <Link to="/register/lecturer">
                  <Button variant="hero" size="default" className="w-full">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Register as Lecturer
                  </Button>
                </Link>
              </div>
            </div>

            {/* Stats */}
            <div className="flex gap-8 pt-8 border-t border-border/50">
              <div>
                <p className="text-3xl font-bold text-foreground">50+</p>
                <p className="text-sm text-muted-foreground">Universities</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-foreground">10K+</p>
                <p className="text-sm text-muted-foreground">Active Students</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-foreground">98%</p>
                <p className="text-sm text-muted-foreground">Satisfaction</p>
              </div>
            </div>
          </div>

          {/* Right Content - Student Photo Grid */}
          <div className="relative hidden lg:block animate-fade-in">
            <div className="relative w-full h-[600px]">
              {/* Connecting Lines SVG */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" viewBox="0 0 500 600">
                <path d="M250 150 Q 300 200 320 250" stroke="hsl(var(--border))" strokeWidth="2" fill="none" strokeDasharray="5,5" />
                <path d="M320 250 Q 350 300 380 320" stroke="hsl(var(--border))" strokeWidth="2" fill="none" strokeDasharray="5,5" />
                <path d="M180 280 Q 220 320 250 380" stroke="hsl(var(--border))" strokeWidth="2" fill="none" strokeDasharray="5,5" />
                <path d="M250 380 Q 280 420 350 450" stroke="hsl(var(--border))" strokeWidth="2" fill="none" strokeDasharray="5,5" />
              </svg>

              {/* Student Cards - Row 1 */}
              <div className="absolute top-0 left-16 w-36 h-36 rounded-3xl overflow-hidden bg-secondary/20 shadow-medium animate-float" style={{ animationDelay: '0s' }}>
                <img src={student1} alt="Student" className="w-full h-full object-cover" />
              </div>
              <div className="absolute top-8 right-12 w-40 h-40 rounded-3xl overflow-hidden bg-accent/20 shadow-medium animate-float" style={{ animationDelay: '0.5s' }}>
                <img src={student2} alt="Student" className="w-full h-full object-cover" />
              </div>

              {/* Floating Badge - Top */}
              <div className="absolute top-4 right-4 px-3 py-1.5 rounded-full bg-card border border-border shadow-soft flex items-center gap-2 animate-float" style={{ animationDelay: '1s' }}>
                <Sparkles className="w-4 h-4 text-accent" />
                <span className="text-xs font-medium text-foreground">AI Learning</span>
              </div>

              {/* Student Cards - Row 2 */}
              <div className="absolute top-44 left-0 w-32 h-32 rounded-3xl overflow-hidden bg-primary/20 shadow-medium animate-float" style={{ animationDelay: '0.3s' }}>
                <img src={student3} alt="Student" className="w-full h-full object-cover" />
              </div>
              <div className="absolute top-48 left-40 w-44 h-44 rounded-3xl overflow-hidden bg-secondary/30 shadow-large animate-float" style={{ animationDelay: '0.8s' }}>
                <img src={student4} alt="Student" className="w-full h-full object-cover" />
              </div>
              <div className="absolute top-40 right-0 w-36 h-36 rounded-3xl overflow-hidden bg-muted shadow-medium animate-float" style={{ animationDelay: '0.6s' }}>
                <img src={student5} alt="Student" className="w-full h-full object-cover" />
              </div>

              {/* Floating Badge - Middle */}
              <div className="absolute top-64 left-32 px-3 py-1.5 rounded-full gradient-secondary shadow-glow flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-secondary-foreground" />
                <span className="text-xs font-semibold text-secondary-foreground">Live Class</span>
              </div>

              {/* Student Cards - Row 3 */}
              <div className="absolute bottom-16 left-20 w-40 h-40 rounded-3xl overflow-hidden bg-accent/20 shadow-large animate-float" style={{ animationDelay: '0.4s' }}>
                <img src={student6} alt="Student" className="w-full h-full object-cover" />
              </div>

              {/* Floating Badge - Bottom */}
              <div className="absolute bottom-28 right-20 px-3 py-1.5 rounded-full bg-card border border-border shadow-soft flex items-center gap-2 animate-float" style={{ animationDelay: '1.2s' }}>
                <GraduationCap className="w-4 h-4 text-secondary" />
                <span className="text-xs font-medium text-foreground">Graduate</span>
              </div>

              {/* Decorative Icon Badges */}
              <div className="absolute top-24 left-56 w-10 h-10 rounded-full gradient-primary shadow-medium flex items-center justify-center">
                <Brain className="w-5 h-5 text-primary-foreground" />
              </div>
              <div className="absolute bottom-40 right-8 w-10 h-10 rounded-full gradient-accent shadow-medium flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-accent-foreground" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
