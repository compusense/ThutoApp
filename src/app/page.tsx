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
  ArrowRight,
  Star,
  CheckCircle2,
  Zap,
  TrendingUp,
  Clock,
  Smartphone,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const heroImage = PlaceHolderImages.find((p) => p.id === 'hero-background');

const features = [
  {
    icon: <UserCog className="h-8 w-8" />,
    title: 'Super Admin',
    description: 'System-wide control to manage users, regions, schools, and curriculum.',
    gradient: 'from-indigo-500/20 to-indigo-600/10',
    color: 'text-indigo-500',
  },
  {
    icon: <School className="h-8 w-8" />,
    title: 'School Head',
    description: 'Manage students, classes, results, and staff at the school level.',
    gradient: 'from-emerald-500/20 to-emerald-600/10',
    color: 'text-emerald-500',
  },
  {
    icon: <User className="h-8 w-8" />,
    title: 'Teacher',
    description: 'Focus on classroom tasks, mark entry, and AI-powered lesson planning.',
    gradient: 'from-amber-500/20 to-amber-600/10',
    color: 'text-amber-500',
  },
  {
    icon: <GraduationCap className="h-8 w-8" />,
    title: 'Student',
    description: 'Access personal academic information, notes, quizzes, and results.',
    gradient: 'from-rose-500/20 to-rose-600/10',
    color: 'text-rose-500',
  },
];

const pillars = [
  {
    icon: <LayoutDashboard className="h-7 w-7" />,
    title: 'Modern Frontend',
    description: 'Next.js 15, React, Tailwind CSS, ShadCN/UI — fast, responsive, and accessible.',
  },
  {
    icon: <ShieldCheck className="h-7 w-7" />,
    title: 'Secure Backend',
    description: 'Firebase Auth, Firestore, RBAC with Custom Claims — enterprise-grade security.',
  },
  {
    icon: <Cpu className="h-7 w-7" />,
    title: 'Generative AI',
    description: 'Gemini 2.5 Flash + Genkit — intelligent automation for educators.',
  },
];

const superAdminFeatures = [
  'Organizational Hierarchy (Regions & Sub-Regions)',
  'School Management & User Lifecycle',
  'Curriculum Foundation & Syllabus Builder',
  'Billing & Usage Monitoring',
];

const teacherFeatures = [
  'AI Mark Sheet Scanner (Batch grading with Gemini Vision)',
  'AI-Powered Lesson Notes & Quiz Generation',
  'High-speed mark entry with auto-save',
  'AI Remarks & Progress Reports',
];

const stats = [
  { value: '5+', label: 'User Roles', icon: Users, description: 'Tailored experiences' },
  { value: '100%', label: 'Data Centralization', icon: Database, description: 'Single source of truth' },
  { value: '24/7', label: 'Real-time Access', icon: Globe, description: 'Anytime, anywhere' },
  { value: 'AI', label: 'Teacher Empowerment', icon: Sparkles, description: 'GenAI integrated' },
];

function ElegantContainer({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8", className)}>
      {children}
    </div>
  );
}

function SectionHeader({ badge, title, subtitle, centered = true }: { badge?: string; title: React.ReactNode; subtitle?: string; centered?: boolean }) {
  return (
    <div className={cn("space-y-4 mb-16", centered && "text-center")}>
      {badge && (
        <div className={cn("inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium", centered && "mx-auto")}>
          <span className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-full blur-sm" />
          <span className="relative">{badge}</span>
        </div>
      )}
      <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
        {title}
      </h2>
      {subtitle && (
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          {subtitle}
        </p>
      )}
    </div>
  );
}

