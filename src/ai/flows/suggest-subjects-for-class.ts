'use server';

/**
 * @fileOverview This file defines a Genkit flow for suggesting a list of relevant subjects for a class.
 *
 * - suggestSubjectsForClass - A function that suggests subjects for a given class.
 * - SuggestSubjectsForClassInput - The input type for the suggestSubjectsForClass function.
 * - SuggestSubjectsForClassOutput - The return type for the suggestSubjectsForClass function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestSubjectsForClassInputSchema = z.object({
  gradeLevel: z.string().describe('The grade level of the class.'),
  curriculum: z.string().describe('The curriculum being followed by the school.'),
});
export type SuggestSubjectsForClassInput = z.infer<typeof SuggestSubjectsForClassInputSchema>;

const SuggestSubjectsForClassOutputSchema = z.object({
  subjects: z.array(z.string()).describe('A list of suggested subjects for the class.'),
});
export type SuggestSubjectsForClassOutput = z.infer<typeof SuggestSubjectsForClassOutputSchema>;

export async function suggestSubjectsForClass(input: SuggestSubjectsForClassInput): Promise<SuggestSubjectsForClassOutput> {
  return suggestSubjectsForClassFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestSubjectsForClassPrompt',
  input: {schema: SuggestSubjectsForClassInputSchema},
  output: {schema: SuggestSubjectsForClassOutputSchema},
  prompt: `You are a curriculum expert. Suggest a list of subjects for a class, based on the curriculum and grade level.

Curriculum: {{{curriculum}}}
Grade Level: {{{gradeLevel}}}

Subjects:`,
});

const suggestSubjectsForClassFlow = ai.defineFlow(
  {
    name: 'suggestSubjectsForClassFlow',
    inputSchema: SuggestSubjectsForClassInputSchema,
    outputSchema: SuggestSubjectsForClassOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
