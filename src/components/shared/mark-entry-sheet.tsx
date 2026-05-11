
'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { doc, onSnapshot, collection, query, where, getDocs, getDoc, FirestoreError } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useUser, UserProfile } from '@/firebase/auth/use-user';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { Class } from '@/app/school-head/classes/page';
import { Student } from '@/app/school-head/students/page';
import { Subject } from '@/app/super-admin/subjects/page';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Download, Upload, Info } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { saveTermMarks, getMarkSheetActivity } from '@/app/school-head/classes/[classId]/marks/actions';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { generateCSVTemplate, parseCSV } from '@/components/shared/mark-entry-csv-utils';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { format } from 'date-fns';

const MarkEntrySchema = z.object({
  totals: z.record(z.coerce.number().min(0, "Total required")),
  marks: z.record(z.record(z.object({
    score: z.union([z.coerce.number().min(0, "Invalid score"), z.string().length(0), z.string().length(0).optional()]).optional(),
  }))),
});

type MarkEntryFormValues = z.infer<typeof MarkEntrySchema>;

interface ActivityData {
    lastModifiedBy: string;
    lastModifiedAt: string;
}

interface MarkEntrySheetProps {
    user: UserProfile;
    classId: string;
    assessmentsByTerm: Record<string, string[]>;
    pageTitle: string;
    pageDescription: string;
    backPath: string;
    backLabel: string;
    isInvigilation?: boolean;
}

