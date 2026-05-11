
'use client';

import { useParams } from 'next/navigation';
import { useUser } from '@/firebase/auth/use-user';
import { MarkEntrySheet } from '@/components/shared/mark-entry-sheet';
import { Loader2 } from 'lucide-react';

const assessmentsByTerm: Record<string, string[]> = {
  "Term 1": ["End of Term 1"],
  "Term 2": ["End of Term 2"],
  "Term 3": ["End of Term 3"],
};

export default function InvigilationMarkEntryPage() {
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
      pageTitle="Invigilation Mark Entry"
      pageDescription="Enter marks for the end of term exam."
      backPath="/teacher/invigilation"
      backLabel="Back to Invigilation Duties"
      isInvigilation={true}
    />
  );
}
