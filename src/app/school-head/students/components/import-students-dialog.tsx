'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Loader2, UploadCloud, File, X, AlertTriangle } from 'lucide-react';
import Papa from 'papaparse';
import { CSV_HEADERS } from './csv-utils';
import { bulkCreateOrUpdateStudents } from '../actions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ImportStudentsDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  schoolId: string | undefined;
}

interface ParsedStudent {
    'Admission Number'?: string;
    'ID Number'?: string;
    'First Name': string;
    'Surname': string;
    'Year': string;
    'Month': string;
    'Date': string;
    'Gender': 'Male' | 'Female';
}

const importSchema = z.object({
  file: z.instanceof(File).refine(file => file.type === 'text/csv', 'File must be a CSV.'),
});

export function ImportStudentsDialog({ isOpen, onOpenChange, schoolId }: ImportStudentsDialogProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [validationErrors, setValidationErrors] = React.useState<string[]>([]);
  const [parsedData, setParsedData] = React.useState<ParsedStudent[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!isOpen) {
      setFile(null);
      setParsedData([]);
      setValidationErrors([]);
    }
  }, [isOpen]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
        setFile(selectedFile);
        setValidationErrors([]);
        Papa.parse(selectedFile, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const headers = results.meta.fields || [];
                const requiredHeaders = ['First Name', 'Surname', 'Year', 'Month', 'Date', 'Gender'];
                const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
                
                if (missingHeaders.length > 0) {
                    setValidationErrors([`The following required columns are missing from your CSV file: ${missingHeaders.join(', ')}.`]);
                    setParsedData([]);
                    return;
                }

                // Client-side row validation
                const data = results.data as ParsedStudent[];
                const errors: string[] = [];
                data.forEach((row, index) => {
                    const rowNum = index + 2; // +1 for 0-index, +1 for header row
                    if (!row['First Name']?.trim()) errors.push(`Row ${rowNum}: 'First Name' is missing.`);
                    if (!row['Surname']?.trim()) errors.push(`Row ${rowNum}: 'Surname' is missing.`);
                    if (!row['Year']?.trim()) errors.push(`Row ${rowNum}: 'Year' is missing.`);
                    if (!row['Month']?.trim()) errors.push(`Row ${rowNum}: 'Month' is missing.`);
                    if (!row['Date']?.trim()) errors.push(`Row ${rowNum}: 'Date' is missing.`);
                    if (!row['Gender']?.trim()) {
                        errors.push(`Row ${rowNum}: 'Gender' is missing.`);
                    } else if (row['Gender'] !== 'Male' && row['Gender'] !== 'Female') {
                        errors.push(`Row ${rowNum}: 'Gender' must be 'Male' or 'Female'.`);
                    }

                    const year = parseInt(row['Year']);
                    const month = parseInt(row['Month']);
                    const day = parseInt(row['Date']);
                    if(isNaN(year) || isNaN(month) || isNaN(day)) {
                        errors.push(`Row ${rowNum}: Year, Month, and Date must be numbers.`);
                    } else {
                        const d = new Date(year, month - 1, day);
                        if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
                            errors.push(`Row ${rowNum}: Invalid date '${year}-${month}-${day}'.`);
                        }
                    }
                });

                if (errors.length > 0) {
                    setValidationErrors(errors);
                    setParsedData([]);
                } else {
                    setParsedData(data);
                }
            }
        });
    }
  }

  const clearFile = () => {
    setFile(null);
    setParsedData([]);
    if (fileInputRef.current) {
        fileInputRef.current.value = "";
    }
  }

  const handleSubmit = async () => {
    if (!schoolId || parsedData.length === 0 || validationErrors.length > 0) return;
    setIsSubmitting(true);
    try {
      const result = await bulkCreateOrUpdateStudents({ schoolId, students: parsedData });
      const failedRecords = result.results.filter(r => r.status === 'failed');

      if (failedRecords.length > 0) {
        const errorMessages = failedRecords.map(r => `Row for Admission No. '${r.admissionNumber || 'N/A'}': ${r.reason}`);
        setValidationErrors(errorMessages);
        toast({
            variant: 'destructive',
            title: `${failedRecords.length} record(s) failed to import.`,
            description: "Please see the error messages below, correct your file, and try again.",
            duration: 10000,
        });
      } else {
        toast({
          title: 'Import Successful',
          description: result.message,
        });
        onOpenChange(false);
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Unexpected Error',
        description: error.message || 'An unknown error occurred during import.',
        duration: 9000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import Students from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file to bulk add or update students. Ensure your file has the correct headers: {CSV_HEADERS.join(', ')}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
            <div 
                className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-md cursor-pointer hover:border-primary"
                onClick={() => fileInputRef.current?.click()}
            >
                <UploadCloud className="w-10 h-10 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">Click or drag & drop to upload CSV</p>
                 <input
                    type="file"
                    ref={fileInputRef}
                    accept=".csv"
                    className="hidden"
                    onChange={handleFileChange}
                />
            </div>
            
            {file && (
                <div className="flex items-center gap-2 p-2 border rounded-md">
                    <File className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm font-medium flex-1 truncate">{file.name}</span>
                    <Button size="icon" variant="ghost" onClick={clearFile} disabled={isSubmitting}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            )}
            
            {validationErrors.length > 0 && (
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Validation Errors Found</AlertTitle>
                    <AlertDescription>
                        <ScrollArea className="h-40 mt-2">
                            <ul className="list-disc pl-5">
                                {validationErrors.map((err, i) => <li key={i}>{err}</li>)}
                            </ul>
                        </ScrollArea>
                    </AlertDescription>
                </Alert>
            )}

            {parsedData.length > 0 && validationErrors.length === 0 && (
                 <Alert>
                    <AlertTitle>Ready to Import</AlertTitle>
                    <AlertDescription>
                        Found {parsedData.length} student records in the file. Existing students will be updated based on matching 'Admission Number'.
                    </AlertDescription>
                </Alert>
            )}

        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !file || parsedData.length === 0 || validationErrors.length > 0}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Import Students
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
