
'use client';

import * as React from 'react';
import { useUser } from '@/firebase/auth/use-user';
import { useFirestore, auth } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, Printer, FileText } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { getStudentReportData, getStudentAvailableReports, ReportData } from './actions';
import { format } from 'date-fns';
import { formatTeacherName } from '@/lib/utils';
import { ProgressReport } from '@/app/teacher/reports/components/progress-report';

export default function StudentResultsPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(true);
  const [availableReports, setAvailableReports] = React.useState<{ period: string, display: string }[]>([]);
  const [selectedPeriod, setSelectedPeriod] = React.useState<string>('');
  const [reportData, setReportData] = React.useState<ReportData | null>(null);

  React.useEffect(() => {
    if (!user) return;
    setLoading(true);
    console.log('[PAGE LOG] Fetching available reports...');

    const fetchReports = async () => {
        try {
            const idToken = await auth.currentUser?.getIdToken();
            if (!idToken) throw new Error("Authentication required.");

            const result = await getStudentAvailableReports(idToken);
            console.log('[PAGE LOG] Result from getStudentAvailableReports:', result);
            if (result.success && result.data) {
              setAvailableReports(result.data);
              if (result.data.length > 0) {
                setSelectedPeriod(result.data[0].period);
              }
            } else {
              console.error('[PAGE LOG] Failed to fetch available reports:', result.message);
              toast({ variant: 'destructive', title: 'Error', description: result.message });
            }
        } catch(err: any) {
             console.error('[PAGE LOG] CATCH block: Error fetching available reports:', err);
             toast({ variant: 'destructive', title: 'Error', description: err.message });
        } finally {
            setLoading(false);
        }
    };
    
    fetchReports();

  }, [user, toast]);

  React.useEffect(() => {
    if (!selectedPeriod) {
        setReportData(null);
        return;
    };

    const fetchReportData = async () => {
        setLoading(true);
        try {
            const idToken = await auth.currentUser?.getIdToken();
            if (!idToken) throw new Error("Authentication required.");

            const result = await getStudentReportData({ period: selectedPeriod }, idToken);
            if (result.success && result.data) {
                setReportData(result.data);
            } else {
                toast({ variant: 'destructive', title: 'Error', description: result.message });
            }
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Error', description: err.message });
        } finally {
            setLoading(false);
        }
    };

    fetchReportData();
  }, [selectedPeriod, toast]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">My Results</h2>
        <p className="text-muted-foreground">View your end-of-term progress reports.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select a Report</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod} disabled={availableReports.length === 0 || loading}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder={loading ? 'Loading reports...' : 'Select a report to view'} />
            </SelectTrigger>
            <SelectContent>
              {availableReports.map(({ period, display }) => (
                <SelectItem key={period} value={period}>
                  {display}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
      
       {loading && (
        <div className="flex justify-center p-10"><Loader2 className="h-8 w-8 animate-spin" /></div>
      )}

      {reportData && (
        <ProgressReport reportData={reportData} storageKey={null} />
      )}

      {!loading && !reportData && selectedPeriod && (
        <Card>
            <CardContent className="p-10 text-center text-muted-foreground">
                Could not load data for the selected report.
            </CardContent>
        </Card>
      )}

      {!loading && availableReports.length === 0 && (
         <Card>
            <CardContent className="p-10 text-center text-muted-foreground">
                <FileText className="mx-auto h-12 w-12" />
                <h3 className="mt-4 text-lg font-semibold">No Reports Found</h3>
                <p className="mt-1 text-sm">No end-of-term reports are available for you yet.</p>
            </CardContent>
        </Card>
      )}
    </div>
  );
}
