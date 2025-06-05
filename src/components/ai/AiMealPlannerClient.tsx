
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import AiFeatureCard from '@/components/ai/AiFeatureCard';
import RecipeDisplay from '@/components/ai/RecipeDisplay';
import type { Recipe, DailyMealPlan } from '@/types/recipe';
import { aiMealPlanner, type AiMealPlannerInput } from '@/ai/flows/ai-meal-planner';
import { useToast } from "@/hooks/use-toast";
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { PANTRY_ITEMS_KEY, APP_SETTINGS_KEY, AI_MEAL_PLAN_KEY } from '@/lib/localStorageKeys';
import type { PantryItem } from '@/types/pantry';
import type { AppSettings } from '@/types/settings';
import { defaultAppSettings } from '@/types/settings';
import { CalendarHeart, Sparkles, Send, Loader2, RefreshCw } from 'lucide-react';

export default function AiMealPlannerClient() {
  const [pantryContents, setPantryContents] = useState('');
  const [dietaryGoals, setDietaryGoals] = useState('');
  const [generatedPlan, setGeneratedPlan] = useLocalStorage<Recipe | null>(AI_MEAL_PLAN_KEY, null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [storedPantryItems] = useLocalStorage<PantryItem[]>(PANTRY_ITEMS_KEY, []);
  const [settings] = useLocalStorage<AppSettings>(APP_SETTINGS_KEY, defaultAppSettings);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (hasMounted && storedPantryItems.length > 0) {
      const pantryNames = storedPantryItems.map(item => item.name).join(', ');
      setPantryContents(pantryNames);
    }
  }, [storedPantryItems, hasMounted]);

  const handleToggleSaveMeal = (dayIndex: number, mealType: 'breakfast' | 'lunch' | 'dinner') => {
    setGeneratedPlan(prevPlan => {
      if (!prevPlan || !prevPlan.dailyMealPlans) return prevPlan;

      const updatedDailyMealPlans = prevPlan.dailyMealPlans.map((day, index) => {
        if (index === dayIndex) {
          const updatedDay = { ...day };
          if (mealType === 'breakfast') updatedDay.isBreakfastSaved = !updatedDay.isBreakfastSaved;
          else if (mealType === 'lunch') updatedDay.isLunchSaved = !updatedDay.isLunchSaved;
          else if (mealType === 'dinner') updatedDay.isDinnerSaved = !updatedDay.isDinnerSaved;
          return updatedDay;
        }
        return day;
      });
      return { ...prevPlan, dailyMealPlans: updatedDailyMealPlans };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pantryContents.trim() || !dietaryGoals.trim()) {
      toast({ title: "Missing Information", description: "Please provide pantry contents and dietary goals.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    // Do not reset generatedPlan here if we want to support partial regeneration
    // setGeneratedPlan(null); 
    try {
      const input: AiMealPlannerInput = { 
        pantryContents, 
        dietaryGoals,
        cuisinePreferences: settings.cuisinePreferences && settings.cuisinePreferences.length > 0 ? settings.cuisinePreferences : undefined,
        existingPlan: generatedPlan?.dailyMealPlans // Pass current plan if it exists
      };
      const result = await aiMealPlanner(input);
      // The flow now returns the plan with saved flags preserved/updated
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
  
  const handleForceRefreshAll = () => {
    setGeneratedPlan(prev => {
        if (!prev || !prev.dailyMealPlans) return null;
        // Create a new plan object where all saved flags are false
        const refreshedDailyPlans = prev.dailyMealPlans.map(day => ({
            ...day,
            isBreakfastSaved: false,
            isLunchSaved: false,
            isDinnerSaved: false,
        }));
        // Also clear any top-level recipe details if they exist from other contexts
        return { 
          recipeName: '', 
          ingredients: '', 
          instructions: '', 
          dailyMealPlans: refreshedDailyPlans 
        };
    });
    toast({ title: "Plan Reset", description: "All meal locks removed. Click 'Generate Meal Plan' to get a completely new plan."});
  };


  if (!hasMounted) {
    return (
      <AiFeatureCard
        title="AI Meal Planner"
        description="Get a 7-day Indian meal plan. Save meals you like, and regenerate the rest!"
        icon={CalendarHeart}
      >
        <div className="flex justify-center items-center min-h-[200px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AiFeatureCard>
    );
  }

  return (
    <AiFeatureCard
      title="AI Meal Planner"
      description="Get a 7-day Indian meal plan. Save meals you like, and regenerate the rest!"
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
        {hasMounted && (
          <p className="text-xs text-muted-foreground">
              Your cuisine preferences from settings (currently: {settings.cuisinePreferences?.join(', ') || 'Any Indian'}) will be considered.
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-2">
            <Button type="submit" disabled={isLoading} className="w-full sm:w-auto flex-grow">
            {isLoading ? (
                <Sparkles className="mr-2 h-5 w-5 animate-spin" />
            ) : (
                <Send className="mr-2 h-5 w-5" />
            )}
            {generatedPlan?.dailyMealPlans?.some(d => d.isBreakfastSaved || d.isLunchSaved || d.isDinnerSaved) ? 'Regenerate Unsaved Meals' : 'Generate Meal Plan'}
            </Button>
            {generatedPlan && generatedPlan.dailyMealPlans && generatedPlan.dailyMealPlans.length > 0 && (
                <Button type="button" variant="outline" onClick={handleForceRefreshAll} disabled={isLoading} className="w-full sm:w-auto">
                    <RefreshCw className="mr-2 h-5 w-5" />
                    Start Fresh (Unlock All)
                </Button>
            )}
        </div>
      </form>
      <RecipeDisplay 
        recipe={generatedPlan} 
        isLoading={isLoading} 
        title="Your Personalized Meal Plan"
        onToggleSaveMeal={handleToggleSaveMeal}
      />
    </AiFeatureCard>
  );
}
