
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AppLink } from '@/components/ui/app-link';
import { ArrowLeft, Download, Eye, Loader2, List, Archive, AlertTriangle } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { doc, getDoc, collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { useFirestore, auth } from '@/firebase';
import { FormDocument, FormSubmission } from '../../page';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { getSchoolName, archiveForm } from '../../actions';
import { exportSubmissionsAsCSV } from '../../submissions/csv-export';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

export default function FormSubmissionsPage() {
  const params = useParams();
  const { formId } = params;
  const firestore = useFirestore();
  const [formDef, setFormDef] = useState<FormDocument | null>(null);
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (!firestore || !formId) return;

    const formRef = doc(firestore, 'forms', formId as string);
    const unsubForm = onSnapshot(formRef, (docSnap) => {
      if (docSnap.exists()) {
        setFormDef({ id: docSnap.id, ...docSnap.data() } as FormDocument);
      } else {
        setFormDef(null);
      }
    });

    const submissionsQuery = query(collection(firestore, 'forms', formId as string, 'submissions'), orderBy('submittedAt', 'desc'));
    const unsubSubmissions = onSnapshot(submissionsQuery, async (snapshot) => {
      const fetchedSubmissions: FormSubmission[] = await Promise.all(snapshot.docs.map(async (doc) => {
        const data = doc.data();
        const schoolName = await getSchoolName(data.schoolId);
        return {
          id: doc.id,
          formId: data.formId,
          schoolId: data.schoolId,
          schoolName,
          submittedBy: data.submittedBy,
          submittedAt: data.submittedAt,
          responses: data.responses,
        };
      }));
      setSubmissions(fetchedSubmissions);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching submissions: ", error);
      setLoading(false);
    });

    return () => {
        unsubForm();
        unsubSubmissions();
    };
  }, [firestore, formId]);
  
  const handleExport = async () => {
    if (!formDef) return;
    setIsExporting(true);
    try {
      await exportSubmissionsAsCSV(formDef);
      toast({ title: 'Export Successful', description: 'The consolidated CSV file has been downloaded.' });
    } catch(e: any) {
      toast({ variant: 'destructive', title: 'Export Failed', description: e.message });
    } finally {
      setIsExporting(false);
    }
  }

  const handleArchive = async () => {
      if (!formDef) return;
      setIsArchiving(true);
      try {
          const idToken = await auth.currentUser?.getIdToken();
          if (!idToken) throw new Error("Authentication failed.");
          
          const result = await archiveForm(formDef.id, idToken);
          if (result.success) {
              toast({title: "Form Archived", description: "This form will no longer accept new submissions."});
              // The onSnapshot listener will update the formDef status automatically
          } else {
              throw new Error(result.message);
          }
      } catch (e: any) {
          toast({variant: 'destructive', title: "Archive Failed", description: e.message});
      } finally {
          setIsArchiving(false);
      }
  }


  return (
    <div className="space-y-6">
       <div className='flex items-center justify-between'>
            <div>
                <Button asChild variant="ghost" className="-ml-4">
                    <AppLink href="/forms">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to All Forms
                    </AppLink>
                </Button>
                <h2 className="text-3xl font-bold tracking-tight">{formDef?.title || 'Form'} Submissions</h2>
                <p className="text-muted-foreground">
                View responses submitted by School Heads.
                </p>
            </div>
            <div className="flex items-center space-x-2">
                 <Button asChild variant="outline" disabled={submissions.length === 0}>
                    <AppLink href={`/forms/${formId}/submissions/consolidated`}>
                        <List className="mr-2 h-4 w-4" />
                        View Consolidated
                    </AppLink>
                </Button>
                <Button onClick={handleExport} disabled={isExporting || submissions.length === 0}>
                    {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                    Export All as CSV
                </Button>
                {formDef?.status === 'published' && (
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" disabled={isArchiving}>
                                {isArchiving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Archive className="mr-2 h-4 w-4" />}
                                Archive Form
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure you want to archive this form?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Archiving the form will prevent any new submissions. You will still be able to view and export existing data. This action cannot be undone.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleArchive}>Confirm</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                )}
            </div>
       </div>
       {formDef?.status === 'archived' && (
            <div className="p-4 bg-amber-50 border-l-4 border-amber-400 rounded-r-md">
                <div className="flex">
                    <div className="flex-shrink-0">
                        <AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden="true" />
                    </div>
                    <div className="ml-3">
                        <p className="text-sm text-amber-700">
                        This form has been archived and is now read-only. New submissions are no longer accepted.
                        </p>
                    </div>
                </div>
            </div>
        )}

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
                                <Button asChild variant="outline" size="sm">
                                    <AppLink href={`/forms/${formId}/submissions/${sub.id}`}>
                                        <Eye className="mr-2 h-4 w-4" />
                                        View
                                    </AppLink>
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

    