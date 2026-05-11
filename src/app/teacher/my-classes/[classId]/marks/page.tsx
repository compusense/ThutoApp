
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser } from '@/firebase/auth/use-user';
import { MarkEntrySheet } from '@/components/shared/mark-entry-sheet';
import { Loader2 } from 'lucide-react';

const assessmentsByTerm: Record<string, string[]> = {
  "Term 1": ["January Test", "February Test", "March Test"],
  "Term 2": ["May Test", "June Test", "July Test"],
  "Term 3": ["September Test", "October Test", "November Test"],
};

export default function TeacherMarkEntryPage() {
  const { classId } = useParams();
  const { user } = useUser();

  if (!user) {
    return <div className="flex justify-center p-10"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <MarkEntrySheet
      user={user}
      classId={classId as string}
      assessmentsByTerm={assessmentsByTerm}
      pageTitle="Mark Entry"
      pageDescription="Enter student marks for a specific assessment."
      backPath="/teacher/my-classes"
      backLabel="Back to My Classes"
    />
  );
}
