
import { config } from 'dotenv';
config();

import '@/ai/flows/suggest-subjects-for-class.ts';
import '@/ai/flows/generate-term-report-summary.ts';
import '@/ai/flows/generate-report-comment.ts';
import '@/ai/flows/generate-comprehensive-report.ts';
import '@/ai/flows/generate-note-from-objectives.ts';
import '@/ai/flows/generate-quiz-from-note.ts';
import '@/ai/flows/mark-answer-sheet-flow.ts';
import '@/ai/flows/search-intent-flow.ts';
