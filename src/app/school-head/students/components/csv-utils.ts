
'use client';
import { Student } from "@/app/school-head/students/page";
import Papa from "papaparse";

export const CSV_HEADERS = [
    "Admission Number",
    "ID Number",
    "First Name",
    "Surname",
    "Year",  // YYYY
    "Month", // MM
    "Date",  // DD
    "Gender",
];


export function exportStudentsAsCSV(students: Student[], schoolName: string) {
    if (students.length === 0) {
        throw new Error("There are no active students to export.");
    }

    const dataToExport = students.map(student => {
        const [year, month, day] = student.dateOfBirth ? student.dateOfBirth.split('-') : ['', '', ''];
        return {
            "Admission Number": student.admissionNumber || '',
            "ID Number": student.idNumber || '',
            "First Name": student.firstName,
            "Surname": student.surname,
            "Year": year,
            "Month": month,
            "Date": day,
            "Gender": student.gender,
        }
    });
    
    const csv = Papa.unparse({
        fields: CSV_HEADERS,
        data: dataToExport,
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${schoolName.replace(/\s+/g, '_')}_student_registry.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

