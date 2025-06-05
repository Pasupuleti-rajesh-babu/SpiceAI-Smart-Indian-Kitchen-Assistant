
export interface DailyMealPlan {
  day: string;
  breakfast: string;
  lunch: string;
  dinner: string;
}

export interface Recipe {
  recipeName: string;
  ingredients: string; // This is a single string from AI, needs parsing/formatting
  instructions: string; // This is a single string from AI, needs parsing/formatting
  reason?: string;
  // For AI Substitution Output
  substituteIngredient?: string;
  reasoning?: string;
  isHealthy?: boolean;
  isBudgetFriendly?: boolean;
  // For AI Query Output
  recipeSuggestions?: string[];
  // For AI Meal Planner Output - now structured
  dailyMealPlans?: DailyMealPlan[];
}
