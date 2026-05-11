
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SchoolCalendar } from './components/school-calendar';
import { StudentGenderChart } from './components/student-gender-chart';
import { ClassPerformanceTrendChart } from './components/class-performance-trend-chart';
import { SchoolPerformanceBarChart } from './components/school-performance-bar-chart';
import { TeacherChartCard } from './components/teacher-chart-card';

export default function TeacherDashboard() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Chart cards */}
      <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
        <TeacherChartCard
            title="School Performance Summary"
            description="Most recent End of Term School Performance Summary."
            >
            <SchoolPerformanceBarChart />
        </TeacherChartCard>
        
        <TeacherChartCard
            title="My Class"
            description="Student Gender Distribution"
            >
            <StudentGenderChart />
        </TeacherChartCard>

        <div className="md:col-span-2">
            <TeacherChartCard
                title="Class Performance Trend"
                description="Overall pass rate for 'End of Term' assessments in your classes over time."
            >
                <ClassPerformanceTrendChart />
            </TeacherChartCard>
        </div>
      </div>

      {/* Sidebar for Action Plan */}
      <div className="lg:col-span-1">
        <Card>
          <CardHeader>
            <CardTitle>School Calendar of Events</CardTitle>
            <CardDescription>
              Upcoming events from your school's Action Plan.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SchoolCalendar />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
