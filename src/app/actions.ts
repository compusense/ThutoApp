
"use server";

import { z } from 'zod';
import { admin } from '@/firebase/admin';
import { revalidatePath } from 'next/cache';

const profileSchema = z.object({
  uid: z.string(),
  firstName: z.string().min(1, 'First name is required'),
  surname: z.string().min(1, 'Surname is required'),
  gender: z.enum(['Male', 'Female']),
  dateOfBirth: z.date(),
  post: z.string(),
  portfolio: z.string().optional(),
  salaryScale: z.string(),
  qualification: z.string(),
  qualificationDetails: z.string().optional(),
  otherQualification: z.string().optional(), // For "Other" qualification text
  nationality: z.string().min(1, 'Nationality is required'),
  otherNationality: z.string().optional(),
  natureOfEmployment: z.enum(['Permanent & Pensionable', 'Contract', 'Temporary']),
}).superRefine((data, ctx) => {
    if ((data.post === 'Senior Teacher 1' || data.post === 'HOD') && !data.portfolio) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Portfolio is required for this post',
            path: ['portfolio'],
        });
    }
    if (data.qualification === 'Degree + PGDE' && !data.qualificationDetails) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Please specify your qualification details',
            path: ['qualificationDetails'],
        });
    }
    if (data.qualification === 'Other Teaching Qualification' && (!data.otherQualification || data.otherQualification.trim() === '')) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Please specify your qualification',
            path: ['otherQualification'],
        });
    }
    if (data.nationality === 'Other' && (!data.otherNationality || data.otherNationality.trim() === '')) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Please specify your nationality',
            path: ['otherNationality'],
        });
    }
});


type ProfileInput = z.infer<typeof profileSchema>;

export async function completeUserProfile(values: ProfileInput): Promise<{ success: boolean; message: string }> {
  const validatedFields = profileSchema.safeParse(values);

  if (!validatedFields.success) {
    return { success: false, message: 'Invalid input.' };
  }

  try {
    const { uid, otherNationality, otherQualification, ...profileData } = validatedFields.data;
    const firestore = admin.firestore();

    const displayName = `${profileData.firstName} ${profileData.surname}`;
    
    const finalNationality = profileData.nationality === 'Other' ? otherNationality : profileData.nationality;
    
    // If 'Other Teaching Qualification' is selected, use the custom input as the main qualification.
    const finalQualification = profileData.qualification === 'Other Teaching Qualification' ? otherQualification : profileData.qualification;

    const userRef = firestore.collection('users').doc(uid);
    await userRef.update({
      ...profileData,
      qualification: finalQualification,
      nationality: finalNationality,
      displayName,
      dateOfBirth: profileData.dateOfBirth.toISOString(),
      detailsComplete: true,
    });

    await admin.auth().updateUser(uid, { displayName });

    revalidatePath('/'); // Revalidate root to trigger layout shifts if needed
    return { success: true, message: 'Profile updated successfully.' };
  } catch (error: any) {
    console.error('[SERVER ACTION] ❌ Error completing user profile:', error);
    return { success: false, message: 'An unexpected error occurred.' };
  }
}
