
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowLeft, Download, ArrowUpDown, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AppLink } from '@/components/ui/app-link';
import { exportSubmissions } from '../../../actions';
import { useToast } from '@/hooks/use-toast';
import Papa from 'papaparse';
import { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/app/school-head/students/components/data-table';

interface ConsolidatedRow {
    [key: string]: string | number;
}

export default function ConsolidatedSubmissionsPage() {
  const params = useParams();
  const { formId } = params;
  const { toast } = useToast();

  const [rows, setRows] = useState<ConsolidatedRow[]>([]);
  const [columns, setColumns] = useState<ColumnDef<ConsolidatedRow>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [formTitle, setFormTitle] = useState('');


  useEffect(() => {
    if (!formId) return;
    setLoading(true);

    exportSubmissions(formId as string)
        .then(result => {
            if (result.success && result.data) {
                const { headers: fetchedHeaders, rows: fetchedRows, title } = result.data;
                setFormTitle(title || 'Consolidated Submissions');
                
                const dynamicColumns: ColumnDef<ConsolidatedRow>[] = fetchedHeaders.map((header, index) => ({
                    accessorKey: header,
                    header: ({ column }) => {
                        return (
                            <Button
                                variant="ghost"
                                onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                                className="justify-start px-0"
                            >
                                {header}
                                <ArrowUpDown className="ml-2 h-4 w-4" />
                            </Button>
                        )
                    },
                }));
                
                const formattedRows: ConsolidatedRow[] = fetchedRows.map(row => {
                    const rowObject: ConsolidatedRow = {};
                    fetchedHeaders.forEach((header, i) => {
                        rowObject[header] = row[i];
                    });
                    return rowObject;
                });

                setColumns(dynamicColumns);
                setHeaders(fetchedHeaders);
                setRows(formattedRows);

            } else {
                toast({ variant: 'destructive', title: "Error", description: result.message || "Could not load consolidated data."})
            }
        })
        .catch(err => {
             toast({ variant: 'destructive', title: "Error", description: err.message || "An unexpected error occurred."})
        })
        .finally(() => setLoading(false))
    

  }, [formId, toast]);

  const handleExport = () => {
    if (rows.length === 0) return;

    const dataToExport = rows.map(row => headers.map(header => row[header]));

    const csv = Papa.unparse({
        fields: headers,
        data: dataToExport,
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${formTitle.replace(/\s+/g, '_')}_consolidated.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  
  const handlePrint = () => {
    window.print();
  }

  if (loading) {
    return <div className="flex justify-center items-center p-10"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6 printable-area">
        <div className="flex justify-between items-center printable-hidden">
            <div>
                <Button asChild variant="ghost" className="-ml-4">
                    <AppLink href={`/forms/${formId}/submissions`}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Submissions
                    </AppLink>
                </Button>
                <CardTitle>{formTitle}</CardTitle>
                <CardDescription>
                    All records submitted by all schools for this form. Click column headers to sort.
                </CardDescription>
            </div>
             <div className="flex items-center space-x-2">
                <Button onClick={handlePrint} variant="outline">
                    <Printer className="mr-2 h-4 w-4" />
                    Print
                </Button>
                <Button onClick={handleExport} variant="outline">
                    <Download className="mr-2 h-4 w-4" />
                    Export as CSV
                </Button>
             </div>
        </div>
        
        {rows.length === 0 ? (
            <Card>
                <CardContent className="p-10 text-center text-muted-foreground">
                    No data found to consolidate.
                </CardContent>
            </Card>
        ) : (
            <DataTable 
                columns={columns} 
                data={rows} 
                loading={loading}
                filterColumn={headers[0]}
                filterPlaceholder={`Filter by ${headers[0]}...`}
            />
        )}
    </div>
  );
}