export function MarkEntrySheet({ user, classId, assessmentsByTerm, pageTitle, pageDescription, backPath, backLabel, isInvigilation = false }: MarkEntrySheetProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const firestore = useFirestore();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [classData, setClassData] = useState<Class | null>(null);
  const [classTeacher, setClassTeacher] = useState<UserProfile | null>(null);
  const [enrolledStudents, setEnrolledStudents] = useState<Student[]>([]);
  const [classSubjects, setClassSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasPermission, setHasPermission] = useState(!isInvigilation);
  const [isAutoSaveOn, setIsAutoSaveOn] = useState(false);
  const [activityData, setActivityData] = useState<ActivityData | null>(null);
  const [loadingActivity, setLoadingActivity] = useState(false);

  const academicYears = useMemo(() => Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - 2 + i).toString()), []);
  const [selectedYear, setSelectedYear] = useState<string>(searchParams.get('year') || new Date().getFullYear().toString());
  const terms = ["Term 1", "Term 2", "Term 3"] as const;
  type Term = typeof terms[number];
  const [selectedTerm, setSelectedTerm] = useState<Term>(searchParams.get('term') as Term || terms[0]);
  const [selectedAssessment, setSelectedAssessment] = useState<string>('');
  
  const form = useForm<MarkEntryFormValues>({
    resolver: zodResolver(MarkEntrySchema),
    defaultValues: { totals: {}, marks: {} },
  });

  const { reset, setValue, formState: { dirtyFields, isDirty }, watch, getValues } = form;
  const watchedFormValues = watch();

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty]);


  const onSubmit = useCallback(async (data: MarkEntryFormValues) => {
    if (!user?.schoolId || !classData?.id || !selectedAssessment) return;
    
    const dirtyMarks: Record<string, Record<string, { score: number | string | undefined }>> = {};
    Object.keys(dirtyFields.marks || {}).forEach(studentId => {
        if (!dirtyMarks[studentId]) dirtyMarks[studentId] = {};
        Object.keys(dirtyFields.marks![studentId]!).forEach(subjectId => {
            dirtyMarks[studentId][subjectId] = { score: data.marks[studentId][subjectId].score };
        });
    });
    
    if (Object.keys(dirtyMarks).length === 0 && !dirtyFields.totals) {
        if (!isAutoSaveOn) toast({ title: "No changes", description: "No marks were entered or changed." });
        return;
    }

    setIsSubmitting(true);
    
    const payload = {
      schoolId: user.schoolId,
      classId: classData.id,
      academicYear: selectedYear,
      term: selectedTerm,
      assessment: selectedAssessment,
      totals: data.totals,
      marks: dirtyMarks,
      modifiedBy: user.uid,
    };

    try {
      const result = await saveTermMarks(payload);
      if(result.success) {
          if (!isAutoSaveOn) {
            toast({ title: "Success", description: result.message });
          }
          if (result.data) {
             form.reset({
                ...form.getValues(),
                totals: result.data.totals
             });
          } else {
             form.reset(form.getValues());
          }
      } else {
          throw new Error(result.message);
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: "Error", description: error.message || "Could not save marks." });
    } finally {
      setIsSubmitting(false);
    }
  }, [user, classData, selectedYear, selectedTerm, selectedAssessment, dirtyFields, toast, form, isAutoSaveOn, getValues]);
  
  useEffect(() => {
    if (!isAutoSaveOn || !dirtyFields.marks) {
        return;
    }

    if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
       onSubmit(form.getValues());
    }, 1500);

    return () => {
        if(saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    }
  }, [watchedFormValues, isAutoSaveOn, dirtyFields, form, onSubmit]);

  useEffect(() => {
    if (!isInvigilation || !firestore || !user.uid || !user.schoolId || !classId) return;

    const q = query(
        collection(firestore, 'schools', user.schoolId, 'invigilations'),
        where('teacherId', '==', user.uid),
        where('classId', '==', classId),
        where('academicYear', '==', selectedYear),
        where('term', '==', selectedTerm)
    );
    getDocs(q).then(snap => {
        setHasPermission(!snap.empty);
    })
  }, [isInvigilation, firestore, user, classId, selectedYear, selectedTerm]);

  useEffect(() => {
    if (!firestore || !user?.schoolId || !classId) return;
    const classRef = doc(firestore, 'schools', user.schoolId, 'classes', classId as string);
    const unsub = onSnapshot(classRef, (snap) => {
        if (snap.exists()) {
            const data = { id: snap.id, ...snap.data() } as Class;
            setClassData(data);
            if (data.teacherId) {
                const teacherRef = doc(firestore, 'users', data.teacherId);
                onSnapshot(teacherRef, (tsnap) => setClassTeacher(tsnap.exists() ? {uid: tsnap.id, ...tsnap.data()} as UserProfile : null));
            }
        } else { setClassData(null); }
    });
    return () => unsub();
  }, [firestore, user, classId]);


  useEffect(() => {
    setActivityData(null);
    if (!firestore || !user?.schoolId || !classId || !selectedYear || !selectedTerm || !selectedAssessment || !hasPermission) {
        setLoading(false);
        return;
    };
    
    let isMounted = true;
    setLoading(true);

    const fetchData = async () => {
      try {
        const studentsQuery = query(collection(firestore, 'schools', user.schoolId!, 'students'), where('classId', '==', classId));
        const enrolledSnapshot = await getDocs(studentsQuery);
        const fetchedStudents = enrolledSnapshot.docs.map(d => ({ ...d.data(), id: d.id, fullName: `${d.data()?.firstName} ${d.data()?.surname}` } as Student));
        
        const subjectsQuery = query(collection(firestore, `schools/${user.schoolId}/classes/${classId}/subjects`), where('academicYear', '==', selectedYear));
        const subjectsSnapshot = await getDocs(subjectsQuery);
        const subjectIds = subjectsSnapshot.docs.map(doc => doc.data().subjectId);
    
        let fetchedSubjects: Subject[] = [];
        if (subjectIds.length > 0) {
          const subjectPromises = subjectIds.map(id => getDoc(doc(firestore, 'subjects', id)));
          const subjectDocs = await Promise.all(subjectPromises);
          fetchedSubjects = subjectDocs.map(d => ({ ...d.data(), id: d.id } as Subject));
        }

        const totalsAssessmentName = selectedAssessment;
        const assessmentTotalsId = `${selectedYear}-${selectedTerm.replace(/\s+/g, '-')}-${totalsAssessmentName.replace(/\s+/g, '-')}`;
        
        const assessmentTotalsRef = doc(firestore, 'schools', user.schoolId, 'classes', classId as string, 'assessmentTotals', assessmentTotalsId);
        const assessmentTotalsSnap = await getDoc(assessmentTotalsRef).catch(err => {
            return null;
        });
        
        const rawData = assessmentTotalsSnap?.exists() ? assessmentTotalsSnap.data() : {};
        const totalsData: Record<string, number | string> = rawData.totals ?? {};
    
        const marksData: Record<string, Record<string, { score: number | string }>> = {};
        for (const student of fetchedStudents) {
          marksData[student.id] = {};
          const marksQuery = query(
            collection(firestore, `schools/${user.schoolId}/students/${student.id}/marks`),
            where('academicYear', '==', selectedYear),
            where('term', '==', selectedTerm),
            where('assessment', '==', selectedAssessment)
          );
          const marksSnapshot = await getDocs(marksQuery);
          marksSnapshot.forEach(doc => {
            const mark = doc.data();
            marksData[student.id][mark.subjectId] = { score: mark.score };
          });
        }
    
        for (const subject of fetchedSubjects) {
          if (totalsData[subject.id] === undefined) {
            totalsData[subject.id] = '';
          }
        }

        for (const student of fetchedStudents) {
          marksData[student.id] ??= {};
          for (const subject of fetchedSubjects) {
            marksData[student.id][subject.id] ??= { score: '' };
          }
        }
        
        if (isMounted) {
          setEnrolledStudents(fetchedStudents.sort((a,b) => a.fullName!.localeCompare(b.fullName!)));
          setClassSubjects(fetchedSubjects.sort((a,b) => a.name.localeCompare(b.name)));
          reset({ totals: totalsData, marks: marksData });
        }
      } catch (error: any) {
        if (isMounted) {
          toast({ variant: 'destructive', title: 'Error', description: 'Failed to load data.' });
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    
    fetchData();

    return () => { isMounted = false; };
  }, [firestore, user, classId, selectedYear, selectedTerm, selectedAssessment, reset, toast, hasPermission]);
  
  const handleFetchActivity = async () => {
      if (!user?.schoolId || !classData?.id || !selectedAssessment) return;
      setLoadingActivity(true);
      try {
          const result = await getMarkSheetActivity({
              schoolId: user.schoolId,
              classId: classData.id,
              academicYear: selectedYear,
              term: selectedTerm,
              assessment: selectedAssessment
          });
          if (result.success && result.data) {
              setActivityData(result.data);
          } else {
              setActivityData(null); // Explicitly set to null if not found
          }
      } catch (error: any) {
          toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch activity.' });
      } finally {
          setLoadingActivity(false);
      }
  };


  const handleTermChange = (termValue: string) => {
    const term = termValue as Term;
    setSelectedTerm(term);
    setSelectedAssessment(''); 
  }
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, rowIndex: number, colIndex: number) => {
    const { key } = e;
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) return;
    e.preventDefault();

    let nextRow = rowIndex;
    let nextCol = colIndex;

    switch (key) {
      case 'ArrowUp': nextRow = rowIndex > 0 ? rowIndex - 1 : enrolledStudents.length - 1; break;
      case 'ArrowDown': nextRow = rowIndex < enrolledStudents.length - 1 ? rowIndex + 1 : 0; break;
      case 'ArrowLeft': nextCol = colIndex > 0 ? colIndex - 1 : classSubjects.length - 1; break;
      case 'ArrowRight': nextCol = colIndex < classSubjects.length - 1 ? colIndex + 1 : 0; break;
    }
    
    if (enrolledStudents.length === 0 || classSubjects.length === 0) return;
    
    const nextStudentId = enrolledStudents[nextRow].id;
    const nextSubjectId = classSubjects[nextCol].id;
    const nextInput = document.querySelector(`input[name="marks.${nextStudentId}.${nextSubjectId}.score"]`) as HTMLInputElement;
    if (nextInput) {
      nextInput.focus();
      nextInput.select();
    }
  };

  const handleDownloadCSV = () => {
    if (!classData || !selectedAssessment) return;
    try {
        const currentValues = form.getValues();
        generateCSVTemplate({
            className: classData.name,
            teacherName: classTeacher?.displayName || 'N/A',
            assessment: selectedAssessment,
            year: selectedYear,
            students: enrolledStudents,
            subjects: classSubjects,
            marks: currentValues.marks,
            totals: currentValues.totals,
        });
        toast({ title: 'CSV Template Downloaded' });
    } catch(e: any) {
        toast({ variant: 'destructive', title: 'Download Failed', description: e.message });
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
        parseCSV(file, (results) => {
            if (results.errors.length > 0) {
                toast({
                    variant: 'destructive',
                    title: `CSV Validation Error(s)`,
                    description: ( <ul className="list-disc list-inside text-xs">{results.errors.map((err, i) => <li key={i}>{err}</li>)}</ul>),
                    duration: 10000,
                });
                return;
            }
            const { totals, marks } = results.data;
            for(const subjectId in totals) setValue(`totals.${subjectId}`, totals[subjectId], { shouldDirty: true });
            for(const studentId in marks) {
                for(const subjectId in marks[studentId]) {
                    setValue(`marks.${studentId}.${subjectId}.score`, marks[studentId][subjectId].score, { shouldDirty: true });
                }
            }
            toast({ title: 'CSV Processed', description: 'Marks loaded. Review and save.' });
        }, enrolledStudents, classSubjects);
    }
    if(fileInputRef.current) fileInputRef.current.value = '';
  };
  
  if (!user || !classData) {
      return (
          <div className="flex justify-center p-10">
              {loading ? <Loader2 className="h-8 w-8 animate-spin" /> : <p>Class not found.</p>}
          </div>
      )
  }

  if (!hasPermission && !loading) {
    return <div className="p-8 text-center text-destructive">You do not have permission to access this mark sheet.</div>;
  }

  return (
    <FormProvider {...form}>
      <div className="flex flex-wrap items-start justify-between gap-4 space-y-2 mb-6">
        <div>
            <Button variant="ghost" onClick={() => router.push(backPath)} className="mb-4 -ml-4">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {backLabel}
            </Button>
            <h2 className="text-3xl font-bold tracking-tight">{pageTitle}: {classData?.name}</h2>
            <p className="text-muted-foreground">{pageDescription}</p>
        </div>
        <div className="flex items-center space-x-2 pt-2">
            <input type="file" ref={fileInputRef} accept=".csv" onChange={handleFileUpload} className="hidden" />
            <Button variant="outline" type="button" onClick={handleDownloadCSV} disabled={!selectedAssessment || enrolledStudents.length === 0 || classSubjects.length === 0}>
                <Download className="mr-2 h-4 w-4" />
                Download Template
            </Button>
            <Button variant="outline" type="button" onClick={() => fileInputRef.current?.click()} disabled={!selectedAssessment || enrolledStudents.length === 0 || classSubjects.length === 0}>
                <Upload className="mr-2 h-4 w-4" />
                Upload CSV
            </Button>
        </div>
      </div>
      <form onSubmit={form.handleSubmit(onSubmit)}>
      <Card>
        <CardHeader>
            <CardTitle>Filters & Options</CardTitle>
            <CardDescription>Select a year, term, and assessment to begin.</CardDescription>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
                <Select value={selectedYear} onValueChange={setSelectedYear} disabled={isInvigilation}>
                    <SelectTrigger><SelectValue placeholder="Select Year" /></SelectTrigger>
                    <SelectContent>{academicYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                </Select>
                 <Select value={selectedTerm} onValueChange={handleTermChange} disabled={isInvigilation}>
                    <SelectTrigger><SelectValue placeholder="Select Term" /></SelectTrigger>
                    <SelectContent>{terms.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
                 <Select value={selectedAssessment} onValueChange={setSelectedAssessment} disabled={!selectedTerm}>
                    <SelectTrigger><SelectValue placeholder="Select Assessment" /></SelectTrigger>
                    <SelectContent>{(assessmentsByTerm[selectedTerm] || []).map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                </Select>
                <div className="flex items-center space-x-4 justify-self-end md:col-span-2 lg:col-span-1 lg:justify-self-start">
                    <div className="flex items-center space-x-2">
                        <Switch id="autosave-mode" checked={isAutoSaveOn} onCheckedChange={setIsAutoSaveOn} />
                        <Label htmlFor="autosave-mode">Auto-save</Label>
                    </div>
                    <Dialog onOpenChange={() => setActivityData(null)}>
                        <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={!selectedAssessment} onClick={handleFetchActivity}>
                                <Info className="h-5 w-5" />
                                <span className="sr-only">View Activity</span>
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Mark Sheet Activity</DialogTitle>
                                <DialogDescription>Information about the last saved changes for this assessment.</DialogDescription>
                            </DialogHeader>
                            {loadingActivity ? (
                                <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin" /></div>
                            ) : activityData ? (
                                <div className="space-y-2 text-sm">
                                    <p><span className="font-semibold">Last Modified By:</span> {activityData.lastModifiedBy}</p>
                                    <p><span className="font-semibold">Last Modified At:</span> {format(new Date(activityData.lastModifiedAt), 'PPP p')}</p>
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">No recorded activity found for this assessment period.</p>
                            )}
                        </DialogContent>
                    </Dialog>
                </div>
            </div>
        </CardHeader>
        <CardContent>
            {!selectedAssessment ? (
                <div className="text-center py-10 text-muted-foreground">Please select an assessment to show the mark sheet.</div>
            ) : loading ? (
                 <div className="space-y-2 p-4">
                    {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                 </div>
            ) : (enrolledStudents.length === 0 || classSubjects.length === 0) ? (
                <div className="text-center py-10 text-muted-foreground">
                    {enrolledStudents.length === 0 ? "There are no students enrolled in this class." : "No subjects have been allocated to this class for the selected year."}
                </div>
            ) : (
                <div className="relative max-h-[60vh] overflow-auto rounded-md border bg-card">
                  <table className="w-full border-collapse text-sm">
                    <thead className="sticky top-0 z-20 bg-card">
                      <tr className="border-b">
                        <th className="sticky left-0 top-0 z-30 bg-card w-16 min-w-[60px] border-r p-2 text-left font-semibold text-xs uppercase tracking-wider">
                          No.
                        </th>
                        <th className="sticky left-16 top-0 z-30 bg-card w-56 min-w-[180px] border-r p-2 text-left font-semibold text-xs uppercase tracking-wider">
                          Student Name
                        </th>
                        {classSubjects.map((subject) => (
                          <th
                            key={subject.id}
                            className="border-r p-2 text-center font-semibold text-xs whitespace-nowrap min-w-[105px]"
                            title={subject.name}
                          >
                            <div className="truncate max-w-[90px] mx-auto">
                              {subject.name}
                            </div>
                          </th>
                        ))}
                      </tr>

                      <tr className="border-b bg-muted/30">
                        <th className="sticky left-0 bg-card z-30 border-r p-1" />
                        <th className="sticky left-16 bg-card z-30 border-r p-1 text-left font-large text-xs">
                          Total
                        </th>
                        {classSubjects.map((subject) => (
                          <td key={subject.id} className="p-1 border-r">
                            <FormField
                              control={form.control}
                              name={`totals.${subject.id}`}
                              render={({ field }) => (
                                <FormItem className="m-0">
                                  <FormControl>
                                    <Input
                                      type="number"
                                      {...field}
                                      onWheel={(e) => e.currentTarget.blur()}
                                      className="h-7 text-center text-xs font-bold text-destructive border-0 bg-transparent focus:bg-white"
                                      placeholder="Total"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </td>
                        ))}
                      </tr>
                    </thead>

                    <tbody className="bg-white">
                      {enrolledStudents.map((student, rowIdx) => (
                        <tr
                          key={student.id}
                          className="border-b hover:bg-muted/50 transition-colors"
                        >
                          <td className="sticky left-0 z-10 bg-inherit font-medium text-center border-r p-2 text-sm">
                            {rowIdx + 1}
                          </td>

                          <td className="sticky left-16 z-10 bg-inherit font-medium border-r p-2 text-sm">
                            <div className="truncate max-w-[180px]" title={student.fullName ?? ''}>
                              {student.fullName}
                            </div>
                          </td>

                          {classSubjects.map((subject, colIdx) => (
                            <td key={subject.id} className="p-1 border-r">
                              <FormField
                                control={form.control}
                                name={`marks.${student.id}.${subject.id}.score`}
                                render={({ field }) => (
                                  <FormItem className="m-0">
                                    <FormControl>
                                      <Input
                                        type="number"
                                        {...field}
                                        onKeyDown={(e) => handleKeyDown(e, rowIdx, colIdx)}
                                        onWheel={(e) => e.currentTarget.blur()}
                                        className="h-7 text-center text-xs border-0 bg-background/50 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                                        placeholder=""
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-t from-card to-transparent pointer-events-none" />
                </div>
            )}
            {selectedAssessment && !loading && enrolledStudents.length > 0 && classSubjects.length > 0 && !isAutoSaveOn && (
                <div className="flex justify-end mt-6">
                    <Button type="submit" disabled={isSubmitting || !form.formState.isDirty}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isSubmitting ? "Saving..." : "Save Marks"}
                    </Button>
                </div>
            )}
             {isAutoSaveOn && (
              <div className="flex justify-end items-center mt-4 space-x-2">
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  <p className="text-sm text-muted-foreground italic">
                      {isSubmitting ? 'Saving...' : 'Changes are saved automatically.'}
                  </p>
              </div>
            )}
        </CardContent>
      </Card>
      </form>
    </FormProvider>
  );
}
