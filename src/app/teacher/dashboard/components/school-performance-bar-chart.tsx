
'use client';
import * as React from 'react';
import { useUser } from '@/firebase/auth/use-user';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Loader2, BarChart2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { generateSchoolResultsSummary } from '@/app/school-head/results-summary/actions';

export function SchoolPerformanceBarChart() {
  const { user } = useUser();
  const { toast } = useToast();
  const [chartData, setChartData] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!user?.schoolId) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        const now = new Date();
        const currentMonth = now.getMonth(); // 0-11 (Jan-Dec)
        let academicYear: string;
        let term: string;
        
        if (currentMonth >= 3 && currentMonth <= 6) { // April to July
            term = 'Term 1';
            academicYear = now.getFullYear().toString();
        } else if (currentMonth >= 7 && currentMonth <= 9) { // August to October
            term = 'Term 2';
            academicYear = now.getFullYear().toString();
        } else { // November to March
            term = 'Term 3';
            // If it's Jan, Feb, or Mar, the academic year is the previous year
            academicYear = (currentMonth >= 0 && currentMonth <= 2) 
                ? (now.getFullYear() - 1).toString() 
                : now.getFullYear().toString();
        }
        
        const assessment = `End of ${term}`;
        
        const result = await generateSchoolResultsSummary({
          schoolId: user.schoolId!,
          academicYear,
          term,
          assessment,
        });

        if (result.success && result.data) {
           const formattedData = result.data.classSummaries.map(item => ({
              name: item.className.replace('Standard ', 'Std '),
              'Quality Pass (AB)': parseFloat(item.gradePercentages.AB.toFixed(1)),
              'Overall Pass (ABC)': parseFloat(item.gradePercentages.ABC.toFixed(1)),
            }));
            
            // Sort by grade level
            formattedData.sort((a, b) => {
                const numA = parseInt(a.name.replace(/[^0-9]/g, ''), 10);
                const numB = parseInt(b.name.replace(/[^0-9]/g, ''), 10);
                return (isNaN(numA) || isNaN(numB)) ? a.name.localeCompare(b.name) : numA - numB;
            });

           setChartData(formattedData);
        } else {
          setChartData([]);
          console.warn("Could not generate school summary for dashboard:", result.message);
        }
      } catch (error) {
        console.error("Error setting up chart:", error);
        setChartData([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
    
  }, [user, toast]);
  
  const chartConfig = {
    'Quality Pass (AB)': {
      label: '(AB)',
      color: '#10b981', // A nice green color
      gradientFrom: '#6ee7b7',
      gradientTo: '#10b981'
    },
    'Overall Pass (ABC)': {
      label: '(ABC)',
      color: '#3b82f6', // A nice blue color
      gradientFrom: '#93c5fd',
      gradientTo: '#3b82f6'
    },
  };
  
  if (loading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }
  
  if (chartData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center h-full text-muted-foreground">
        <BarChart2 className="h-10 w-10 mb-2" />
        <p>No end-of-term results found for the most recent period.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-grow">
        <ChartContainer config={chartConfig} className="w-full h-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} accessibilityLayer margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs>
                  <linearGradient id="fillQuality" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartConfig['Quality Pass (AB)'].gradientFrom} stopOpacity={0.8}/>
                    <stop offset="95%" stopColor={chartConfig['Quality Pass (AB)'].gradientTo} stopOpacity={0.9}/>
                  </linearGradient>
                  <linearGradient id="fillOverall" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartConfig['Overall Pass (ABC)'].gradientFrom} stopOpacity={0.8}/>
                    <stop offset="95%" stopColor={chartConfig['Overall Pass (ABC)'].gradientTo} stopOpacity={0.9}/>
                  </linearGradient>
                </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="name"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                fontSize={12}
              />
              <YAxis
                tickFormatter={(value) => `${value}%`}
                domain={[0, 100]}
              />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent indicator="dot" />}
              />
              <Bar dataKey="Quality Pass (AB)" fill="url(#fillQuality)" radius={4} />
              <Bar dataKey="Overall Pass (ABC)" fill="url(#fillOverall)" radius={4} />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </div>
      <div className="flex items-center justify-center gap-4 text-sm mt-4">
        <div className="flex items-center gap-2">
          <div className="h-2 w-4 rounded-sm" style={{ background: chartConfig['Quality Pass (AB)'].color }}/>
          <span className="text-muted-foreground">{chartConfig['Quality Pass (AB)'].label}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-4 rounded-sm" style={{ background: chartConfig['Overall Pass (ABC)'].color }}/>
          <span className="text-muted-foreground">{chartConfig['Overall Pass (ABC)'].label}</span>
        </div>
      </div>
    </div>
  );
}
