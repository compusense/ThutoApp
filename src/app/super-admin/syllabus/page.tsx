
'use client';

import {
  useState,
  useMemo,
  useEffect,
  useCallback,
  ChangeEvent,
} from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  PlusCircle,
  Trash2,
  Save,
  Loader2,
  BookCopy,
  Eraser,
  Pencil,
} from 'lucide-react';
import {
  useForm,
  useFieldArray,
  FormProvider,
  useFormContext,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { v4 as uuidv4 } from 'uuid';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Subject } from '@/app/super-admin/subjects/page';
import { useFirestore, auth } from '@/firebase';
import {
  collection,
  query,
  onSnapshot,
  where,
  getDocs,
  getDoc,
} from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { createSyllabus, updateSyllabus } from './actions';
import { ManageSyllabiTab, Syllabus } from './components/manage-syllabi-tab';

const schoolLevels = [
  'Primary School',
  'Junior Secondary School',
  'Senior Secondary School',
];

const gradeLevelsBySchool: Record<string, string[]> = {
  'Primary School': [
    'Reception',
    'Standard 1',
    'Standard 2',
    'Standard 3',
    'Standard 4',
    'Standard 5',
    'Standard 6',
    'Standard 7',
  ],
  'Junior Secondary School': ['Form 1', 'Form 2', 'Form 3'],
  'Senior Secondary School': ['Form 4', 'Form 5'],
};

// --- Zod Schemas ---
const specificObjectiveSchema = z.object({
  id: z.string(),
  text: z.string().min(1, 'Specific objective text cannot be empty.'),
  objectiveNumber: z.string(),
});

const generalObjectiveSchema = z.object({
  id: z.string(),
  text: z.string().min(1, 'General objective text cannot be empty'),
  specificObjectives: z
    .array(specificObjectiveSchema)
    .min(1, 'At least one specific objective is required.'),
});

const topicSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Topic name is required.'),
  generalObjectives: z
    .array(generalObjectiveSchema)
    .min(1, 'At least one general objective is required.'),
});

const moduleSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Module name is required.'),
  topics: z.array(topicSchema).min(1, 'At least one topic is required.'),
});

const syllabusSchema = z.object({
  schoolLevel: z.string().min(1, 'School Level is required'),
  gradeLevel: z.string().min(1, 'Grade Level is required'),
  subjectId: z.string().min(1, 'Subject is required'),
  modules: z.array(moduleSchema).min(1, 'At least one module is required.'),
});

type SyllabusFormValues = z.infer<typeof syllabusSchema>;

const FORM_STORAGE_KEY = 'thuto-syllabus-builder-draft';

