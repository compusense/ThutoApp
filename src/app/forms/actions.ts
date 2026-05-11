
'use server';

import { z } from 'zod';
import { admin } from '@/firebase/admin';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { getAuth } from 'firebase-admin/auth';
import { firestore } from 'firebase-admin';

// Schema for creating a form - now defines columns for a table
const formSchema = z.object({
  title: z.string().min(3, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  columns: z.array(z.object({
    id: z.string(),
    label: z.string().min(1, 'Column label is required'),
    type: z.enum(['text', 'textarea', 'date', 'number', 'select-teacher']),
  })).min(1, 'At least one column is required'),
});


export async function createForm(values: z.infer<typeof formSchema>, idToken: string) {
  const validatedFields = formSchema.safeParse(values);
  if (!validatedFields.success) {
    return { success: false, message: 'Invalid form data.' };
  }

  if (!idToken) {
    return { success: false, message: 'Authentication required.' };
  }

  try {
    const decodedToken = await getAuth().verifyIdToken(idToken);
    const { uid } = decodedToken;
    const userRole = decodedToken.role;
    const subRegionId = decodedToken.subRegionId;

    if (userRole !== 'sub-region-admin' || !subRegionId) {
        return { success: false, message: 'You do not have permission to create forms.' };
    }

    const newForm = {
      title: validatedFields.data.title,
      description: validatedFields.data.description,
      fields: validatedFields.data.columns, // Renamed to 'fields' to match schema
      createdBy: uid,
      subRegionId,
      createdAt: new Date().toISOString(),
      status: 'published' as const,
    };
    
    await admin.firestore().collection('forms').add(newForm);

    revalidatePath('/forms');
    return { success: true, message: 'Form created successfully.' };
  } catch (error: any)
{
    console.error('[SERVER ACTION] Error creating form:', error);
    return { success: false, message: error.message || 'An error occurred while creating the form.' };
  }
}

// Schema for submitting a form - responses are now an array of rows
const submissionSchema = z.object({
  formId: z.string(),
  rows: z.array(z.record(z.any())),
});

export async function submitForm(values: z.infer<typeof submissionSchema>, idToken: string) {
    const validatedFields = submissionSchema.safeParse(values);
    if (!validatedFields.success) {
        return { success: false, message: 'Invalid submission data.' };
    }

    if (!idToken) {
        return { success: false, message: 'Authentication required.' };
    }

    try {
        const decodedToken = await getAuth().verifyIdToken(idToken);
        const { uid } = decodedToken;
        const schoolId = decodedToken.schoolId;

        if (decodedToken.role !== 'school-head' || !schoolId) {
            return { success: false, message: 'Only school heads can submit forms.' };
        }

        const { formId, rows } = validatedFields.data;

        const serializedRows = rows.map(row => {
            const rowData: Record<string, any> = {};
            for (const fieldId in row) {
                const value = row[fieldId];
                rowData[fieldId] = value instanceof Date ? value.toISOString() : value;
            }
            return rowData;
        });


        const submissionData = {
            formId,
            schoolId,
            submittedBy: uid,
            submittedAt: new Date().toISOString(),
            responses: serializedRows,
        };

        await admin.firestore().collection('forms').doc(formId).collection('submissions').add(submissionData);

        revalidatePath('/forms');
        return { success: true, message: 'Form submitted successfully.' };
    } catch (error: any) {
        console.error("Error submitting form: ", error);
        return { success: false, message: error.message || 'An error occurred.' };
    }
}


// Action to get teachers for a school (callable from the client form)
export async function getSchoolTeachers(schoolId: string) {
    try {
        const usersSnap = await admin.firestore().collection('users')
            .where('schoolId', '==', schoolId)
            .where('role', 'in', ['teacher', 'school-head', 'deputy-school-head'])
            .get();

        if (usersSnap.empty) return [];

        return usersSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() })) as any[];
    } catch (e: any) {
        console.error("Error getting school teachers", e.message);
        return [];
    }
}

export async function getSchoolName(schoolId: string): Promise<string> {
    try {
        const schoolDoc = await admin.firestore().collection('schools').doc(schoolId).get();
        return schoolDoc.exists ? schoolDoc.data()?.name : 'Unknown School';
    } catch {
        return 'Unknown School';
    }
}


