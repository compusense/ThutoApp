
'use server';

import { z } from 'zod';
import { admin } from '@/firebase/admin';
import { revalidatePath } from 'next/cache';
import { firestore } from 'firebase-admin';
import { UserRecord } from 'firebase-admin/auth';
import { UserProfile } from '@/firebase/auth/use-user';


export async function getUsersWithAuthData(): Promise<UserProfile[]> {
  const db = admin.firestore();
  const auth = admin.auth();

  try {
    const usersSnap = await db.collection('users').get();
    const firestoreUsers = usersSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));

    const authUsersList = await auth.listUsers();
    const authUserMap = new Map<string, UserRecord>();
    authUsersList.users.forEach(user => {
      authUserMap.set(user.uid, user);
    });

    const enrichedUsers = firestoreUsers.map(user => {
      const authUser = authUserMap.get(user.uid);
      return {
        ...user,
        lastSignInTime: authUser?.metadata.lastSignInTime,
      };
    });

    return enrichedUsers;

  } catch (error) {
    console.error("Error fetching users with auth data:", error);
    return [];
  }
}


const createUserSchema = z.object({
  displayName: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['super-admin', 'school-head', 'teacher', 'sub-region-admin', 'student', 'developer']),
  idNumber: z.string().min(1, 'ID number is required'),
  schoolId: z.string().optional(),
  subRegionId: z.string().optional(),
}).refine(data => {
    if ((data.role === 'teacher' || data.role === 'school-head') && !data.schoolId) {
        return false;
    }
    return true;
}, {
    message: "School is required for this role",
    path: ["schoolId"],
}).refine(data => {
    if (data.role === 'sub-region-admin' && !data.subRegionId) {
        return false;
    }
    return true;
}, {
    message: "Sub-Region is required for this role",
    path: ["subRegionId"],
});

type CreateUserInput = z.infer<typeof createUserSchema>;

export async function createUser(values: CreateUserInput): Promise<{ success: boolean; message: string }> {
  const validatedFields = createUserSchema.safeParse(values);

  if (!validatedFields.success) {
    const firstError = validatedFields.error.errors[0];
    return { success: false, message: firstError.message || 'Invalid input.' };
  }

  try {
    const { email, password, displayName, role, idNumber, schoolId } = validatedFields.data;
    let { subRegionId } = validatedFields.data;

    const auth = admin.auth();
    const firestoreDb = admin.firestore();

    const userRecord = await auth.createUser({
      email,
      password,
      displayName,
    });

    const uid = userRecord.uid;

    if (schoolId) {
        const schoolDoc = await firestoreDb.collection('schools').doc(schoolId).get();
        if (schoolDoc.exists && schoolDoc.data()?.subRegionId) {
            subRegionId = schoolDoc.data()?.subRegionId;
        }
    }

    const customClaims: { [key: string]: any } = { role };
    if (schoolId) customClaims.schoolId = schoolId;
    if (subRegionId) customClaims.subRegionId = subRegionId;

    await auth.setCustomUserClaims(uid, customClaims);

    const userProfile: any = {
      uid,
      displayName,
      email,
      role,
      idNumber,
      isDeactivated: false,
      detailsComplete: role === 'developer' || role === 'student',
    };
    
    if (schoolId) userProfile.schoolId = schoolId;
    if (subRegionId) userProfile.subRegionId = subRegionId;

     if (role === 'school-head' && schoolId) {
        await firestoreDb.collection('schools').doc(schoolId).update({ schoolHeadId: uid });
    }

    await firestoreDb.collection('users').doc(uid).set(userProfile);
    
    revalidatePath('/super-admin/users');
    return { success: true, message: 'User created successfully.' };

  } catch (error: any) {
    console.error('[SERVER ACTION] ❌ Error during user creation process:', error);
    let message = 'An unexpected error occurred while creating the user.';

    if (error.code === 'auth/email-already-exists') {
      message = 'A user with this email address already exists.';
    } else if (error.message) {
      message = error.message;
    }

    return { success: false, message };
  }
}


const updateUserSchema = z.object({
  uid: z.string(),
  displayName: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  role: z.enum(['super-admin', 'school-head', 'teacher', 'sub-region-admin', 'student', 'developer']),
  regionId: z.string().optional(),
  subRegionId: z.string().optional(),
  schoolId: z.string().optional(),
}).refine(data => !((data.role === 'teacher' || data.role === 'school-head') && !data.schoolId), {
  message: "School is required for this role",
  path: ["schoolId"],
}).refine(data => !(data.role === 'sub-region-admin' && !data.subRegionId), {
    message: "Sub-Region is required for this role",
    path: ["subRegionId"],
});

type UpdateUserInput = z.infer<typeof updateUserSchema>;

export async function updateUser(values: UpdateUserInput): Promise<{ success: boolean; message: string }> {
  const validatedFields = updateUserSchema.safeParse(values);
  if (!validatedFields.success) {
    return { success: false, message: 'Invalid input.' };
  }
  
  const { uid, ...data } = validatedFields.data;
  let { subRegionId, schoolId } = data;

  try {
    const auth = admin.auth();
    const firestoreDb = admin.firestore();

    await auth.updateUser(uid, {
      email: data.email,
      displayName: data.displayName,
    });
    
    if (data.schoolId) {
        const schoolDoc = await firestoreDb.collection('schools').doc(data.schoolId).get();
        if (schoolDoc.exists && schoolDoc.data()?.subRegionId) {
            subRegionId = schoolDoc.data()?.subRegionId;
        } else {
            subRegionId = undefined;
        }
    } else if (data.role !== 'sub-region-admin') {
      subRegionId = undefined;
    }

    const customClaims: { [key: string]: any } = { role: data.role };
    customClaims.schoolId = data.schoolId || null;
    customClaims.subRegionId = subRegionId || null;

    await auth.setCustomUserClaims(uid, customClaims);
    
    const userRef = firestoreDb.collection('users').doc(uid);
    await userRef.update({
        displayName: data.displayName,
        email: data.email,
        role: data.role,
        schoolId: data.schoolId || null,
        subRegionId: subRegionId || null,
    });
    
    revalidatePath('/super-admin/users');
    return { success: true, message: 'User updated successfully.' };
  } catch (error: any) {
    console.error('[SERVER ACTION] ❌ Error updating user:', error);
    return { success: false, message: error.message || 'An unexpected error occurred.' };
  }
}

export async function sendPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
  try {
    await admin.auth().generatePasswordResetLink(email);
    return { success: true, message: 'Password reset email sent successfully.' };
  } catch (error: any) {
    console.error('[SERVER ACTION] ❌ Error sending password reset:', error);
    return { success: false, message: error.message || 'An unexpected error occurred.' };
  }
}

export async function deactivateUser(uid: string): Promise<{ success: boolean; message: string }> {
    try {
        const auth = admin.auth();
        const firestore = admin.firestore();

        await auth.updateUser(uid, { disabled: true });

        const userRef = firestore.collection('users').doc(uid);
        await userRef.update({
            isDeactivated: true,
            dateOfDeactivation: new Date().toISOString(),
        });

        revalidatePath('/super-admin/users');
        return { success: true, message: 'User deactivated successfully.' };
    } catch (error: any) {
        console.error('[SERVER ACTION] ❌ Error deactivating user:', error);
        return { success: false, message: error.message || 'An unexpected error occurred.' };
    }
}
