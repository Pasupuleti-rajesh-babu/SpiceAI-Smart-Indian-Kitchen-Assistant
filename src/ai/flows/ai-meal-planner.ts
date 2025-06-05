
'use server';

/**
 * @fileOverview This file defines a Genkit flow for generating a 7-day Indian meal plan.
 * It considers user's pantry contents, dietary goals, cuisine preferences, and an optional existing plan to allow for partial regeneration.
 *
 * - aiMealPlanner - A function that generates a 7-day Indian meal plan.
 * - AiMealPlannerInput - The input type for the aiMealPlanner function.
 * - AiMealPlannerOutput - The return type for the aiMealPlanner function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const DailyMealPlanSchema = z.object({
  day: z.string().describe("Day of the week (e.g., Monday)"),
  breakfast: z.string().describe("Breakfast meal for the day"),
  lunch: z.string().describe("Lunch meal for the day"),
  dinner: z.string().describe("Dinner meal for the day"),
  isBreakfastSaved: z.boolean().optional().describe("Indicates if the user wants to keep this breakfast meal."),
  isLunchSaved: z.boolean().optional().describe("Indicates if the user wants to keep this lunch meal."),
  isDinnerSaved: z.boolean().optional().describe("Indicates if the user wants to keep this dinner meal."),
});

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
  existingPlan: z.array(DailyMealPlanSchema).optional().describe("An optional existing 7-day meal plan. If provided, meals marked with 'is[Meal]Saved: true' should be retained, and only unsaved meals should be regenerated."),
});
export type AiMealPlannerInput = z.infer<typeof AiMealPlannerInputSchema>;


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

Based on the user's pantry contents and dietary goals, generate or update a 7-day Indian meal plan.
Consider smart ingredient substitutions based on availability and dietary needs.
The meal plan should be easy to follow and primarily feature Indian cuisine.

Pantry Contents: {{{pantryContents}}}
Dietary Goals: {{{dietaryGoals}}}
{{#if cuisinePreferences.length}}
Preferred Indian Cuisines: {{#each cuisinePreferences}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}
When generating the meal plan, please try to incorporate dishes from these preferred Indian cuisines for any new meal suggestions.
{{else}}
The user has not specified any particular Indian cuisine preferences, so you can suggest a general Indian meal plan for any new meal suggestions.
{{/if}}

{{#if existingPlan}}
The user has provided an existing meal plan. Review it carefully.
For each day and each meal (breakfast, lunch, dinner):
- If 'isBreakfastSaved' is true for a day, you MUST keep the existing breakfast for that day.
- If 'isLunchSaved' is true for a day, you MUST keep the existing lunch for that day.
- If 'isDinnerSaved' is true for a day, you MUST keep the existing dinner for that day.
- For any meal slot that is NOT marked as saved (or if the saved flag is false/missing), you should generate a NEW, appropriate meal suggestion based on the pantry, dietary goals, and cuisine preferences.

Existing Plan Details:
{{#each existingPlan}}
Day: {{day}}
  Breakfast: {{breakfast}} {{#if isBreakfastSaved}}(KEEP THIS){{/if}}
  Lunch: {{lunch}} {{#if isLunchSaved}}(KEEP THIS){{/if}}
  Dinner: {{dinner}} {{#if isDinnerSaved}}(KEEP THIS){{/if}}
{{/each}}

Generate a complete 7-day plan, incorporating the saved meals from the existing plan and filling in the rest.
{{else}}
Generate a completely fresh 7-day meal plan.
{{/if}}

Respond *only* with a JSON array, where each element is an object representing a day. Each day object must have the following string properties: "day", "breakfast", "lunch", and "dinner".
The boolean saved flags (isBreakfastSaved, isLunchSaved, isDinnerSaved) from the input existingPlan should NOT be part of your JSON output schema. Your output should only contain day, breakfast, lunch, dinner for each of the 7 days.
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
    // The AI output schema doesn't include the "isSaved" flags.
    // We will merge the AI's meal suggestions with the saved flags from the input.
    const {output} = await mealPlanPrompt(input);
    
    if (output && input.existingPlan) {
      const finalPlan = output.mealPlan.map((dayPlan, index) => {
        const existingDay = input.existingPlan![index]; // Assume plans are same length and order
        return {
          ...dayPlan,
          isBreakfastSaved: existingDay?.isBreakfastSaved,
          isLunchSaved: existingDay?.isLunchSaved,
          isDinnerSaved: existingDay?.isDinnerSaved,
        };
      });
      return { mealPlan: finalPlan };
    }
    
    return output!;
  }
);
