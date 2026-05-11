'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { PlusCircle, Trash2, CalendarIcon, Loader2, Upload, File, X, UploadCloud } from 'lucide-react';
import { useForm, useFieldArray, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Subject } from '@/app/super-admin/subjects/page';
import { useFirestore, auth, useStorage } from '@/firebase';
import { collection, query, onSnapshot, where } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { createStructuredTimetable, createFileTimetable, uploadExamMaterial, deleteTimetable } from './actions';
import { Label } from '@/components/ui/label';
import { ref, uploadBytesResumable, getDownloadURL, UploadTask } from 'firebase/storage';
import { Progress } from '@/components/ui/progress';
import { useUser } from '@/firebase/auth/use-user';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const scheduleItemSchema = z.object({
  id: z.string(),
  date: z.date({ required_error: 'Date is required' }),
  session1_time: z.string().optional(),
  session1_subjectId: z.string().optional(),
  session1_subjectId2: z.string().optional(),
  session1_subject1_comments: z.string().optional(),
  session1_subject2_comments: z.string().optional(),
  session2_time: z.string().optional(),
  session2_subjectId: z.string().optional(),
  session2_subjectId2: z.string().optional(),
  session2_subject1_comments: z.string().optional(),
  session2_subject2_comments: z.string().optional(),
}).superRefine((data, ctx) => {
    if (!data.session1_subjectId && !data.session1_subjectId2 && !data.session2_subjectId && !data.session2_subjectId2) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Each row must have at least one subject.", path: ['session1_subjectId'] });
        return;
    }
    if ((data.session1_subjectId || data.session1_subjectId2) && !data.session1_time) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Time is required for Session 1 if subjects are assigned.", path: ['session1_time'] });
    }
    if ((data.session2_subjectId || data.session2_subjectId2) && !data.session2_time) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Time is required for Session 2 if subjects are assigned.", path: ['session2_time'] });
    }
});


const structuredTimetableSchema = z.object({
  schedule: z.array(scheduleItemSchema).min(1, 'Timetable must have at least one entry.'),
});

type StructuredFormValues = z.infer<typeof structuredTimetableSchema>;

const schoolLevels = ["Primary School", "Junior Secondary School", "Senior Secondary School"];

const gradeLevelsBySchool: Record<string, string[]> = {
    "Primary School": ["Reception", "Standard 1", "Standard 2", "Standard 3", "Standard 4", "Standard 5", "Standard 6", "Standard 7"],
    "Junior Secondary School": ["Form 1", "Form 2", "Form 3"],
    "Senior Secondary School": ["Form 4", "Form 5"],
};


