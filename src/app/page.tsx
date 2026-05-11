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


function Hero() {
  return (
    <section className="relative w-full min-h-[85vh] pt-20 flex items-center justify-center text-center text-white">
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
      <div className="absolute inset-0 bg-primary/80" />
      <div className="relative z-10 container px-4 md:px-6 py-12">
        <div className="max-w-3xl mx-auto space-y-4">
          <h1 className="font-headline text-5xl md:text-7xl font-bold tracking-tighter">
            Digitizing Schools, Empowering Educators
          </h1>
          <p className="text-xl md:text-2xl font-bold text-primary-foreground/80 max-w-2xl mx-auto">
            ThutoApp is a modern, centralized platform designed to streamline
            school administration, reduce paperwork, and provide real-time
            insights for every role in the educational hierarchy.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
            <AppLink
              href="/login"
              className={cn(buttonVariants({ size: 'lg', variant: 'cta' }))}
            >
              Login to Your Portal
            </AppLink>
          </div>
        </div>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section className="py-20 md:py-32 flex items-center justify-center">
      <div className="container px-4 md:px-6 text-center">
        <div className="space-y-4 mb-16">
          <h2 className="font-headline text-4xl font-bold tracking-tighter">
            A Tailored Experience for Everyone
          </h2>
          <p className="max-w-2xl mx-auto text-lg text-muted-foreground">
            From system-wide oversight to classroom-level operations, Thuto
            provides the right tools for the right people.
          </p>
        </div>
        <div className="mx-auto max-w-5xl grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <Card key={feature.title} className="text-center">
              <CardHeader>
                <div className="mx-auto bg-primary/10 p-4 rounded-full w-fit">
                  {feature.icon}
                </div>
                <CardTitle className="mt-4">{feature.title}</CardTitle>
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


function TechPillars() {
  return (
    <section className="py-20 md:py-32 bg-secondary/50 flex items-center justify-center">
      <div className="container px-4 md:px-6">
        <div className="text-center space-y-4 mb-16">
          <h2 className="font-headline text-4xl font-bold tracking-tighter">
            Built on a Modern Foundation
          </h2>
          <p className="max-w-2xl mx-auto text-lg text-muted-foreground">
            Thuto leverages a powerful and secure technical architecture to
            deliver a reliable and scalable experience.
          </p>
        </div>
        <div className="grid gap-8 md:grid-cols-3">
          {pillars.map((pillar) => (
            <div key={pillar.title} className="text-center">
              {pillar.icon}
              <h3 className="text-xl font-bold">{pillar.title}</h3>
              <p className="text-muted-foreground mt-2">
                {pillar.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function LandingPage() {
  return (
    <div className="bg-background">
       <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b">
        <div className="container mx-auto flex h-20 items-center justify-between px-4 md:px-6">
          <AppLink href="/" className="flex items-center gap-2">
            <Image src="/logo.svg" alt="Thuto Logo" width={64} height={64} className="h-16 w-auto" />
          </AppLink>
          <div className="flex items-center gap-2">
            <AppLink href="/login" className={cn(buttonVariants({ variant: "outline" }))}>
                Login
            </AppLink>
          </div>
        </div>
      </header>
      <main>
        <Hero />
        <Features />
        <TechPillars />
      </main>
      <footer className="py-12 bg-muted">
        <div className="container text-center text-muted-foreground text-sm">
          &copy; {new Date().getFullYear()} Thuto School Management System. All
          Rights Reserved.
        </div>
      </footer>
    </div>
  );
}
