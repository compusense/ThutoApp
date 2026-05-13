'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useUser } from '@/firebase/auth/use-user';
import { storage, firestore } from '@/firebase';
import { generateMergedPDF, LetterData } from '@/lib/pdf-service';
import { doc, getDoc } from 'firebase/firestore';
import { ConfirmationLetterForm } from './components/confirmation-letter-form';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { FileText, Upload, Loader2, Eye } from 'lucide-react';

const formSchema = z.object({
  recipientName: z.string().min(2, 'Recipient name is required'),
  subject: z.string().min(2, 'Subject is required'),
  content: z.string().min(10, 'Content must be at least 10 characters'),
});

const TEMPLATES = [
  {
    id: 'employment-confirmation',
    name: 'Confirmation of Employment',
    content: `To Whom It May Concern,

This letter serves to confirm that [Employee Name] is currently employed at [School Name] in the position of [Job Title]. [Employee Name] has been with us since [Start Date] and is a [Permanent/Contract] employee.

If you require any further information, please do not hesitate to contact our office.

Sincerely,

School Head`,
  },
  {
    id: 'recommendation',
    name: 'Letter of Recommendation',
    content: `Dear Admissions Committee / Hiring Manager,

It is with great pleasure that I recommend [Name] for [Opportunity]. During their time at [School Name], [Name] has demonstrated exceptional [Skill/Attribute] and was a valued member of our community.

[Name] consistently showed dedication to their studies/work and maintained a high standard of professional conduct.

I am confident that [Name] will be a great asset to your organization.

Best regards,

School Head`,
  },
];

export default function CorrespondencePage() {
  const { user } = useUser();
  const { toast } = useToast();
  const [isUploading, setIsUploading] = React.useState(false);
  const [isPreviewing, setIsPreviewing] = React.useState(false);
  const [letterheadUrl, setLetterheadUrl] = React.useState<string | null>(null);
  const [letterType, setLetterType] = React.useState<'general' | 'confirmation'>('general');
  const [schoolName, setSchoolName] = React.useState<string>('');

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      recipientName: '',
      subject: '',
      content: '',
    },
  });

  // Load existing letterhead if available
  React.useEffect(() => {
    if (user?.schoolId) {
      const letterheadRef = ref(storage, `schools/${user.schoolId}/assets/letterhead.pdf`);
      getDownloadURL(letterheadRef)
        .then((url) => setLetterheadUrl(url))
        .catch(() => {
          // If it doesn't exist, that's fine
        });

      // Get school name
      getDoc(doc(firestore, 'schools', user.schoolId)).then(snap => {
        if (snap.exists()) {
          setSchoolName(snap.data().name || '');
        }
      });
    }
  }, [user?.schoolId]);

  const onFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user?.schoolId) return;

    if (file.type !== 'application/pdf') {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a PDF file.',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);
    try {
      const storageRef = ref(storage, `schools/${user.schoolId}/assets/letterhead.pdf`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setLetterheadUrl(url);
      toast({
        title: 'Success',
        description: 'Official letterhead uploaded successfully.',
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload failed',
        description: 'Could not upload the letterhead. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleTemplateChange = (templateId: string) => {
    const template = TEMPLATES.find((t) => t.id === templateId);
    if (template) {
      form.setValue('content', template.content);
    }
  };

  const handlePreview = async (values: any) => {
    if (!letterheadUrl) {
      toast({
        title: 'Letterhead missing',
        description: 'Please upload an official letterhead PDF first.',
        variant: 'destructive',
      });
      return;
    }

    setIsPreviewing(true);
    try {
      const pdfData = {
        ...values,
        schoolName: schoolName,
        schoolHeadName: user?.displayName || 'School Head',
      };
      
      const pdfBlob = await generateMergedPDF(letterheadUrl, pdfData);
      const url = URL.createObjectURL(pdfBlob);
      window.open(url, '_blank');
    } catch (error) {
      console.error('PDF Generation error:', error);
      toast({
        title: 'Preview failed',
        description: 'Could not generate the PDF preview.',
        variant: 'destructive',
      });
    } finally {
      setIsPreviewing(false);
    }
  };

  if (!user || user.role !== 'school-head') {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Access Restricted: Schoolhead only.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Official Correspondence</h1>
          <p className="text-muted-foreground">
            Generate professional letters on your school's official letterhead.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Letterhead Setup
            </CardTitle>
            <CardDescription>
              Upload your school's official PDF letterhead (A4 size recommended).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 hover:bg-muted/50 transition-colors cursor-pointer relative">
              <input
                type="file"
                accept=".pdf"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={onFileUpload}
                disabled={isUploading}
              />
              {isUploading ? (
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
              ) : (
                <FileText className="h-10 w-10 text-muted-foreground" />
              )}
              <p className="mt-2 text-sm font-medium">
                {letterheadUrl ? 'Update Letterhead' : 'Upload Letterhead'}
              </p>
              <p className="text-xs text-muted-foreground">PDF only (max 5MB)</p>
            </div>
            {letterheadUrl && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-3">
                <p className="text-xs text-green-700 dark:text-green-400 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-green-500" />
                  Official letterhead is active
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Draft Letter</CardTitle>
                <CardDescription>
                  Choose a letter type and fill in the details.
                </CardDescription>
              </div>
              <div className="flex bg-muted p-1 rounded-md">
                <Button
                  variant={letterType === 'general' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setLetterType('general')}
                >
                  General
                </Button>
                <Button
                  variant={letterType === 'confirmation' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setLetterType('confirmation')}
                >
                  Confirmation
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {letterType === 'general' ? (
              <Form {...form}>
                <form className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="recipientName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Recipient Name</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Thabo Lekone" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormItem>
                      <FormLabel>Template</FormLabel>
                      <Select onValueChange={handleTemplateChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a template" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {TEMPLATES.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  </div>

                  <FormField
                    control={form.control}
                    name="subject"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subject</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Confirmation of Employment" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="content"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Content</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Type your letter content here..."
                            className="min-h-[300px] resize-none"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end gap-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => form.reset()}
                      disabled={isPreviewing}
                    >
                      Reset
                    </Button>
                    <Button
                      type="button"
                      onClick={form.handleSubmit(handlePreview)}
                      disabled={isPreviewing || !letterheadUrl}
                    >
                      {isPreviewing ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Eye className="mr-2 h-4 w-4" />
                      )}
                      Preview & Print
                    </Button>
                  </div>
                </form>
              </Form>
            ) : (
              <ConfirmationLetterForm
                onPreview={handlePreview}
                isLoading={isPreviewing}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
