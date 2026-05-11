import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

/**
 * Genkit instance for AI operations.
 * 
 * IMPORTANT: This plugin requires an API key to be set in your environment.
 * Add 'GOOGLE_GENAI_API_KEY=your_key' to your .env file at the root of the project.
 * 
 * Also ensure the 'Generative Language API' is enabled in your Google Cloud Console:
 * https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com
 */
export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-2.5-flash',
});
