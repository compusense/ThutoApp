'use server';
/**
 * @fileOverview AI flow to mark a scanned multiple choice answer sheet.
 *
 * - markAnswerSheet - Analyzes an image of an answer sheet and returns the detected answers.
 * - MarkAnswerSheetInput - Input type for the function.
 * - MarkAnswerSheetOutput - Return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const MarkAnswerSheetInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of a student's answer sheet, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  markingKey: z.array(z.object({
    questionNumber: z.number(),
    correctAnswer: z.string(),
  })).describe('The correct answers for the assessment.'),
});
export type MarkAnswerSheetInput = z.infer<typeof MarkAnswerSheetInputSchema>;

const MarkAnswerSheetOutputSchema = z.object({
  studentName: z.string().optional().describe('The name of the student detected on the sheet.'),
  detectedAnswers: z.array(z.object({
    questionNumber: z.number(),
    selectedAnswer: z.string().describe('The answer selected by the student (e.g., A, B, C, D, True, False).'),
    isCorrect: z.boolean(),
  })),
  totalScore: z.number(),
  maxScore: z.number(),
});
export type MarkAnswerSheetOutput = z.infer<typeof MarkAnswerSheetOutputSchema>;

export async function markAnswerSheet(input: MarkAnswerSheetInput): Promise<MarkAnswerSheetOutput> {
  return markAnswerSheetFlow(input);
}

const prompt = ai.definePrompt({
  name: 'markAnswerSheetPrompt',
  input: { schema: MarkAnswerSheetInputSchema },
  output: { schema: MarkAnswerSheetOutputSchema },
  prompt: `You are an expert examiner assistant. Your task is to analyze a scanned image of a student's multiple choice answer sheet.

1.  **Extract the student's name** if it is written on the sheet.
2.  **Identify the student's selected answers** for each question number.
3.  **Compare the detected answers** with the provided Marking Key. 
    **CRITICAL: Comparison MUST be case-insensitive.** (e.g. 'a' matches 'A', 'c' matches 'C').
4.  **Calculate the total score**.

MARKING KEY:
{{#each markingKey}}
Q{{questionNumber}}: {{correctAnswer}}
{{/each}}

ANSWER SHEET IMAGE:
{{media url=photoDataUri}}

Instructions:
- Be precise. If a student's handwriting is unclear, provide your best guess but prioritize accuracy.
- Multiple choice answers are usually single letters (A, B, C, D) or bubbles filled in.
- True/False answers are usually words or checkboxes.
- **Always normalize the detected 'selectedAnswer' values to UPPERCASE in your response.**
- Return the results in the specified JSON format.
`,
});

const markAnswerSheetFlow = ai.defineFlow(
  {
    name: 'markAnswerSheetFlow',
    inputSchema: MarkAnswerSheetInputSchema,
    outputSchema: MarkAnswerSheetOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) throw new Error('AI failed to process the answer sheet.');
    return output;
  }
);
