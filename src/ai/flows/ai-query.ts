'use server';

/**
 * @fileOverview AI recipe query flow that translates natural language queries into recipe suggestions.
 *
 * - aiRecipeQuery - A function that handles the recipe query process.
 * - AiRecipeQueryInput - The input type for the aiRecipeQuery function.
 * - AiRecipeQueryOutput - The return type for the aiRecipeQuery function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AiRecipeQueryInputSchema = z.object({
  query: z.string().describe('A natural language query for a recipe, e.g., \'Dinner for 4 with no onion-garlic\'.'),
});
export type AiRecipeQueryInput = z.infer<typeof AiRecipeQueryInputSchema>;

const AiRecipeQueryOutputSchema = z.object({
  recipeSuggestions: z
    .array(z.string())
    .describe('A list of recipe suggestions based on the query.'),
});
export type AiRecipeQueryOutput = z.infer<typeof AiRecipeQueryOutputSchema>;

export async function aiRecipeQuery(input: AiRecipeQueryInput): Promise<AiRecipeQueryOutput> {
  return aiRecipeQueryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'aiRecipeQueryPrompt',
  input: {schema: AiRecipeQueryInputSchema},
  output: {schema: AiRecipeQueryOutputSchema},
  prompt: `You are a helpful assistant that suggests recipes based on user queries.

  The user query is: {{{query}}}

  Suggest recipes that satisfy the query. Return a list of recipe suggestions.
  Consider dietary restrictions and the number of people when suggesting recipes.`,
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
