
'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Building, Map } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { useEffect, useState } from 'react';
import { collection, getCountFromServer } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';

function StatCard({ title, value, icon: Icon, loading }: { title: string, value: string | number, icon: React.ElementType, loading: boolean }) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-8 w-1/2" />
          ) : (
            <div className="text-2xl font-bold">{value}</div>
          )}
        </CardContent>
      </Card>
    );
}

export default function SuperAdminDashboard() {
  const firestore = useFirestore();
  const [userCount, setUserCount] = useState(0);
  const [schoolCount, setSchoolCount] = useState(0);
  const [regionCount, setRegionCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firestore) return;
    const fetchData = async () => {
        try {
            const userSnap = await getCountFromServer(collection(firestore, 'users'));
            setUserCount(userSnap.data().count);
            
            const schoolSnap = await getCountFromServer(collection(firestore, 'schools'));
            setSchoolCount(schoolSnap.data().count);
            
            const regionSnap = await getCountFromServer(collection(firestore, 'regions'));
            setRegionCount(regionSnap.data().count);
        } catch(error) {
            console.error("Error fetching dashboard counts:", error);
        } finally {
            setLoading(false);
        }
    };
    fetchData();
  }, [firestore]);


  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Super Admin Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard title="Total Users" value={userCount} icon={Users} loading={loading} />
        <StatCard title="Total Schools" value={schoolCount} icon={Building} loading={loading} />
        <StatCard title="Total Regions" value={regionCount} icon={Map} loading={loading} />
      </div>
    </div>
  );
}
