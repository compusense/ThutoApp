
'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { AppLink } from '@/components/ui/app-link';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

interface ServiceCost {
  id: string;
  service: string;
  icon: string;
  description: string;
  usageCost: number;
  savings: number;
}

const costData: ServiceCost[] = [
  {
    id: 'storage',
    service: 'Cloud Storage',
    icon: '🔵',
    description: 'Stores files uploaded to your application, such as exam papers, teacher profile pictures, and timetable documents.',
    usageCost: 0.00,
    savings: 0.00,
  },
  {
    id: 'hosting',
    service: 'Firebase App Hosting',
    icon: '🔸',
    description: 'Runs the Next.js frontend of your application. This cost is for the server resources that serve the web pages to your users.',
    usageCost: 0.01,
    savings: -0.01,
  },
  {
    id: 'gemini',
    service: 'Gemini API',
    icon: '🟧',
    description: 'Powers the generative AI features in Thuto, like generating report card comments and comprehensive class reports.',
    usageCost: 0.10,
    savings: -0.10,
  },
  {
    id: 'run',
    service: 'Cloud Run',
    icon: '🔺',
    description: 'A serverless platform that automatically scales your backend. Firebase App Hosting uses Cloud Run under the hood to run your application code.',
    usageCost: 0.13,
    savings: -0.13,
  },
  {
    id: 'app-engine',
    service: 'App Engine',
    icon: '🔻',
    description: 'Another serverless platform. Some background tasks or specific services used by Firebase might use App Engine, resulting in minor costs.',
    usageCost: 0.05,
    savings: -0.05,
  },
];

const totalUsage = costData.reduce((acc, item) => acc + item.usageCost, 0);
const totalSavings = costData.reduce((acc, item) => acc + item.savings, 0);
const subtotal = totalUsage + totalSavings;


export default function BillingExplanationPage() {
  const router = useRouter();

  const handleRowClick = (serviceId: string) => {
    router.push(`/super-admin/billing/${serviceId}`);
  };

  return (
    <div className="space-y-6">
        <div>
            <Button asChild variant="ghost" className="-ml-4">
                <AppLink href="/super-admin/dashboard">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Dashboard
                </AppLink>
            </Button>
            <h2 className="text-3xl font-bold tracking-tight">Understanding Your Project Costs</h2>
            <p className="text-muted-foreground">
                A breakdown of the services used by the Thuto application and an explanation of the costs.
            </p>
        </div>

        <Card>
            <CardHeader>
                <CardTitle>Billing Summary</CardTitle>
                <CardDescription>
                    This table explains the costs shown in your billing report. The "Other savings" column represents credits or free tier usage provided by the platform, which is why your final subtotal is $0.00.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[200px]">Service</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead className="text-right">Usage Cost</TableHead>
                                <TableHead className="text-right">Other Savings</TableHead>
                                <TableHead className="text-right">Subtotal</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {costData.map((item) => (
                                <TableRow 
                                    key={item.id} 
                                    className="cursor-pointer hover:bg-muted/50" 
                                    onClick={() => handleRowClick(item.id)}
                                >
                                    <TableCell className="font-medium">
                                        <span className="mr-2">{item.icon}</span>{item.service}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">{item.description}</TableCell>
                                    <TableCell className="text-right">${item.usageCost.toFixed(2)}</TableCell>
                                    <TableCell className="text-right text-green-600">${item.savings.toFixed(2)}</TableCell>
                                    <TableCell className="text-right font-semibold">
                                        <div className="flex items-center justify-end">
                                            <span>${(item.usageCost + item.savings).toFixed(2)}</span>
                                            <ChevronRight className="h-4 w-4 text-muted-foreground ml-2" />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                         <TableFooter>
                            <TableRow>
                                <TableCell colSpan={2} className="font-bold">Total</TableCell>
                                <TableCell className="text-right font-bold">${totalUsage.toFixed(2)}</TableCell>
                                <TableCell className="text-right font-bold text-green-600">${totalSavings.toFixed(2)}</TableCell>
                                <TableCell className="text-right font-extrabold">${subtotal.toFixed(2)}</TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </div>
            </CardContent>
        </Card>
    </div>
  );
}

    