
'use server';

/**
 * @fileOverview AI agent that suggests Indian recipes based on mood.
 *
 * - moodBasedRecipe - A function that suggests recipes based on user's mood.
 * - MoodBasedRecipeInput - The input type for the moodBasedRecipe function.
 * - MoodBasedRecipeOutput - The return type for the moodBasedRecipe function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const MoodBasedRecipeInputSchema = z.object({
  mood: z
    .string()
    .describe('The mood of the user. e.g., tired, happy, stressed.'),
});
export type MoodBasedRecipeInput = z.infer<typeof MoodBasedRecipeInputSchema>;

const MoodBasedRecipeOutputSchema = z.object({
  recipeName: z.string().describe('The name of the suggested recipe.'),
  ingredients: z.string().describe('The ingredients required for the recipe.'),
  instructions: z
    .string()
    .describe('Step-by-step instructions to prepare the recipe.'),
  reason: z
    .string()
    .describe('Explanation of why this recipe is suitable for the given mood.'),
});
export type MoodBasedRecipeOutput = z.infer<typeof MoodBasedRecipeOutputSchema>;

export async function moodBasedRecipe(input: MoodBasedRecipeInput): Promise<MoodBasedRecipeOutput> {
  return moodBasedRecipeFlow(input);
}

const prompt = ai.definePrompt({
  name: 'moodBasedRecipePrompt',
  input: {schema: MoodBasedRecipeInputSchema},
  output: {schema: MoodBasedRecipeOutputSchema},
  prompt: `You are an AI expert in Indian cuisine. A user will provide their current mood, and you will suggest a comforting Indian recipe that suits their mood.
Aim to provide a *different and creative* recipe suggestion each time for the same mood if possible.
Explain why you are suggesting this specific recipe.

Mood: {{{mood}}}

Respond with the recipeName, ingredients, instructions, and a brief explanation of why this recipe is suitable for the given mood.
`,
  config: {
    temperature: 0.8, // Increase temperature for more varied responses
  },
});

const moodBasedRecipeFlow = ai.defineFlow(
  {
    name: 'moodBasedRecipeFlow',
    inputSchema: MoodBasedRecipeInputSchema,
    outputSchema: MoodBasedRecipeOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);

