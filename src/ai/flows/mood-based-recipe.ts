
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
  prompt: `You are an AI culinary genius specializing in diverse Indian cuisine. A user will provide their current mood. Your task is to conjure a *unique and imaginative* Indian recipe perfectly suited to that mood.

Critically, for EVERY request, you MUST generate a fresh, *never-before-suggested-by-you-in-this-interaction-style* recipe. Avoid common, stereotypical, or overly simple suggestions like basic khichdi unless the mood *absolutely* demands something very plain. Strive for creativity and surprise the user with your depth of knowledge. If you've thought of a recipe, try to think of something different.

Mood: {{{mood}}}

Respond with the recipeName, ingredients, instructions, and a compelling explanation of why this specific, creative recipe is an excellent match for the given mood.
`,
  config: {
    temperature: 0.9, // Increased temperature slightly more for extra creativity
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

