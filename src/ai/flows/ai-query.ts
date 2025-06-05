
'use server';

/**
 * @fileOverview AI recipe query flow that translates natural language queries into a detailed recipe suggestion, considering cuisine preferences.
 *
 * - aiRecipeQuery - A function that handles the recipe query process.
 * - AiRecipeQueryInput - The input type for the aiRecipeQuery function.
 * - AiRecipeQueryOutput - The return type for the aiRecipeQuery function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AiRecipeQueryInputSchema = z.object({
  query: z.string().describe('A natural language query for a recipe, e.g., \'Dinner for 4 with no onion-garlic\'.'),
  cuisinePreferences: z
    .array(z.string())
    .optional()
    .describe('Optional list of preferred Indian cuisines, e.g., ["South Indian", "Punjabi"].'),
});
export type AiRecipeQueryInput = z.infer<typeof AiRecipeQueryInputSchema>;

const AiRecipeQueryOutputSchema = z.object({
  recipeName: z.string().describe('The name of the suggested recipe.'),
  ingredients: z.string().describe('The ingredients required for the recipe, formatted as a list (e.g., item 1\\nitem 2).'),
  instructions: z
    .string()
    .describe('Step-by-step instructions to prepare the recipe, formatted as a list (e.g., step 1\\nstep 2).'),
  reason: z.string().optional().describe('Explanation of why this recipe is a good match for the query.'),
});
export type AiRecipeQueryOutput = z.infer<typeof AiRecipeQueryOutputSchema>;

export async function aiRecipeQuery(input: AiRecipeQueryInput): Promise<AiRecipeQueryOutput> {
  return aiRecipeQueryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'aiRecipeQueryPrompt',
  input: {schema: AiRecipeQueryInputSchema},
  output: {schema: AiRecipeQueryOutputSchema},
  prompt: `You are a helpful assistant that provides a detailed Indian recipe based on a user's query.

  The user query is: {{{query}}}

  {{#if cuisinePreferences.length}}
  The user has also specified preferred Indian cuisines: {{#each cuisinePreferences}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}.
  Please try to suggest a recipe that aligns with these preferences.
  {{else}}
  The user has not specified any particular Indian cuisine preferences, so suggest a general Indian recipe.
  {{/if}}

  Based on the query, suggest the single best matching Indian recipe.
  Provide the recipeName, a list of ingredients (each on a new line), step-by-step instructions (each on a new line), and optionally, a brief reason why this recipe fits the query.
  Consider dietary restrictions and the number of people mentioned in the query when suggesting the recipe.`,
});

const aiRecipeQueryFlow = ai.defineFlow(
  {
    name: 'aiRecipeQueryFlow',
    inputSchema: AiRecipeQueryInputSchema,
    outputSchema: AiRecipeQueryOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
