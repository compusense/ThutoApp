
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser } from '@/firebase/auth/use-user';
import { useFirestore } from '@/firebase';
import { collection, query, where, onSnapshot, getDocs, doc, writeBatch } from 'firebase/firestore';
import { Loader2, Download, Printer, Eye, BookOpen, AlertTriangle, UploadCloud } from 'lucide-react';
import { format } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Subject } from '@/app/super-admin/subjects/page';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { publishExamsToTeachers, downloadAndZipFiles } from './actions';
import { useToast } from '@/hooks/use-toast';
import { auth } from '@/firebase';
import { School } from '@/app/super-admin/schools/page';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { saveAs } from 'file-saver';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';


interface SchoolNotification {
    id: string;
    type: 'timetable' | 'material';
    referenceId: string;
    publishedAt: string;
    isRead: boolean;
    title: string;
}

interface ScheduleItem {
    id: string;
    date: string;
    session1_time?: string;
    session1_subjectId?: string;
    session1_subjectId2?: string;
    session1_subject1_comments?: string;
    session1_subject2_comments?: string;
    session2_time?: string;
    session2_subjectId?: string;
    session2_subjectId2?: string;
    session2_subject1_comments?: string;
    session2_subject2_comments?: string;
}

interface ExamTimetable {
    id: string;
    academicYear: string;
    term: string;
    schoolLevel: string;
    type: 'file' | 'structured';
    fileUrl?: string;
    fileName?: string;
    schedule?: ScheduleItem[];
}

interface ExamMaterial {
    id: string;
    subRegionId: string;
    academicYear: string;
    term: string;
    schoolLevel: string;
    gradeLevel: string;
    fileUrl: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    uploadedAt: string;
    uploadedBy: string;
}

interface PublishedExam {
    id: string;
    schoolId: string;
    academicYear: string;
    term: string;
    schoolLevel: string;
    gradeLevel: string;
    publishedAt: string;
    publishedBy: string;
}


interface GroupedMaterials {
  periodKey: string;
  academicYear: string;
  term: string;
  schoolLevel: string;
  gradeLevel: string;
  materials: ExamMaterial[];
  isPublished: boolean;
}

// Data structure for the new organization
// { "2024": { "Term 1": { "Standard 7": { materials: [], isPublished: false } } } }
type OrganizedMaterials = Record<string, Record<string, Record<string, { materials: ExamMaterial[], isPublished: boolean }>>>;


