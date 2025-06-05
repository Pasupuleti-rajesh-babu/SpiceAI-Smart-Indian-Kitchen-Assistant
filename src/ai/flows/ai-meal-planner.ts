
'use server';

/**
 * @fileOverview This file defines a Genkit flow for generating a 7-day Indian meal plan based on user's pantry contents, dietary goals, and cuisine preferences.
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
  cuisinePreferences: z
    .array(z.string())
    .optional()
    .describe('Optional list of preferred Indian cuisines, e.g., ["South Indian", "Punjabi"].'),
});
export type AiMealPlannerInput = z.infer<typeof AiMealPlannerInputSchema>;

const DailyMealPlanSchema = z.object({
  day: z.string().describe("Day of the week (e.g., Monday)"),
  breakfast: z.string().describe("Breakfast meal for the day"),
  lunch: z.string().describe("Lunch meal for the day"),
  dinner: z.string().describe("Dinner meal for the day"),
});

const AiMealPlannerOutputSchema = z.object({
  mealPlan: z.array(DailyMealPlanSchema).describe('A 7-day Indian meal plan, structured as an array of objects, where each object represents a day and contains breakfast, lunch, and dinner. Example: [{"day": "Monday", "breakfast": "Meal A", "lunch": "Meal B", "dinner": "Meal C"}, ...]'),
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

Based on the user's pantry contents and dietary goals, generate a 7-day Indian meal plan.
Consider smart ingredient substitutions based on availability and dietary needs.
The meal plan should be easy to follow and primarily feature Indian cuisine.

Pantry Contents: {{{pantryContents}}}
Dietary Goals: {{{dietaryGoals}}}
{{#if cuisinePreferences.length}}
Preferred Indian Cuisines: {{#each cuisinePreferences}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}
When generating the meal plan, please try to incorporate dishes from these preferred Indian cuisines.
{{else}}
The user has not specified any particular Indian cuisine preferences, so you can suggest a general Indian meal plan.
{{/if}}

Respond *only* with a JSON array, where each element is an object representing a day. Each day object must have the following string properties: "day", "breakfast", "lunch", and "dinner".
For example: [{"day": "Monday", "breakfast": "Poha", "lunch": "Rajma Chawal", "dinner": "Palak Paneer with Roti"}, ...]
Do not include any conversational text, introductory phrases, explanations, or markdown formatting like \`\`\`json ... \`\`\` outside of the JSON structure itself. The entire response should be the JSON array.`,
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
