import { AppLink } from '@/components/ui/app-link';
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Users,
  LayoutDashboard,
  ShieldCheck,
  Cpu,
  School,
  UserCog,
  User,
  GraduationCap,
  BarChart3,
  BookOpen,
  ScanLine,
  Sparkles,
  FileSpreadsheet,
  Search,
  Database,
  Globe,
  LineChart,
  ChevronRight,
  Award,
  Building2,
  CalendarDays,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const heroImage = PlaceHolderImages.find((p) => p.id === 'hero-background');

const features = [
  {
    icon: <UserCog className="h-10 w-10 text-primary" />,
    title: 'Super Admin',
    description: 'System-wide control to manage users, regions, schools, and curriculum.',
  },
  {
    icon: <School className="h-10 w-10 text-primary" />,
    title: 'School Head',
    description: 'Manage students, classes, results, and staff at the school level.',
  },
  {
    icon: <User className="h-10 w-10 text-primary" />,
    title: 'Teacher',
    description: 'Focus on classroom tasks, mark entry, and AI-powered lesson planning.',
  },
  {
    icon: <GraduationCap className="h-10 w-10 text-primary" />,
    title: 'Student',
    description: 'Access personal academic information, notes, quizzes, and results.',
  },
];

const pillars = [
  {
    icon: <LayoutDashboard className="h-8 w-8 mb-4 text-primary" />,
    title: 'Modern Frontend',
    description:
      'Built with Next.js, React, and Tailwind CSS for a responsive, fast user experience.',
  },
  {
    icon: <ShieldCheck className="h-8 w-8 mb-4 text-primary" />,
    title: 'Secure Backend',
    description:
      'Powered by Firebase, with Firestore for data and robust Role-Based Access Control.',
  },
  {
    icon: <Cpu className="h-8 w-8 mb-4 text-primary" />,
    title: 'Generative AI',
    description:
      'Integrated with Genkit and the Gemini API for smart features that reduce teacher workload.',
  },
];

const superAdminFeatures = [
  { icon: <Building2 className="h-5 w-5" />, text: 'Organizational Hierarchy (Regions & Sub-Regions)' },
  { icon: <School className="h-5 w-5" />, text: 'School Management & User Lifecycle' },
  { icon: <BookOpen className="h-5 w-5" />, text: 'Curriculum Foundation & Syllabus Builder' },
  { icon: <Database className="h-5 w-5" />, text: 'Billing & Usage Monitoring' },
];

const teacherFeatures = [
  { icon: <ScanLine className="h-5 w-5" />, text: 'AI Mark Sheet Scanner (Batch grading)' },
  { icon: <Sparkles className="h-5 w-5" />, text: 'AI-Powered Lesson Notes & Quiz Generation' },
  { icon: <FileSpreadsheet className="h-5 w-5" />, text: 'High-speed mark entry with auto-save' },
  { icon: <Award className="h-5 w-5" />, text: 'AI Remarks & Progress Reports' },
];

const stats = [
  { value: '5+', label: 'User Roles', icon: Users },
  { value: '100%', label: 'Data Centralization', icon: Database },
  { value: '24/7', label: 'Real-time Access', icon: Globe },
  { value: 'GenAI', label: 'Teacher Empowerment', icon: Sparkles },
];

