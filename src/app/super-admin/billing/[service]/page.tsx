
'use client';

import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AppLink } from '@/components/ui/app-link';
import { ArrowLeft, Construction } from 'lucide-react';

const serviceNames: Record<string, string> = {
  storage: 'Cloud Storage',
  hosting: 'Firebase App Hosting',
  gemini: 'Gemini API',
  run: 'Cloud Run',
  'app-engine': 'App Engine',
};

export default function ServiceUsageDetailsPage() {
  const params = useParams();
  const serviceId = params.service as string;
  const serviceName = serviceNames[serviceId] || 'Service';

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" className="-ml-4">
          <AppLink href="/super-admin/billing-explanation">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Billing Explanation
          </AppLink>
        </Button>
        <h2 className="text-3xl font-bold tracking-tight">
          Usage Details for {serviceName}
        </h2>
        <p className="text-muted-foreground">
          Top users and schools contributing to {serviceName} usage.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Feature Under Construction</CardTitle>
          <CardDescription>
            This page will soon display detailed usage analytics.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center text-center text-muted-foreground py-16">
          <Construction className="h-16 w-16 mb-4" />
          <p className="font-semibold">We're building it!</p>
          <p className="text-sm">
            The functionality to track and display per-user and per-school usage is currently in development.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

    