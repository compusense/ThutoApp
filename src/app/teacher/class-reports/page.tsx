
'use client';

import * as React from 'react';
import { useMemo, useState } from 'react';
import { useUser, UserProfile } from '@/firebase/auth/use-user';
import { useFirestore } from '@/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, FileText, Printer, Wand2, Copy, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Class } from '@/app/school-head/classes/page';
import {
  generateClassReport,
  generateComprehensiveReport,
  saveNarrativeReport,
  getNarrativeReport,
  ClassReportData,
} from './actions';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { formatTeacherName } from '@/lib/utils';
import { Label } from '@/components/ui/label';

export default function MyClassReportsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [classes, setClasses] = useState<Class[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Filters
  const academicYears = useMemo(
    () =>
      Array.from({ length: 5 }, (_, i) =>
        (new Date().getFullYear() - 2 + i).toString()
      ),
    []
  );
  const [selectedYear, setSelectedYear] = useState<string>(
    new Date().getFullYear().toString()
  );
  const terms = ['Term 1', 'Term 2', 'Term 3'] as const;
  type Term = (typeof terms)[number];
  const [selectedTerm, setSelectedTerm] = useState<Term>(terms[0]);
  const [selectedClass, setSelectedClass] = useState<string>('');

  // Report State
  const [reportData, setReportData] = useState<ClassReportData | null>(null);
  const [reportText, setReportText] = useState('');

  // Define a unique key for local storage
  const getStorageKey = React.useCallback(() => {
    if (!user || !selectedClass || !selectedYear || !selectedTerm) return null;
    return `thuto-narrative-report-${user.uid}-${selectedClass}-${selectedYear}-${selectedTerm}`;
  }, [user, selectedClass, selectedYear, selectedTerm]);

  // Fetch teacher's classes
  React.useEffect(() => {
    if (!firestore || !user?.schoolId || !user.uid) return;
    setLoadingClasses(true);
    const q = query(
      collection(firestore, 'schools', user.schoolId, 'classes'),
      where('teacherId', '==', user.uid)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const fetchedClasses = snap.docs
          .map((doc) => ({ ...(doc.data() as Class), id: doc.id }))
          .sort((a, b) => a.name.localeCompare(b.name));
        setClasses(fetchedClasses);
        setLoadingClasses(false);
      },
      (error) => {
        console.error('Error fetching classes:', error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Could not fetch your classes.',
        });
        setLoadingClasses(false);
      }
    );
    return () => unsub();
  }, [firestore, user?.schoolId, user?.uid, toast]);

  // Auto-save to localStorage
  React.useEffect(() => {
    const storageKey = getStorageKey();
    if (storageKey && reportText) {
      localStorage.setItem(storageKey, reportText);
    }
  }, [reportText, getStorageKey]);

  // Load from database and/or localStorage
  const loadReportData = React.useCallback(async () => {
    if (!user?.schoolId || !selectedClass || !selectedYear || !selectedTerm) return;
  
    setIsLoading(true);
    setReportData(null);
    setReportText(''); // Clear previous text
  
    try {
      // 1. Fetch the main student/mark data
      const reportResult = await generateClassReport({
        schoolId: user.schoolId,
        classId: selectedClass,
        academicYear: selectedYear,
        term: selectedTerm,
      });
  
      if (reportResult.success && reportResult.data) {
        setReportData(reportResult.data);
        if (reportResult.data.studentReports.length === 0) {
          toast({
            title: 'No Data',
            description: 'No end of term marks found for this class and period.',
          });
        }
  
        // 2. Fetch the report saved in the database
        const savedReportResult = await getNarrativeReport({
          schoolId: user.schoolId,
          classId: selectedClass,
          academicYear: selectedYear,
          term: selectedTerm,
        });
  
        // 3. Check for a local draft
        const storageKey = getStorageKey();
        const localDraft = storageKey ? localStorage.getItem(storageKey) : null;
  
        // 4. Set the text: local draft > saved DB report > empty string
        if (localDraft) {
          setReportText(localDraft);
        } else if (savedReportResult.success && savedReportResult.reportText) {
          setReportText(savedReportResult.reportText);
        }
  
      } else {
        throw new Error(reportResult.message || 'Failed to generate report.');
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error Generating Report',
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  }, [user?.schoolId, selectedClass, selectedYear, selectedTerm, toast, getStorageKey]);


  const handleLoadResults = () => {
    loadReportData();
  }
  
  // Reload data if dependencies change
  React.useEffect(() => {
    if (selectedClass && selectedYear && selectedTerm) {
      loadReportData();
    }
  }, [selectedClass, selectedYear, selectedTerm, loadReportData]);


  const handleGenerateAIReport = async () => {
    if (!reportData) return;
    setIsGeneratingAi(true);
    try {
      const result = await generateComprehensiveReport(reportData);
      if (result.success && result.report) {
        setReportText(result.report);
        toast({
          title: 'AI Report Generated',
          description: 'The comprehensive report has been generated.',
        });
      } else {
        throw new Error(result.message || 'The AI failed to generate a report.');
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'AI Generation Failed',
        description: error.message,
      });
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleSaveReport = async () => {
    if (!reportData || !user?.schoolId) {
        toast({ variant: 'destructive', title: 'No Data Loaded', description: 'Please load class results before saving.' });
        return;
    }
    setIsSaving(true);
    try {
        const result = await saveNarrativeReport({
            schoolId: user.schoolId,
            classId: reportData.classData.id,
            academicYear: reportData.academicYear,
            term: reportData.term,
            reportText: reportText
        });
        if (result.success) {
            toast({ title: 'Success', description: 'Your report has been saved.' });
            // Clear local storage on successful save
            const storageKey = getStorageKey();
            if (storageKey) {
                localStorage.removeItem(storageKey);
            }
        } else {
            throw new Error(result.message);
        }
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Save Failed', description: error.message });
    } finally {
        setIsSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCopy = () => {
    if (!reportText) {
        toast({ variant: 'destructive', title: 'Nothing to Copy', description: 'The report is empty.' });
        return;
    }
    navigator.clipboard.writeText(reportText);
    toast({ title: 'Copied!', description: 'The report narrative has been copied to your clipboard.' });
  };

  return (
    <div className="space-y-6">
      <div className="printable-hidden flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            My Class Reports
          </h2>
          <p className="text-muted-foreground">
            Write comprehensive narrative reports for your class.
          </p>
        </div>
      </div>

      <Card className="printable-hidden">
        <CardHeader>
          <CardTitle>Select Report Period</CardTitle>
          <CardDescription>
            Choose a class and term to load the end-of-term performance data.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <Select
              value={selectedClass}
              onValueChange={setSelectedClass}
              disabled={loadingClasses}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={loadingClasses ? 'Loading...' : 'Select Class'}
                />
              </SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger>
                <SelectValue placeholder="Select Year" />
              </SelectTrigger>
              <SelectContent>
                {academicYears.map((y) => (
                  <SelectItem key={y} value={y}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={selectedTerm}
              onValueChange={(v) => setSelectedTerm(v as Term)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Term" />
              </SelectTrigger>
              <SelectContent>
                {terms.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleLoadResults} disabled={isLoading || !selectedClass}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Load Results
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      )}

      {reportData && (
        <div className="printable-area">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>Comprehensive Class Report</CardTitle>
                  <CardDescription>
                    {reportData.classData.name} - {selectedTerm}, {selectedYear}
                  </CardDescription>
                </div>
                <div className="printable-hidden flex items-center space-x-2">
                  <Button
                    onClick={handleGenerateAIReport}
                    disabled={isGeneratingAi}
                  >
                    <Wand2 className="mr-2 h-4 w-4" />
                    {isGeneratingAi
                      ? 'Generating...'
                      : 'Generate with AI'}
                  </Button>
                  <Button onClick={handleSaveReport} disabled={isSaving}>
                      <Save className="mr-2 h-4 w-4" />
                      {isSaving ? 'Saving...' : 'Save Report'}
                  </Button>
                  <Button onClick={handleCopy} variant="outline">
                    <Copy className="mr-2 h-4 w-4" /> Copy
                  </Button>
                  <Button onClick={handlePrint} variant="outline">
                    <Printer className="mr-2 h-4 w-4" /> Print
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="report-text">Report Narrative</Label>
                  <Textarea
                    id="report-text"
                    placeholder="Type your report here, or generate one with AI."
                    value={reportText}
                    onChange={(e) => setReportText(e.target.value)}
                    className="min-h-[50vh]"
                  />
                </div>
                <div className="text-xs text-muted-foreground pt-4 border-t">
                  <p className="font-bold">TEACHER: {formatTeacherName(user)}</p>
                  <p className="font-bold">DATE: {new Date().toLocaleDateString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

       {!isLoading && !reportData && (
          <Card>
            <CardContent className="py-20 text-center text-muted-foreground">
              <FileText className="mx-auto h-12 w-12" />
              <h3 className="mt-4 text-lg font-semibold">Load Class Results</h3>
              <p className="mt-1 text-sm">
                Select a class and period to load performance data before
                writing your report.
              </p>
            </CardContent>
          </Card>
        )}
    </div>
  );
}
