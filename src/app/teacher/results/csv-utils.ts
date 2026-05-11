'use client';
import Papa from "papaparse";
import { Class } from "@/app/school-head/classes/page";

interface Subject { id: string; name: string; }
interface ReportStudentData {
  student: { id: string; fullName: string; };
  subjects: {
    subjectName: string;
    symbol: string;
    possibleMark: number;
    pupilMark: number;
    percentage: number;
    remarks: string;
  }[];
  overall: {
    symbol: string;
    possibleMark: number;
    pupilMark: number;
    percentage: number;
    remarks: string;
  };
  hasNoMarks?: boolean;
}

interface CSVExportParams {
    reportData: ReportStudentData[];
    subjects: Subject[];
    classData: Class;
    assessment: string;
    term: string;
    year: string;
}

export function exportReportAsCSV({
    reportData,
    subjects,
    classData,
    assessment,
    term,
    year,
}: CSVExportParams) {
    // 1. Headers Row
    const mainHeaders = ["Student Name"];
    subjects.forEach(sub => {
        mainHeaders.push(`${sub.name} Mark`, `${sub.name} %`, `${sub.name} Grade`);
    });
    mainHeaders.push("Overall %", "Final Grade");

    // 2. Maximum Marks Row (Totals)
    const totalsRow = ["MAXIMUM MARKS"];
    subjects.forEach(sub => {
        // Try to find the possible mark for this subject from the first student who has marks
        const firstStudentWithMarks = reportData.find(r => !r.hasNoMarks);
        const subjectResult = firstStudentWithMarks?.subjects.find(s => s.subjectName === sub.name);
        const maxMark = subjectResult?.possibleMark ?? "";
        totalsRow.push(maxMark.toString(), "", "");
    });
    totalsRow.push("", ""); // Empty for Overall % and Final Grade columns

    // 3. Student Data Rows
    const studentRows = reportData.map(dataItem => {
        const row = [dataItem.student.fullName];
        subjects.forEach(sub => {
            const mark = dataItem.subjects.find(s => s.subjectName === sub.name);
            if (mark && mark.possibleMark > 0) {
                row.push(mark.pupilMark.toString(), `${mark.percentage.toFixed(1)}%`, mark.symbol);
            } else {
                row.push("-", "-", "-");
            }
        });
        
        if (dataItem.hasNoMarks) {
            row.push("-", "-");
        } else {
            row.push(`${dataItem.overall.percentage.toFixed(1)}%`, dataItem.overall.symbol);
        }
        return row;
    });

    const csvHeader = [
        `Class:,${classData.name}`,
        `Assessment:,${assessment}, ${year}`,
        ``, // Blank line
    ].join('\n');
    
    const tableData = [mainHeaders, totalsRow, ...studentRows];
    const csvTable = Papa.unparse(tableData);
    
    const csvContent = csvHeader + csvTable;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${classData.name}_${assessment}_${year}_report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
