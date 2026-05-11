
'use server';

/**
 * @fileOverview AI flow to interpret natural language search queries for app navigation.
 *
 * - interpretSearchIntent - Analyzes a query and maps it to a site section.
 * - SearchIntentInput - Input type for the function.
 * - SearchIntentOutput - Return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const SearchIntentInputSchema = z.object({
  query: z.string().describe('The user\'s search query.'),
  role: z.string().describe('The role of the current user (teacher, school-head, etc.).'),
});
export type SearchIntentInput = z.infer<typeof SearchIntentInputSchema>;

const SearchIntentOutputSchema = z.object({
  suggestedPath: z.string().describe('The relative URL path for the suggested page.'),
  label: z.string().describe('A short, descriptive label for the link.'),
  description: z.string().describe('A brief explanation of what the user can do on this page.'),
  confidence: z.number().describe('Confidence score from 0 to 1. Higher if it definitely maps to a page.'),
});
export type SearchIntentOutput = z.infer<typeof SearchIntentOutputSchema>;

export async function interpretSearchIntent(input: SearchIntentInput): Promise<SearchIntentOutput | null> {
  const { output } = await interpretSearchIntentFlow(input);
  return output || null;
}

const interpretSearchIntentFlow = ai.defineFlow(
  {
    name: 'interpretSearchIntentFlow',
    inputSchema: SearchIntentInputSchema,
    outputSchema: SearchIntentOutputSchema.nullable(),
  },
  async (input) => {
    const prompt = ai.definePrompt({
      name: 'interpretSearchIntentPrompt',
      input: { schema: SearchIntentInputSchema },
      output: { schema: SearchIntentOutputSchema },
      prompt: `You are the "Thuto" School Management System Guide. 
Your goal is to guide the user to the correct page based on their query and role.

USER ROLE: {{{role}}}
USER QUERY: {{{query}}}

SITE MAP & KEY FUNCTIONS:
- Dashboard (General stats): /{{{role}}}/dashboard
- Enter Marks (Grading, score entry): /teacher/my-classes
- View Results (Snapshots, summaries): /teacher/results
- Syllabus (Curriculum explorer): /teacher/syllabus
- Class Activities (Manage lesson notes): /teacher/notes
- AI Scanner (Mark multiple choice sheets): /teacher/scanner
- Individual Reports (Progress reports for parents): /teacher/reports
- Class Reports (Narrative/Comprehensive class-wide): /teacher/class-reports
- Student Registry (Add/Search students): /school-head/students
- Staff Management (Manage teachers): /school-head/teachers
- Class Management (Create classes): /school-head/classes
- Promotions (End of year move students): /school-head/promotions
- Exam Management (Timetables/Materials): /school-head/exam-management
- Data Collection Forms (Official surveys): /forms

INSTRUCTIONS:
1. If the user is asking "how to", "where is", or using verbs like "mark", "report", "promote", or "find", map it to the correct path.
2. If the user query is clearly a person's name (e.g. "Mpho", "Bokang") or a random string, return a confidence score of 0.1.
3. If it maps perfectly to a page (e.g. "how do i scan sheets"), return a high confidence (0.9+).
4. For teachers looking to mark/grade, point them to /teacher/scanner (AI) or /teacher/my-classes (Manual).
5. Ensure the suggested path starts with a /.`,
    });

    const { output } = await prompt(input);
    return output || null;
  }
);
