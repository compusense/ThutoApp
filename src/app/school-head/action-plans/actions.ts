
'use server';

import { z } from 'zod';
import { admin } from '@/firebase/admin';
import { revalidatePath } from 'next/cache';
import { firestore } from 'firebase-admin';

const actionPlanEventSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  date: z.date(),
  type: z.enum(['Meeting', 'Sports', 'Exam', 'Cultural', 'Other']),
  description: z.string().optional(),
});

const saveActionPlanSchema = z.object({
  schoolId: z.string(),
  academicYear: z.string(),
  term: z.string(),
  events: z.array(actionPlanEventSchema),
});

type SaveActionPlanInput = z.infer<typeof saveActionPlanSchema>;

export async function saveActionPlan(values: SaveActionPlanInput) {
  const validatedFields = saveActionPlanSchema.safeParse(values);
  if (!validatedFields.success) {
    return { success: false, message: 'Invalid input' };
  }

  const { schoolId, academicYear, term, events } = validatedFields.data;
  const db = admin.firestore();
  
  // Use a consistent ID for the document to ensure only one plan per period.
  const docId = `${academicYear}-${term.replace(' ', '')}`;
  const actionPlanRef = db.collection('schools').doc(schoolId).collection('actionPlans').doc(docId);

  try {
    const serializedEvents = events.map(event => ({
        ...event,
        date: event.date.toISOString(),
    }));

    await actionPlanRef.set({
        schoolId,
        academicYear,
        term,
        events: serializedEvents,
        lastModified: firestore.FieldValue.serverTimestamp(),
    }, { merge: true }); // Use merge to avoid overwriting other fields if they exist.

    revalidatePath(`/school-head/action-plans`);
    revalidatePath(`/teacher/dashboard`);
    return { success: true, message: 'Action plan saved successfully.' };
  } catch (error) {
    console.error('Error saving action plan:', error);
    return { success: false, message: 'Failed to save action plan.' };
  }
}
