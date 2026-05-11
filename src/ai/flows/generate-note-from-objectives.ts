
'use server';

/**
 * @fileOverview Generates lesson notes from a topic and learning objectives.
 *
 * - generateNoteFromObjectives - A function that generates the notes.
 * - GenerateNoteInput - The input type for the function.
 * - GenerateNoteOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateNoteInputSchema = z.object({
  topic: z.string().describe("The main topic of the lesson note, e.g., 'Fractions'."),
  objectives: z.string().describe("A list of learning objectives, likely in markdown bullet points, that the lesson note should cover."),
});
export type GenerateNoteInput = z.infer<typeof GenerateNoteInputSchema>;

const GenerateNoteOutputSchema = z.object({
  noteContent: z
    .string()
    .describe(
      'The full, generated lesson note in simple Markdown format. It should include simple explanations, local examples, and placeholders for images.'
    ),
});
export type GenerateNoteOutput = z.infer<typeof GenerateNoteOutputSchema>;

const generateNoteFromObjectivesFlow = ai.defineFlow(
  {
    name: 'generateNoteFromObjectivesFlow',
    inputSchema: GenerateNoteInputSchema,
    outputSchema: GenerateNoteOutputSchema,
  },
  async (input) => {
    const prompt = ai.definePrompt({
      name: 'generateNoteFromObjectivesPrompt',
      input: { schema: GenerateNoteInputSchema },
      output: { schema: GenerateNoteOutputSchema },
      prompt: `You are an expert curriculum developer creating lesson notes for a primary school teacher in Botswana.
The language must be VERY simple, clear, and easy for a primary student to understand.

Your task is to generate a lesson note based on the provided topic and learning objectives.

TOPIC:
{{{topic}}}

LEARNING OBJECTIVES:
{{{objectives}}}

INSTRUCTIONS:
1.  Structure the note logically with clear headings.
2.  Explain each concept from the objectives in simple terms.
3.  Use Botswana-specific examples where possible(e.g., using Pula/Thebe, talking about cattle, local villages, morula fruit, mophane worms).
4.  You dont have to Write "Botswana Example" Just write "Example 1, Example 2, or use "E.g" 
5.  For illustrations, do NOT use markdown image syntax. Instead, use a simple text placeholder like: [Illustration: A drawing of three children sharing a bag of oranges]. This placeholder will be converted into a visual element.
6.  The final output must be only the lesson note content in Markdown format.
`,
    });
    
    const { output } = await prompt(input);
    return output!;
  }
);


export async function generateNoteFromObjectives(
  input: GenerateNoteInput
): Promise<GenerateNoteOutput> {
  return generateNoteFromObjectivesFlow(input);
}
