
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot, collection, query, where, getDocs, getDoc, FirestoreError } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useUser } from '@/firebase/auth/use-user';
import { MarkEntrySheet } from '@/components/shared/mark-entry-sheet';
import { Class } from '@/app/school-head/classes/page';
import { Student } from '@/app/school-head/students/page';
import { Subject } from '@/app/super-admin/subjects/page';
import { UserProfile } from '@/firebase/auth/use-user';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

const assessmentsByTerm: Record<string, string[]> = {
  "Term 1": ["January Test", "February Test", "March Test", "End of Term 1"],
  "Term 2": ["May Test", "June Test", "July Test", "End of Term 2"],
  "Term 3": ["September Test", "October Test", "November Test", "End of Term 3"],
};

export default function MarkEntryPage() {
  const { classId } = useParams();
  const router = useRouter();
  const { user } = useUser();

  if (!user) {
    return <div className="flex justify-center p-10"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <MarkEntrySheet
      user={user}
      classId={classId as string}
      assessmentsByTerm={assessmentsByTerm}
      pageTitle="Mark Entry Sheet"
      pageDescription="Enter student marks for a specific assessment. Only entered/changed marks will be saved."
      backPath={`/school-head/classes/${classId}`}
      backLabel="Back to Class Roll"
    />
  );
}
