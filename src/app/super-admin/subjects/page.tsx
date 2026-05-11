
'use client';

import { useState, useEffect, useMemo } from 'react';
import { PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { collection, onSnapshot, FirestoreError } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { DataTable } from './components/data-table';
import { getColumns } from './components/columns';
import { CreateSubjectDialog } from './components/create-subject-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export interface Subject {
  id: string;
  name: string;
  subjectCode?: string;
  schoolLevel: "Primary School" | "Junior Secondary School" | "Senior Secondary School";
}

const schoolLevels = [
    "Primary School",
    "Junior Secondary School",
    "Senior Secondary School",
];

export default function SubjectsPage() {
  const [isCreateSubjectDialogOpen, setCreateSubjectDialogOpen] = useState(false);
  const firestore = useFirestore();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    if (!firestore) return;

    let isMounted = true;
    console.log('[SubjectsPage] Setting up Firestore listener...');

    const subjectsCollection = collection(firestore, 'subjects');
    const unsubscribe = onSnapshot(
      subjectsCollection,
      (snapshot) => {
        if (isMounted) {
          const fetchedSubjects: Subject[] = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Subject));
          setSubjects(fetchedSubjects);
          setLoading(false);
        }
      },
      (err: FirestoreError) => {
        if (isMounted) {
            console.error("Firestore subscription error:", err);
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: 'subjects',
                operation: 'list',
            }));
            setLoading(false);
        }
      }
    );

    return () => {
      isMounted = false;
      console.log('[DEBUG] Unsubscribing from Firestore listener (Subjects)...');
      unsubscribe();
    };
  }, [firestore]);

  const columns = useMemo(() => getColumns(), []);

  const filteredSubjects = useMemo(() => {
    if (activeTab === 'all') {
      return subjects;
    }
    return subjects.filter(subject => subject.schoolLevel === activeTab);
  }, [subjects, activeTab]);

  return (
    <>
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Subjects</h2>
          <p className="text-muted-foreground">
            Manage the master list of subjects for all schools.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button onClick={() => setCreateSubjectDialogOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Subject
          </Button>
        </div>
      </div>
      <div className="py-10">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="Primary School">Primary School</TabsTrigger>
                <TabsTrigger value="Junior Secondary School">Junior Secondary</TabsTrigger>
                <TabsTrigger value="Senior Secondary School">Senior Secondary</TabsTrigger>
            </TabsList>
            <TabsContent value={activeTab} className="mt-4">
                <DataTable columns={columns} data={filteredSubjects} loading={loading} />
            </TabsContent>
        </Tabs>

      </div>
      <CreateSubjectDialog
        isOpen={isCreateSubjectDialogOpen}
        onOpenChange={setCreateSubjectDialogOpen}
      />
    </>
  );
}
