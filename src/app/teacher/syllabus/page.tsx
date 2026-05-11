
'use client';

import * as React from 'react';
import { useUser } from '@/firebase/auth/use-user';
import { useFirestore, auth } from '@/firebase';
import { collection, onSnapshot, query, where, getDocs, getDoc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2, Search, PlusCircle } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Subject } from '@/app/super-admin/subjects/page';
import { Class } from '@/app/school-head/classes/page';
import { createNoteFromTopic } from './actions';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { AppLink } from '@/components/ui/app-link';

interface SyllabusModule {
  id: string;
  name: string;
  topics: SyllabusTopic[];
}

interface SyllabusTopic {
  id: string;
  name: string;
  generalObjectives: GeneralObjective[];
}

interface GeneralObjective {
  id: string;
  text: string;
  specificObjectives: SpecificObjective[];
}

interface SpecificObjective {
  id: string;
  objectiveNumber: string;
  text: string;
}

interface SyllabusDocument {
  id: string;
  subjectId: string;
  subjectName?: string;
  gradeLevel: string;
  schoolLevel: string;
  modules: SyllabusModule[];
}

export default function TeacherSyllabusPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [syllabi, setSyllabi] = React.useState<SyllabusDocument[]>([]);
  const [filteredSyllabi, setFilteredSyllabi] = React.useState<SyllabusDocument[]>([]);
  const [teacherClass, setTeacherClass] = React.useState<Class | null>(null);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);


  // Fetch teacher's assigned class and school type
  React.useEffect(() => {
    if (!firestore || !user?.schoolId || !user.uid) {
        setLoading(false);
        return;
    }
    console.log('[SYLLABUS LOG] User identified. Fetching class...');

    const currentYear = new Date().getFullYear().toString();
    const classesRef = collection(firestore, 'schools', user.schoolId, 'classes');
    const q = query(classesRef, where('teacherId', '==', user.uid));

    const unsub = onSnapshot(q, async (classSnap) => {
        if (classSnap.empty) {
            console.log('[SYLLABUS LOG] No classes assigned to this teacher.');
            setTeacherClass(null);
            setLoading(false);
            return;
        }

        let assignedClass: Class | null = null;
        for (const doc of classSnap.docs) {
            const classSubjectsRef = collection(doc.ref, 'subjects');
            const subjectsQuery = query(classSubjectsRef, where('academicYear', '==', currentYear));
            const subjectsSnap = await getDocs(subjectsQuery);
            if (!subjectsSnap.empty) {
                const schoolSnap = await getDoc(doc.ref.parent.parent!);
                assignedClass = {
                  id: doc.id,
                  ...doc.data(),
                  schoolType: schoolSnap.data()?.schoolType
                } as Class;
                break;
            }
        }
        
        if (assignedClass) {
          console.log('[SYLLABUS LOG] Found assigned class for current year:', assignedClass.name);
          setTeacherClass(assignedClass);
        } else {
          console.log('[SYLLABUS LOG] Teacher is assigned to a class, but not for the current academic year.');
          setTeacherClass(null);
        }

    }, (err) => {
        console.error('[SYLLABUS LOG] Error fetching teacher class:', err);
        setError("Could not fetch class assignment.");
        setLoading(false);
    });

    return () => unsub();
  }, [firestore, user]);

  // Fetch syllabi based on the teacher's class
  React.useEffect(() => {
    if (!firestore || !teacherClass) {
      console.log('[SYLLABUS LOG] No teacher class found, clearing syllabi.');
      setSyllabi([]);
      setLoading(false);
      return;
    }
    
    console.log(`[SYLLABUS LOG] Teacher class found. Fetching syllabi for Grade: ${teacherClass.gradeLevel}, Level: ${teacherClass.schoolType}`);
    setLoading(true);

    const q = query(
        collection(firestore, 'syllabi'),
        where('gradeLevel', '==', teacherClass.gradeLevel),
        where('schoolLevel', '==', teacherClass.schoolType)
    );

    const unsub = onSnapshot(q, async (snap) => {
        const subjectIds = snap.docs.map(doc => doc.data().subjectId);
        const subjectMap = new Map<string, string>();
        
        console.log(`[SYLLABUS LOG] Found ${snap.size} syllabi documents. Fetching subject names...`);
        
        if (subjectIds.length > 0) {
            const chunks = [];
            for (let i = 0; i < subjectIds.length; i += 30) {
                chunks.push(subjectIds.slice(i, i + 30));
            }

            for (const chunk of chunks) {
              const subjectsSnap = await getDocs(query(collection(firestore, 'subjects'), where('__name__', 'in', chunk)));
              subjectsSnap.forEach(doc => subjectMap.set(doc.id, doc.data().name));
            }
        }

        const fetchedSyllabi = snap.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            subjectName: subjectMap.get(doc.data().subjectId) || 'Unknown Subject'
        } as SyllabusDocument));
        
        console.log(`[SYLLABUS LOG] Successfully fetched and enriched ${fetchedSyllabi.length} syllabi.`);
        setSyllabi(fetchedSyllabi);
        setLoading(false);
    }, (err) => {
        console.error('[SYLLABUS LOG] Error fetching syllabi:', err);
        setError("Could not load syllabi from the database.");
        setLoading(false);
    });

    return () => unsub();
  }, [firestore, teacherClass]);


  // Filter syllabi based on search term
  React.useEffect(() => {
    if (!searchTerm) {
      setFilteredSyllabi(syllabi);
      return;
    }

    const lowercasedFilter = searchTerm.toLowerCase();
    console.log(`[SYLLABUS LOG] Filtering with term: "${lowercasedFilter}"`);

    const filtered = syllabi.map(syllabus => {
        const matchingModules = syllabus.modules.map(module => {
            const matchingTopics = module.topics.map(topic => {
                 const topicMatch = topic.name.toLowerCase().includes(lowercasedFilter);
                 
                 const matchingGeneralObjectives = topic.generalObjectives.map(genObjective => {
                     const genObjectiveMatch = genObjective.text.toLowerCase().includes(lowercasedFilter);

                     const matchingSpecificObjectives = genObjective.specificObjectives.filter(specObjective => 
                        specObjective.text.toLowerCase().includes(lowercasedFilter)
                     );

                     if (matchingSpecificObjectives.length > 0) {
                         return { ...genObjective, specificObjectives: matchingSpecificObjectives };
                     }
                     if (genObjectiveMatch) {
                         return genObjective;
                     }
                     return null;

                 }).filter(Boolean) as GeneralObjective[];

                 if (matchingGeneralObjectives.length > 0) {
                     return { ...topic, generalObjectives: matchingGeneralObjectives };
                 }
                 if (topicMatch) {
                     return topic;
                 }
                 return null;

            }).filter(Boolean) as SyllabusTopic[];
            
            if (matchingTopics.length > 0) {
                return { ...module, topics: matchingTopics };
            }
             if (module.name.toLowerCase().includes(lowercasedFilter)) {
                return module;
            }
            return null;
        }).filter(Boolean) as SyllabusModule[];

        if (matchingModules.length > 0) {
            return { ...syllabus, modules: matchingModules };
        }
        if (syllabus.subjectName?.toLowerCase().includes(lowercasedFilter)) {
            return syllabus;
        }
        return null;
    }).filter(Boolean) as SyllabusDocument[];

    setFilteredSyllabi(filtered);
  }, [searchTerm, syllabi]);
  
  const handleCreateNote = async (topic: SyllabusTopic, subjectId: string) => {
    if (!user || !teacherClass) return;

    let content = `### General Objectives\n`;
    topic.generalObjectives.forEach(go => {
        content += `- ${go.text}\n`;
        go.specificObjectives.forEach(so => {
            content += `  - **${so.objectiveNumber}**: ${so.text}\n`;
        });
    });

    try {
        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) throw new Error("Authentication required.");

        const result = await createNoteFromTopic({
            title: topic.name,
            content,
            createdBy: user.uid,
            classId: teacherClass.id,
            schoolId: user.schoolId!,
            subjectId: subjectId,
        }, idToken);

        if (result.success && result.noteId) {
            toast({
                title: 'Note Created',
                description: `A new note for "${topic.name}" has been created.`,
                action: (
                    <Button asChild variant="secondary">
                        <AppLink href={`/teacher/notes/${result.noteId}`}>View Note</AppLink>
                    </Button>
                )
            });
        } else {
            throw new Error(result.message);
        }
    } catch (e: any) {
        toast({
            variant: 'destructive',
            title: 'Error',
            description: e.message || 'Could not create note.'
        });
    }
  };


  return (
    <div className="space-y-6">
        <div>
            <h2 className="text-3xl font-bold tracking-tight">Syllabus Explorer</h2>
            <p className="text-muted-foreground">Search for topics and learning objectives in your grade's curriculum.</p>
        </div>
        
        <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input 
                placeholder="Search by subject, topic or objective..."
                className="pl-10 text-base"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                disabled={loading || !teacherClass}
            />
        </div>

        {loading ? (
             <div className="flex justify-center p-10"><Loader2 className="h-8 w-8 animate-spin" /></div>
        ) : error ? (
            <Card><CardContent className="p-10 text-center text-destructive">{error}</CardContent></Card>
        ) : syllabi.length === 0 ? (
            <Card>
                <CardContent className="p-10 text-center text-muted-foreground">
                    {teacherClass ? `No syllabi found for ${teacherClass.gradeLevel}.` : "You are not assigned to a class for the current year."}
                </CardContent>
            </Card>
        ) : filteredSyllabi.length === 0 && searchTerm ? (
            <Card>
                <CardContent className="p-10 text-center text-muted-foreground">
                    No results found for "{searchTerm}".
                </CardContent>
            </Card>
        ) : (
            <Accordion type="multiple" className="w-full space-y-4">
                {filteredSyllabi.map(syllabus => (
                    <Card key={syllabus.id}>
                         <AccordionItem value={syllabus.id} className="border-b-0">
                            <AccordionTrigger className="p-6 text-xl font-semibold hover:no-underline">
                               {syllabus.subjectName} - {syllabus.gradeLevel}
                            </AccordionTrigger>
                            <AccordionContent className="px-6 pb-6">
                                <Accordion type="multiple" className="w-full space-y-2">
                                {syllabus.modules.map(module => (
                                    <Card key={module.id} className="bg-muted/30">
                                        <AccordionItem value={module.id} className="border-b-0">
                                            <AccordionTrigger className="p-4 text-lg font-medium hover:no-underline">
                                                {module.name}
                                            </AccordionTrigger>
                                            <AccordionContent className="p-4 pt-0 space-y-4">
                                                {module.topics.map(topic => (
                                                    <div key={topic.id} className="pl-4 border-l-2 ml-2">
                                                        <div className="flex justify-between items-center mb-2">
                                                          <h4 className="font-semibold text-base">{topic.name}</h4>
                                                          <Button size="sm" variant="outline" onClick={() => handleCreateNote(topic, syllabus.subjectId)}>
                                                              <PlusCircle className="h-4 w-4 mr-2" />
                                                              Create Note
                                                          </Button>
                                                        </div>
                                                        <ul className="space-y-2 pl-4">
                                                            {topic.generalObjectives.map(go => (
                                                                <li key={go.id}>
                                                                    <p className="font-medium text-primary">{go.text}</p>
                                                                    <ul className="list-disc pl-6 mt-1 space-y-1 text-sm text-muted-foreground">
                                                                        {go.specificObjectives.map(so => (
                                                                            <li key={so.id}>
                                                                                <span className="font-semibold">{so.objectiveNumber}:</span> {so.text}
                                                                            </li>
                                                                        ))}
                                                                    </ul>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                ))}
                                            </AccordionContent>
                                        </AccordionItem>
                                    </Card>
                                ))}
                                </Accordion>
                            </AccordionContent>
                        </AccordionItem>
                    </Card>
                ))}
            </Accordion>
        )}
    </div>
  );
}
