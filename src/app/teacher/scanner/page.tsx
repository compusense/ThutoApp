
'use client';

import * as React from 'react';
import { useUser } from '@/firebase/auth/use-user';
import { useFirestore, auth } from '@/firebase';
import { collection, query, where, onSnapshot, getDocs, doc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
    Loader2, 
    UploadCloud, 
    Upload,
    FileText, 
    CheckCircle2, 
    XCircle, 
    Plus, 
    Trash2, 
    Save, 
    ScanLine,
    AlertCircle,
    X,
    Lightbulb,
    Eye
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Class } from '@/app/school-head/classes/page';
import { Subject } from '@/app/super-admin/subjects/page';
import { Student } from '@/app/school-head/students/page';
import { processMarkingBatch, saveScannedMarksToRegistry } from './actions';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Image from 'next/image';

interface MarkingKeyItem {
    questionNumber: number;
    correctAnswer: string;
}

interface ScanResult {
    studentName?: string;
    detectedAnswers: {
        questionNumber: number;
        selectedAnswer: string;
        isCorrect: boolean;
    }[];
    totalScore: number;
    maxScore: number;
    status: 'success' | 'error';
    message?: string;
    matchedStudentId?: string; // Manually or AI matched
    originalImage?: string; // Base64 for review
}

const assessmentsByTerm: Record<string, string[]> = {
  "Term 1": ["January Test", "February Test", "March Test", "End of Term 1"],
  "Term 2": ["May Test", "June Test", "July Test", "End of Term 2"],
  "Term 3": ["September Test", "October Test", "November Test", "End of Term 3"],
};