export async function exportSubmissions(formId: string) {
    try {
        const db = admin.firestore();
        const formSnap = await db.collection('forms').doc(formId).get();
        if (!formSnap.exists) {
            throw new Error("Form not found");
        }
        const formDef = formSnap.data() as any;
        const teacherFields = formDef.fields.filter((f: any) => f.type === 'select-teacher').map((f: any) => f.id);

        const submissionsSnap = await db.collection('forms').doc(formId).collection('submissions').get();
        if (submissionsSnap.empty) {
            return { success: true, data: { headers: [], rows: [], title: formDef.title } };
        }

        // Fetch all schools and teachers in parallel
        const schoolIds = [...new Set(submissionsSnap.docs.map(d => d.data().schoolId))];
        const schoolsSnap = await db.collection('schools').where(firestore.FieldPath.documentId(), 'in', schoolIds).get();
        const schoolNameMap = new Map(schoolsSnap.docs.map(d => [d.id, d.data().name]));
        
        let allTeacherUids = new Set<string>();
        if (teacherFields.length > 0) {
            submissionsSnap.docs.forEach(subDoc => {
                const subData = subDoc.data();
                subData.responses.forEach((response: Record<string, any>) => {
                    teacherFields.forEach((fieldId: string) => {
                        if (response[fieldId]) allTeacherUids.add(response[fieldId]);
                    });
                });
            });
        }

        let teacherNameMap = new Map<string, string>();
        if (allTeacherUids.size > 0) {
            const teachersSnap = await db.collection('users').where(firestore.FieldPath.documentId(), 'in', Array.from(allTeacherUids)).get();
            teachersSnap.docs.forEach(doc => {
                teacherNameMap.set(doc.id, doc.data().displayName);
            });
        }


        const headers = ['School', ...formDef.fields.map((f: any) => f.label)];
        const rows: (string | number)[][] = [];

        submissionsSnap.docs.forEach(subDoc => {
            const subData = subDoc.data();
            const schoolName = schoolNameMap.get(subData.schoolId) || subData.schoolId;

            subData.responses.forEach((response: Record<string, any>) => {
                const row: (string | number)[] = [schoolName];
                formDef.fields.forEach((field: any) => {
                    let value = response[field.id];
                     if (field.type === 'date' && value) {
                        try { row.push(new Date(value).toLocaleDateString()); } catch { row.push(value); }
                    } else if (field.type === 'select-teacher' && value) {
                        row.push(teacherNameMap.get(value) || value);
                    } else if (typeof value !== 'undefined' && value !== null) {
                        row.push(value);
                    } else {
                        row.push('');
                    }
                });
                rows.push(row);
            });
        });
        
        return { success: true, data: { headers, rows, title: formDef.title } };

    } catch (error: any) {
        console.error("Error exporting submissions: ", error);
        return { success: false, message: error.message };
    }
}


export async function getDisplayNamesFromUids(uids: string[]): Promise<Map<string, string>> {
    const nameMap = new Map<string, string>();
    if (uids.length === 0) return nameMap;

    try {
        const usersSnap = await admin.firestore().collection('users').where(firestore.FieldPath.documentId(), 'in', uids).get();
        usersSnap.forEach(doc => {
            nameMap.set(doc.id, doc.data().displayName || doc.id);
        });
        return nameMap;
    } catch(e) {
        console.error("Error fetching user display names", e);
        return nameMap;
    }
}

export async function archiveForm(formId: string, idToken: string): Promise<{ success: boolean; message: string }> {
    if (!idToken) {
        return { success: false, message: 'Authentication required.' };
    }

    try {
        const decodedToken = await getAuth().verifyIdToken(idToken);
        const { uid } = decodedToken;

        const formRef = admin.firestore().collection('forms').doc(formId);
        const formDoc = await formRef.get();

        if (!formDoc.exists) {
            return { success: false, message: 'Form not found.' };
        }

        if (formDoc.data()?.createdBy !== uid) {
            return { success: false, message: 'You do not have permission to archive this form.' };
        }

        await formRef.update({ status: 'archived' });

        revalidatePath('/forms');
        revalidatePath(`/forms/${formId}/submissions`);
        return { success: true, message: 'Form archived successfully.' };

    } catch (error: any) {
        console.error("Error archiving form: ", error);
        return { success: false, message: error.message || 'An error occurred.' };
    }
}

    