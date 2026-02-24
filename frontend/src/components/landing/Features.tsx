import { Camera, Users, BarChart3, Share2, Shield, Zap } from "lucide-react";

const features = [
  {
    icon: Camera,
    title: "Camera-Based Sessions",
    description: "Activate AI-powered camera sessions for real-time visual analysis during lectures and presentations.",
    gradient: "gradient-primary",
  },
  {
    icon: Users,
    title: "Class Management",
    description: "Easily manage student rosters, approve access, and organize classes by department or course.",
    gradient: "gradient-secondary",
  },
  {
    icon: BarChart3,
    title: "AI Insights Dashboard",
    description: "View comprehensive analytics and AI-generated insights from your vision model processing.",
    gradient: "gradient-accent",
  },
  {
    icon: Share2,
    title: "Component Sharing",
    description: "Extract and share AI-generated components with students for enhanced collaborative learning.",
    gradient: "gradient-secondary",
  },
  {
    icon: Shield,
    title: "Secure Access Control",
    description: "Role-based authentication ensures only approved students can access your course materials.",
    gradient: "gradient-primary",
  },
  {
    icon: Zap,
    title: "Real-time Processing",
    description: "Experience instant AI responses with our optimized edge computing infrastructure.",
    gradient: "gradient-accent",
  },
];

const Features = () => {
  return (
    <section id="features" className="py-24 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16 animate-slide-up">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/10 border border-secondary/20 mb-4">
            <Zap className="w-4 h-4 text-secondary" />
            <span className="text-sm font-medium text-secondary">Platform Features</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Everything You Need for{" "}
            <span className="text-gradient-secondary">AI-Powered Education</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Our comprehensive platform combines cutting-edge computer vision with intuitive tools for both lecturers and students.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className="group bg-card rounded-2xl p-8 shadow-soft hover:shadow-large transition-all duration-300 border border-border/50 hover:border-secondary/30 hover:-translate-y-1 animate-fade-in"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className={`w-14 h-14 rounded-2xl ${feature.gradient} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-soft`}>
                <feature.icon className="w-7 h-7 text-primary-foreground" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">
                {feature.title}
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        <div id="about" className="mt-20 rounded-3xl glass-card p-8 md:p-10 shadow-medium">
          <h3 className="text-2xl md:text-3xl font-bold mb-3">Built for Real Academic Workflows</h3>
          <p className="text-muted-foreground max-w-3xl">
            The platform is designed around how universities actually operate: student onboarding, lecturer-led session
            control, secure attendance events, and role-aware dashboards that reduce admin overhead.
          </p>
        </div>
      </div>
    </section>
  );
};

export default Features;
