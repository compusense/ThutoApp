
'use server';

import { z } from 'zod';
import { admin } from '@/firebase/admin';
import { revalidatePath } from 'next/cache';
import { firestore } from 'firebase-admin';
import { UserRecord } from 'firebase-admin/auth';
import { UserProfile } from '@/firebase/auth/use-user';


// Helper to format date as YYYY-MM-DD without timezone conversion issues
function formatDateToYYYYMMDD(date: Date) {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

const createStudentSchema = z.object({
  schoolId: z.string().min(1),
  admissionNumber: z.string().optional(),
  idNumber: z.string().optional(),
  firstName: z.string().min(1, 'First Name is required'),
  surname: z.string().min(1, 'Surname is required'),
  gender: z.enum(['Male', 'Female']),
  dateOfBirth: z.date(),
  classId: z.string().optional(), // Optional class assignment
});

type CreateStudentInput = z.infer<typeof createStudentSchema>;

export async function createStudent(values: CreateStudentInput): Promise<{ success: boolean; message: string }> {
  const validatedFields = createStudentSchema.safeParse(values);

  if (!validatedFields.success) {
    return { success: false, message: validatedFields.error.errors.map(e => e.message).join(', ') };
  }

  try {
    const { schoolId, classId, ...studentData } = validatedFields.data;
    const db = admin.firestore();
    
    const studentsRef = db.collection('schools').doc(schoolId).collection('students');
    
    const finalStudentData: any = {
        ...studentData,
        dateOfBirth: formatDateToYYYYMMDD(studentData.dateOfBirth),
        status: 'Active',
    };
    if (classId) {
        finalStudentData.classId = classId;
    }

    if (finalStudentData.admissionNumber) {
        const existingStudentQuery = await studentsRef.where('admissionNumber', '==', finalStudentData.admissionNumber).get();
        if (!existingStudentQuery.empty) {
            return { success: false, message: `A student with admission number "${finalStudentData.admissionNumber}" already exists.` };
        }
    }
    
    // Create the student document
    const newStudentRef = await studentsRef.add(finalStudentData);
    
    // If a class was selected, also enroll the student in that class's subcollection
    if (classId) {
        const enrollmentRef = db.collection('schools').doc(schoolId).collection('classes').doc(classId).collection('students').doc(newStudentRef.id);
        await enrollmentRef.set({ studentId: newStudentRef.id });
        revalidatePath(`/school-head/classes/${classId}`);
    }
    
    revalidatePath('/school-head/students');
    return { success: true, message: 'Student created successfully.' };
  } catch (error: any) {
    console.error('[SERVER ACTION] ❌ Error during student creation process:', error);
    return { success: false, message: error.message || 'An unexpected error occurred while creating the student.' };
  }
}

const updateStudentSchema = z.object({
  schoolId: z.string(),
  studentId: z.string(),
  admissionNumber: z.string().optional(),
  idNumber: z.string().optional(),
  firstName: z.string().min(1, 'First Name is required'),
  surname: z.string().min(1, 'Surname is required'),
  gender: z.enum(['Male', 'Female']),
  dateOfBirth: z.date(),
});

type UpdateStudentInput = z.infer<typeof updateStudentSchema>;

export async function updateStudent(values: UpdateStudentInput): Promise<{ success: boolean, message: string }> {
    const validatedFields = updateStudentSchema.safeParse(values);
    if (!validatedFields.success) {
        return { success: false, message: 'Invalid input' };
    }

    const { schoolId, studentId, ...dataToUpdate } = validatedFields.data;

    try {
        const studentRef = admin.firestore().collection('schools').doc(schoolId).collection('students').doc(studentId);
        
        await studentRef.update({
            ...dataToUpdate,
            dateOfBirth: formatDateToYYYYMMDD(dataToUpdate.dateOfBirth),
        });

        revalidatePath('/school-head/students');
        return { success: true, message: "Student details updated." };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}

const changeStatusSchema = z.object({
  schoolId: z.string(),
  studentId: z.string(),
  status: z.enum(['Active', 'Dropped Out', 'Transferred Out', 'Deceased']),
  reasonForStatusChange: z.string().optional(),
});

type ChangeStatusInput = z.infer<typeof changeStatusSchema>;

export async function changeStudentStatus(values: ChangeStatusInput): Promise<{ success: boolean, message: string }> {
    const validatedFields = changeStatusSchema.safeParse(values);
    if (!validatedFields.success) {
        return { success: false, message: 'Invalid input' };
    }

    const { schoolId, studentId, status, reasonForStatusChange } = validatedFields.data;
    const db = admin.firestore();
    const batch = db.batch();

    try {
        const studentRecordRef = db.collection('schools').doc(schoolId).collection('students').doc(studentId);
        const studentDoc = await studentRecordRef.get();
        const studentData = studentDoc.data();


        const updateData: any = {
            status,
            dateOfStatusChange: firestore.FieldValue.serverTimestamp()
        };

        if (reasonForStatusChange) {
            updateData.reasonForStatusChange = reasonForStatusChange;
        }

        // When a student becomes inactive, remove them from any class they are enrolled in.
        if (status !== 'Active' && studentData?.classId) {
            const enrollmentRef = db.collection('schools').doc(schoolId).collection('classes').doc(studentData.classId).collection('students').doc(studentId);
            batch.delete(enrollmentRef);
            updateData.classId = firestore.FieldValue.delete(); // Remove classId from student record
        }

        batch.update(studentRecordRef, updateData);
        
        await batch.commit();

        revalidatePath('/school-head/students');
        if (studentData?.classId) {
            revalidatePath(`/school-head/classes/${studentData.classId}`);
        }
        return { success: true, message: `Student status changed to ${status}.` };
    } catch (e: any) {
        console.error('Error changing student status:', e);
        return { success: false, message: e.message };
    }
}

const createStudentUserAccountSchema = z.object({
  schoolId: z.string(),
  studentId: z.string(), // The document ID from the schools/{schoolId}/students subcollection
});

type CreateStudentUserAccountInput = z.infer<typeof createStudentUserAccountSchema>;

// Generates a random password
const generatePassword = (length = 8) => {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let retVal = "";
    for (let i = 0, n = charset.length; i < length; ++i) {
        retVal += charset.charAt(Math.floor(Math.random() * n));
    }
    return retVal;
};

export async function createStudentUserAccount(values: CreateStudentUserAccountInput): Promise<{ success: boolean; message: string; data?: { email: string, password: string } }> {
  const validatedFields = createStudentUserAccountSchema.safeParse(values);
  if (!validatedFields.success) {
    return { success: false, message: 'Invalid input' };
  }

  const { schoolId, studentId } = validatedFields.data;
  const db = admin.firestore();
  const auth = admin.auth();

  try {
    const schoolDoc = await db.collection('schools').doc(schoolId).get();
    if (!schoolDoc.exists) throw new Error("School not found.");
    
    const studentDocRef = db.collection('schools').doc(schoolId).collection('students').doc(studentId);
    const studentDoc = await studentDocRef.get();
    if (!studentDoc.exists) throw new Error("Student not found.");
    const studentData = studentDoc.data()!;

    if (studentData.uid) {
      return { success: false, message: "This student already has a user account." };
    }

    const password = generatePassword(8);
    const emailPrefix = `${studentData.firstName}${studentData.surname}`.toLowerCase().replace(/[^a-z0-9]/g, '');
    const email = `${emailPrefix}@thutoapp.ac.bw`;
    const displayName = `${studentData.firstName} ${studentData.surname}`;
    
    const userRecord = await auth.createUser({
        email,
        password,
        displayName,
    });

    const uid = userRecord.uid;
    const customClaims: { [key: string]: any } = { 
        role: 'student', 
        schoolId: schoolId, 
        subRegionId: schoolDoc.data()?.subRegionId 
    };

    // Correctly add classId and className to custom claims if they exist
    if (studentData.classId) {
        const classDoc = await db.collection('schools').doc(schoolId).collection('classes').doc(studentData.classId).get();
        if (classDoc.exists) {
            customClaims.classId = studentData.classId;
            customClaims.className = classDoc.data()?.name;
        }
    }

    await auth.setCustomUserClaims(uid, customClaims);
    
    const userProfile: any = {
        uid,
        displayName,
        email,
        role: 'student',
        idNumber: studentData.admissionNumber,
        photoURL: null,
        isDeactivated: false,
        detailsComplete: true, // Students don't have a profile completion step
        schoolId: schoolId,
        subRegionId: schoolDoc.data()?.subRegionId,
        // Also store class info directly on the Firestore user document
        classId: customClaims.classId || null,
        className: customClaims.className || null,
    };

    await db.collection('users').doc(uid).set(userProfile);
    await studentDocRef.update({ uid });
    
    revalidatePath('/school-head/students');

    return { 
        success: true, 
        message: 'Student user account created.',
        data: { email, password }
    };
  } catch (error: any) {
    console.error('Error creating student user account:', error);
    return { success: false, message: error.message || 'An unexpected error occurred.' };
  }
}

const bulkStudentsSchema = z.object({
  schoolId: z.string(),
  students: z.array(z.object({
    'Admission Number': z.string().optional(),
    'ID Number': z.string().optional(),
    'First Name': z.string(),
    'Surname': z.string(),
    'Year': z.string(),
    'Month': z.string(),
    'Date': z.string(),
    'Gender': z.enum(['Male', 'Female']),
  }))
});

export async function bulkCreateOrUpdateStudents(values: z.infer<typeof bulkStudentsSchema>): Promise<{ success: boolean; message: string; results: { status: 'created' | 'updated' | 'failed', admissionNumber?: string, reason?: string }[] }> {
    const validatedFields = bulkStudentsSchema.safeParse(values);
    if (!validatedFields.success) {
        return { success: false, message: 'Invalid input.', results: [] };
    }

    const { schoolId, students } = validatedFields.data;
    const db = admin.firestore();
    const studentsRef = db.collection('schools').doc(schoolId).collection('students');
    const results: { status: 'created' | 'updated' | 'failed', admissionNumber?: string, reason?: string }[] = [];

    for (const studentData of students) {
        const admissionNumber = studentData['Admission Number']?.trim();

        try {
            const year = parseInt(studentData['Year']);
            const month = parseInt(studentData['Month']);
            const day = parseInt(studentData['Date']);

            if (isNaN(year) || isNaN(month) || isNaN(day) || month < 1 || month > 12 || day < 1 || day > 31) {
                throw new Error(`Invalid date components for ${studentData['First Name']} ${studentData['Surname']}`);
            }

            const dateOfBirth = new Date(year, month - 1, day).toISOString().split('T')[0];

            const dataToSave = {
                firstName: studentData['First Name'],
                surname: studentData['Surname'],
                dateOfBirth: dateOfBirth,
                gender: studentData['Gender'],
                idNumber: studentData['ID Number'] || null,
                admissionNumber: admissionNumber || null,
                status: 'Active',
            };
            
            if (admissionNumber) {
                const existingStudentQuery = await studentsRef.where('admissionNumber', '==', admissionNumber).limit(1).get();
                if (!existingStudentQuery.empty) {
                    const docId = existingStudentQuery.docs[0].id;
                    await studentsRef.doc(docId).update(dataToSave);
                    results.push({ status: 'updated', admissionNumber });
                } else {
                    await studentsRef.add(dataToSave);
                    results.push({ status: 'created', admissionNumber });
                }
            } else {
                await studentsRef.add(dataToSave);
                results.push({ status: 'created' });
            }
        } catch (e: any) {
             results.push({ status: 'failed', admissionNumber, reason: e.message });
        }
    }
    
    revalidatePath('/school-head/students');
    const successes = results.filter(r => r.status !== 'failed').length;
    const failures = results.length - successes;
    return { 
        success: failures === 0, 
        message: `Processed ${results.length} records. ${successes} successful, ${failures} failed.`,
        results 
    };
}


const resetPasswordSchema = z.object({
  schoolId: z.string(),
  studentId: z.string(),
});

export async function resetStudentPassword(values: z.infer<typeof resetPasswordSchema>): Promise<{ success: boolean; message: string; data?: { newPassword: string } }> {
    const validatedFields = resetPasswordSchema.safeParse(values);
    if (!validatedFields.success) {
        return { success: false, message: 'Invalid input' };
    }

    const { schoolId, studentId } = validatedFields.data;
    const db = admin.firestore();
    const auth = admin.auth();

    try {
        const studentDoc = await db.collection('schools').doc(schoolId).collection('students').doc(studentId).get();
        if (!studentDoc.exists) {
            throw new Error("Student not found.");
        }
        
        const studentData = studentDoc.data()!;
        if (!studentData.uid) {
            throw new Error("This student does not have a login account to reset.");
        }

        const newPassword = generatePassword(8);
        await auth.updateUser(studentData.uid, { password: newPassword });

        return {
            success: true,
            message: "Password has been reset.",
            data: { newPassword },
        };
    } catch (error: any) {
        console.error('Error resetting student password:', error);
        return { success: false, message: error.message || 'An unexpected error occurred.' };
    }
}
