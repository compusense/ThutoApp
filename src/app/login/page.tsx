
import { AppLink } from '@/components/ui/app-link';
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';

import { LoginForm } from '@/components/auth/login-form';

export default function LoginPage() {
  const loginImage = PlaceHolderImages.find((p) => p.id === 'login-image');
  const loginBg = PlaceHolderImages.find((p) => p.id === 'login-background');

  return (
    <div className="w-full lg:grid lg:min-h-screen lg:grid-cols-2">
      <div className="relative hidden items-center justify-center bg-gray-100 dark:bg-gray-800 lg:flex">
        {loginBg && (
          <Image
            src={loginBg.imageUrl}
            alt={loginBg.description}
            fill
            className="object-cover"
            data-ai-hint={loginBg.imageHint}
          />
        )}
        <div className="absolute inset-0 bg-primary/60" />
        <div className="relative z-10 p-10 text-center">
          <h1 className="font-headline text-5xl font-bold tracking-tighter text-primary-foreground">
            Thuto
          </h1>
          <p className="mt-4 text-2xl font-bold text-primary-foreground/80 max-w-md mx-auto">
            Empowering education through technology, one classroom at a time.
          </p>
        </div>
      </div>
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="mx-auto flex w-full max-w-sm flex-col justify-center space-y-6">
          <div className="flex flex-col items-center text-center">
             <AppLink href="/" className="flex items-center gap-2 text-foreground mb-4">
                 <Image src="/logo.svg" alt="Thuto Logo" width={96} height={96} className="h-24 w-auto" />
             </AppLink>
            <p className="text-muted-foreground">
              Enter your credentials to access your dashboard.
            </p>
          </div>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
