'use client';
import * as React from 'react';
import { useUser } from '@/firebase/auth/use-user';
import { useFirestore } from '@/firebase';
import { collection, query, where, doc, getDoc, getDocs, onSnapshot, FirestoreError } from 'firebase/firestore';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Loader2, LineChart, AlertCircle, RefreshCcw } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Class } from '@/app/school-head/classes/page';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

interface HistoryItem {
    fromClassId: string;
    fromYear: string;
    toYear: string;
}

export function ClassPerformanceTrendChart() {
    const { user } = useUser();
    const firestore = useFirestore();
    
    const [teacherClasses, setTeacherClasses] = React.useState<Class[]>([]);
    const [selectedClassId, setSelectedClassId] = React.useState<string>('');
    const [chartData, setChartData] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [isRefreshing, setIsRefreshing] = React.useState(false);

    // 1. Fetch Teacher's current active classes
    React.useEffect(() => {
        if (!firestore || !user?.uid || !user.schoolId) return;

        const currentYear = new Date().getFullYear().toString();
        const q = query(
            collection(firestore, 'schools', user.schoolId, 'classes'),
            where('teacherId', '==', user.uid),
            where('academicYear', '==', currentYear)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class));
            const sorted = fetched.sort((a, b) => a.name.localeCompare(b.name));
            setTeacherClasses(sorted);
            
            if (sorted.length > 0 && !selectedClassId) {
                setSelectedClassId(sorted[0].id);
            }
            setLoading(false);
        }, async (err: FirestoreError) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: `schools/${user.schoolId}/classes`,
                operation: 'list',
            }));
            setLoading(false);
        });

        return () => unsubscribe();
    }, [firestore, user, selectedClassId]);

    // 2. Trace history and fetch snapshots when class changes
    React.useEffect(() => {
        if (!firestore || !user?.schoolId || !selectedClassId) {
            setChartData([]);
            return;
        }

        const fetchHistoryAndSnapshots = async () => {
            setIsRefreshing(true);
            try {
                // A. Trace the promotion chain (Cohort IDs)
                const historyChainIds: string[] = [selectedClassId];
                let currentId = selectedClassId;
                
                // Trace back up to 7 years (Primary School cycle)
                for (let i = 0; i < 7; i++) {
                    const classRef = doc(firestore, 'schools', user.schoolId!, 'classes', currentId);
                    const classSnap = await getDoc(classRef).catch(async (err: FirestoreError) => {
                        errorEmitter.emit('permission-error', new FirestorePermissionError({
                            path: classRef.path,
                            operation: 'get',
                        }));
                        return null;
                    });

                    if (!classSnap || !classSnap.exists()) break;
                    
                    const data = classSnap.data();
                    const history = data.promotionHistory as HistoryItem[] | undefined;
                    
                    if (history && history.length > 0) {
                        const previousClassId = history[0].fromClassId;
                        // Avoid infinite loops and redundant checks
                        if (previousClassId && !historyChainIds.includes(previousClassId)) {
                            historyChainIds.push(previousClassId);
                            currentId = previousClassId;
                        } else {
                            break;
                        }
                    } else {
                        break;
                    }
                }

                // B. Fetch all snapshots for the entire chain in parallel
                const snapshotPromises = historyChainIds.map(async (classId) => {
                    const snapCollRef = collection(firestore, 'schools', user.schoolId!, 'classes', classId, 'resultsSnapshots');
                    const snapResult = await getDocs(snapCollRef).catch(async (err: FirestoreError) => {
                        errorEmitter.emit('permission-error', new FirestorePermissionError({
                            path: snapCollRef.path,
                            operation: 'list',
                        }));
                        return null;
                    });
                    return snapResult ? snapResult.docs.map(d => d.data()) : [];
                });

                const allSnapshotsResults = await Promise.all(snapshotPromises);
                const flattenedSnapshots = allSnapshotsResults.flat();

                // C. Process and filter for "End of Term" trends
                const processedData = flattenedSnapshots
                    .filter(snap => {
                        const assessment = snap.assessment?.toLowerCase() || '';
                        return assessment.includes('end of term');
                    })
                    .map(snap => {
                        const overall = snap.summaryData?.overall;
                        const passRate = overall ? parseFloat((overall.passRate || 0).toFixed(1)) : 0;
                        
                        return {
                            period: `${snap.academicYear} ${snap.term}`,
                            passRate,
                            sortKey: `${snap.academicYear}-${snap.term.replace('Term ', '')}`
                        };
                    })
                    .sort((a, b) => a.sortKey.localeCompare(b.sortKey));

                setChartData(processedData);

            } catch (error) {
                console.error("[TREND CHART] Failed to fetch historical data:", error);
            } finally {
                setIsRefreshing(false);
            }
        };

        fetchHistoryAndSnapshots();
    }, [firestore, user?.schoolId, selectedClassId]);

    const chartConfig = {
      passRate: { label: 'ABC Pass %', color: 'hsl(var(--primary))' },
    };

    if (loading) {
        return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    if (teacherClasses.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center text-center h-64 text-muted-foreground p-4">
                <LineChart className="h-10 w-10 mb-2 opacity-20" />
                <p className="font-semibold text-foreground">No Classes Assigned</p>
                <p className="text-sm mt-1">You are not assigned as a teacher to any classes for {new Date().getFullYear()}.</p>
            </div>
        );
    }
    
    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                    {isRefreshing && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                    {chartData.length > 0 && (
                        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                            Cohort Performance Trace
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-medium">Cohort:</span>
                    <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                        <SelectTrigger className="w-[160px] h-8 text-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {teacherClasses.map(c => (
                                <SelectItem key={c.id} value={c.id}>
                                    {c.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {chartData.length === 0 && !isRefreshing ? (
                <div className="flex flex-col items-center justify-center text-center h-64 text-muted-foreground bg-muted/20 rounded-lg border border-dashed p-6">
                    <AlertCircle className="h-8 w-8 mb-2 opacity-20" />
                    <p className="font-medium text-foreground">No Historical Snapshots</p>
                    <p className="text-xs mt-1 max-w-[220px]">
                        Save "End of Term" marks for this cohort to begin tracking academic progression.
                    </p>
                </div>
            ) : (
                <div className="relative h-64 w-full">
                    {isRefreshing && (
                        <div className="absolute inset-0 z-10 bg-background/50 flex items-center justify-center backdrop-blur-[1px]">
                            <RefreshCcw className="h-6 w-6 animate-spin text-primary opacity-50" />
                        </div>
                    )}
                    <ChartContainer config={chartConfig} className="w-full h-full min-h-[250px]">
                      <AreaChart
                        accessibilityLayer
                        data={chartData}
                        margin={{
                          left: -20,
                          right: 20,
                          top: 10,
                          bottom: 5,
                        }}
                      >
                        <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.5} />
                        <XAxis
                          dataKey="period"
                          tickLine={false}
                          axisLine={false}
                          tickMargin={8}
                          fontSize={10}
                          tickFormatter={(value) => {
                              const parts = value.split(' ');
                              return `${parts[0]} T${parts[2]}`;
                          }}
                        />
                         <YAxis 
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            domain={[0, 100]}
                            tickFormatter={(value) => `${value}%`}
                            fontSize={10}
                        />
                        <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                        <defs>
                          <linearGradient id="fillPassRate" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--color-passRate)" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="var(--color-passRate)" stopOpacity={0.01} />
                          </linearGradient>
                        </defs>
                        <Area
                          dataKey="passRate"
                          name="ABC Pass %"
                          type="monotone"
                          fill="url(#fillPassRate)"
                          fillOpacity={1}
                          stroke="var(--color-passRate)"
                          strokeWidth={3}
                          animationDuration={1000}
                        />
                      </AreaChart>
                    </ChartContainer>
                </div>
            )}
        </div>
    );
}
