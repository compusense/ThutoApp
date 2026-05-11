'use server';

import { admin } from '@/firebase/admin';
import { getAuth } from 'firebase-admin/auth';

/**
 * Performs a global search across database entities based on user role.
 */
export async function globalSearch(queryText: string, idToken: string) {
  if (!idToken || !queryText || queryText.trim().length < 2) {
    return { success: true, results: { entities: [] } };
  }

  const cleanQuery = queryText.trim();

  try {
    const decodedToken = await getAuth().verifyIdToken(idToken);
    const { role, schoolId, subRegionId } = decodedToken;
    const db = admin.firestore();

    const entityResults: any[] = [];

    // Standardize search string (Capitalized for Firestore prefix matching for students/schools)
    const searchStr = cleanQuery.split(' ')[0];
    const capitalized = searchStr.charAt(0).toUpperCase() + searchStr.slice(1).toLowerCase();

    if ((role === 'teacher' || role === 'school-head') && schoolId) {
      // --- Search students in the school registry ---
      const studentsRef = db.collection('schools').doc(schoolId).collection('students');
      
      // Search by First Name (Prefix matching)
      const studentsSnap = await studentsRef
        .where('firstName', '>=', capitalized)
        .where('firstName', '<=', capitalized + '\uf8ff')
        .limit(5)
        .get();

      studentsSnap.forEach(doc => {
        const data = doc.data();
        entityResults.push({
          id: doc.id,
          type: 'student',
          title: `${data.firstName} ${data.surname}`,
          subtitle: `Admission: ${data.admissionNumber || 'N/A'}`,
          path: role === 'school-head' ? `/school-head/students` : `/teacher/my-classes`,
          actions: [
            { label: role === 'school-head' ? 'Manage Marks' : 'View Marks', path: role === 'school-head' ? `/school-head/students/${doc.id}/marks` : `/teacher/students/${doc.id}/marks` },
            { label: 'View Results', path: role === 'school-head' ? `/school-head/results?classId=${data.classId}` : `/teacher/results?classId=${data.classId}` }
          ]
        });
      });
      
      // Also try searching by Surname for students if results are low
      if (entityResults.length < 3) {
          const surnameSnap = await studentsRef
            .where('surname', '>=', capitalized)
            .where('surname', '<=', capitalized + '\uf8ff')
            .limit(3)
            .get();
          
          surnameSnap.forEach(doc => {
              if (!entityResults.some(r => r.id === doc.id)) {
                  const data = doc.data();
                  entityResults.push({
                    id: doc.id,
                    type: 'student',
                    title: `${data.firstName} ${data.surname}`,
                    subtitle: `Admission: ${data.admissionNumber || 'N/A'}`,
                    path: role === 'school-head' ? `/school-head/students` : `/teacher/my-classes`,
                    actions: [
                        { label: role === 'school-head' ? 'Manage Marks' : 'View Marks', path: role === 'school-head' ? `/school-head/students/${doc.id}/marks` : `/teacher/students/${doc.id}/marks` },
                        { label: 'View Results', path: role === 'school-head' ? `/school-head/results?classId=${data.classId}` : `/teacher/results?classId=${data.classId}` }
                    ]
                  });
              }
          });
      }

      // --- Search Staff (Only for School Head) ---
      if (role === 'school-head') {
        // Fetch all staff for this specific school
        const staffSnap = await db.collection('users')
          .where('schoolId', '==', schoolId)
          .get();
        
        // Convert the search query to lowercase once for easy matching
        const lowerSearchStr = cleanQuery.toLowerCase();
        const staffResults: any[] = [];

        staffSnap.forEach(doc => {
            const data = doc.data();
            
            // Filter out students if they share the users collection
            if (data.role === 'student') return;

            // Grab the name fields, defaulting to empty strings to prevent errors
            const dName = (data.displayName || '').toLowerCase();
            const fName = (data.firstName || '').toLowerCase();
            const sName = (data.surname || '').toLowerCase();

            // Check if the search string is ANYWHERE inside the names
            if (
                dName.includes(lowerSearchStr) || 
                fName.includes(lowerSearchStr) || 
                sName.includes(lowerSearchStr)
            ) {
                staffResults.push({
                    id: doc.id,
                    type: 'staff',
                    title: data.displayName || `${data.firstName || ''} ${data.surname || ''}`.trim(),
                    subtitle: data.post || 'Staff Member',
                    path: `/school-head/teachers/${doc.id}`,
                });
            }
        });
        
        // Limit the results to 5 and add to main results
        entityResults.push(...staffResults.slice(0, 5));
      }
    } else if (role === 'sub-region-admin' && subRegionId) {
      // Search schools in the sub-region
      const schoolsSnap = await db.collection('schools')
        .where('subRegionId', '==', subRegionId)
        .where('name', '>=', capitalized)
        .where('name', '<=', capitalized + '\uf8ff')
        .limit(5)
        .get();

      schoolsSnap.forEach(doc => {
        entityResults.push({
          id: doc.id,
          type: 'school',
          title: doc.data().name,
          subtitle: `Reg No: ${doc.data().regNo}`,
          path: `/sub-region-admin/results`,
        });
      });
    }

    return {
      success: true,
      results: {
        entities: entityResults
      }
    };

  } catch (error: any) {
    console.error('[SEARCH ACTION ERROR]', error);
    return { success: false, message: error.message };
  }
}