export default function AIScannerPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const router = useRouter();

    // Context State
    const [classes, setClasses] = React.useState<Class[]>([]);
    const [invigilatedClassIds, setInvigilatedClassIds] = React.useState<Set<string>>(new Set());
    const [subjects, setSubjects] = React.useState<Subject[]>([]);
    const [students, setStudents] = React.useState<Student[]>([]);
    const [loadingContext, setLoadingContext] = React.useState(true);

    // Filter State
    const academicYears = React.useMemo(() => Array.from({ length: 5 }, (_, i) => (2024 + i).toString()), []);
    const [selectedYear, setSelectedYear] = React.useState("2026");
    const [selectedTerm, setSelectedTerm] = React.useState<"Term 1" | "Term 2" | "Term 3">("Term 1");
    const [selectedClass, setSelectedClass] = React.useState("");
    const [selectedSubject, setSelectedSubject] = React.useState("");
    const [selectedAssessment, setSelectedAssessment] = React.useState("");

    // Marking Key State
    const [markingKey, setMarkingKey] = React.useState<MarkingKeyItem[]>([]);
    
    // Upload State
    const [files, setFiles] = React.useState<File[]>([]);
    const [isProcessing, setIsProcessing] = React.useState(false);
    const [scanResults, setScanResults] = React.useState<ScanResult[]>([]);
    const [isSaving, setIsSaving] = React.useState(false);
    const [reviewIndex, setReviewIndex] = React.useState<number | null>(null);

    // Load initial context (Owned Classes and Invigilations) for CURRENT active period
    React.useEffect(() => {
        if (!firestore || !user?.schoolId || !user.uid) return;

        setLoadingContext(true);
        setClasses([]);
        setInvigilatedClassIds(new Set());
        
        const unsubs: (() => void)[] = [];

        // 1. Owned Classes - Filtered by selectedYear
        const ownedQuery = query(
            collection(firestore, 'schools', user.schoolId, 'classes'), 
            where('teacherId', '==', user.uid),
            where('academicYear', '==', selectedYear)
        );
        const unsubOwned = onSnapshot(ownedQuery, (snap) => {
            const owned = snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Class));
            setClasses(prev => {
                const other = prev.filter(c => !snap.docs.some(d => d.id === c.id));
                const combined = [...other, ...owned];
                return combined.sort((a,b) => a.name.localeCompare(b.name));
            });
        });
        unsubs.push(unsubOwned);

        // 2. Invigilations - Filtered by selectedYear and selectedTerm
        const invigQuery = query(
            collection(firestore, 'schools', user.schoolId, 'invigilations'), 
            where('teacherId', '==', user.uid),
            where('academicYear', '==', selectedYear),
            where('term', '==', selectedTerm)
        );
        const unsubInvig = onSnapshot(invigQuery, async (snap) => {
            const ids = new Set<string>();
            snap.docs.forEach(d => ids.add(d.data().classId));
            setInvigilatedClassIds(ids);

            if (ids.size > 0) {
                const classesRef = collection(firestore, 'schools', user.schoolId!, 'classes');
                const idsArray = Array.from(ids);
                const chunks = [];
                for (let i = 0; i < idsArray.length; i += 30) {
                    chunks.push(idsArray.slice(i, i + 30));
                }

                for (const chunk of chunks) {
                    const q = query(classesRef, where('__name__', 'in', chunk));
                    const docs = await getDocs(q);
                    const invigilatedClasses = docs.docs.map(doc => ({ ...doc.data(), id: doc.id } as Class));
                    setClasses(prev => {
                        const other = prev.filter(c => !docs.docs.some(d => d.id === c.id));
                        const combined = [...other, ...invigilatedClasses];
                        return combined.sort((a,b) => a.name.localeCompare(b.name));
                    });
                }
            }
            setLoadingContext(false);
        });
        unsubs.push(unsubInvig);

        return () => unsubs.forEach(u => u());
    }, [firestore, user, selectedYear, selectedTerm]);

    // Load subjects and students when class is selected
    React.useEffect(() => {
        if (!firestore || !user?.schoolId || !selectedClass) {
            setSubjects([]);
            setStudents([]);
            return;
        }

        const fetchClassContext = async () => {
            // Subjects
            const subQuery = query(collection(firestore, `schools/${user.schoolId}/classes/${selectedClass}/subjects`), where('academicYear', '==', selectedYear));
            const subSnap = await getDocs(subQuery);
            const subIds = subSnap.docs.map(d => d.data().subjectId);
            
            if (subIds.length > 0) {
                const masterSubSnap = await getDocs(query(collection(firestore, 'subjects'), where('__name__', 'in', subIds)));
                setSubjects(masterSubSnap.docs.map(d => ({ ...d.data(), id: d.id } as Subject)));
            } else {
                setSubjects([]);
            }

            // Students
            const stuQuery = query(collection(firestore, `schools/${user.schoolId}/students`), where('classId', '==', selectedClass));
            const stuSnap = await getDocs(stuQuery);
            setStudents(stuSnap.docs.map(d => ({ ...d.data(), id: d.id, fullName: `${d.data().firstName} ${d.data().surname}` } as Student)));
        };

        fetchClassContext();
    }, [firestore, user, selectedClass, selectedYear]);

    const filteredAssessments = React.useMemo(() => {
        const base = assessmentsByTerm[selectedTerm] || [];
        const selectedClassData = classes.find(c => c.id === selectedClass);
        const isInvigilatedOnly = invigilatedClassIds.has(selectedClass) && selectedClassData?.teacherId !== user?.uid;
        
        if (isInvigilatedOnly) {
            // Invigilators typically only handle End of Term exams
            return base.filter(a => a.startsWith('End of'));
        }
        return base;
    }, [selectedTerm, selectedClass, invigilatedClassIds, classes, user?.uid]);

    const addQuestion = () => {
        setMarkingKey(prev => [...prev, { questionNumber: prev.length + 1, correctAnswer: 'A' }]);
    };

    const removeQuestion = (index: number) => {
        setMarkingKey(prev => {
            const updated = prev.filter((_, i) => i !== index);
            return updated.map((item, i) => ({ ...item, questionNumber: i + 1 }));
        });
    };

    const handleKeyChange = (index: number, value: string) => {
        setMarkingKey(prev => prev.map((item, i) => i === index ? { ...item, correctAnswer: value.toUpperCase() } : item));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
        }
    };

    const convertToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = error => reject(error);
        });
    };

    const handleProcessBatch = async () => {
        if (files.length === 0 || markingKey.length === 0) {
            toast({ variant: 'destructive', title: 'Missing Data', description: 'Please provide both marking key and scans.' });
            return;
        }

        setIsProcessing(true);
        setScanResults([]);

        try {
            const idToken = await auth.currentUser?.getIdToken();
            if (!idToken) throw new Error("Authentication failed.");

            const base64Images = await Promise.all(files.map(file => convertToBase64(file)));

            const result = await processMarkingBatch({
                schoolId: user!.schoolId!,
                classId: selectedClass,
                subjectId: selectedSubject,
                academicYear: selectedYear,
                term: selectedTerm,
                assessment: selectedAssessment,
                markingKey,
                images: base64Images,
            }, idToken);

            if (result.success && result.data) {
                // Try to auto-match students by name
                const processedResults = result.data.map((res, i) => {
                    if (res.status === 'error') return res;
                    const matchedStudent = students.find(s => 
                        s.fullName?.toLowerCase().includes(res.studentName?.toLowerCase() || '~~~~')
                    );
                    return { ...res, matchedStudentId: matchedStudent?.id || '', originalImage: base64Images[i] };
                });
                setScanResults(processedResults as ScanResult[]);
                toast({ title: 'Batch Processed', description: `AI has finished marking ${files.length} sheets.` });
            } else {
                throw new Error(result.message);
            }
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Process Failed', description: error.message });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSaveResults = async () => {
        const readyToSave = scanResults.filter(r => r.status === 'success' && r.matchedStudentId);
        if (readyToSave.length === 0) {
            toast({ variant: 'destructive', title: 'No valid results', description: 'Please ensure students are matched correctly.' });
            return;
        }

        setIsSaving(true);
        try {
            const idToken = await auth.currentUser?.getIdToken();
            if (!idToken) throw new Error("Authentication required.");

            const result = await saveScannedMarksToRegistry({
                schoolId: user!.schoolId!,
                classId: selectedClass,
                subjectId: selectedSubject,
                academicYear: selectedYear,
                term: selectedTerm,
                assessment: selectedAssessment,
                results: readyToSave.map(r => ({
                    studentId: r.matchedStudentId!,
                    score: r.totalScore,
                    total: r.maxScore,
                }))
            }, idToken);

            if (result.success) {
                toast({ title: 'Success', description: result.message });
                router.push(`/teacher/my-classes/${selectedClass}/marks?assessment=${encodeURIComponent(selectedAssessment)}&term=${selectedTerm}&year=${selectedYear}`);
            } else {
                throw new Error(result.message);
            }
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Save Failed', description: error.message });
        } finally {
            setIsSaving(false);
        }
    };

    if (loadingContext) {
        return <div className="flex justify-center p-10"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    const currentReview = reviewIndex !== null ? scanResults[reviewIndex] : null;

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">AI Mark Sheet Scanner</h2>
                <p className="text-muted-foreground">Upload scanned answer sheets and a marking key to automatically grade multiple choice exams.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Step 1: Configuration */}
                <div className="lg:col-span-1 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <FileText className="h-5 w-5 text-primary" />
                                1. Session Details
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Academic Year</Label>
                                <Select value={selectedYear} onValueChange={(val) => {
                                    setSelectedYear(val);
                                    setSelectedClass("");
                                    setSelectedAssessment("");
                                }}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>{academicYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Term</Label>
                                <Select value={selectedTerm} onValueChange={(v: any) => {
                                    setSelectedTerm(v);
                                    setSelectedAssessment("");
                                }}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Term 1">Term 1</SelectItem>
                                        <SelectItem value="Term 2">Term 2</SelectItem>
                                        <SelectItem value="Term 3">Term 3</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Class</Label>
                                <Select value={selectedClass} onValueChange={setSelectedClass}>
                                    <SelectTrigger><SelectValue placeholder={classes.length === 0 ? "No active classes found" : "Select Class"} /></SelectTrigger>
                                    <SelectContent>
                                        {classes.map(c => {
                                            const isInvigilated = invigilatedClassIds.has(c.id) && c.teacherId !== user?.uid;
                                            return (
                                                <SelectItem key={c.id} value={c.id}>
                                                    {c.name} {isInvigilated ? '(Invigilating)' : ''}
                                                </SelectItem>
                                            );
                                        })}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Subject</Label>
                                <Select value={selectedSubject} onValueChange={setSelectedSubject} disabled={!selectedClass}>
                                    <SelectTrigger><SelectValue placeholder={subjects.length === 0 && selectedClass ? "No subjects allocated" : "Select Subject"} /></SelectTrigger>
                                    <SelectContent>{subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Assessment</Label>
                                <Select value={selectedAssessment} onValueChange={setSelectedAssessment} disabled={!selectedTerm || filteredAssessments.length === 0}>
                                    <SelectTrigger><SelectValue placeholder={filteredAssessments.length === 0 ? "No valid assessments" : "Select Assessment"} /></SelectTrigger>
                                    <SelectContent>{filteredAssessments.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <CheckCircle2 className="h-5 w-5 text-primary" />
                                2. Marking Key
                            </CardTitle>
                            <CardDescription>Enter the correct options for each question.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <ScrollArea className="h-[300px] border rounded-md p-2">
                                {markingKey.length === 0 ? (
                                    <p className="text-center text-muted-foreground py-10">Add questions to build your key.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {markingKey.map((item, index) => (
                                            <div key={index} className="flex items-center gap-2">
                                                <div className="w-10 font-bold text-sm">Q{item.questionNumber}</div>
                                                <Input 
                                                    className="flex-1 uppercase" 
                                                    maxLength={5}
                                                    value={item.correctAnswer} 
                                                    onChange={(e) => handleKeyChange(index, e.target.value)}
                                                />
                                                <Button size="icon" variant="ghost" onClick={() => removeQuestion(index)}>
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </ScrollArea>
                            <Button variant="outline" className="w-full" onClick={addQuestion}>
                                <Plus className="h-4 w-4 mr-2" /> Add Question
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                {/* Step 2: Upload and Processing */}
                <div className="lg:col-span-2 space-y-6">
                    <Alert className="bg-blue-50 border-blue-200 text-blue-800">
                        <Lightbulb className="h-4 w-4" />
                        <AlertTitle>Tips for Best Results</AlertTitle>
                        <AlertDescription className="text-xs space-y-1 mt-1">
                            <p>• Ensure students write their names clearly at the top.</p>
                            <p>• Take photos directly from above in good lighting.</p>
                            <p>• Use standard MCQ formats (A, B, C, D) for highest accuracy.</p>
                        </AlertDescription>
                    </Alert>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <UploadCloud className="h-5 w-5 text-primary" />
                                3. Upload Scans
                            </CardTitle>
                            <CardDescription>Select the batch of student answer sheets to mark.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div 
                                    className="border-2 border-dashed rounded-lg p-10 flex flex-col items-center justify-center cursor-pointer hover:border-primary transition-colors"
                                    onClick={() => document.getElementById('sheet-upload')?.click()}
                                >
                                    <Upload className="h-10 w-10 text-muted-foreground mb-2" />
                                    <p className="text-sm font-medium">Select Images</p>
                                    <input 
                                        id="sheet-upload" 
                                        type="file" 
                                        multiple 
                                        accept="image/*" 
                                        className="hidden" 
                                        onChange={handleFileChange}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Queue ({files.length} files)</Label>
                                    <ScrollArea className="h-24 border rounded-md p-2">
                                        {files.map((f, i) => (
                                            <div key={i} className="flex justify-between items-center text-xs py-1">
                                                <span className="truncate">{f.name}</span>
                                                <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => setFiles(files.filter((_, idx) => idx !== i))}>
                                                    <X className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        ))}
                                    </ScrollArea>
                                </div>
                            </div>
                            <Button 
                                className="w-full h-12" 
                                size="lg" 
                                disabled={isProcessing || files.length === 0 || markingKey.length === 0 || !selectedAssessment}
                                onClick={handleProcessBatch}
                            >
                                {isProcessing ? (
                                    <>
                                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                        Processing Batch...
                                    </>
                                ) : (
                                    <>
                                        <ScanLine className="mr-2 h-5 w-5" />
                                        Start AI Marking
                                    </>
                                )}
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Results Review */}
                    {(scanResults.length > 0 || isProcessing) && (
                        <Card>
                            <CardHeader>
                                <div className="flex justify-between items-center">
                                    <div>
                                        <CardTitle>AI Analysis Results</CardTitle>
                                        <CardDescription>Review detected scores and match with students. Click a row to verify AI accuracy.</CardDescription>
                                    </div>
                                    {scanResults.length > 0 && (
                                        <Button onClick={handleSaveResults} disabled={isSaving || isProcessing}>
                                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                            Save to Registry
                                        </Button>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="rounded-md border overflow-hidden">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>AI Detected Name</TableHead>
                                                <TableHead>Match Student</TableHead>
                                                <TableHead className="text-center">Score</TableHead>
                                                <TableHead className="text-center">Status</TableHead>
                                                <TableHead className="text-right">Review</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {scanResults.map((res, i) => (
                                                <TableRow 
                                                    key={i} 
                                                    className={cn(res.status === 'success' && "cursor-pointer hover:bg-muted/50")}
                                                    onClick={() => res.status === 'success' && setReviewIndex(i)}
                                                >
                                                    <TableCell className="font-medium">
                                                        {res.studentName || <span className="text-muted-foreground">Not detected</span>}
                                                    </TableCell>
                                                    <TableCell onClick={(e) => e.stopPropagation()}>
                                                        <Select 
                                                            value={res.matchedStudentId} 
                                                            onValueChange={(val) => {
                                                                const newResults = [...scanResults];
                                                                newResults[i].matchedStudentId = val;
                                                                setScanResults(newResults);
                                                            }}
                                                        >
                                                            <SelectTrigger className="w-[200px]">
                                                                <SelectValue placeholder="Select Student" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {students.map(s => <SelectItem key={s.id} value={s.id}>{s.fullName}</SelectItem>)}
                                                            </SelectContent>
                                                        </Select>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        {res.status === 'success' ? `${res.totalScore} / ${res.maxScore}` : '-'}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        {res.status === 'success' ? (
                                                            <div className="flex items-center justify-center text-green-600">
                                                                <CheckCircle2 className="h-5 w-5" />
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center justify-center text-destructive" title={res.message}>
                                                                <XCircle className="h-5 w-5" />
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {res.status === 'success' && (
                                                            <Button size="icon" variant="ghost">
                                                                <Eye className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            {isProcessing && (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="h-24 text-center">
                                                        <div className="flex flex-col items-center gap-2">
                                                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                                            <p className="text-sm text-muted-foreground animate-pulse">AI is looking at your sheets...</p>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                                {scanResults.length > 0 && (
                                    <div className="mt-4 p-4 bg-muted rounded-lg flex items-start gap-3">
                                        <AlertCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                                        <p className="text-xs text-muted-foreground leading-relaxed">
                                            AI detection is optimized for standard answer sheet formats. Click on any row to verify that the AI correctly identified the student's name and choices.
                                        </p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>

            {/* Review Modal */}
            <Dialog open={reviewIndex !== null} onOpenChange={(open) => !open && setReviewIndex(null)}>
                <DialogContent className="max-w-5xl h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Verify AI Analysis</DialogTitle>
                        <DialogDescription>Compare the scanned sheet with the detected answers.</DialogDescription>
                    </DialogHeader>
                    {currentReview && (
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 overflow-hidden min-h-0 py-4">
                            <div className="relative border rounded-lg overflow-hidden bg-black flex items-center justify-center">
                                {currentReview.originalImage && (
                                    <img 
                                        src={currentReview.originalImage} 
                                        alt="Scan" 
                                        className="max-w-full max-h-full object-contain"
                                    />
                                )}
                            </div>
                            <div className="flex flex-col space-y-4 overflow-hidden">
                                <div className="p-4 bg-muted rounded-lg">
                                    <h4 className="font-bold mb-1">Detected Name:</h4>
                                    <p className={cn("text-lg", !currentReview.studentName && "text-muted-foreground italic")}>
                                        {currentReview.studentName || "Not detected"}
                                    </p>
                                    <div className="mt-2 text-2xl font-bold text-primary">
                                        Score: {currentReview.totalScore} / {currentReview.maxScore}
                                    </div>
                                </div>
                                <ScrollArea className="flex-1 pr-4">
                                    <div className="space-y-2">
                                        {currentReview.detectedAnswers.map((ans, idx) => (
                                            <div key={idx} className={cn(
                                                "flex items-center justify-between p-3 rounded-lg border",
                                                ans.isCorrect ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
                                            )}>
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center font-bold text-sm">
                                                        {ans.questionNumber}
                                                    </div>
                                                    <div>
                                                        <span className="text-sm font-medium">Selected: </span>
                                                        <span className="font-bold text-lg">{ans.selectedAnswer || '-'}</span>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-xs text-muted-foreground block">Correct Key</span>
                                                    <span className="font-bold">{markingKey.find(k => k.questionNumber === ans.questionNumber)?.correctAnswer}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
