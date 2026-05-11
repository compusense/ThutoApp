
'use server';

import { z } from 'zod';
import { admin } from '@/firebase/admin';
import { revalidatePath } from 'next/cache';
import { getAuth } from 'firebase-admin/auth';

const specificObjectiveSchema = z.object({
  id: z.string(),
  text: z.string().min(1, 'Specific objective text cannot be empty'),
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

// Helper function to process and number the syllabus
const processSyllabusValues = (values: z.infer<typeof syllabusSchema>) => {
  return {
    ...values,
    modules: values.modules.map((module, moduleIndex) => ({
      ...module,
      topics: module.topics.map((topic, topicIndex) => ({
        ...topic,
        generalObjectives: topic.generalObjectives.map(
          (genObjective, genObjIndex) => ({
            ...genObjective,
            specificObjectives: genObjective.specificObjectives.map(
              (specObjective, specObjIndex) => ({
                ...specObjective,
                objectiveNumber: `${moduleIndex + 1}.${topicIndex + 1}.${genObjIndex + 1}.${specObjIndex + 1}`,
              })
            ),
          })
        ),
      })),
    })),
  };
};

export async function createSyllabus(
  values: z.infer<typeof syllabusSchema>,
  idToken: string
) {
  const processedValues = processSyllabusValues(values);
  const validatedFields = syllabusSchema.safeParse(processedValues);

  if (!validatedFields.success) {
    console.error(
      'Syllabus validation failed:',
      validatedFields.error.flatten()
    );
    return {
      success: false,
      message: 'Invalid data provided. Please check all fields.',
    };
  }

  try {
    const decodedToken = await getAuth().verifyIdToken(idToken);
    const { uid } = decodedToken;

    if (decodedToken.role !== 'super-admin') {
      return { success: false, message: 'Permission denied.' };
    }

    const newSyllabus = {
      ...validatedFields.data,
      uploadedAt: new Date().toISOString(),
      uploadedBy: uid,
    };

    await admin.firestore().collection('syllabi').add(newSyllabus);

    revalidatePath('/super-admin/syllabus');
    return { success: true, message: 'Syllabus created successfully.' };
  } catch (e: any) {
    console.error('[SERVER ACTION ERROR] createSyllabus:', e);
    return {
      success: false,
      message: e.message || 'An unknown error occurred.',
    };
  }
}

const updateSyllabusSchema = syllabusSchema.extend({
    id: z.string().min(1, 'Syllabus ID is required.'),
});


export async function updateSyllabus(values: z.infer<typeof updateSyllabusSchema>, idToken: string) {
    const processedValues = processSyllabusValues(values);
    const validatedFields = updateSyllabusSchema.safeParse(processedValues);

    if (!validatedFields.success) {
        console.error('Syllabus update validation failed:', validatedFields.error.flatten());
        return { success: false, message: 'Invalid data provided.' };
    }

    try {
        const decodedToken = await getAuth().verifyIdToken(idToken);
        const { uid } = decodedToken;
        if (decodedToken.role !== 'super-admin') {
            return { success: false, message: 'Permission denied.' };
        }

        const { id, ...syllabusData } = validatedFields.data;
        const updatedSyllabus = {
            ...syllabusData,
            lastModifiedAt: new Date().toISOString(),
            lastModifiedBy: uid,
        };

        await admin.firestore().collection('syllabi').doc(id).update(updatedSyllabus);
        
        revalidatePath('/super-admin/syllabus');
        return { success: true, message: 'Syllabus updated successfully.' };

    } catch (e: any) {
        console.error('[SERVER ACTION ERROR] updateSyllabus:', e);
        return { success: false, message: e.message || 'An unknown error occurred.' };
    }
}


export async function deleteSyllabus(id: string, idToken: string) {
  if (!idToken) {
    return { success: false, message: 'Authentication required.' };
  }

  try {
    const decodedToken = await getAuth().verifyIdToken(idToken);
    if (decodedToken.role !== 'super-admin') {
      return { success: false, message: 'Permission denied.' };
    }
    
    await admin.firestore().collection('syllabi').doc(id).delete();
    
    revalidatePath('/super-admin/syllabus');
    return { success: true, message: 'Syllabus deleted successfully.' };
  } catch (e: any) {
    console.error('[SERVER ACTION ERROR] deleteSyllabus:', e);
    return { success: false, message: e.message || 'An unknown error occurred.' };
  }
}

