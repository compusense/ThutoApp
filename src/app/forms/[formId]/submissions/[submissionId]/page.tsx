
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useFirestore } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { FormDocument, FormSubmission } from '../../../page';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AppLink } from '@/components/ui/app-link';
import { format } from 'date-fns';
import { getDisplayNamesFromUids } from '../../../actions';

export default function SubmissionDetailPage() {
  const params = useParams();
  const { formId, submissionId } = params;
  const firestore = useFirestore();

  const [formDef, setFormDef] = useState<FormDocument | null>(null);
  const [submission, setSubmission] = useState<FormSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [teacherNameMap, setTeacherNameMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!firestore || !formId || !submissionId) return;
    setLoading(true);

    const fetchSubmission = async () => {
      try {
        const formRef = doc(firestore, 'forms', formId as string);
        const submissionRef = doc(firestore, `forms/${formId}/submissions/${submissionId}`);
        
        const [formSnap, submissionSnap] = await Promise.all([getDoc(formRef), getDoc(submissionRef)]);

        if (formSnap.exists()) {
          const formDoc = { id: formSnap.id, ...formSnap.data() } as FormDocument;
          setFormDef(formDoc);

          if (submissionSnap.exists()) {
            const submissionData = { id: submissionSnap.id, ...submissionSnap.data() } as FormSubmission;
            
            // Get school name
            if (!submissionData.schoolName) {
              const schoolDoc = await getDoc(doc(firestore, 'schools', submissionData.schoolId));
              submissionData.schoolName = schoolDoc.exists() ? schoolDoc.data().name : 'Unknown School';
            }
            
            // Get teacher names
            const teacherFieldIds = formDoc.fields.filter(f => f.type === 'select-teacher').map(f => f.id);
            if (teacherFieldIds.length > 0) {
                const teacherUids = new Set<string>();
                submissionData.responses.forEach(row => {
                    teacherFieldIds.forEach(fieldId => {
                        if(row[fieldId]) teacherUids.add(row[fieldId]);
                    });
                });
                if(teacherUids.size > 0) {
                    const names = await getDisplayNamesFromUids(Array.from(teacherUids));
                    setTeacherNameMap(names);
                }
            }
            
            setSubmission(submissionData);
          }
        }

      } catch (error) {
        console.error("Error fetching submission details:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSubmission();
  }, [firestore, formId, submissionId]);
  

  if (loading) {
    return <div className="flex justify-center items-center p-10"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!submission || !formDef) {
    return <div className="p-10 text-center">Submission not found.</div>;
  }

  return (
    <div className="space-y-6">
        <Button asChild variant="ghost" className="-ml-4">
            <AppLink href={`/forms/${formId}/submissions`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to All Submissions
            </AppLink>
        </Button>
        <Card>
            <CardHeader>
                <CardTitle>Viewing Submission for: {formDef.title}</CardTitle>
                <CardDescription>
                    Submitted by {submission.schoolName} on {format(new Date(submission.submittedAt), 'PPP p')}.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                {formDef.fields.map(field => (
                                    <TableHead key={field.id}>{field.label}</TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {submission.responses.map((row, rowIndex) => (
                                <TableRow key={rowIndex}>
                                    {formDef.fields.map(field => {
                                        let cellValue = row[field.id];
                                        if (field.type === 'date' && cellValue) {
                                            try { cellValue = format(new Date(cellValue), 'PPP'); } catch { /* ignore invalid dates */ }
                                        }
                                        if (field.type === 'select-teacher' && cellValue) {
                                            cellValue = teacherNameMap.get(cellValue) || cellValue;
                                        }
                                        return (
                                            <TableCell key={field.id}>{cellValue ?? ''}</TableCell>
                                        );
                                    })}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    </div>
  );
}
