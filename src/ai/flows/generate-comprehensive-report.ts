
'use server';

/**
 * @fileOverview Generates a comprehensive narrative report for a class's performance.
 *
 * - generateComprehensiveClassReport - A function that generates the report.
 * - GenerateComprehensiveReportInput - The input type for the function.
 * - GenerateComprehensiveReportOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateComprehensiveReportInputSchema = z.object({
  className: z.string().describe("The name of the class, e.g., 'Standard 7A'."),
  academicYear: z.string().describe('The academic year, e.g., "2024".'),
  term: z.string().describe('The academic term, e.g., "Term 1".'),
  totalStudents: z.number().describe('The total number of students in the class.'),
  overallAverage: z.number().describe("The class's overall average percentage."),
  classOverallPassRate: z.number().describe("The class's overall Pass Rate (A, B, or C)."),
  topStudent: z.string().describe("The name of the top-performing student."),
  studentPerformanceData: z.array(z.object({
      studentName: z.string(),
      overallPercentage: z.number(),
  })).describe('An array of objects, each containing a student name and their overall percentage.'),
   subjectPerformanceData: z.array(z.object({
    subjectName: z.string(),
    overallPassRate: z.number().describe("The percentage of students who achieved an 'A', 'B', or 'C' grade."),
  })).describe('An array of objects, each containing a subject name and the pass rates for that subject.'),
});
export type GenerateComprehensiveReportInput = z.infer<typeof GenerateComprehensiveReportInputSchema>;


const PromptInputSchema = GenerateComprehensiveReportInputSchema.extend({
    topSubjects: z.array(GenerateComprehensiveReportInputSchema.shape.subjectPerformanceData.element),
    bottomSubjects: z.array(GenerateComprehensiveReportInputSchema.shape.subjectPerformanceData.element),
    topStudentPercentage: z.number().optional(),
});

const GenerateComprehensiveReportOutputSchema = z.object({
  report: z.string().describe(
    'A comprehensive, well-structured narrative report with a main title, subtitles for each section, and paragraphs. It should start with an introduction, discuss the overall class performance, mention subjects of strength and weakness based on pass rates, highlight top performers and students needing support, and conclude with recommendations. The tone should be professional and constructive.'
  ),
});
export type GenerateComprehensiveReportOutput = z.infer<typeof GenerateComprehensiveReportOutputSchema>;

export async function generateComprehensiveClassReport(
  input: GenerateComprehensiveReportInput
): Promise<GenerateComprehensiveReportOutput> {
  console.log('[GENKIT FLOW LOG] Received input in generateComprehensiveClassReport:', JSON.stringify(input, null, 2));
  return generateComprehensiveReportFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateComprehensiveReportPrompt',
  input: { schema: PromptInputSchema },
  output: { schema: GenerateComprehensiveReportOutputSchema },
  prompt: `You are a highly experienced Botswana primary school headteacher writing an official end-of-term class report.

Write a professional, accurate, and constructive narrative report using ONLY the data provided below. DO NOT guess, estimate, or invent any numbers.

=== REPORT STRUCTURE (Follow Exactly) ===

Class Performance Report: {{{className}}} - {{{term}}}, {{{academicYear}}}

Introduction
This report presents the academic performance of {{{className}}} for {{{term}}} of the {{{academicYear}}} academic year. The class has {{{totalStudents}}} students.

Overall Performance
The class recorded an overall average of {{{overallAverage}}}% and an overall pass rate (A-C) of {{{classOverallPassRate}}}%. While no student achieved an overall A or B symbol, several subjects showed encouraging pass rates, indicating that excellence is achievable in specific areas. The focus should be on helping more students achieve mastery across all subjects.

Subject Performance Analysis
Performance varied across subjects. The strongest subjects, based on Overall Pass Rate (A-C), were:
{{#each topSubjects}}
• {{{subjectName}}}: {{{overallPassRate}}}% Overall Pass (A-C)
{{/each}}

Subjects requiring the most attention include:
{{#each bottomSubjects}}
• {{{subjectName}}}: {{{overallPassRate}}}% Overall Pass (A-C)
{{/each}}

Student Performance Analysis
{{{topStudent}}} led the class with an outstanding average of {{{topStudentPercentage}}}%. A number of students performed satisfactorily, scoring between 50% and 79%, and should be encouraged to continue their steady efforts. However, a significant portion of the class scored below the 50% pass mark, indicating a clear need for targeted academic support and intervention to address learning gaps.

Conclusion and Recommendations
While pockets of excellence exist, the overall performance indicates a need for broader improvement. Recommended actions include:
• Targeted revision in low-performing subjects.
• After-school support for students scoring below 50%.
• Celebrating and learning from top performers through peer mentoring.
`,
});

const generateComprehensiveReportFlow = ai.defineFlow(
  {
    name: 'generateComprehensiveReportFlow',
    inputSchema: GenerateComprehensiveReportInputSchema,
    outputSchema: GenerateComprehensiveReportOutputSchema,
  },
  async (input) => {
    try {
        
      const sortedByOverallDesc = [...input.subjectPerformanceData].sort((a, b) => b.overallPassRate - a.overallPassRate);
      const topSubjects = sortedByOverallDesc.slice(0, 3);

      const sortedByOverallAsc = [...input.subjectPerformanceData].sort((a, b) => a.overallPassRate - b.overallPassRate);
      const bottomSubjects = sortedByOverallAsc.slice(0, 3);

      const topStudentData = input.studentPerformanceData.find(
        (student) => student.studentName === input.topStudent
      );

      const promptInput = {
        ...input,
        topSubjects,
        bottomSubjects,
        topStudentPercentage: topStudentData?.overallPercentage,
      };

      const response = await prompt(promptInput);
      const output = response.output;
      console.log('[GENKIT FLOW LOG] AI model raw output:', JSON.stringify(output, null, 2));
      
      if (!output) {
        throw new Error('AI model returned an empty output.');
      }
      
      return output;
    } catch (error: any) {
      console.error('[GENKIT FLOW ERROR] Error during prompt execution:', error);
      throw new Error(`AI flow failed: ${error.message}`);
    }
  }
);
