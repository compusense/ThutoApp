
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AppLink } from '@/components/ui/app-link';
import { ArrowLeft, Eye, Loader2 } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { doc, getDoc, collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { FormDocument } from '../page';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { getSchoolName } from '../actions';

interface Submission {
  id: string;
  formId: string;
  schoolId: string;
  schoolName?: string;
  submittedBy: string;
  submittedAt: string; // ISO string
}

export default function FormSubmissionsPage() {
  const params = useParams();
  const { formId } = params;
  const firestore = useFirestore();
  const [formDef, setFormDef] = useState<FormDocument | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firestore || !formId) return;

    const formRef = doc(firestore, 'forms', formId as string);
    getDoc(formRef).then(docSnap => {
      if (docSnap.exists()) {
        setFormDef({ id: docSnap.id, ...docSnap.data() } as FormDocument);
      }
    });

    const submissionsQuery = query(collection(firestore, 'forms', formId as string, 'submissions'), orderBy('submittedAt', 'desc'));
    const unsubscribe = onSnapshot(submissionsQuery, async (snapshot) => {
      const fetchedSubmissions: Submission[] = await Promise.all(snapshot.docs.map(async (doc) => {
        const data = doc.data() as Submission;
        const schoolName = await getSchoolName(data.schoolId);
        return {
          ...data,
          id: doc.id,
          schoolName,
        };
      }));
      setSubmissions(fetchedSubmissions);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching submissions: ", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [firestore, formId]);

  return (
    <div className="space-y-6">
        <Button asChild variant="ghost" className="-ml-4">
            <AppLink href="/forms">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to All Forms
            </AppLink>
        </Button>
      <div>
        <h2 className="text-3xl font-bold tracking-tight">{formDef?.title || 'Form'} Submissions</h2>
        <p className="text-muted-foreground">
          View responses submitted by School Heads.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Received Submissions</CardTitle>
          <CardDescription>
            A list of all schools that have submitted this form.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center p-10"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : submissions.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">No submissions have been received for this form yet.</p>
          ) : (
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>School</TableHead>
                        <TableHead>Date Submitted</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {submissions.map(sub => (
                        <TableRow key={sub.id}>
                            <TableCell className="font-medium">{sub.schoolName || sub.schoolId}</TableCell>
                            <TableCell>{format(new Date(sub.submittedAt), 'PPP p')}</TableCell>
                            <TableCell className="text-right">
                                <Button variant="outline" size="sm" disabled>
                                    <Eye className="mr-2 h-4 w-4" />
                                    View (Soon)
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
