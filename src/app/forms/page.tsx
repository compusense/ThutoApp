
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser } from '@/firebase/auth/use-user';
import { Button } from '@/components/ui/button';
import { AppLink } from '@/components/ui/app-link';
import { FileText, Loader2, PlusCircle, View, ArrowLeft, Archive } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export interface FormField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'date' | 'number' | 'select-teacher';
}

export interface FormDocument {
  id: string;
  title: string;
  description: string;
  subRegionId: string;
  createdBy: string;
  createdAt: string; // ISO string
  status: 'draft' | 'published' | 'archived';
  fields: FormField[];
  submissionCount?: number;
}

export interface FormSubmission {
  id: string;
  formId: string;
  schoolId: string;
  schoolName?: string;
  submittedBy: string;
  submittedAt: string; // ISO string
  responses: Record<string, any>[];
}

function FormCard({ form, canCreateForms }: { form: FormDocument, canCreateForms: boolean }) {
    return (
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="flex justify-between items-start">
                <span className="line-clamp-2">{form.title}</span>
                <Badge variant={form.status === 'published' ? 'secondary' : form.status === 'archived' ? 'outline' : 'default'}>
                    {form.status}
                </Badge>
            </CardTitle>
            <CardDescription>
              Created on {format(new Date(form.createdAt), 'PPP')}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-grow">
            <p className="text-sm text-muted-foreground line-clamp-3">{form.description}</p>
          </CardContent>
          <div className="p-6 pt-0">
            {canCreateForms ? (
                <Button asChild className="w-full">
                    <AppLink href={`/forms/${form.id}/submissions`}>
                        <View className="mr-2 h-4 w-4" />
                        View Submissions ({form.submissionCount ?? 0})
                    </AppLink>
                </Button>
            ) : (
                <Button asChild className="w-full">
                    <AppLink href={`/forms/${form.id}`}>
                        <FileText className="mr-2 h-4 w-4" />
                        Fill Out Form
                    </AppLink>
                </Button>
            )}
          </div>
        </Card>
    );
}

export default function FormsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [forms, setForms] = useState<FormDocument[]>([]);
  const [loading, setLoading] = useState(true);

  const canCreateForms = user?.role === 'sub-region-admin' || user?.role === 'super-admin';
  const dashboardLink = user?.role ? `/${user.role}/dashboard` : '/';

  useEffect(() => {
    if (!firestore || !user) return;

    let q;
    if (canCreateForms && user.uid) {
      q = query(collection(firestore, 'forms'), where('createdBy', '==', user.uid));
    } else if (user.role === 'school-head' && user.subRegionId) {
      q = query(
        collection(firestore, 'forms'),
        where('subRegionId', '==', user.subRegionId),
        where('status', '==', 'published') // School heads only see published forms
      );
    } else {
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const fetchedForms: FormDocument[] = [];
      for (const doc of snapshot.docs) {
        const formData = { id: doc.id, ...doc.data() } as FormDocument;
        if (canCreateForms) {
          const submissionsSnap = await getDocs(collection(doc.ref, 'submissions'));
          formData.submissionCount = submissionsSnap.size;
        }
        fetchedForms.push(formData);
      }
      fetchedForms.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setForms(fetchedForms);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching forms: ", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [firestore, user, canCreateForms]);

  const publishedForms = forms.filter(f => f.status === 'published');
  const archivedForms = forms.filter(f => f.status === 'archived');


  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between">
        <div>
           <Button asChild variant="ghost" className="-ml-4">
                <AppLink href={dashboardLink}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Dashboard
                </AppLink>
            </Button>
          <h2 className="text-3xl font-bold tracking-tight">Forms</h2>
          <p className="text-muted-foreground">
            {canCreateForms ? 'Create and manage forms for schools.' : 'View and respond to assigned forms.'}
          </p>
        </div>
        {canCreateForms && (
            <Button asChild>
                <AppLink href="/forms/create">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Create New Form
                </AppLink>
            </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center items-center p-10"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : canCreateForms ? (
         <Tabs defaultValue="published" className="w-full">
            <TabsList>
                <TabsTrigger value="published">Published</TabsTrigger>
                <TabsTrigger value="archived">Archived</TabsTrigger>
            </TabsList>
            <TabsContent value="published">
                {publishedForms.length === 0 ? (
                     <Card className="mt-4"><CardContent className="p-10 text-center"><p className="text-muted-foreground">No published forms found.</p></CardContent></Card>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mt-4">
                        {publishedForms.map(form => <FormCard key={form.id} form={form} canCreateForms={canCreateForms} />)}
                    </div>
                )}
            </TabsContent>
            <TabsContent value="archived">
                 {archivedForms.length === 0 ? (
                     <Card className="mt-4"><CardContent className="p-10 text-center"><p className="text-muted-foreground">No archived forms found.</p></CardContent></Card>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mt-4">
                        {archivedForms.map(form => <FormCard key={form.id} form={form} canCreateForms={canCreateForms} />)}
                    </div>
                )}
            </TabsContent>
        </Tabs>
      ) : forms.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No Forms Found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              There are currently no forms assigned to your sub-region.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {forms.map((form) => <FormCard key={form.id} form={form} canCreateForms={canCreateForms} />)}
        </div>
      )}
    </div>
  );
}

    