function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Image with Overlay */}
      {heroImage && (
        <>
          <Image
            src={heroImage.imageUrl}
            alt={heroImage.description}
            fill
            className="object-cover"
            priority
            data-ai-hint={heroImage.imageHint}
          />
          <div className="absolute inset-0 bg-gradient-to-br from-primary/90 via-primary/80 to-primary/90" />
          <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-20 mix-blend-overlay" />
        </>
      )}

      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gold/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-primary-foreground/5 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <ElegantContainer className="relative z-10 py-20">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 border border-white/20 mx-auto animate-fade-in-up">
            <Sparkles className="h-4 w-4 text-gold" />
            <span className="text-sm font-medium text-white/90">AI-Powered Education Management</span>
          </div>

          {/* Main Heading */}
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tighter text-white animate-fade-in-up delay-75">
            Digitizing Schools,
            <span className="block text-gradient-gold mt-2">Empowering Educators</span>
          </h1>

          {/* Description */}
          <p className="text-xl md:text-2xl text-white/80 max-w-2xl mx-auto leading-relaxed animate-fade-in-up delay-150">
            ThutoApp is a modern, centralized platform designed to streamline
            school administration, reduce paperwork, and provide real-time
            insights for every role in the educational hierarchy.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4 animate-fade-in-up delay-225">
            <AppLink
              href="/login"
              className={cn(
                buttonVariants({ size: 'lg' }),
                'bg-white text-primary hover:bg-white/90 shadow-xl hover:shadow-2xl transition-all duration-300 group text-base font-semibold'
              )}
            >
              Login to Your Portal
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </AppLink>
            <AppLink
              href="#features"
              className={cn(
                buttonVariants({ size: 'lg', variant: 'outline' }),
                'bg-transparent border-white/30 text-white hover:bg-white/10 hover:border-white/50 transition-all duration-300 text-base font-semibold'
              )}
            >
              Explore Features
            </AppLink>
          </div>

          {/* Scroll Indicator */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
            <div className="w-6 h-10 rounded-full border-2 border-white/30 flex justify-center">
              <div className="w-1 h-2 bg-white/50 rounded-full mt-2 animate-pulse" />
            </div>
          </div>
        </div>
      </ElegantContainer>
    </section>
  );
}

function StatsSection() {
  return (
    <section className="py-20 border-y border-border/50 bg-gradient-to-b from-background to-secondary/20">
      <ElegantContainer>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 lg:gap-12">
          {stats.map((stat, index) => (
            <div
              key={stat.label}
              className="text-center space-y-3 group animate-fade-in-up"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="relative inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 text-primary mx-auto group-hover:scale-110 transition-transform duration-300">
                <stat.icon className="h-7 w-7" />
                <div className="absolute inset-0 rounded-2xl bg-primary/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>
              <div className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                {stat.value}
              </div>
              <div className="font-semibold text-foreground">{stat.label}</div>
              <div className="text-xs text-muted-foreground">{stat.description}</div>
            </div>
          ))}
        </div>
      </ElegantContainer>
    </section>
  );
}

function Features() {
  return (
    <section id="features" className="py-28">
      <ElegantContainer>
        <SectionHeader
          badge="✨ Role-Based Access"
          title={
            <>
              A Tailored Experience for{' '}
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">Everyone</span>
            </>
          }
          subtitle="From system-wide oversight to classroom-level operations, Thuto provides the right tools for the right people."
        />

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className="group relative bg-card rounded-2xl border border-border/50 hover:border-border transition-all duration-500 animate-fade-in-up overflow-hidden"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
              <div className="relative p-6 text-center space-y-4">
                <div className={`inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br ${feature.gradient} ${feature.color} mx-auto group-hover:scale-110 transition-transform duration-300`}>
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold">{feature.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </ElegantContainer>
    </section>
  );
}

