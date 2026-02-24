import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Brain, GraduationCap, Sparkles, User, UserPlus } from "lucide-react";
import heroBg from "@/assets/hero-bg.jpg";

const Hero = () => {
  return (
    <section id="home" className="relative min-h-screen flex items-center pt-24 overflow-hidden">
      <div className="absolute inset-0 z-0">
        <img src={heroBg} alt="Smart classroom" className="w-full h-full object-cover opacity-15" />
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background/95 to-background/85" />
      </div>

      <div className="absolute -top-20 -right-20 w-96 h-96 bg-secondary/15 blur-3xl rounded-full" />
      <div className="absolute -bottom-24 -left-10 w-[28rem] h-[28rem] bg-accent/10 blur-3xl rounded-full" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="animate-slide-up">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/10 border border-secondary/20 mb-6">
              <Brain className="w-4 h-4 text-secondary" />
              <span className="text-sm font-medium text-secondary">AI Attendance + Learning Intelligence</span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6">
              Build a Smarter
              <span className="block text-gradient-secondary">University Experience</span>
            </h1>

            <p className="text-lg text-muted-foreground max-w-xl mb-8">
              EduVision combines secure facial setup, smart attendance, and lecturer analytics in one modern platform
              designed for real classrooms.
            </p>

            <div className="mb-10">
              <p className="text-sm text-muted-foreground">
                Choose a portal on the right to register.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-5 max-w-lg">
              <div className="rounded-xl bg-card/80 border border-border/50 p-4 shadow-soft">
                <p className="text-2xl font-bold">99.2%</p>
                <p className="text-xs text-muted-foreground">Face Match Accuracy</p>
              </div>
              <div className="rounded-xl bg-card/80 border border-border/50 p-4 shadow-soft">
                <p className="text-2xl font-bold">150+</p>
                <p className="text-xs text-muted-foreground">Active Classes</p>
              </div>
              <div className="rounded-xl bg-card/80 border border-border/50 p-4 shadow-soft">
                <p className="text-2xl font-bold">24/7</p>
                <p className="text-xs text-muted-foreground">Cloud Availability</p>
              </div>
            </div>
          </div>

          <div className="relative animate-fade-in">
            <div className="glass-card rounded-3xl p-6 md:p-8 shadow-large">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold">Portal Access</h3>
                <span className="text-xs px-3 py-1 rounded-full bg-secondary/15 text-secondary border border-secondary/30">
                  Live
                </span>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-border/60 bg-card p-5">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl gradient-secondary flex items-center justify-center">
                      <User className="w-5 h-5 text-secondary-foreground" />
                    </div>
                    <p className="font-semibold">Student Portal</p>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">Register, complete face setup, and join enrolled sessions.</p>
                  <Link to="/register/student">
                    <Button variant="heroOutline" className="w-full">
                      <UserPlus className="w-4 h-4 mr-2" />
                      Student Registration
                    </Button>
                  </Link>
                </div>

                <div className="rounded-2xl border border-border/60 bg-card p-5">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
                      <GraduationCap className="w-5 h-5 text-primary-foreground" />
                    </div>
                    <p className="font-semibold">Lecturer Portal</p>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">Create classes, launch attendance, and review AI insights.</p>
                  <Link to="/register/lecturer">
                    <Button variant="hero" className="w-full">
                      <Sparkles className="w-4 h-4 mr-2" />
                      Lecturer Registration
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
