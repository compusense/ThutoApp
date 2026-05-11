'use server';

/**
 * @fileOverview Generates a summarized version of a student's term report for parents.
 *
 * - generateTermReportSummary - A function that generates the summarized report.
 * - GenerateTermReportSummaryInput - The input type for the generateTermReportSummary function.
 * - GenerateTermReportSummaryOutput - The return type for the generateTermReportSummary function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateTermReportSummaryInputSchema = z.object({
  studentName: z.string().describe('The name of the student.'),
  term: z.string().describe('The term for which the report is being generated (e.g., Term 1, 2024).'),
  academicYear: z.string().describe('The academic year for which the report is being generated (e.g., 2023-2024).'),
  subjects: z.array(z.string()).describe('A list of subjects the student is taking.'),
  grades: z.record(z.string(), z.string()).describe('A record of grades for each subject, with subject names as keys and grades as values.'),
  teacherComments: z.record(z.string(), z.string()).describe('A record of teacher comments for each subject, with subject names as keys and comments as values.'),
});
export type GenerateTermReportSummaryInput = z.infer<typeof GenerateTermReportSummaryInputSchema>;

const GenerateTermReportSummaryOutputSchema = z.object({
  summary: z.string().describe('A summarized version of the term report, highlighting key achievements and areas for improvement.'),
});
export type GenerateTermReportSummaryOutput = z.infer<typeof GenerateTermReportSummaryOutputSchema>;

export async function generateTermReportSummary(input: GenerateTermReportSummaryInput): Promise<GenerateTermReportSummaryOutput> {
  return generateTermReportSummaryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateTermReportSummaryPrompt',
  input: {schema: GenerateTermReportSummaryInputSchema},
  output: {schema: GenerateTermReportSummaryOutputSchema},
  prompt: `You are an AI assistant that summarizes student term reports for parents.

  Given the following information about a student's performance, generate a concise summary
  highlighting key achievements and areas for improvement. The summary should be easily understandable for parents.

  Student Name: {{{studentName}}}
  Term: {{{term}}}
  Academic Year: {{{academicYear}}}
  Subjects: {{#each subjects}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}
  Grades: {{#each grades}}{{{@key}}}: {{{this}}}{{#unless @last}}, {{/unless}}{{/each}}
  Teacher Comments: {{#each teacherComments}}{{{@key}}}: {{{this}}}{{#unless @last}}, {{/unless}}{{/each}}
  `,
});

const generateTermReportSummaryFlow = ai.defineFlow(
  {
    name: 'generateTermReportSummaryFlow',
    inputSchema: GenerateTermReportSummaryInputSchema,
    outputSchema: GenerateTermReportSummaryOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
