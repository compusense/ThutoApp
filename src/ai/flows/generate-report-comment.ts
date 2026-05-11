
'use server';

/**
 * @fileOverview Generates a termly progress report comment for a student.
 *
 * - generateReportComment - A function that generates the report comment.
 * - GenerateReportCommentInput - The input type for the generateReportComment function.
 * - GenerateReportCommentOutput - The return type for the generateReportComment function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateReportCommentInputSchema = z.object({
  studentName: z.string().describe("The student's full name."),
  grades: z
    .string()
    .describe(
      'A comma-separated list of subject grades, e.g., "Mathematics: A, English: B, Science: C".'
    ),
  overallGrade: z.string().describe('The overall grade symbol (A, B, C, D, E).'),
  overallRemarks: z
    .string()
    .describe(
      'The overall performance remark (e.g., Excellent, Very Good, Good, Fair, Unsatisfactory).'
    ),
});
export type GenerateReportCommentInput = z.infer<
  typeof GenerateReportCommentInputSchema
>;

const GenerateReportCommentOutputSchema = z.object({
  comment: z
    .string()
    .describe(
      'A constructive and encouraging comment for the student, written from the perspective of a class teacher. It should be 2-3 sentences long.'
    ),
});
export type GenerateReportCommentOutput = z.infer<
  typeof GenerateReportCommentOutputSchema
>;

export async function generateReportComment(
  input: GenerateReportCommentInput
): Promise<GenerateReportCommentOutput> {
  return generateReportCommentFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateReportCommentPrompt',
  input: { schema: GenerateReportCommentInputSchema },
  output: { schema: GenerateReportCommentOutputSchema },
  prompt: `You are an experienced and caring primary school teacher. Your task is to write a brief, constructive, and encouraging end-of-term report comment for a student.

The comment should be personalized based on their performance. Start by acknowledging an area of strength and then gently suggest an area for improvement. End on a positive and motivational note. The comment should be 2-3 sentences long.

Student's Name: {{{studentName}}}
Overall Performance: {{{overallGrade}}} - {{{overallRemarks}}}
Subject Grades: {{{grades}}}

Based on this information, write the class teacher's remarks.`,
});

const generateReportCommentFlow = ai.defineFlow(
  {
    name: 'generateReportCommentFlow',
    inputSchema: GenerateReportCommentInputSchema,
    outputSchema: GenerateReportCommentOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