function Hero() {
  return (
    <section className="relative w-full min-h-[90vh] pt-24 flex items-center justify-center text-center text-white overflow-hidden">
      {heroImage && (
        <Image
          src={heroImage.imageUrl}
          alt={heroImage.description}
          fill
          className="object-cover"
          priority
          data-ai-hint={heroImage.imageHint}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/85 via-primary/75 to-primary/90" />
      <div className="relative z-10 container px-4 md:px-6 py-12 md:py-16">
        <div className="max-w-4xl mx-auto space-y-6 animate-fade-in-up">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 text-sm font-medium border border-white/20 mx-auto w-fit">
            <Sparkles className="h-4 w-4 text-gold" />
            <span>AI-Powered Education Management</span>
          </div>
          <h1 className="font-bold text-5xl md:text-7xl lg:text-8xl tracking-tighter">
            Digitizing Schools,{' '}
            <span className="text-gradient-gold">Empowering Educators</span>
          </h1>
          <p className="text-xl md:text-2xl text-primary-foreground/85 max-w-3xl mx-auto leading-relaxed">
            ThutoApp is a modern, centralized platform designed to streamline
            school administration, reduce paperwork, and provide real-time
            insights for every role in the educational hierarchy.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <AppLink
              href="/login"
              className={cn(buttonVariants({ size: 'lg', variant: 'cta' }), 'group')}
            >
              Login to Your Portal
              <ChevronRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </AppLink>
            <AppLink
              href="#features"
              className={cn(buttonVariants({ size: 'lg', variant: 'outline' }), 'bg-transparent border-white/20 text-white hover:bg-white/10')}
            >
              Explore Features
            </AppLink>
          </div>
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
}

function StatsSection() {
  return (
    <section className="py-16 bg-secondary/30 border-y border-border">
      <div className="container px-4 md:px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <div
              key={stat.label}
              className="text-center space-y-2 animate-fade-in-up"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary mx-auto">
                <stat.icon className="h-6 w-6" />
              </div>
              <div className="text-3xl md:text-4xl font-bold text-foreground">{stat.value}</div>
              <div className="text-sm text-muted-foreground uppercase tracking-wide">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section id="features" className="py-24 md:py-32">
      <div className="container px-4 md:px-6">
        <div className="text-center space-y-4 mb-16">
          <div className="inline-flex items-center gap-2 bg-accent/10 rounded-full px-4 py-1.5 text-sm font-medium text-accent-foreground mx-auto">
            <Users className="h-4 w-4" />
            <span>Role-Based Access</span>
          </div>
          <h2 className="font-bold text-4xl md:text-5xl tracking-tighter">
            A Tailored Experience for{' '}
            <span className="text-gradient-primary">Everyone</span>
          </h2>
          <p className="max-w-2xl mx-auto text-lg text-muted-foreground">
            From system-wide oversight to classroom-level operations, Thuto
            provides the right tools for the right people.
          </p>
        </div>
        <div className="mx-auto max-w-6xl grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, index) => (
            <Card
              key={feature.title}
              className="text-center border-border/50 hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 animate-fade-in-up"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <CardHeader>
                <div className="mx-auto bg-gradient-to-br from-primary/10 to-primary/5 p-4 rounded-2xl w-fit">
                  {feature.icon}
                </div>
                <CardTitle className="mt-4 text-xl">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function DetailedFeatures() {
  return (
    <section className="py-24 bg-secondary/30">
      <div className="container px-4 md:px-6">
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          <div className="space-y-8 animate-fade-in-up">
            <div>
              <div className="inline-flex items-center gap-2 bg-primary/10 rounded-full px-4 py-1.5 text-sm font-medium text-primary mb-4">
                <UserCog className="h-4 w-4" />
                <span>System Administration</span>
              </div>
              <h3 className="text-2xl md:text-3xl font-bold mb-4">
                Super Admin Capabilities
              </h3>
              <p className="text-muted-foreground mb-6">
                Complete control over the educational hierarchy with powerful tools for managing regions, schools, users, and curriculum.
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                {superAdminFeatures.map((feature, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <div className="flex-shrink-0 text-primary">{feature.icon}</div>
                    <span className="text-foreground/80">{feature.text}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="pt-4 border-t border-border">
              <div className="inline-flex items-center gap-2 bg-gold/10 rounded-full px-4 py-1.5 text-sm font-medium text-gold mb-4">
                <ScanLine className="h-4 w-4" />
                <span>Classroom Innovation</span>
              </div>
              <h3 className="text-2xl md:text-3xl font-bold mb-4">
                Teacher AI Tools
              </h3>
              <p className="text-muted-foreground mb-6">
                Leverage cutting-edge AI to reduce administrative workload and focus on what matters most—teaching.
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                {teacherFeatures.map((feature, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <div className="flex-shrink-0 text-gold">{feature.icon}</div>
                    <span className="text-foreground/80">{feature.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-8 bg-gradient-to-br from-card to-secondary/20 rounded-2xl p-6 md:p-8 border border-border/50 animate-fade-in-up delay-150">
            <div>
              <div className="inline-flex items-center gap-2 bg-success/10 rounded-full px-4 py-1.5 text-sm font-medium text-success mb-4">
                <BarChart3 className="h-4 w-4" />
                <span>Advanced Analytics</span>
              </div>
              <h3 className="text-2xl md:text-3xl font-bold mb-4">
                Precision in Performance Metrics
              </h3>
              <div className="space-y-4 text-muted-foreground">
                <p>
                  Thuto ensures accurate performance tracking with intelligent handling of student attendance and historical data.
                </p>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <div className="h-5 w-5 rounded-full bg-success/20 flex items-center justify-center mt-0.5">
                      <div className="h-2 w-2 rounded-full bg-success" />
                    </div>
                    <span><strong className="text-foreground">Sitting Roll Logic:</strong> Absent students are excluded from pass rates for true classroom performance.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="h-5 w-5 rounded-full bg-success/20 flex items-center justify-center mt-0.5">
                      <div className="h-2 w-2 rounded-full bg-success" />
                    </div>
                    <span><strong className="text-foreground">Immutable Snapshots:</strong> Result snapshots ensure historical consistency.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="h-5 w-5 rounded-full bg-success/20 flex items-center justify-center mt-0.5">
                      <div className="h-2 w-2 rounded-full bg-success" />
                    </div>
                    <span><strong className="text-foreground">Cohort Tracing:</strong> Track student cohorts across promotions.</span>
                  </li>
                </ul>
              </div>
            </div>
            <div className="bg-card rounded-xl p-5 border border-border/50">
              <div className="flex items-center gap-2 mb-3">
                <Award className="h-5 w-5 text-gold" />
                <h4 className="font-semibold">Uniform Grading Scale (Botswana-aligned)</h4>
              </div>
              <div className="grid grid-cols-5 gap-2 text-center text-sm">
                <div className="bg-success/10 rounded-lg p-2">
                  <div className="font-bold text-success">A</div>
                  <div className="text-xs">80%+</div>
                </div>
                <div className="bg-primary/10 rounded-lg p-2">
                  <div className="font-bold text-primary">B</div>
                  <div className="text-xs">65-79%</div>
                </div>
                <div className="bg-gold/10 rounded-lg p-2">
                  <div className="font-bold text-gold">C</div>
                  <div className="text-xs">50-64%</div>
                </div>
                <div className="bg-warning/10 rounded-lg p-2">
                  <div className="font-bold text-warning">D</div>
                  <div className="text-xs">30-49%</div>
                </div>
                <div className="bg-destructive/10 rounded-lg p-2">
                  <div className="font-bold text-destructive">E</div>
                  <div className="text-xs">{'<30%'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function TechPillars() {
  return (
    <section className="py-24 md:py-32">
      <div className="container px-4 md:px-6">
        <div className="text-center space-y-4 mb-16">
          <div className="inline-flex items-center gap-2 bg-secondary rounded-full px-4 py-1.5 text-sm font-medium mx-auto">
            <Cpu className="h-4 w-4" />
            <span>Technical Architecture</span>
          </div>
          <h2 className="font-bold text-4xl md:text-5xl tracking-tighter">
            Built on a{' '}
            <span className="text-gradient-primary">Modern Foundation</span>
          </h2>
          <p className="max-w-2xl mx-auto text-lg text-muted-foreground">
            Thuto leverages a powerful and secure technical architecture to
            deliver a reliable and scalable experience.
          </p>
        </div>
        <div className="grid gap-8 md:grid-cols-3 max-w-5xl mx-auto">
          {pillars.map((pillar, index) => (
            <div
              key={pillar.title}
              className="text-center p-6 rounded-2xl bg-card border border-border/50 hover:border-primary/30 transition-all duration-300 hover:shadow-lg animate-fade-in-up"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-primary/10 to-primary/5 mb-4">
                {pillar.icon}
              </div>
              <h3 className="text-xl font-bold mb-2">{pillar.title}</h3>
              <p className="text-muted-foreground">{pillar.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function GlobalSearchSection() {
  return (
    <section className="py-20 bg-gradient-to-r from-primary/5 to-secondary/10 border-y border-border">
      <div className="container px-4 md:px-6 text-center">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 bg-background rounded-full px-4 py-2 shadow-sm border border-border mx-auto">
            <Search className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Global Entity Search</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tighter">
            Find Anything, Instantly
          </h2>
          <p className="text-lg text-muted-foreground">
            A fast, role-aware search bar allows users to find students, staff members, or schools instantly, providing quick-action links based on their permissions.
          </p>
          <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground bg-card rounded-full px-6 py-3 w-fit mx-auto border border-border">
            <span className="flex items-center gap-1"><Users className="h-3 w-3" /> Students</span>
            <span className="w-1 h-1 rounded-full bg-border" />
            <span className="flex items-center gap-1"><User className="h-3 w-3" /> Staff</span>
            <span className="w-1 h-1 rounded-full bg-border" />
            <span className="flex items-center gap-1"><School className="h-3 w-3" /> Schools</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function CtaSection() {
  return (
    <section className="py-24">
      <div className="container px-4 md:px-6">
        <div className="relative rounded-3xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-primary to-primary/80" />
          <div className="absolute inset-0 noise-overlay" />
          <div className="relative z-10 py-16 px-6 md:py-20 md:px-12 text-center text-white">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
              Ready to Transform Your School?
            </h2>
            <p className="text-lg md:text-xl text-primary-foreground/85 max-w-2xl mx-auto mb-8">
              Join the digital revolution in education management. Streamline operations, empower teachers, and unlock insights.
            </p>
            <AppLink
              href="/login"
              className={cn(
                buttonVariants({ size: 'lg', variant: 'default' }),
                'bg-white text-primary hover:bg-white/90 shadow-lg hover:shadow-xl transition-all'
              )}
            >
              Get Started Today
              <ChevronRight className="ml-2 h-4 w-4" />
            </AppLink>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function LandingPage() {
  return (
    <div className="bg-background">
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto flex h-20 items-center justify-between px-4 md:px-6">
          <AppLink href="/" className="flex items-center gap-2">
            <Image src="/logo.svg" alt="Thuto Logo" width={64} height={64} className="h-16 w-auto" />
            <span className="font-bold text-xl hidden sm:inline-block bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Thuto
            </span>
          </AppLink>
          <div className="flex items-center gap-3">
            <AppLink
              href="/login"
              className={cn(buttonVariants({ variant: 'outline' }), 'hidden sm:inline-flex')}
            >
              Login
            </AppLink>
            <AppLink
              href="/login"
              className={cn(buttonVariants({ variant: 'default' }), 'shadow-sm')}
            >
              Portal
            </AppLink>
          </div>
        </div>
      </header>
      <main>
        <Hero />
        <StatsSection />
        <Features />
        <DetailedFeatures />
        <TechPillars />
        <GlobalSearchSection />
        <CtaSection />
      </main>
      <footer className="py-12 bg-muted/50 border-t border-border">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-center md:text-left">
            <div className="flex items-center gap-2">
              <Image src="/logo.svg" alt="Thuto Logo" width={40} height={40} className="h-10 w-auto" />
              <span className="font-semibold">Thuto School Management System</span>
            </div>
            <div className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} Thuto. All Rights Reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}