export default function SyllabusManagementPage() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingSyllabusId, setEditingSyllabusId] = useState<string | null>(
    null
  );
  const [activeTab, setActiveTab] = useState('builder');

  const form = useForm<SyllabusFormValues>({
    resolver: zodResolver(syllabusSchema),
    defaultValues: {
      schoolLevel: '',
      gradeLevel: '',
      subjectId: '',
      modules: [],
    },
  });

  const { control, handleSubmit, watch, reset, resetField } = form;

  const {
    fields: moduleFields,
    append: appendModule,
    remove: removeModule,
  } = useFieldArray({
    control,
    name: 'modules',
  });

  const watchedSchoolLevel = watch('schoolLevel');
  const availableGradeLevels = gradeLevelsBySchool[watchedSchoolLevel] || [];
  const availableSubjects = useMemo(() => {
    return allSubjects.filter((s) => s.schoolLevel === watchedSchoolLevel);
  }, [allSubjects, watchedSchoolLevel]);

  // Load saved draft from localStorage on initial render, but only if not in edit mode
  useEffect(() => {
    if (editingSyllabusId) return;

    const savedDraft = localStorage.getItem(FORM_STORAGE_KEY);
    if (savedDraft) {
      try {
        const parsedData = JSON.parse(savedDraft);
        reset(parsedData);
        toast({
          title: 'Draft Loaded',
          description: 'Your previous unsaved syllabus has been loaded.',
        });
      } catch (e) {
        console.error('Failed to parse syllabus draft from localStorage', e);
      }
    }
  }, [reset, toast, editingSyllabusId]); // Add editingSyllabusId here

  // Save draft to localStorage on change, but only if not in edit mode
  useEffect(() => {
    if (editingSyllabusId) return;

    const subscription = watch((value) => {
      localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(value));
    });
    return () => subscription.unsubscribe();
  }, [watch, editingSyllabusId]);

  useEffect(() => {
    resetField('gradeLevel');
    resetField('subjectId');
  }, [watchedSchoolLevel, resetField]);

  useEffect(() => {
    if (!firestore) {
      setLoadingSubjects(false);
      return;
    }
    const q = query(collection(firestore, 'subjects'));
    const unsub = onSnapshot(q, (snap) => {
      const subjects = snap.docs.map(
        (d) => ({ ...d.data(), id: d.id } as Subject)
      );
      setAllSubjects(subjects);
      setLoadingSubjects(false);
    });
    return () => unsub();
  }, [firestore]);

  const onSubmit = async (values: SyllabusFormValues) => {
    setIsSubmitting(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error('Authentication required.');

      let result;
      if (editingSyllabusId) {
        // We are updating
        result = await updateSyllabus(
          { ...values, id: editingSyllabusId },
          idToken
        );
      } else {
        // We are creating
        result = await createSyllabus(values, idToken);
      }

      if (result.success) {
        toast({ title: 'Success', description: result.message });
        if (!editingSyllabusId) {
          localStorage.removeItem(FORM_STORAGE_KEY);
        }
        handleClearForm(); // This will also clear the editing state
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClearForm = () => {
    localStorage.removeItem(FORM_STORAGE_KEY);
    reset({
      schoolLevel: '',
      gradeLevel: '',
      subjectId: '',
      modules: [],
    });
    setEditingSyllabusId(null);
    toast({
      title: 'Form Cleared',
      description: 'The syllabus builder has been reset.',
    });
  };

  const handleEditSyllabus = (syllabus: Syllabus) => {
    // Generate client-side IDs for nested arrays since they don't have them in Firestore
    const dataWithIds = {
      ...syllabus,
      modules: syllabus.modules.map((m) => ({
        ...m,
        id: m.id || uuidv4(),
        topics: m.topics.map((t: any) => ({
          ...t,
          id: t.id || uuidv4(),
          generalObjectives: t.generalObjectives.map((go: any) => ({
            ...go,
            id: go.id || uuidv4(),
            specificObjectives: go.specificObjectives.map((so: any) => ({
              ...so,
              id: so.id || uuidv4(),
            })),
          })),
        })),
      })),
    };
    reset(dataWithIds);
    setEditingSyllabusId(syllabus.id);
    setActiveTab('builder');
    toast({
      title: 'Editing Syllabus',
      description: `Loaded syllabus for ${syllabus.subjectName}.`,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Syllabus Management</h2>
        <p className="text-muted-foreground">
          Build and manage curriculum syllabi for all school levels and
          subjects.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="builder">Syllabus Builder</TabsTrigger>
          <TabsTrigger value="manage">Manage Syllabi</TabsTrigger>
        </TabsList>
        <TabsContent value="builder" className="mt-6">
          <FormProvider {...form}>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle>
                        {editingSyllabusId
                          ? 'Editing Syllabus'
                          : 'Syllabus Details'}
                      </CardTitle>
                      <CardDescription>
                        {editingSyllabusId
                          ? 'You are editing an existing syllabus. Save your changes when done.'
                          : 'Define the syllabus and its associated curriculum level.'}
                      </CardDescription>
                    </div>
                    {editingSyllabusId && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleClearForm}
                      >
                        {' '}
                        <Pencil className="mr-2" /> Start New Syllabus
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="grid md:grid-cols-3 gap-4">
                  <FormField
                    control={control}
                    name="schoolLevel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>School Level</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select School Level" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {schoolLevels.map((l) => (
                              <SelectItem key={l} value={l}>
                                {l}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={control}
                    name="gradeLevel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Grade/Standard</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                          disabled={availableGradeLevels.length === 0}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select Grade" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {availableGradeLevels.map((l) => (
                              <SelectItem key={l} value={l}>
                                {l}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={control}
                    name="subjectId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subject</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                          disabled={availableSubjects.length === 0}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select Subject" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {availableSubjects.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle>Syllabus Modules</CardTitle>
                      <CardDescription>
                        Add one or more modules to this syllabus.
                      </CardDescription>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        appendModule({ id: uuidv4(), name: '', topics: [] })
                      }
                    >
                      <PlusCircle className="mr-2" /> Add Module
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Accordion type="multiple" className="w-full space-y-4">
                    {moduleFields.map((module, moduleIndex) => (
                      <ModuleArray
                        key={module.id}
                        moduleIndex={moduleIndex}
                        removeModule={removeModule}
                      />
                    ))}
                  </Accordion>
                  {form.formState.errors.modules && (
                    <p className="text-sm font-medium text-destructive">
                      {form.formState.errors.modules.root?.message ||
                        form.formState.errors.modules.message}
                    </p>
                  )}
                </CardContent>
              </Card>

              <div className="flex justify-between">
                <Button type="button" variant="ghost" onClick={handleClearForm}>
                  <Eraser className="mr-2" />
                  Clear Form
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <Loader2 className="animate-spin mr-2" />
                  ) : (
                    <Save className="mr-2" />
                  )}
                  {editingSyllabusId ? 'Update Syllabus' : 'Save Syllabus'}
                </Button>
              </div>
            </form>
          </FormProvider>
        </TabsContent>
        <TabsContent value="manage" className="mt-6">
          <ManageSyllabiTab
            allSubjects={allSubjects}
            onEdit={handleEditSyllabus}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ------ NESTED COMPONENTS ------

function ModuleArray({
  moduleIndex,
  removeModule,
}: {
  moduleIndex: number;
  removeModule: (index: number) => void;
}) {
  const { control } = useFormContext();
  const {
    fields: topicFields,
    append: appendTopic,
    remove: removeTopic,
  } = useFieldArray({
    control,
    name: `modules.${moduleIndex}.topics`,
  });

  return (
    <Card className="border-primary/50">
      <Accordion type="single" collapsible defaultValue="module-content">
        <AccordionItem value="module-content" className="border-none">
          <AccordionTrigger className="p-4 hover:no-underline bg-primary/5 text-primary">
            <div className="flex items-center gap-4 flex-1 text-left">
              <span className="text-2xl font-bold">{`${moduleIndex + 1}.`}</span>
              <FormField
                control={control}
                name={`modules.${moduleIndex}.name`}
                render={({ field }) => (
                  <FormItem className="flex-grow">
                    <FormControl>
                      <Input
                        placeholder={`Module ${moduleIndex + 1} Name`}
                        {...field}
                        className="text-lg font-semibold border-0 bg-transparent focus-visible:ring-1 focus-visible:ring-ring"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </AccordionTrigger>
          <AccordionContent className="p-4 space-y-4">
            <div className="flex justify-end">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => removeModule(moduleIndex)}
              >
                <Trash2 className="mr-2" /> Remove Module
              </Button>
            </div>
            <Accordion type="multiple" className="w-full space-y-4">
              {topicFields.map((topic, topicIndex) => (
                <TopicArray
                  key={topic.id}
                  moduleIndex={moduleIndex}
                  topicIndex={topicIndex}
                  removeTopic={removeTopic}
                />
              ))}
            </Accordion>
            <div className="flex justify-start pt-4 border-t">
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  appendTopic({
                    id: uuidv4(),
                    name: '',
                    generalObjectives: [
                      {
                        id: uuidv4(),
                        text: '',
                        specificObjectives: [
                          { id: uuidv4(), text: '', objectiveNumber: '' },
                        ],
                      },
                    ],
                  })
                }
              >
                <PlusCircle className="mr-2" /> Add Topic
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
  );
}

function TopicArray({
  moduleIndex,
  topicIndex,
  removeTopic,
}: {
  moduleIndex: number;
  topicIndex: number;
  removeTopic: (index: number) => void;
}) {
  const { control, watch } = useFormContext();
  return (
    <Card className="overflow-hidden">
      <AccordionItem
        value={`topic-${moduleIndex}-${topicIndex}`}
        className="border-none"
      >
        <AccordionTrigger className="p-4 hover:no-underline bg-muted/50">
          <div className="flex items-center gap-4 flex-1 text-left">
            <span className="text-lg font-bold text-primary">{`${
              moduleIndex + 1
            }.${topicIndex + 1}`}</span>
            <p className="font-semibold">
              {watch(`modules.${moduleIndex}.topics.${topicIndex}.name`) ||
                `Topic ${topicIndex + 1}`}
            </p>
          </div>
        </AccordionTrigger>
        <AccordionContent className="p-4 space-y-4">
          <div className="flex justify-end">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => removeTopic(topicIndex)}
            >
              <Trash2 className="mr-2" /> Remove Topic
            </Button>
          </div>
          <FormField
            control={control}
            name={`modules.${moduleIndex}.topics.${topicIndex}.name`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Topic Name</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="space-y-3 pt-4">
            <h4 className="font-medium">General Objectives</h4>
            <GeneralObjectivesArray
              moduleIndex={moduleIndex}
              topicIndex={topicIndex}
            />
          </div>
        </AccordionContent>
      </AccordionItem>
    </Card>
  );
}

function GeneralObjectivesArray({
  moduleIndex,
  topicIndex,
}: {
  moduleIndex: number;
  topicIndex: number;
}) {
  const { control } = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control,
    name: `modules.${moduleIndex}.topics.${topicIndex}.generalObjectives`,
  });

  return (
    <div className="space-y-4 pl-4">
      {fields.map((field, index) => (
        <Card key={field.id} className="p-4 bg-background">
          <div className="flex justify-between items-start mb-4">
            <div className="font-semibold">{`${moduleIndex + 1}.${
              topicIndex + 1
            }.${index + 1} General Objective`}</div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => remove(index)}
            >
              <Trash2 className="h-4 w-4 text-destructive mr-2" /> Remove
            </Button>
          </div>
          <div className="space-y-4">
            <FormField
              control={control}
              name={`modules.${moduleIndex}.topics.${topicIndex}.generalObjectives.${index}.text`}
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the general objective..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="pl-6 space-y-2">
              <h5 className="font-medium text-sm">Specific Objectives</h5>
              <SpecificObjectivesArray
                moduleIndex={moduleIndex}
                topicIndex={topicIndex}
                generalObjectiveIndex={index}
              />
            </div>
          </div>
        </Card>
      ))}
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={() =>
          append({
            id: uuidv4(),
            text: '',
            specificObjectives: [
              { id: uuidv4(), text: '', objectiveNumber: '' },
            ],
          })
        }
      >
        <PlusCircle className="mr-2 h-4 w-4" /> Add General Objective
      </Button>
    </div>
  );
}

function SpecificObjectivesArray({
  moduleIndex,
  topicIndex,
  generalObjectiveIndex,
}: {
  moduleIndex: number;
  topicIndex: number;
  generalObjectiveIndex: number;
}) {
  const { control } = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control,
    name: `modules.${moduleIndex}.topics.${topicIndex}.generalObjectives.${generalObjectiveIndex}.specificObjectives`,
  });

  return (
    <div className="space-y-4">
      {fields.map((field, index) => (
        <div key={field.id} className="flex items-start gap-2">
          <span className="pt-2 text-sm font-semibold text-muted-foreground w-20">{`${
            moduleIndex + 1
          }.${topicIndex + 1}.${generalObjectiveIndex + 1}.${
            index + 1
          }`}</span>
          <FormField
            control={control}
            name={`modules.${moduleIndex}.topics.${topicIndex}.generalObjectives.${generalObjectiveIndex}.specificObjectives.${index}.text`}
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormControl>
                  <Textarea
                    placeholder={`Specific objective text...`}
                    {...field}
                    rows={1}
                    className="min-h-0"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => remove(index)}
            className="shrink-0 mt-2"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => append({ id: uuidv4(), text: '', objectiveNumber: '' })}
      >
        <PlusCircle className="mr-2 h-4 w-4" /> Add Specific Objective
      </Button>
    </div>
  );
}
