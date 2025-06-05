
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import AiFeatureCard from '@/components/ai/AiFeatureCard';
import RecipeDisplay from '@/components/ai/RecipeDisplay';
import type { Recipe } from '@/types/recipe';
import { aiMealPlanner, type AiMealPlannerInput } from '@/ai/flows/ai-meal-planner';
import { useToast } from "@/hooks/use-toast";
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { PANTRY_ITEMS_KEY, APP_SETTINGS_KEY } from '@/lib/localStorageKeys';
import type { PantryItem } from '@/types/pantry';
import type { AppSettings } from '@/types/settings';
import { defaultAppSettings } from '@/types/settings';
import { CalendarHeart, Sparkles, Send } from 'lucide-react';

export default function AiMealPlannerClient() {
  const [pantryContents, setPantryContents] = useState('');
  const [dietaryGoals, setDietaryGoals] = useState('');
  const [generatedPlan, setGeneratedPlan] = useState<Recipe | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [storedPantryItems] = useLocalStorage<PantryItem[]>(PANTRY_ITEMS_KEY, []);
  const [settings] = useLocalStorage<AppSettings>(APP_SETTINGS_KEY, defaultAppSettings);

  useEffect(() => {
    if (storedPantryItems.length > 0) {
      const pantryNames = storedPantryItems.map(item => item.name).join(', ');
      setPantryContents(pantryNames);
    }
  }, [storedPantryItems]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pantryContents.trim() || !dietaryGoals.trim()) {
      toast({ title: "Missing Information", description: "Please provide pantry contents and dietary goals.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    setGeneratedPlan(null);
    try {
      const input: AiMealPlannerInput = { 
        pantryContents, 
        dietaryGoals,
        cuisinePreferences: settings.cuisinePreferences && settings.cuisinePreferences.length > 0 ? settings.cuisinePreferences : undefined,
      };
      const result = await aiMealPlanner(input);
      setGeneratedPlan({
        recipeName: '', 
        ingredients: '', 
        instructions: '', 
        dailyMealPlans: result.mealPlan
      });
      toast({ title: "Meal Plan Generated!", description: "Your 7-day Indian meal plan is ready.", variant: "default" });
    } catch (error) {
      console.error("Error generating meal plan:", error);
      toast({ title: "Error", description: "Failed to generate meal plan. Please try again.", variant: "destructive" });
    }
    setIsLoading(false);
  };

  return (
    <AiFeatureCard
      title="AI Meal Planner"
      description="Get a 7-day Indian meal plan based on your pantry, dietary goals, and cuisine preferences."
      icon={CalendarHeart}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <Label htmlFor="pantryContents" className="text-sm font-medium">Pantry Contents (comma-separated)</Label>
          <Textarea
            id="pantryContents"
            value={pantryContents}
            onChange={(e) => setPantryContents(e.target.value)}
            placeholder="e.g., Rice, Lentils, Spinach, Paneer, Tomatoes"
            rows={3}
            className="mt-1"
            required
          />
           <p className="mt-1 text-xs text-muted-foreground">
            Automatically pre-filled from your pantry. You can edit it here.
          </p>
        </div>
        <div>
          <Label htmlFor="dietaryGoals" className="text-sm font-medium">Dietary Goals & Restrictions</Label>
          <Textarea
            id="dietaryGoals"
            value={dietaryGoals}
            onChange={(e) => setDietaryGoals(e.target.value)}
            placeholder="e.g., Weight loss, high protein, no gluten, avoid mushrooms"
            rows={3}
            className="mt-1"
            required
          />
        </div>
        <p className="text-xs text-muted-foreground">
            Your cuisine preferences from settings (currently: {settings.cuisinePreferences?.join(', ') || 'Any Indian'}) will be considered.
        </p>
        <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
          {isLoading ? (
            <Sparkles className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            <Send className="mr-2 h-5 w-5" />
          )}
          Generate Meal Plan
        </Button>
      </form>
      <RecipeDisplay recipe={generatedPlan} isLoading={isLoading} title="Your Personalized Meal Plan" />
    </AiFeatureCard>
  );
}