function DetailedFeatures() {
  return (
    <section className="py-28 bg-gradient-to-b from-secondary/30 to-transparent">
      <ElegantContainer>
        <SectionHeader
          badge="🔧 Core Capabilities"
          title={
            <>
              Everything You Need to{' '}
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">Succeed</span>
            </>
          }
          subtitle="Powerful tools designed for every level of the education system"
        />

        <div className="grid lg:grid-cols-2 gap-12">
          {/* Super Admin Card */}
          <div className="group relative bg-card rounded-2xl border border-border/50 overflow-hidden animate-fade-in-up">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-700" />
            <div className="p-8 space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-500">
                  <UserCog className="h-6 w-6" />
                </div>
                <h3 className="text-2xl font-bold">Super Admin</h3>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                Complete control over the educational hierarchy with powerful tools for managing regions, schools, users, and curriculum.
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                {superAdminFeatures.map((feature, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-indigo-500 flex-shrink-0" />
                    <span className="text-foreground/80">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Teacher Card */}
          <div className="group relative bg-card rounded-2xl border border-border/50 overflow-hidden animate-fade-in-up delay-150">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-700" />
            <div className="p-8 space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500">
                  <Sparkles className="h-6 w-6" />
                </div>
                <h3 className="text-2xl font-bold">Teacher AI Tools</h3>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                Leverage cutting-edge AI to reduce administrative workload and focus on what matters most—teaching.
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                {teacherFeatures.map((feature, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-amber-500 flex-shrink-0" />
                    <span className="text-foreground/80">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Grading Scale Card */}
        <div className="mt-12 p-8 bg-gradient-to-r from-primary/5 via-secondary/10 to-primary/5 rounded-2xl border border-border/50 animate-fade-in-up delay-300">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-center md:text-left">
              <div className="flex items-center gap-2 justify-center md:justify-start mb-2">
                <Award className="h-5 w-5 text-gold" />
                <h4 className="font-semibold text-lg">Botswana-Aligned Grading Scale</h4>
              </div>
              <p className="text-muted-foreground text-sm">Standardized assessment framework used across all schools</p>
            </div>
            <div className="flex gap-3">
              {[
                { grade: 'A', range: '80%+', color: 'bg-emerald-500' },
                { grade: 'B', range: '65-79%', color: 'bg-blue-500' },
                { grade: 'C', range: '50-64%', color: 'bg-amber-500' },
                { grade: 'D', range: '30-49%', color: 'bg-orange-500' },
                { grade: 'E', range: '<30%', color: 'bg-rose-500' },
              ].map((item) => (
                <div key={item.grade} className="text-center">
                  <div className={`w-12 h-12 rounded-full ${item.color} flex items-center justify-center text-white font-bold text-lg shadow-lg`}>
                    {item.grade}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{item.range}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </ElegantContainer>
    </section>
  );
}

function TechPillars() {
  return (
    <section className="py-28">
      <ElegantContainer>
        <SectionHeader
          badge="⚡ Technical Architecture"
          title={
            <>
              Built on a{' '}
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">Modern Foundation</span>
            </>
          }
          subtitle="Enterprise-grade technology stack delivering reliability, security, and scale"
        />

        <div className="grid md:grid-cols-3 gap-8">
          {pillars.map((pillar, index) => (
            <div
              key={pillar.title}
              className="group relative bg-card rounded-2xl border border-border/50 p-8 text-center hover:shadow-xl transition-all duration-500 animate-fade-in-up"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 text-primary mb-6 group-hover:scale-110 transition-transform duration-300">
                  {pillar.icon}
                </div>
                <h3 className="text-xl font-bold mb-3">{pillar.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{pillar.description}</p>
              </div>
            </div>
          ))}
        </div>
      </ElegantContainer>
    </section>
  );
}

function GlobalSearchSection() {
  return (
    <section className="py-28 bg-gradient-to-r from-primary/5 via-secondary/10 to-primary/5">
      <ElegantContainer>
        <div className="flex flex-col lg:flex-row items-center gap-12">
          <div className="flex-1 text-center lg:text-left space-y-6">
            <div className="inline-flex items-center gap-2 bg-background rounded-full px-4 py-2 border border-border mx-auto lg:mx-0">
              <Search className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Global Entity Search</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Find Anything,{' '}
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">Instantly</span>
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              A fast, role-aware search bar allows users to find students, staff members, or schools instantly, providing quick-action links based on their permissions.
            </p>
            <div className="flex flex-wrap gap-3 justify-center lg:justify-start">
              {['Students', 'Staff Members', 'Schools', 'Classes'].map((item) => (
                <div key={item} className="flex items-center gap-2 bg-card rounded-full px-4 py-2 text-sm border border-border">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex-1">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-primary/10 rounded-2xl blur-2xl" />
              <div className="relative bg-card rounded-2xl border border-border p-6 shadow-xl">
                <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-xl border border-border">
                  <Search className="h-5 w-5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search for students, teachers, or schools..."
                    className="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground"
                    readOnly
                  />
                  <kbd className="hidden sm:inline-flex px-2 py-1 text-xs bg-muted rounded border border-border">⌘K</kbd>
                </div>
                <div className="mt-4 space-y-2">
                  {['Thabo Mbeki (Student) · Grade 10A', 'Dr. Sarah Johnson (Teacher) · Mathematics', 'Gaborone Secondary School'].map((result, i) => (
                    <div key={i} className="p-3 rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer">
                      <p className="text-sm font-medium">{result.split(' · ')[0]}</p>
                      {result.includes(' · ') && (
                        <p className="text-xs text-muted-foreground">{result.split(' · ')[1]}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </ElegantContainer>
    </section>
  );
}

function PerformanceMetrics() {
  return (
    <section className="py-28">
      <ElegantContainer>
        <SectionHeader
          badge="📊 Precision Analytics"
          title={
            <>
              Intelligent{' '}
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">Performance Metrics</span>
            </>
          }
          subtitle="Accurate tracking with intelligent handling of attendance and historical data"
        />

        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              icon: <Users className="h-6 w-6" />,
              title: 'Sitting Roll Logic',
              description: 'Absent students are excluded from pass rates, ensuring metrics reflect true classroom performance.',
              color: 'from-emerald-500/20 to-emerald-600/10',
            },
            {
              icon: <Database className="h-6 w-6" />,
              title: 'Immutable Snapshots',
              description: 'Result snapshots ensure historical consistency even when students change classes.',
              color: 'from-blue-500/20 to-blue-600/10',
            },
            {
              icon: <TrendingUp className="h-6 w-6" />,
              title: 'Cohort Tracing',
              description: 'Track student cohorts across promotions to visualize long-term academic progress.',
              color: 'from-amber-500/20 to-amber-600/10',
            },
          ].map((item, index) => (
            <div
              key={item.title}
              className="group bg-card rounded-2xl border border-border/50 p-6 hover:shadow-lg transition-all duration-300 animate-fade-in-up"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${item.color} mb-4 group-hover:scale-110 transition-transform duration-300`}>
                <div className="text-foreground">{item.icon}</div>
              </div>
              <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{item.description}</p>
            </div>
          ))}
        </div>
      </ElegantContainer>
    </section>
  );
}

function CtaSection() {
  return (
    <section className="py-28">
      <ElegantContainer>
        <div className="relative rounded-3xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/90 to-primary/80" />
          <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-gold/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary-foreground/10 rounded-full blur-3xl" />

          <div className="relative z-10 py-16 px-6 md:py-20 md:px-12 text-center">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
              Ready to Transform Your School?
            </h2>
            <p className="text-lg md:text-xl text-white/80 max-w-2xl mx-auto mb-8 leading-relaxed">
              Join the digital revolution in education management. Streamline operations, empower teachers, and unlock actionable insights.
            </p>
            <AppLink
              href="/login"
              className={cn(
                buttonVariants({ size: 'lg' }),
                'bg-white text-primary hover:bg-white/90 shadow-xl hover:shadow-2xl transition-all duration-300 group text-base font-semibold'
              )}
            >
              Get Started Today
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </AppLink>
          </div>
        </div>
      </ElegantContainer>
    </section>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <ElegantContainer className="py-4">
          <div className="flex items-center justify-between">
            <AppLink href="/" className="flex items-center gap-3 group">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 rounded-full blur-md group-hover:blur-xl transition-all duration-300" />
                <Image src="/logo.svg" alt="Thuto Logo" width={48} height={48} className="h-12 w-auto relative" />
              </div>
              <span className="font-bold text-xl bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                Thuto
              </span>
            </AppLink>
            <div className="flex items-center gap-3">
              <AppLink
                href="/login"
                className={cn(buttonVariants({ variant: 'ghost' }), 'hidden sm:inline-flex text-foreground/70 hover:text-foreground')}
              >
                Login
              </AppLink>
              <AppLink
                href="/login"
                className={cn(buttonVariants({ variant: 'default' }), 'shadow-sm')}
              >
                Portal
                <ArrowRight className="ml-2 h-4 w-4" />
              </AppLink>
            </div>
          </div>
        </ElegantContainer>
      </header>

      <main>
        <Hero />
        <StatsSection />
        <Features />
        <DetailedFeatures />
        <TechPillars />
        <GlobalSearchSection />
        <PerformanceMetrics />
        <CtaSection />
      </main>

      {/* Footer */}
      <footer className="py-12 bg-secondary/30 border-t border-border">
        <ElegantContainer>
          <div className="flex flex-col md:flex-row justify-between items-center gap-6 text-center md:text-left">
            <div className="flex items-center gap-3">
              <Image src="/logo.svg" alt="Thuto Logo" width={36} height={36} className="h-9 w-auto" />
              <div>
                <p className="font-semibold">Thuto School Management System</p>
                <p className="text-xs text-muted-foreground">Digitizing Schools, Empowering Educators</p>
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} Thuto. All Rights Reserved.
            </div>
          </div>
        </ElegantContainer>
      </footer>
    </div>
  );
}