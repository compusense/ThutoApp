
'use client';
import { Student } from "@/app/school-head/students/page";
import { Subject } from "@/app/super-admin/subjects/page";
import Papa from "papaparse";

interface CSVExportData {
    className: string;
    teacherName: string;
    assessment: string;
    year: string;
    students: Student[];
    subjects: Subject[];
    marks?: Record<string, Record<string, { score?: number | string }>>;
    totals?: Record<string, number | string>;
}

export function generateCSVTemplate({
    className,
    teacherName,
    assessment,
    year,
    students,
    subjects,
    marks,
    totals,
}: CSVExportData) {

    const headers = [
        "Student ID",
        "Student Name",
        ...subjects.map(s => s.name)
    ];

    const totalsRow = [
        "TOTALS",
        "Enter Subject Totals Below",
        ...subjects.map(s => totals?.[s.id] ?? "100")
    ];

    const studentRows = students.map(student => [
        student.admissionNumber,
        student.fullName,
        ...subjects.map(subject => marks?.[student.id]?.[subject.id]?.score ?? "")
    ]);

    const csvHeader = [
        `Class:,${className}`,
        `Teacher:,${teacherName}`,
        `Assessment:,${assessment}`,
        `Year:,${year}`,
        ``, // Blank line
    ].join('\n');

    const tableData = [headers, totalsRow, ...studentRows];
    const csvTable = Papa.unparse(tableData);

    const csvContent = csvHeader + csvTable;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${className}_${assessment}_${year}_sheet.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

interface ParsedResults {
    data: {
        totals: Record<string, number>;
        marks: Record<string, Record<string, { score: number | string }>>;
    };
    errors: string[];
}

export function parseCSV(
    file: File,
    callback: (results: ParsedResults) => void,
    students: Student[],
    subjects: Subject[]
) {
    Papa.parse(file, {
        complete: (result) => {
            const parsedData: ParsedResults = {
                data: { totals: {}, marks: {} },
                errors: [],
            };

            const studentMap = new Map(students.map(s => [s.admissionNumber, s.id]));
            const subjectMap = new Map(subjects.map(s => [s.name, s.id]));

            const rows = result.data as string[][];

            // Find the header row (should contain "Student ID")
            let headerIndex = rows.findIndex(row => row[0]?.trim() === 'Student ID');
            if (headerIndex === -1) {
                parsedData.errors.push('CSV is missing the header row. Could not find "Student ID".');
                callback(parsedData);
                return;
            }

            const headerRow = rows[headerIndex];
            const totalsRow = rows[headerIndex + 1];
            const marksRows = rows.slice(headerIndex + 2);

            // Validate Totals row
            if (totalsRow?.[0]?.trim() !== 'TOTALS') {
                 parsedData.errors.push('CSV is missing the "TOTALS" row immediately after the header.');
                 callback(parsedData);
                 return;
            }

            // Map CSV subject headers to subject IDs
            const csvSubjects: {name: string, id: string | undefined}[] = headerRow.slice(2).map(name => ({
                name: name.trim(),
                id: subjectMap.get(name.trim()),
            }));

            // Validate Subjects
            csvSubjects.forEach((sub, i) => {
                if (!sub.id) {
                    parsedData.errors.push(`Subject "${sub.name}" from CSV column ${i+3} does not match any allocated subjects for this class.`);
                }
            });
            if(parsedData.errors.length > 0) {
                callback(parsedData);
                return;
            }


            // Process Totals
            csvSubjects.forEach((sub, index) => {
                const totalVal = totalsRow[index + 2]?.trim();
                const total = Number(totalVal);
                if (!isNaN(total) && total > 0) {
                    parsedData.data.totals[sub.id!] = total;
                } else {
                     parsedData.errors.push(`Invalid total "${totalVal}" for subject "${sub.name}". Totals must be numbers greater than 0.`);
                }
            });


            // Process Marks
            marksRows.forEach((row, rowIndex) => {
                const admissionNumber = row[0]?.trim();
                if (!admissionNumber) return; // Skip empty rows

                const studentId = studentMap.get(admissionNumber);
                if (!studentId) {
                    parsedData.errors.push(`Student with Admission No. "${admissionNumber}" (row ${headerIndex + 3 + rowIndex}) was not found in the class.`);
                    return;
                }

                parsedData.data.marks[studentId] = {};

                csvSubjects.forEach((sub, colIndex) => {
                    const scoreVal = row[colIndex + 2]?.trim();
                    if(scoreVal !== undefined && scoreVal !== null && scoreVal !== '') { // Only process non-empty scores
                        const score = Number(scoreVal);
                        if (!isNaN(score) && score >= 0) {
                            parsedData.data.marks[studentId][sub.id!] = { score };
                        } else {
                            parsedData.errors.push(`Invalid score "${scoreVal}" for student "${row[1]}" and subject "${sub.name}". Scores must be numbers.`);
                        }
                    }
                });
            });

            callback(parsedData);
        },
        error: (error) => {
            callback({
                data: { totals: {}, marks: {} },
                errors: [`PapaParse error: ${error.message}`]
            });
        },
    });
}
