'use client';

import * as React from 'react';
import { useUser } from '@/firebase/auth/use-user';
import { useFirestore } from '@/firebase';
import { collection, onSnapshot, query, FirestoreError } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { format, isToday, startOfToday } from 'date-fns';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CalendarDays, Loader2 } from 'lucide-react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

interface ActionPlanEvent {
    title: string;
    date: string; // ISO string
    type: 'Meeting' | 'Sports' | 'Exam' | 'Cultural' | 'Other';
    description?: string;
}

export function SchoolCalendar() {
    const { user } = useUser();
    const firestore = useFirestore();
    const [events, setEvents] = React.useState<ActionPlanEvent[]>([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        if (!firestore || !user?.schoolId) {
            setLoading(false);
            return;
        }
        setLoading(true);

        const actionPlansCollRef = collection(firestore, 'schools', user.schoolId, 'actionPlans');
        const actionPlansQuery = query(actionPlansCollRef);

        const unsubscribe = onSnapshot(actionPlansQuery, (snapshot) => {
            const schoolEvents: ActionPlanEvent[] = [];
            snapshot.forEach(doc => {
                const plan = doc.data();
                if (plan.events) {
                    plan.events.forEach((event: any) => {
                        schoolEvents.push(event);
                    });
                }
            });
            
            const today = startOfToday();
            const upcomingEvents = schoolEvents
                .filter(event => new Date(event.date) >= today)
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            
            setEvents(upcomingEvents);
            setLoading(false);
        }, async (err: FirestoreError) => {
            const permissionError = new FirestorePermissionError({
                path: actionPlansCollRef.path,
                operation: 'list',
            });
            errorEmitter.emit('permission-error', permissionError);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [firestore, user?.schoolId]);

    const getBadgeColor = (type: ActionPlanEvent['type']) => {
        switch (type) {
            case 'Meeting': return 'bg-blue-500 hover:bg-blue-500';
            case 'Sports': return 'bg-green-500 hover:bg-green-500';
            case 'Exam': return 'bg-yellow-500 hover:bg-yellow-500 text-black';
            case 'Cultural': return 'bg-purple-500 hover:bg-purple-500';
            default: return 'bg-gray-500 hover:bg-gray-500';
        }
    }

    if (loading) {
        return <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    if (events.length === 0) {
        return (
            <div className="text-center text-muted-foreground py-10">
                <CalendarDays className="mx-auto h-12 w-12" />
                <h3 className="mt-4 text-lg font-semibold">No Upcoming Events</h3>
                <p className="mt-1 text-sm">There are no events scheduled in the school's action plan.</p>
            </div>
        );
    }

    return (
        <ScrollArea className="h-[75vh] pr-4">
            <div className="space-y-4">
                {events.map((event, index) => {
                    const eventDate = new Date(event.date);
                    const ongoing = isToday(eventDate);
                    return (
                        <div key={index} className="flex items-start gap-4">
                            <div className="flex shrink-0 flex-col w-16 items-center rounded-lg overflow-hidden border-2 border-primary/20 bg-card shadow-sm">
                                <div className="w-full bg-destructive text-center text-[10px] font-bold uppercase text-destructive-foreground">
                                    {format(eventDate, 'MMM')}
                                </div>
                                <div className="py-1 text-center">
                                    <p className="text-2xl font-extrabold text-primary">{format(eventDate, 'dd')}</p>
                                    <p className="text-xs font-bold text-muted-foreground -mt-1">{format(eventDate, 'EEE')}</p>
                                </div>
                            </div>
                            <div className="flex-1 space-y-1 pt-1">
                                <div className="flex justify-between items-start gap-2">
                                    <p className="font-medium leading-tight">{event.title}</p>
                                    <div className="flex items-center gap-2 shrink-0">
                                      {ongoing && <Badge variant="default" className="bg-accent text-accent-foreground hover:bg-accent/90">Ongoing</Badge>}
                                      <Badge className={cn("text-xs text-white", getBadgeColor(event.type))}>{event.type}</Badge>
                                    </div>
                                </div>
                                {event.description && <p className="text-sm text-muted-foreground">{event.description}</p>}
                            </div>
                        </div>
                    );
                })}
            </div>
        </ScrollArea>
    );
}
