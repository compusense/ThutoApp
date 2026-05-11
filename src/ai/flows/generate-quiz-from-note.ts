
'use server';

/**
 * @fileOverview Generates a quiz based on a lesson note's content.
 *
 * - generateQuizFromNote - Generates a quiz.
 * - GenerateQuizInput - Input type.
 * - GenerateQuizOutput - Return type.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateQuizInputSchema = z.object({
  title: z.string().describe('The title of the lesson note.'),
  content: z.string().describe("The full content of the lesson note, which includes learning objectives."),
});
export type GenerateQuizInput = z.infer<typeof GenerateQuizInputSchema>;

const QuizQuestionSchema = z.object({
  question: z.string().describe('The question text.'),
  type: z.enum(['multiple-choice', 'true-false']).describe('The type of the question.'),
  options: z.array(z.string()).optional().describe('An array of 4 options for a multiple-choice question.'),
  correctAnswer: z.string().describe('The correct answer. For true-false, it should be "True" or "False". For multiple-choice, it should be one of the provided options.'),
});

const GenerateQuizOutputSchema = z.object({
  title: z.string(),
  questions: z.array(QuizQuestionSchema).min(5).max(10),
});
export type GenerateQuizOutput = z.infer<typeof GenerateQuizOutputSchema>;

const prompt = ai.definePrompt({
  name: 'generateQuizPrompt',
  input: { schema: GenerateQuizInputSchema },
  output: { schema: GenerateQuizOutputSchema },
  prompt: `You are an expert in creating educational assessments for primary school students in Botswana.
Your task is to generate a quiz based on the provided lesson note title and objectives.

The quiz should contain between 5 and 10 questions.
- 80% of the questions must be multiple-choice with 4 distinct options.
- 20% of the questions must be true/false.

The questions should be clear, simple, and directly test the learning objectives outlined in the note content.

Lesson Title: {{{title}}}
Note Content / Objectives:
{{{content}}}

Generate a quiz based on this information.
`,
});

export const generateQuizFromNote = ai.defineFlow(
  {
    name: 'generateQuizFromNoteFlow',
    inputSchema: GenerateQuizInputSchema,
    outputSchema: GenerateQuizOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
      throw new Error('AI failed to generate quiz output.');
    }
    return output;
  }
);
