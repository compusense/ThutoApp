
'use client';
import * as React from 'react';
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { ContinuousAssessmentData } from "../actions";
import '../printReports.css';

const abbreviateSubject = (name: string): string => {
    const lowerCaseName = name.toLowerCase();
    const abbreviations: Record<string, string> = {
        "agriculture": "Agric",
        "creative and performing arts (capa)": "CAPA",
        "english": "English",
        "mathematics": "Maths",
        "religious and moral education": "R.M.E",
        "science": "Science",
        "setswana": "Setswana",
        "social studies": "S/Studies",
    };
    return abbreviations[lowerCaseName] || name;
};


function TermTable({ termName, termData, subjects, comments }: { termName: string, termData: any, subjects: {name: string, remarks: string}[], comments?: string }) {
    if (termData.assessments.length === 0) {
        return null; // Don't render table if no assessments for this term
    }
    
    const hasEndOfTerm = termData.assessments.includes(`END OF TERM ${termName.split(' ')[1]}`);

    return (
        <div className="space-y-1">
            <h3 className="font-bold text-center text-xs">{termName.toUpperCase()}</h3>
            <table className="w-full border-collapse border-2 border-black text-[9px]">
                <thead>
                    <tr className="font-bold">
                        <th className="border border-black p-0.5 text-left w-[25%]">SUBJECT</th>
                        {termData.assessments.map((ass: string) => (
                            <React.Fragment key={ass}>
                                <th colSpan={3} className="border border-black p-0.5 text-center">{ass}</th>
                            </React.Fragment>
                        ))}
                        {hasEndOfTerm && <th rowSpan={2} className="border border-black p-0.5 align-bottom w-[15%]">COMMENTS</th>}
                    </tr>
                    <tr className="font-bold">
                         <th className="border border-black p-0.5 text-left"></th>
                        {termData.assessments.map((ass: string) => (
                            <React.Fragment key={`${ass}-sub`}>
                                <th className="border border-black p-0.5">MARK</th>
                                <th className="border border-black p-0.5">%</th>
                                <th className="border border-black p-0.5">GRADE</th>
                            </React.Fragment>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {subjects.map(subject => {
                        const endOfTermAssessmentKey = `END OF TERM ${termName.split(' ')[1]}`;
                        const endOfTermMarkData = termData.subjects[subject.name]?.[endOfTermAssessmentKey];
                        
                        return (
                            <tr key={subject.name}>
                                <td className="border border-black p-0.5 font-bold">{abbreviateSubject(subject.name)}</td>
                                {termData.assessments.map((ass: string) => {
                                    const markData = termData.subjects[subject.name]?.[ass];
                                    return (
                                        <React.Fragment key={`${subject.name}-${ass}`}>
                                            <td className="border border-black p-0.5 text-center">{markData?.mark ?? ''}</td>
                                            <td className="border border-black p-0.5 text-center">{markData ? markData.percentage.toFixed(0) : ''}</td>
                                            <td className="border border-black p-0.5 text-center">{markData?.grade ?? ''}</td>
                                        </React.Fragment>
                                    );
                                })}
                                {hasEndOfTerm && <td className="border border-black p-0.5 h-4 text-center">{subject.remarks}</td>}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
             <div className="pt-1 text-[8px] mt-1">
                <div className="space-y-0.5">
                    <span className="font-bold">CLASS TEACHER'S COMMENT:</span>
                    <div className="border-b border-black h-5 text-xs font-serif italic pl-2">{comments}</div>
                </div>
            </div>
        </div>
    );
}


function SingleStudentReport({ report, schoolName, className, teacherName, academicYear, comments }: { report: ContinuousAssessmentData['studentReports'][0], schoolName: string, className: string, teacherName: string, academicYear: string, comments: Record<string, string> }) {
    const allSubjects = React.useMemo(() => {
        const subjectSet = new Set<string>();
        for (const termKey of ['term1', 'term2', 'term3'] as const) {
            const termSubjects = report[termKey]?.subjects;
            if (termSubjects) {
                Object.keys(termSubjects).forEach(s => subjectSet.add(s));
            }
        }
        return Array.from(subjectSet).sort();
    }, [report]);

    const getRemarksForSubject = (subjectName: string, termData: any) => {
        if (!termData || !termData.subjects || !termData.subjects[subjectName]) return '';
        const endOfTermKey = Object.keys(termData.subjects[subjectName]).find(key => key.startsWith('END OF TERM'));
        if (endOfTermKey && termData.subjects[subjectName][endOfTermKey]) {
            const percentage = termData.subjects[subjectName][endOfTermKey].percentage;
            if (percentage >= 80) return 'Excellent';
            if (percentage >= 70) return 'Very Good';
            if (percentage >= 50) return 'Good';
            return 'Below Average';
        }
        return '';
    };

    const subjectsWithRemarksForTerm = (termData: any) => {
        return allSubjects.map(subjectName => ({
            name: subjectName,
            remarks: getRemarksForSubject(subjectName, termData)
        }));
    }


    return (
        <div className="printable-page-content p-4 max-w-4xl mx-auto bg-white text-black font-sans">
            <div className="space-y-3">
                <div className="text-center">
                    <h1 className="font-bold text-base">{schoolName}</h1>
                    <div className="flex justify-center items-center space-x-2">
                        <h2 className="font-bold text-sm">CONTINUOUS ASSESSMENT {academicYear}</h2>
                        <span className="font-bold">|</span>
                        <h2 className="font-bold text-sm">{className}</h2>
                    </div>
                </div>
                <div className="flex justify-between font-bold text-[10px]">
                    <span>PUPIL'S NAME: {report.student.fullName}</span>
                    <span>TEACHER: {teacherName}</span>
                </div>
                
                <TermTable termName="TERM 1" termData={report.term1} subjects={subjectsWithRemarksForTerm(report.term1)} comments={comments?.term1} />
                <TermTable termName="TERM 2" termData={report.term2} subjects={subjectsWithRemarksForTerm(report.term2)} comments={comments?.term2} />
                <TermTable termName="TERM 3" termData={report.term3} subjects={subjectsWithRemarksForTerm(report.term3)} comments={comments?.term3} />
            </div>
        </div>
    );
}


export function ContinuousAssessmentReport({ data, comments }: { data: ContinuousAssessmentData, comments: Record<string, Record<string, string>> }) {
    const { studentReports, schoolName, className, teacherName, academicYear } = data;

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="mt-6">
            <div className="flex justify-end mb-4 printable-hidden">
                <Button onClick={handlePrint} variant="outline">
                    <Printer className="mr-2 h-4 w-4" /> Print Reports
                </Button>
            </div>
            <div className="printable-area">
                {studentReports.map(report => (
                    <SingleStudentReport
                        key={report.student.id}
                        report={report}
                        schoolName={schoolName}
                        className={className}
                        teacherName={teacherName}
                        academicYear={academicYear}
                        comments={comments[report.student.id] || {}}
                    />
                ))}
            </div>
        </div>
    );
}
