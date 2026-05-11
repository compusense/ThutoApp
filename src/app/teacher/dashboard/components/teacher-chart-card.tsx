
'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogPortal,
} from '@/components/ui/dialog';
import { Expand } from 'lucide-react';

interface TeacherChartCardProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

export function TeacherChartCard({ title, description, children }: TeacherChartCardProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <Card
        onClick={() => setIsOpen(true)}
        className="cursor-pointer transition-all hover:ring-2 hover:ring-primary flex flex-col"
      >
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
            <div className="hidden sm:block p-2 rounded-full bg-secondary/50 text-secondary-foreground group-hover:bg-primary group-hover:text-primary-foreground">
              <Expand className="h-4 w-4" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-grow">
          {children}
        </CardContent>
      </Card>
      <DialogPortal forceMount>
          <DialogContent className="max-w-4xl h-auto sm:h-[80vh] flex flex-col data-[state=closed]:hidden">
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </DialogHeader>
            <div className="flex-grow w-full h-full p-4">
              {children}
            </div>
          </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