function DesignTimetableForm({ allSubjects }: { allSubjects: Subject[] }) {
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
    const [selectedTerm, setSelectedTerm] = useState("Term 1");
    const [selectedSchoolLevel, setSelectedSchoolLevel] = useState("Primary School");
    
    const academicYears = useMemo(() => Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - 2 + i).toString()), []);
    const terms = ["Term 1", "Term 2", "Term 3"];

    const form = useForm<StructuredFormValues>({
        resolver: zodResolver(structuredTimetableSchema),
        defaultValues: {
            schedule: [],
        },
    });

    const { fields, append, remove, control } = useFieldArray({
        control: form.control,
        name: 'schedule',
    });

    const filteredSubjects = allSubjects.filter(s => s.schoolLevel === selectedSchoolLevel);
    
    const addRow = () => {
        append({
            id: uuidv4(),
            date: new Date(),
            session1_time: '08:00 - 10:00',
            session1_subjectId: '',
            session1_subjectId2: 'none',
            session1_subject1_comments: '',
            session1_subject2_comments: '',
            session2_time: '11:00 - 13:00',
            session2_subjectId: '',
            session2_subjectId2: 'none',
            session2_subject1_comments: '',
            session2_subject2_comments: '',
        });
    };
    
    const onSubmit = async (values: StructuredFormValues) => {
        setIsSubmitting(true);
        try {
            const idToken = await auth.currentUser?.getIdToken(true);
            if (!idToken) throw new Error("Authentication required.");
            
            const payload = {
                ...values,
                academicYear: selectedYear,
                term: selectedTerm,
                schoolLevel: selectedSchoolLevel,
            };

            const result = await createStructuredTimetable(payload, idToken);
            if (result.success) {
                toast({ title: "Success", description: result.message });
                form.reset({ schedule: [] });
            } else {
                throw new Error(result.message);
            }
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <FormProvider {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <Card>
                    <CardHeader><CardTitle>Timetable Details</CardTitle></CardHeader>
                    <CardContent className="grid md:grid-cols-3 gap-4">
                       <FormItem><FormLabel>Academic Year</FormLabel><Select onValueChange={setSelectedYear} defaultValue={selectedYear}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{academicYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select></FormItem>
                       <FormItem><FormLabel>Term</FormLabel><Select onValueChange={setSelectedTerm} defaultValue={selectedTerm}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{terms.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></FormItem>
                       <FormItem><FormLabel>School Level</FormLabel><Select onValueChange={setSelectedSchoolLevel} defaultValue={selectedSchoolLevel}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{schoolLevels.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent></Select></FormItem>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>Schedule</CardTitle>
                                <CardDescription>Add and arrange the exam schedule row by row.</CardDescription>
                            </div>
                             <Button type="button" variant="outline" onClick={addRow}><PlusCircle className="mr-2 h-4 w-4" /> Add Row</Button>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                         {fields.map((field, index) => (
                             <Card key={field.id} className="p-4 space-y-4">
                                <div className="flex justify-between items-start">
                                    <FormField control={control} name={`schedule.${index}.date`} render={({ field }) => (
                                        <FormItem className="flex flex-col"><FormLabel>Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("w-[240px] pl-3 text-left font-normal",!field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP") : (<span>Pick a date</span>)}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>
                                    )}/>
                                     <Button variant="ghost" size="icon" onClick={() => remove(index)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                </div>
                                <div className="grid md:grid-cols-2 gap-x-8 gap-y-4">
                                    {/* Session 1 */}
                                    <div className="p-4 border rounded-md space-y-4">
                                        <h4 className="font-semibold">First Session</h4>
                                        <FormField control={control} name={`schedule.${index}.session1_time`} render={({ field }) => (<FormItem><FormLabel>Time</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                        <FormField control={control} name={`schedule.${index}.session1_subjectId`} render={({ field }) => (<FormItem><FormLabel>Subject 1</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select Subject"/></SelectTrigger></FormControl><SelectContent>{filteredSubjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)}/>
                                        <FormField control={control} name={`schedule.${index}.session1_subject1_comments`} render={({ field }) => (<FormItem><FormLabel>Comments for Subject 1</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)}/>
                                        <FormField control={control} name={`schedule.${index}.session1_subjectId2`} render={({ field }) => (<FormItem><FormLabel>Subject 2 (Parallel)</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select Parallel Subject"/></SelectTrigger></FormControl><SelectContent><SelectItem value="none">None</SelectItem>{filteredSubjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)}/>
                                        <FormField control={control} name={`schedule.${index}.session1_subject2_comments`} render={({ field }) => (<FormItem><FormLabel>Comments for Subject 2</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)}/>
                                    </div>
                                    {/* Session 2 */}
                                     <div className="p-4 border rounded-md space-y-4">
                                        <h4 className="font-semibold">Second Session</h4>
                                        <FormField control={control} name={`schedule.${index}.session2_time`} render={({ field }) => (<FormItem><FormLabel>Time</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                        <FormField control={control} name={`schedule.${index}.session2_subjectId`} render={({ field }) => (<FormItem><FormLabel>Subject 1</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select Subject"/></SelectTrigger></FormControl><SelectContent>{filteredSubjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)}/>
                                        <FormField control={control} name={`schedule.${index}.session2_subject1_comments`} render={({ field }) => (<FormItem><FormLabel>Comments for Subject 1</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)}/>
                                        <FormField control={control} name={`schedule.${index}.session2_subjectId2`} render={({ field }) => (<FormItem><FormLabel>Subject 2 (Parallel)</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select Parallel Subject"/></SelectTrigger></FormControl><SelectContent><SelectItem value="none">None</SelectItem>{filteredSubjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)}/>
                                        <FormField control={control} name={`schedule.${index}.session2_subject2_comments`} render={({ field }) => (<FormItem><FormLabel>Comments for Subject 2</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)}/>
                                    </div>
                                </div>
                             </Card>
                         ))}
                         {form.formState.errors.schedule && <p className="text-sm font-medium text-destructive">{form.formState.errors.schedule.root?.message || form.formState.errors.schedule.message}</p>}
                    </CardContent>
                </Card>
                 <div className="flex justify-end">
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Publish Timetable
                    </Button>
                </div>
            </form>
        </FormProvider>
    )
}

const fileTimetableSchema = z.object({
  academicYear: z.string().min(1, 'Academic Year is required'),
  term: z.string().min(1, 'Term is required'),
  schoolLevel: z.string().min(1, 'School Level is required'),
});

type FileFormValues = z.infer<typeof fileTimetableSchema>;

function UploadTimetableForm() {
    const { user } = useUser();
    const storage = useStorage();
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    const academicYears = useMemo(() => Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - 2 + i).toString()), []);
    const terms = ["Term 1", "Term 2", "Term 3"];

    const form = useForm<FileFormValues>({
        resolver: zodResolver(fileTimetableSchema),
        defaultValues: {
            academicYear: new Date().getFullYear().toString(),
            term: "Term 1",
            schoolLevel: "Primary School",
        }
    });

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
        }
    }

    const clearFile = () => {
        setFile(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    }

    const onSubmit = async (values: FileFormValues) => {
        if (!file || !storage || !user?.subRegionId) {
            toast({ variant: 'destructive', title: 'Error', description: 'Please select a file to upload and ensure you are assigned to a sub-region.' });
            return;
        }

        const idToken = await auth.currentUser?.getIdToken(true);
        if (!idToken) {
            toast({ variant: 'destructive', title: 'Error', description: 'Authentication required.' });
            return;
        }

        setUploading(true);
        setUploadProgress(0);

        const filePath = `timetables/${user.subRegionId}/${values.academicYear}-${values.term}-${file.name}`;
        const storageRef = ref(storage, filePath);
        const uploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                setUploadProgress(progress);
            },
            (error) => {
                console.error("Upload failed:", error);
                toast({ variant: 'destructive', title: 'Upload Failed', description: error.message });
                setUploading(false);
            },
            async () => {
                try {
                    const result = await createFileTimetable({
                        ...values,
                        filePath, // Pass internal storage path to server action
                        fileName: file.name,
                    }, idToken);

                    if (result.success) {
                        toast({ title: 'Success', description: 'Timetable published successfully!' });
                        form.reset();
                        clearFile();
                    } else {
                        throw new Error(result.message);
                    }
                } catch (error: any) {
                    toast({ variant: 'destructive', title: 'Error', description: error.message });
                } finally {
                    setUploading(false);
                }
            }
        );
    };

    return (
        <FormProvider {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Upload Timetable File</CardTitle>
                        <CardDescription>Upload a pre-made timetable file (e.g., PDF, Word, Excel).</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid md:grid-cols-3 gap-4">
                           <FormField control={form.control} name="academicYear" render={({ field }) => (
                               <FormItem><FormLabel>Academic Year</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent>{academicYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                            )}/>
                            <FormField control={form.control} name="term" render={({ field }) => (
                                <FormItem><FormLabel>Term</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent>{terms.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                            )}/>
                            <FormField control={form.control} name="schoolLevel" render={({ field }) => (
                               <FormItem><FormLabel>School Level</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent>{schoolLevels.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                            )}/>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="timetable-file">Timetable File</Label>
                            {file ? (
                                <div className="flex items-center gap-2 p-2 border rounded-md">
                                    <File className="h-5 w-5 text-muted-foreground" />
                                    <span className="text-sm font-medium flex-1 truncate">{file.name}</span>
                                    <Button size="icon" variant="ghost" onClick={clearFile} disabled={uploading}>
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            ) : (
                                <Input id="timetable-file" type="file" onChange={handleFileChange} ref={fileInputRef} disabled={uploading} />
                            )}
                        </div>
                        {uploading && (
                            <div className="space-y-2">
                                <Progress value={uploadProgress} />
                                <p className="text-sm text-muted-foreground text-center">Uploading... {Math.round(uploadProgress)}%</p>
                            </div>
                        )}
                        <div className="flex justify-end">
                            <Button type="submit" disabled={!file || uploading}>
                                {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                                {uploading ? 'Publishing...' : 'Upload & Publish'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </form>
        </FormProvider>
    );
}

const examMaterialSchema = z.object({
  academicYear: z.string().min(1, 'Academic Year is required'),
  term: z.string().min(1, 'Term is required'),
  schoolLevel: z.string().min(1, 'School Level is required'),
  gradeLevel: z.string().min(1, 'Grade Level is required'),
});

type ExamMaterialFormValues = z.infer<typeof examMaterialSchema>;

function UploadExamForm() {
    const { user } = useUser();
    const storage = useStorage();
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [files, setFiles] = useState<File[]>([]);
    const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDragging, setIsDragging] = useState(false);


    const academicYears = useMemo(() => Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - 2 + i).toString()), []);
    const terms = ["Term 1", "Term 2", "Term 3"];

    const form = useForm<ExamMaterialFormValues>({
        resolver: zodResolver(examMaterialSchema),
        defaultValues: {
            academicYear: new Date().getFullYear().toString(),
            term: "Term 1",
            schoolLevel: "Primary School",
            gradeLevel: '',
        }
    });

    const watchedSchoolLevel = form.watch('schoolLevel');
    const availableGradeLevels = gradeLevelsBySchool[watchedSchoolLevel] || [];

    useEffect(() => {
        form.resetField('gradeLevel');
    }, [watchedSchoolLevel, form]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
        }
    };
    
    const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            setFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
        }
    }, []);

    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const onSubmit = async (values: ExamMaterialFormValues) => {
      if (files.length === 0) {
        toast({ variant: 'destructive', title: 'Error', description: 'Please select at least one file to upload.' });
        return;
      }
      if (!storage || !user?.subRegionId) {
        toast({ variant: 'destructive', title: 'Error', description: 'Storage service or user region not available.' });
        return;
      }
    
      const idToken = await auth.currentUser?.getIdToken(true);
      if (!idToken) {
        toast({ variant: 'destructive', title: 'Error', description: 'Authentication required.' });
        return;
      }
    
      setIsSubmitting(true);
      let successCount = 0;
      let errorCount = 0;

      const uploadPromises = files.map(file => {
          const filePath = `exam-materials/${user.subRegionId}/${values.academicYear}-${values.term}/${values.gradeLevel}-${file.name}`;
          const storageRef = ref(storage, filePath);
          const uploadTask = uploadBytesResumable(storageRef, file);

          return new Promise<void>((resolve, reject) => {
             uploadTask.on('state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    setUploadProgress(prev => ({...prev, [file.name]: progress}));
                },
                (error) => {
                    console.error(`Upload failed for ${file.name}:`, error);
                    errorCount++;
                    toast({ variant: 'destructive', title: `Upload Failed for ${file.name}`, description: error.message });
                    reject(error);
                },
                async () => {
                    try {
                        const result = await uploadExamMaterial({ ...values, fileName: file.name, filePath }, idToken);
                        if (result.success) {
                            successCount++;
                            resolve();
                        } else {
                            throw new Error(result.message);
                        }
                    } catch (e: any) {
                        errorCount++;
                        toast({ variant: 'destructive', title: `Error processing ${file.name}`, description: e.message });
                        reject(e);
                    }
                }
             );
          });
      });
      
      await Promise.allSettled(uploadPromises);

      toast({
          title: 'Upload Complete',
          description: `${successCount} of ${files.length} file(s) published successfully. ${errorCount} failed.`
      });

      setIsSubmitting(false);
      setFiles([]);
      setUploadProgress({});
      form.reset();
    };

    return (
         <FormProvider {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Upload Exam Material</CardTitle>
                        <CardDescription>Upload exam papers for a specific grade level. You can drag and drop multiple files.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid md:grid-cols-4 gap-4">
                           <FormField control={form.control} name="academicYear" render={({ field }) => (
                               <FormItem><FormLabel>Academic Year</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent>{academicYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                            )}/>
                            <FormField control={form.control} name="term" render={({ field }) => (
                                <FormItem><FormLabel>Term</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent>{terms.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                            )}/>
                            <FormField control={form.control} name="schoolLevel" render={({ field }) => (
                               <FormItem><FormLabel>School Level</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent>{schoolLevels.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                            )}/>
                            <FormField control={form.control} name="gradeLevel" render={({ field }) => (
                               <FormItem><FormLabel>Grade Level</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={availableGradeLevels.length === 0}><FormControl><SelectTrigger><SelectValue placeholder="Select Grade"/></SelectTrigger></FormControl><SelectContent>{availableGradeLevels.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                            )}/>
                        </div>
                        
                        <div
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            className={cn(
                                "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
                                isDragging ? "border-primary bg-primary/10" : "border-input hover:border-primary/50"
                            )}
                        >
                            <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground" />
                            <p className="mt-2 text-sm text-muted-foreground">
                                Drag & drop files here, or click to select files.
                            </p>
                            <input
                                id="exam-file"
                                type="file"
                                multiple
                                onChange={handleFileChange}
                                ref={fileInputRef}
                                className="hidden"
                                disabled={isSubmitting}
                                accept=".pdf,.doc,.docx,.xls,.xlsx"
                            />
                        </div>

                        {files.length > 0 && (
                            <div className="space-y-2">
                                <Label>Selected Files:</Label>
                                <div className="space-y-2">
                                    {files.map((file, index) => (
                                        <div key={index} className="flex items-center gap-2 p-2 border rounded-md">
                                            <File className="h-5 w-5 text-muted-foreground" />
                                            <span className="text-sm font-medium flex-1 truncate">{file.name}</span>
                                             {uploadProgress[file.name] !== undefined && <Progress value={uploadProgress[file.name]} className="w-1/3 h-2" />}
                                            <Button size="icon" variant="ghost" onClick={() => removeFile(index)} disabled={isSubmitting}>
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end">
                            <Button type="submit" disabled={files.length === 0 || isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {isSubmitting ? 'Publishing...' : `Upload & Publish ${files.length} File(s)`}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </form>
        </FormProvider>
    );
}

interface ExamTimetable {
    id: string;
    academicYear: string;
    term: string;
    schoolLevel: string;
    type: 'file' | 'structured';
    fileUrl?: string;
    fileName?: string;
    schedule?: any[];
}


function ManageTimetablesTab() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    
    const [timetables, setTimetables] = useState<ExamTimetable[]>([]);
    const [loading, setLoading] = useState(true);
    const [timetableToDelete, setTimetableToDelete] = useState<ExamTimetable | null>(null);

    useEffect(() => {
        if (!firestore || !user?.subRegionId) {
            setLoading(false);
            return;
        }

        const q = query(collection(firestore, 'examTimetables'), where('subRegionId', '==', user.subRegionId));
        const unsub = onSnapshot(q, (snap) => {
            const data = snap.docs.map(d => ({id: d.id, ...d.data()} as ExamTimetable));
            setTimetables(data);
            setLoading(false);
        }, () => setLoading(false));

        return () => unsub();
    }, [firestore, user?.subRegionId]);
    
    const academicYears = useMemo(() => {
        const years = new Set(timetables.map(t => t.academicYear));
        return Array.from(years).sort((a,b) => b.localeCompare(a));
    }, [timetables]);

    const handleDelete = async () => {
        if (!timetableToDelete) return;
        try {
            const idToken = await auth.currentUser?.getIdToken();
            if (!idToken) throw new Error("Authentication failed");
            const result = await deleteTimetable(timetableToDelete.id, idToken);
            if (result.success) {
                toast({ title: 'Success', description: 'Timetable deleted.' });
            } else {
                throw new Error(result.message);
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        } finally {
            setTimetableToDelete(null);
        }
    };
    
    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>Manage Published Timetables</CardTitle>
                    <CardDescription>View, edit, or delete timetables you have created.</CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center p-10"><Loader2 className="h-8 w-8 animate-spin" /></div>
                    ) : timetables.length === 0 ? (
                        <p className="text-center text-muted-foreground">No timetables have been published yet.</p>
                    ) : (
                        <Tabs defaultValue={academicYears[0]} className="w-full">
                            <TabsList>
                                {academicYears.map(year => <TabsTrigger key={year} value={year}>{year}</TabsTrigger>)}
                            </TabsList>
                             {academicYears.map(year => (
                                <TabsContent key={year} value={year} className="mt-4">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Term</TableHead>
                                                <TableHead>School Level</TableHead>
                                                <TableHead>Type</TableHead>
                                                <TableHead className="text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {timetables.filter(t => t.academicYear === year).map(tt => (
                                                <TableRow key={tt.id}>
                                                    <TableCell>{tt.term}</TableCell>
                                                    <TableCell>{tt.schoolLevel}</TableCell>
                                                    <TableCell>{tt.type}</TableCell>
                                                    <TableCell className="text-right">
                                                         <Button variant="destructive" size="sm" onClick={() => setTimetableToDelete(tt)}>
                                                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                                                         </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TabsContent>
                             ))}
                        </Tabs>
                    )}
                </CardContent>
            </Card>

            <AlertDialog open={!!timetableToDelete} onOpenChange={() => setTimetableToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                           This will permanently delete the timetable for {timetableToDelete?.schoolLevel} - {timetableToDelete?.term}, {timetableToDelete?.academicYear}. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}


export default function ExamManagementPage() {
    const firestore = useFirestore();
    const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
    const [loadingSubjects, setLoadingSubjects] = useState(true);

    useEffect(() => {
        if (!firestore) {
            setLoadingSubjects(false);
            return;
        }
        setLoadingSubjects(true);
        const q = query(collection(firestore, 'subjects'));
        const unsub = onSnapshot(q, (snap) => {
            const subjects = snap.docs.map(d => ({ ...d.data(), id: d.id } as Subject));
            setAllSubjects(subjects);
            setLoadingSubjects(false);
        }, (error) => {
            console.error('Error fetching subjects:', error);
            setLoadingSubjects(false);
        });
        return () => unsub();
    }, [firestore]);
    

    return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold tracking-tight">Exam Management</h2>
      <Tabs defaultValue="design" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="design">Design Timetable</TabsTrigger>
            <TabsTrigger value="upload">Upload Timetable</TabsTrigger>
            <TabsTrigger value="exams">Upload Exams</TabsTrigger>
            <TabsTrigger value="manage">Manage Timetables</TabsTrigger>
        </TabsList>
        <TabsContent value="design" className="mt-6">
            {loadingSubjects ? <div className="flex justify-center p-10"><Loader2 className="h-8 w-8 animate-spin"/></div> : <DesignTimetableForm allSubjects={allSubjects} />}
        </TabsContent>
        <TabsContent value="upload" className="mt-6">
            <UploadTimetableForm />
        </TabsContent>
        <TabsContent value="exams" className="mt-6">
            <UploadExamForm />
        </TabsContent>
         <TabsContent value="manage" className="mt-6">
            <ManageTimetablesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}