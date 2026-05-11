
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser } from '@/firebase/auth/use-user';
import { useFirestore } from '@/firebase';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { Loader2, Download } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

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

interface ExamMaterial {
    id: string;
    academicYear: string;
    term: string;
    gradeLevel: string;
    fileUrl: string; // This is now a path, not a URL
    fileName: string;
    uploadedAt: string;
}

interface GroupedMaterials {
  periodKey: string;
  academicYear: string;
  term: string;
  gradeLevel: string;
  materials: ExamMaterial[];
}

export default function PastExamPapersPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const [loading, setLoading] = useState(true);
    const [publishedExams, setPublishedExams] = useState<PublishedExam[]>([]);
    const [examMaterials, setExamMaterials] = useState<ExamMaterial[]>([]);

    useEffect(() => {
        if (!firestore || !user?.schoolId) {
            setLoading(false);
            return;
        }

        setLoading(true);
        const unsubs: (() => void)[] = [];

        // 1. Listen for exams published by the school head
        const publishedQuery = query(
            collection(firestore, `schools/${user.schoolId}/publishedExams`)
        );
        unsubs.push(onSnapshot(publishedQuery, async (pubSnap) => {
            const fetchedPublishedExams = pubSnap.docs.map(d => ({ id: d.id, ...d.data() } as PublishedExam));
            setPublishedExams(fetchedPublishedExams);

            if (fetchedPublishedExams.length > 0 && user.subRegionId) {
                // 2. Based on published exams, find the actual material files
                const uniquePeriods = new Map<string, PublishedExam>();
                fetchedPublishedExams.forEach(pe => {
                    const key = `${pe.academicYear}-${pe.term}-${pe.gradeLevel}`;
                    if (!uniquePeriods.has(key)) {
                        uniquePeriods.set(key, pe);
                    }
                });

                const queries = Array.from(uniquePeriods.values()).map(pe => 
                    query(
                        collection(firestore, 'examMaterials'),
                        where('subRegionId', '==', user.subRegionId),
                        where('academicYear', '==', pe.academicYear),
                        where('term', '==', pe.term),
                        where('gradeLevel', '==', pe.gradeLevel)
                    )
                );
                
                const allMaterials: ExamMaterial[] = [];
                for (const q of queries) {
                    try {
                        const materialSnap = await getDocs(q);
                        materialSnap.docs.forEach(doc => {
                            if (!allMaterials.some(m => m.id === doc.id)) {
                                allMaterials.push({ id: doc.id, ...doc.data() } as ExamMaterial);
                            }
                        });
                    } catch (e) {
                         console.error("Error fetching exam materials with query", e);
                    }
                }
                setExamMaterials(allMaterials);
            } else {
                 setExamMaterials([]);
            }
            setLoading(false);
        }, () => setLoading(false)));

        return () => unsubs.forEach(unsub => unsub());

    }, [firestore, user]);

    const groupedMaterials = useMemo(() => {
        const groups: Record<string, GroupedMaterials> = {};
        examMaterials.forEach(material => {
             const key = `${material.academicYear}-${material.term}-${material.gradeLevel}`;
             if (!groups[key]) {
                 groups[key] = {
                     periodKey: key,
                     academicYear: material.academicYear,
                     term: material.term,
                     gradeLevel: material.gradeLevel,
                     materials: [],
                 };
             }
             groups[key].materials.push(material);
        });
        return Object.values(groups).sort((a, b) => b.periodKey.localeCompare(a.periodKey));
    }, [examMaterials]);
    

  return (
    <div>
      <h2 className="text-3xl font-bold tracking-tight">Past Exam Papers</h2>
      <p className="text-muted-foreground mb-6">
        Access exam papers published by your school head for revision purposes.
      </p>

       {loading ? (
            <div className="flex justify-center p-10"><Loader2 className="h-8 w-8 animate-spin" /></div>
        ) : groupedMaterials.length === 0 ? (
            <Card>
                <CardContent className="p-10 text-center text-muted-foreground">
                    No exam papers have been published by your school head yet.
                </CardContent>
            </Card>
        ) : (
            <div className="space-y-6">
                 {groupedMaterials.map(group => (
                    <Card key={group.periodKey}>
                        <CardHeader>
                            <CardTitle>{group.gradeLevel} - {group.academicYear}, {group.term}</CardTitle>
                            <CardDescription>{group.materials.length} exam paper(s) available.</CardDescription>
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
                                                    {/* Use the new API route to securely fetch the file */}
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
                ))}
            </div>
        )}
    </div>
  );
}

    