function TimetablesTab({timetables, loading, viewTimetable}: {timetables: ExamTimetable[], loading: boolean, viewTimetable: (tt: ExamTimetable) => void}) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Published Timetables</CardTitle>
                <CardDescription>A list of all exam timetables published for your school.</CardDescription>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex justify-center p-10"><Loader2 className="h-8 w-8 animate-spin" /></div>
                ) : timetables.length === 0 ? (
                    <p className="text-center text-muted-foreground py-10">No timetables have been published for your school yet.</p>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Period</TableHead>
                                <TableHead>School Level</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {timetables.sort((a,b) => parseInt(b.academicYear) - parseInt(a.academicYear)).map(tt => (
                                <TableRow key={tt.id}>
                                    <TableCell className="font-medium">{tt.academicYear}, {tt.term}</TableCell>
                                    <TableCell>{tt.schoolLevel}</TableCell>
                                    <TableCell>
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger>
                                                    <Badge variant="outline">
                                                        {tt.type === 'structured' ? 'Detailed Schedule' : 'File Upload'}
                                                    </Badge>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>
                                                        {tt.type === 'structured'
                                                        ? 'A schedule created in the system with specific dates and times.'
                                                        : 'A document file (e.g., PDF) that was uploaded.'}
                                                    </p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button size="sm" onClick={() => viewTimetable(tt)}>
                                            {tt.type === 'file' ? <Download className="mr-2 h-4 w-4"/> : <Eye className="mr-2 h-4 w-4"/>}
                                            View / Download
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    );
}

function ExamMaterialsTab({ loading, materials, publishedExams, onPublish, onDownloadAll }: { loading: boolean, materials: ExamMaterial[], publishedExams: PublishedExam[], onPublish: (group: any) => void, onDownloadAll: (materials: ExamMaterial[], academicYear: string, term: string, gradeLevel: string) => void }) {
    
    const organizedMaterials = useMemo(() => {
        const organized: OrganizedMaterials = {};
        
        materials.forEach(material => {
            const { academicYear, term, gradeLevel } = material;

            if (!organized[academicYear]) {
                organized[academicYear] = {};
            }
            if (!organized[academicYear][term]) {
                organized[academicYear][term] = {};
            }
            if (!organized[academicYear][term][gradeLevel]) {
                organized[academicYear][term][gradeLevel] = { materials: [], isPublished: false };
            }
            
            organized[academicYear][term][gradeLevel].materials.push(material);
        });

        // Check publishing status for each group
        Object.entries(organized).forEach(([year, terms]) => {
            Object.entries(terms).forEach(([term, grades]) => {
                Object.entries(grades).forEach(([grade, data]) => {
                    data.isPublished = publishedExams.some(pe =>
                        pe.academicYear === year &&
                        pe.term === term &&
                        pe.gradeLevel === grade
                    );
                });
            });
        });

        return organized;

    }, [materials, publishedExams]);

    const academicYears = useMemo(() => Object.keys(organizedMaterials).sort((a, b) => b.localeCompare(a)), [organizedMaterials]);

    if (loading) {
        return <div className="flex justify-center p-10"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    if (academicYears.length === 0) {
        return (
            <Card>
                <CardContent className="p-10 text-center text-muted-foreground">
                    No exam materials have been published for your school yet.
                </CardContent>
            </Card>
        );
    }
    
    return (
        <Tabs defaultValue={academicYears[0]} className="w-full">
            <TabsList>
                {academicYears.map(year => <TabsTrigger key={year} value={year}>{year}</TabsTrigger>)}
            </TabsList>
            {academicYears.map(year => (
                <TabsContent key={year} value={year} className="mt-4">
                    <Accordion type="single" collapsible className="w-full space-y-4">
                        {Object.keys(organizedMaterials[year]).sort().map(term => (
                             <AccordionItem value={term} key={term} className="border-none">
                                <Card>
                                    <AccordionTrigger className="p-6 font-semibold text-lg">
                                        {term}
                                    </AccordionTrigger>
                                    <AccordionContent className="p-6 pt-0 space-y-4">
                                         {Object.keys(organizedMaterials[year][term]).sort().map(gradeLevel => {
                                             const group = organizedMaterials[year][term][gradeLevel];
                                             const isPublished = group.isPublished;
                                             return (
                                                <Card key={gradeLevel}>
                                                    <CardHeader>
                                                        <div className="flex justify-between items-center">
                                                            <div>
                                                                <CardTitle>{gradeLevel}</CardTitle>
                                                                <CardDescription>{group.materials.length} exam paper(s) available.</CardDescription>
                                                            </div>
                                                            <div className='flex items-center space-x-2'>
                                                                <Button variant="outline" onClick={() => onDownloadAll(group.materials, year, term, gradeLevel)}>
                                                                    <Download className="mr-2 h-4 w-4" /> Download All
                                                                </Button>
                                                                <Button onClick={() => onPublish({ academicYear: year, term, gradeLevel })} disabled={isPublished}>
                                                                    <UploadCloud className="mr-2 h-4 w-4" />
                                                                    {isPublished ? 'Published' : 'Publish to Teachers'}
                                                                </Button>
                                                            </div>
                                                        </div>
                                                        {isPublished && (
                                                            <div className="!mt-4 p-3 bg-green-50 border-l-4 border-green-400 rounded-r-md">
                                                                <div className="flex">
                                                                    <div className="ml-3">
                                                                        <p className="text-sm text-green-700">
                                                                            Published to teachers on {format(new Date(publishedExams.find(pe => pe.gradeLevel === gradeLevel && pe.academicYear === year && pe.term === term)?.publishedAt || ''), 'PPP')}.
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </CardHeader>
                                                    <CardContent>
                                                        <Table>
                                                            <TableHeader>
                                                                <TableRow>
                                                                    <TableHead>File Name</TableHead>
                                                                    <TableHead>Uploaded</TableHead>
                                                                    <TableHead className="text-right">Action</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {group.materials.map(material => (
                                                                    <TableRow key={material.id}>
                                                                        <TableCell className="font-medium">{material.fileName}</TableCell>
                                                                        <TableCell>{format(new Date(material.uploadedAt), 'PPP')}</TableCell>
                                                                        <TableCell className="text-right">
                                                                            <Button asChild size="sm" variant="outline">
                                                                                <a href={`/api/downloadFile?filePath=${encodeURIComponent(material.fileUrl)}`} target="_blank" rel="noopener noreferrer">
                                                                                    <Download className="mr-2 h-4 w-4" /> Download
                                                                                </a>
                                                                            </Button>
                                                                        </TableCell>
                                                                    </TableRow>
                                                                ))}
                                                            </TableBody>
                                                        </Table>
                                                    </CardContent>
                                                </Card>
                                             )
                                         })}
                                    </AccordionContent>
                                </Card>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </TabsContent>
            ))}
        </Tabs>
    );
}

export default function ExamManagementPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const firestore = useFirestore();

  const [school, setSchool] = useState<School | null>(null);
  const [notifications, setNotifications] = useState<SchoolNotification[]>([]);
  const [timetables, setTimetables] = useState<ExamTimetable[]>([]);
  const [examMaterials, setExamMaterials] = useState<ExamMaterial[]>([]);
  const [publishedExams, setPublishedExams] = useState<PublishedExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTimetable, setSelectedTimetable] = useState<ExamTimetable | null>(null);
  const [subjectMap, setSubjectMap] = useState<Map<string, string>>(new Map());
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [isPublishing, setIsPublishing] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!firestore || !user?.schoolId) {
        setLoading(false);
        return;
    }

    setLoading(true);
    const unsubs: (() => void)[] = [];

    // Fetch school data to get schoolLevel
    unsubs.push(onSnapshot(doc(firestore, 'schools', user.schoolId), (snap) => {
        if(snap.exists()) setSchool(snap.data() as School);
    }));

    // Fetch notifications
    const notifQuery = query(collection(firestore, `schools/${user.schoolId}/notifications`));
    unsubs.push(onSnapshot(notifQuery, async (snapshot) => {
        const fetchedNotifications = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as SchoolNotification));
        setNotifications(fetchedNotifications);

        // Mark as read
        const unreadNotifs = fetchedNotifications.filter(n => !n.isRead);
        if (unreadNotifs.length > 0) {
            const batch = writeBatch(firestore);
            unreadNotifs.forEach(n => batch.update(doc(firestore, `schools/${user.schoolId}/notifications`, n.id), { isRead: true }));
            await batch.commit().catch(e => console.error("Failed to mark notifications as read:", e));
        }
        
        // Fetch related timetables and materials
        const timetableIds = fetchedNotifications.filter(n => n.type === 'timetable' && n.referenceId).map(n => n.referenceId);
        const materialIds = new Set<string>();
        fetchedNotifications.filter(n => n.type === 'material' && n.referenceId).forEach(n => materialIds.add(n.referenceId));

        if (timetableIds.length > 0) {
            const timetablesQuery = query(collection(firestore, 'examTimetables'), where('__name__', 'in', timetableIds));
            unsubs.push(onSnapshot(timetablesQuery, (snap) => setTimetables(snap.docs.map(d => ({ id: d.id, ...d.data() } as ExamTimetable)))));
        } else {
            setTimetables([]);
        }
        
        if (materialIds.size > 0) {
            const materialsQuery = query(collection(firestore, 'examMaterials'), where('__name__', 'in', Array.from(materialIds)));
             unsubs.push(onSnapshot(materialsQuery, (snap) => setExamMaterials(snap.docs.map(d => ({ id: d.id, ...d.data() } as ExamMaterial)))));
        } else {
            setExamMaterials([]);
        }

        setLoading(false);
    }));
    
    // Fetch already published exams
    const publishedExamsQuery = query(collection(firestore, `schools/${user.schoolId}/publishedExams`));
    unsubs.push(onSnapshot(publishedExamsQuery, (snap) => setPublishedExams(snap.docs.map(d => ({ id: d.id, ...d.data() } as PublishedExam)))));


    return () => unsubs.forEach(unsub => unsub());
  }, [firestore, user]);

  useEffect(() => {
    if (!selectedTimetable || selectedTimetable.type !== 'structured' || !firestore) return;
    setLoadingSubjects(true);
    const subjectIds = new Set<string>();
    selectedTimetable.schedule?.forEach(item => {
        if(item.session1_subjectId) subjectIds.add(item.session1_subjectId);
        if(item.session1_subjectId2) subjectIds.add(item.session1_subjectId2);
        if(item.session2_subjectId) subjectIds.add(item.session2_subjectId);
        if(item.session2_subjectId2) subjectIds.add(item.session2_subjectId2);
    });
    if (subjectIds.size > 0) {
        const q = query(collection(firestore, 'subjects'), where('__name__', 'in', Array.from(subjectIds)));
        getDocs(q).then(snap => {
            const newMap = new Map<string, string>();
            snap.forEach(doc => newMap.set(doc.id, (doc.data() as Subject).name));
            setSubjectMap(newMap);
            setLoadingSubjects(false);
        });
    } else {
        setLoadingSubjects(false);
    }
  }, [selectedTimetable, firestore]);

  const viewTimetable = (timetable: ExamTimetable) => {
    if (timetable.type === 'file' && timetable.fileUrl) {
      window.open(`/api/downloadFile?filePath=${encodeURIComponent(timetable.fileUrl)}`, '_blank');
    } else {
      setSelectedTimetable(timetable);
    }
  };

  const handlePublishExams = async (group: { academicYear: string, term: string, gradeLevel: string }) => {
      if (!user?.schoolId || !school?.schoolType) {
          toast({ variant: 'destructive', title: 'Error', description: 'User or school data is missing.' });
          return;
      }
      const periodKey = `${group.academicYear}-${group.term}-${group.gradeLevel}`;
      setIsPublishing(prev => ({...prev, [periodKey]: true}));
      try {
          const idToken = await auth.currentUser?.getIdToken();
          if (!idToken) throw new Error("Authentication failed.");

          const result = await publishExamsToTeachers({
              schoolId: user.schoolId,
              academicYear: group.academicYear,
              term: group.term,
              schoolLevel: school.schoolType,
              gradeLevel: group.gradeLevel
          }, idToken);

          if (result.success) {
              toast({title: 'Success', description: 'Exams have been published to teachers.'});
          } else {
              throw new Error(result.message);
          }
      } catch (error: any) {
          toast({variant: 'destructive', title: 'Error', description: error.message});
      } finally {
           setIsPublishing(prev => ({...prev, [periodKey]: false}));
      }
  };
  
  const handleDownloadAll = useCallback(async (materials: ExamMaterial[], academicYear: string, term: string, gradeLevel: string) => {
    if (materials.length === 0) return;

    toast({
      title: 'Preparing Download',
      description: 'Zipping files... please wait.',
    });

    try {
        const filePaths = materials.map(m => m.fileUrl);
        const result = await downloadAndZipFiles(filePaths);

        if (result.success && result.data) {
            const blob = new Blob([Buffer.from(result.data, 'base64')], { type: 'application/zip' });
            const fileName = `${academicYear}_${term}_${gradeLevel}_Exams.zip`.replace(/\s/g, '_');
            saveAs(blob, fileName);
        } else {
            throw new Error(result.message || "Failed to create ZIP file on server.");
        }
    } catch (error: any) {
        console.error("Error creating ZIP file:", error);
        toast({
            variant: 'destructive',
            title: 'Download Failed',
            description: error.message || 'Could not create ZIP file.',
        });
    }
  }, [toast]);


  const handlePrint = () => {
    window.print();
  }
  
  return (
    <>
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Exam Management</h2>
          <p className="text-muted-foreground mb-6">
            View and download exam timetables and materials published by your Sub-Region Admin.
          </p>
        </div>
      </div>
      
      <Tabs defaultValue="timetables" className="w-full">
        <TabsList>
          <TabsTrigger value="timetables">Timetables</TabsTrigger>
          <TabsTrigger value="materials">Exam Materials</TabsTrigger>
        </TabsList>
        <TabsContent value="timetables" className="mt-4">
            <TimetablesTab timetables={timetables} loading={loading} viewTimetable={viewTimetable} />
        </TabsContent>
        <TabsContent value="materials" className="mt-4">
            <ExamMaterialsTab loading={loading} materials={examMaterials} publishedExams={publishedExams} onPublish={handlePublishExams} onDownloadAll={handleDownloadAll} />
        </TabsContent>
      </Tabs>
    </div>
    
    <Dialog open={!!selectedTimetable} onOpenChange={() => setSelectedTimetable(null)}>
        <DialogContent className="max-w-4xl printable-area">
            <div>
                <DialogHeader>
                    <DialogTitle>Timetable for {selectedTimetable?.academicYear}, {selectedTimetable?.term}</DialogTitle>
                    <DialogDescription>{selectedTimetable?.schoolLevel}</DialogDescription>
                </DialogHeader>
                {loadingSubjects ? (
                     <div className="flex justify-center p-10"><Loader2 className="h-8 w-8 animate-spin" /></div>
                ) : (
                    <div className="max-h-[60vh] overflow-y-auto mt-4 print:max-h-none print:overflow-visible">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Session 1</TableHead>
                                    <TableHead>Session 2</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {selectedTimetable?.schedule?.map(item => (
                                    <TableRow key={item.id}>
                                        <TableCell className="font-medium">{format(new Date(item.date), 'EEE, PPP')}</TableCell>
                                        <TableCell>
                                            {(item.session1_subjectId || item.session1_subjectId2) ? (
                                                <>
                                                    <p className="font-semibold">{subjectMap.get(item.session1_subjectId!) || item.session1_subjectId}</p>
                                                    {item.session1_subjectId2 && <p className="font-semibold text-muted-foreground">& {subjectMap.get(item.session1_subjectId2) || item.session1_subjectId2}</p>}
                                                    <p className="text-sm text-muted-foreground">{item.session1_time}</p>
                                                    {item.session1_subject1_comments && <p className="text-xs italic mt-1">"{item.session1_subject1_comments}"</p>}
                                                    {item.session1_subject2_comments && <p className="text-xs italic mt-1">"{item.session1_subject2_comments}"</p>}
                                                </>
                                            ) : null}
                                        </TableCell>
                                         <TableCell>
                                             {(item.session2_subjectId || item.session2_subjectId2) ? (
                                                <>
                                                    <p className="font-semibold">{subjectMap.get(item.session2_subjectId!) || item.session2_subjectId}</p>
                                                    {item.session2_subjectId2 && <p className="font-semibold text-muted-foreground">& {subjectMap.get(item.session2_subjectId2) || item.session2_subjectId2}</p>}
                                                    <p className="text-sm text-muted-foreground">{item.session2_time}</p>
                                                    {item.session2_subject1_comments && <p className="text-xs italic mt-1">"{item.session2_subject1_comments}"</p>}
                                                    {item.session2_subject2_comments && <p className="text-xs italic mt-1">"{item.session2_subject2_comments}"</p>}
                                                </>
                                            ) : null}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </div>
            <DialogFooter className="printable-hidden">
                <Button variant="outline" onClick={handlePrint}>
                    <Printer className="mr-2 h-4 w-4" /> Print
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    </>
  );
}
