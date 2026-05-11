
'use client';
import { exportSubmissions } from '../actions';
import { FormDocument, FormSubmission } from '../page';
import Papa from 'papaparse';

export async function exportSubmissionsAsCSV(
    formDef: FormDocument,
) {
    const result = await exportSubmissions(formDef.id);

    if (!result.success || !result.data) {
        throw new Error(result.message || "Failed to fetch data for export.");
    }
    
    if (result.data.rows.length === 0) {
        throw new Error("No submissions to export.");
    }

    const csv = Papa.unparse({
        fields: result.data.headers,
        data: result.data.rows
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${formDef.title.replace(/ /g, '_')}_submissions.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
