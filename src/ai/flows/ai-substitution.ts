'use server';

/**
 * @fileOverview An AI agent that recommends healthy, budget-friendly Indian ingredient alternatives.
 *
 * - aiIngredientSubstitution - A function that handles the ingredient substitution process.
 * - AiIngredientSubstitutionInput - The input type for the aiIngredientSubstitution function.
 * - AiIngredientSubstitutionOutput - The return type for the aiIngredientSubstitution function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AiIngredientSubstitutionInputSchema = z.object({
  ingredient: z.string().describe('The ingredient to find a substitute for.'),
  userHistory: z
    .string()
    .optional()
    .describe('The user history of ingredient usage.'),
  pantryContents: z
    .string()
    .optional()
    .describe('The available ingredients in the pantry.'),
  dietaryRestrictions: z
    .string()
    .optional()
    .describe('Any dietary restrictions the user has.'),
  budget: z.string().optional().describe('The budget constraints of the user.'),
  healthGoals: z
    .string()
    .optional()
    .describe('The health goals of the user, e.g., weight loss, high protein.'),
});

export type AiIngredientSubstitutionInput = z.infer<
  typeof AiIngredientSubstitutionInputSchema
>;

const AiIngredientSubstitutionOutputSchema = z.object({
  substituteIngredient: z
    .string()
    .describe('The recommended substitute ingredient.'),
  reasoning: z
    .string()
    .describe('The reasoning behind the substitution suggestion.'),
  isHealthy: z.boolean().describe('Whether or not the substitute is healthy'),
  isBudgetFriendly: z
    .boolean()
    .describe('Whether or not the substitute is budget friendly'),
});

export type AiIngredientSubstitutionOutput = z.infer<
  typeof AiIngredientSubstitutionOutputSchema
>;

export async function aiIngredientSubstitution(
  input: AiIngredientSubstitutionInput
): Promise<AiIngredientSubstitutionOutput> {
  return aiIngredientSubstitutionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'aiIngredientSubstitutionPrompt',
  input: {schema: AiIngredientSubstitutionInputSchema},
  output: {schema: AiIngredientSubstitutionOutputSchema},
  prompt: `You are an AI assistant that helps users find healthy and budget-friendly Indian ingredient alternatives based on their availability, user history, and nutritional facts.

  Consider the following information to suggest a substitute ingredient:

  Ingredient: {{{ingredient}}}
  User History: {{{userHistory}}}
  Pantry Contents: {{{pantryContents}}}
  Dietary Restrictions: {{{dietaryRestrictions}}}
  Budget: {{{budget}}}
  Health Goals: {{{healthGoals}}}

  Provide a substitute ingredient, and explain your reasoning for the suggestion. Also, indicate whether it is a healthy and budget-friendly alternative.
  Respond in JSON format.
  `,
});

const aiIngredientSubstitutionFlow = ai.defineFlow(
  {
    name: 'aiIngredientSubstitutionFlow',
    inputSchema: AiIngredientSubstitutionInputSchema,
    outputSchema: AiIngredientSubstitutionOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
