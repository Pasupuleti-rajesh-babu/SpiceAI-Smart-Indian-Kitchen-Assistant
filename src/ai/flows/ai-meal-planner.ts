'use server';

/**
 * @fileOverview This file defines a Genkit flow for generating a 7-day Indian meal plan based on user's pantry contents and dietary goals.
 *
 * - aiMealPlanner - A function that generates a 7-day Indian meal plan.
 * - AiMealPlannerInput - The input type for the aiMealPlanner function.
 * - AiMealPlannerOutput - The return type for the aiMealPlanner function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AiMealPlannerInputSchema = z.object({
  pantryContents: z
    .string()
    .describe('A comma-separated list of items currently in the pantry.'),
  dietaryGoals: z
    .string()
    .describe(
      'The dietary goals of the user, e.g., weight loss, high protein. Specify any allergies or ingredients to avoid here as well.'
    ),
});
export type AiMealPlannerInput = z.infer<typeof AiMealPlannerInputSchema>;

const AiMealPlannerOutputSchema = z.object({
  mealPlan: z.string().describe('A 7-day Indian meal plan.'),
});
export type AiMealPlannerOutput = z.infer<typeof AiMealPlannerOutputSchema>;

export async function aiMealPlanner(input: AiMealPlannerInput): Promise<AiMealPlannerOutput> {
  return aiMealPlannerFlow(input);
}

const mealPlanPrompt = ai.definePrompt({
  name: 'mealPlanPrompt',
  input: {schema: AiMealPlannerInputSchema},
  output: {schema: AiMealPlannerOutputSchema},
  prompt: `You are a personal Indian meal planning assistant.

  Based on the user's pantry contents and dietary goals, generate a 7-day Indian meal plan. Consider smart ingredient substitutions based on availability and dietary needs.  The meal plan should be easy to follow. Do not add any conversational text.  The response should be well formatted.

Pantry Contents: {{{pantryContents}}}
Dietary Goals: {{{dietaryGoals}}}

7-Day Indian Meal Plan:`,
});

const aiMealPlannerFlow = ai.defineFlow(
  {
    name: 'aiMealPlannerFlow',
    inputSchema: AiMealPlannerInputSchema,
    outputSchema: AiMealPlannerOutputSchema,
  },
  async input => {
    const {output} = await mealPlanPrompt(input);
    return output!;
  }
);
