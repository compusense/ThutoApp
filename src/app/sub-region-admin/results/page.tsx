'use client';

import * as React from 'react';
import { useMemo, useState, useEffect } from 'react';
import { useUser } from '@/firebase/auth/use-user';
import { useFirestore } from '@/firebase';
import { collection, onSnapshot, query, where, FirestoreError } from 'firebase/firestore';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ArrowLeft, Printer } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { School } from '@/app/super-admin/schools/page';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { generateSubRegionSchoolSummary, generateSchoolClassSummary, SubRegionSchoolSummaryReport, SchoolClassSummaryReport } from './actions';
import { SchoolSummaryReport } from './components/school-summary-report';
import { ClassSummaryReport } from './components/class-summary-report';

const assessmentsByTerm: Record<string, string[]> = {
  "Term 1": ["January Test", "February Test", "March Test", "End of Term 1"],
  "Term 2": ["May Test", "June Test", "July Test", "End of Term 2"],
  "Term 3": ["September Test", "October Test", "November Test", "End of Term 3"],
};

type ViewLevel = 'subregion' | 'school';

export default function SubRegionResultsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [schools, setSchools] = useState<School[]>([]);

  // Filter state
  const academicYears = useMemo(() => Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - 2 + i).toString()), []);
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const terms = ["Term 1", "Term 2", "Term 3"] as const;
  type Term = typeof terms[number];
  const [selectedTerm, setSelectedTerm] = useState<Term>(terms[0]);
  const [selectedAssessment, setSelectedAssessment] = useState<string>('');

  // Drill-down state
  const [viewLevel, setViewLevel] = useState<ViewLevel>('subregion');
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('');

  // Report data state
  const [subRegionReport, setSubRegionReport] = useState<SubRegionSchoolSummaryReport | null>(null);
  const [schoolReport, setSchoolReport] = useState<SchoolClassSummaryReport | null>(null);

  // Breadcrumbs state
  const [breadcrumbs, setBreadcrumbs] = useState<string[]>(['Sub-Region Summary']);

  useEffect(() => {
    if (!firestore || !user?.subRegionId) return;

    const q = query(collection(firestore, 'schools'), where('subRegionId', '==', user.subRegionId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSchools(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as School)));
    }, (err: FirestoreError) => {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch schools in your sub-region.' });
    });

    return () => unsubscribe();
  }, [firestore, user?.subRegionId, toast]);

  const resetViews = () => {
    setSubRegionReport(null);
    setSchoolReport(null);
    setViewLevel('subregion');
    setSelectedSchoolId('');
    setBreadcrumbs(['Sub-Region Summary']);
  };

  const handleTermChange = (termValue: string) => {
    const term = termValue as Term;
    setSelectedTerm(term);
    setSelectedAssessment('');
    resetViews();
  };

  const handleYearChange = (year: string) => {
    setSelectedYear(year);
    resetViews();
  };

  const handleAssessmentChange = (assessment: string) => {
    setSelectedAssessment(assessment);
    resetViews();
  };

  const handleGenerateSubRegionReport = async () => {
    if (!user?.subRegionId) return;
    setLoading(true);
    resetViews();
    try {
      const result = await generateSubRegionSchoolSummary({ subRegionId: user.subRegionId, academicYear: selectedYear, term: selectedTerm, assessment: selectedAssessment });
      if (result.success && result.data) {
        setSubRegionReport(result.data);
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error Generating Report', description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSchoolClick = async (schoolId: string) => {
    setLoading(true);
    setSelectedSchoolId(schoolId);
    try {
      const result = await generateSchoolClassSummary({ schoolId, academicYear: selectedYear, term: selectedTerm, assessment: selectedAssessment });
      if (result.success && result.data) {
        setSchoolReport(result.data);
        setBreadcrumbs([subRegionReport?.subRegionName || 'Sub-Region', result.data.schoolName]);
        setViewLevel('school');
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (viewLevel === 'school') {
      setSchoolReport(null);
      setViewLevel('subregion');
      setBreadcrumbs(breadcrumbs.slice(0, 1));
    }
  };

  const handlePrint = () => {
    window.print();
  };
  
  return (
    <div className="space-y-6">
      <div className="printable-hidden flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Results Analysis</h2>
          <p className="text-muted-foreground">Analyze assessment results by school within your sub-region.</p>
        </div>
      </div>
      
      {viewLevel !== 'subregion' && (
        <Button variant="ghost" onClick={handleBack} className="printable-hidden -ml-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Sub-Region Summary
        </Button>
      )}

      <Card className="printable-hidden">
        <CardHeader>
          <CardTitle>Report Filters</CardTitle>
          <CardDescription>Select a period and assessment to generate reports.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4">
          <Select value={selectedYear} onValueChange={handleYearChange}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Select Year" /></SelectTrigger>
            <SelectContent>{academicYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={selectedTerm} onValueChange={handleTermChange}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Select Term" /></SelectTrigger>
            <SelectContent>{terms.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={selectedAssessment} onValueChange={handleAssessmentChange} disabled={!selectedTerm}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Select Assessment" /></SelectTrigger>
            <SelectContent>{(assessmentsByTerm[selectedTerm] || []).map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
          </Select>
          <Button onClick={handleGenerateSubRegionReport} disabled={loading || !selectedAssessment}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Generate Report
          </Button>
        </CardContent>
      </Card>

      {loading && <div className="flex justify-center items-center p-10"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}

      {!loading && (
        <div>
          <div className="mb-4 printable-hidden flex justify-between items-center">
            <div className="text-sm text-muted-foreground">
              {breadcrumbs.join(' / ')}
            </div>
            {(viewLevel === 'subregion' && subRegionReport) || (viewLevel === 'school' && schoolReport) ? (
              <Button onClick={handlePrint} variant="outline" size="sm">
                <Printer className="mr-2 h-4 w-4" /> Print
              </Button>
            ) : null}
          </div>
          {viewLevel === 'subregion' && subRegionReport && <SchoolSummaryReport report={subRegionReport} onSchoolClick={handleSchoolClick} />}
          {viewLevel === 'school' && schoolReport && <ClassSummaryReport report={schoolReport} />}
        </div>
      )}
    </div>
  );
}
