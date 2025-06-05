import { config } from 'dotenv';
config();

import '@/ai/flows/mood-based-recipe.ts';
import '@/ai/flows/ai-query.ts';
import '@/ai/flows/ai-substitution.ts';
import '@/ai/flows/ai-meal-planner.ts';