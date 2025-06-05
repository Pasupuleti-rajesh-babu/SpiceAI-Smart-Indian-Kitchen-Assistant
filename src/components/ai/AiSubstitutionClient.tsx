
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import AiFeatureCard from '@/components/ai/AiFeatureCard';
import RecipeDisplay from '@/components/ai/RecipeDisplay';
import type { Recipe } from '@/types/recipe';
import { aiIngredientSubstitution, type AiIngredientSubstitutionInput } from '@/ai/flows/ai-substitution';
import { useToast } from "@/hooks/use-toast";
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { PANTRY_ITEMS_KEY, APP_SETTINGS_KEY, AI_SUBSTITUTION_RESULT_KEY } from '@/lib/localStorageKeys';
import type { PantryItem } from '@/types/pantry';
import type { AppSettings } from '@/types/settings';
import { defaultAppSettings } from '@/types/settings';
import { Replace, Sparkles, Send, Loader2 } from 'lucide-react';

export default function AiSubstitutionClient() {
  const [ingredient, setIngredient] = useState('');
  const [healthGoals, setHealthGoals] = useState('');
  const [budget, setBudget] = useState('');
  
  const [generatedSubstitution, setGeneratedSubstitution] = useLocalStorage<Recipe | null>(AI_SUBSTITUTION_RESULT_KEY, null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [hasMounted, setHasMounted] = useState(false);

  const [storedPantryItems] = useLocalStorage<PantryItem[]>(PANTRY_ITEMS_KEY, []);
  const [settings] = useLocalStorage<AppSettings>(APP_SETTINGS_KEY, defaultAppSettings);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ingredient.trim()) {
      toast({ title: "Missing Ingredient", description: "Please enter an ingredient to substitute.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    setGeneratedSubstitution(null); // Clear previous result before fetching new one
    try {
      const pantryContents = storedPantryItems.map(item => item.name).join(', ');
      const dietaryRestrictions = settings.allergies.join(', ');

      const input: AiIngredientSubstitutionInput = { 
        ingredient, 
        pantryContents,
        dietaryRestrictions,
        healthGoals: healthGoals || undefined,
        budget: budget || undefined,
        // userHistory is optional and not explicitly collected here for simplicity
      };
      const result = await aiIngredientSubstitution(input);
      setGeneratedSubstitution({ 
        recipeName: '', // Not applicable
        ingredients: '', // Not applicable
        instructions: '', // Not applicable
        substituteIngredient: result.substituteIngredient,
        reasoning: result.reasoning,
        isHealthy: result.isHealthy,
        isBudgetFriendly: result.isBudgetFriendly
      });
      toast({ title: "Substitution Found!", description: `AI suggested a substitute for ${ingredient}.`, variant: "default" });
    } catch (error) {
      console.error("Error generating substitution:", error);
      toast({ title: "Error", description: "Failed to find substitution. Please try again.", variant: "destructive" });
    }
    setIsLoading(false);
  };

  if (!hasMounted) {
    return (
      <AiFeatureCard
        title="AI Ingredient Substitution"
        description="Find healthy, budget-friendly Indian alternatives for ingredients."
        icon={Replace}
      >
        <div className="flex justify-center items-center min-h-[200px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AiFeatureCard>
    );
  }

  return (
    <AiFeatureCard
      title="AI Ingredient Substitution"
      description="Find healthy, budget-friendly Indian alternatives for ingredients."
      icon={Replace}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <Label htmlFor="ingredient" className="text-sm font-medium">Ingredient to Substitute</Label>
          <Input
            id="ingredient"
            value={ingredient}
            onChange={(e) => setIngredient(e.target.value)}
            placeholder="e.g., White Sugar, All-Purpose Flour"
            className="mt-1"
            required
          />
        </div>
        <div>
          <Label htmlFor="healthGoals" className="text-sm font-medium">Health Goals (Optional)</Label>
          <Input
            id="healthGoals"
            value={healthGoals}
            onChange={(e) => setHealthGoals(e.target.value)}
            placeholder="e.g., Weight loss, low GI, high protein"
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="budget" className="text-sm font-medium">Budget Constraints (Optional)</Label>
          <Input
            id="budget"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            placeholder="e.g., Budget-friendly, premium"
            className="mt-1"
          />
        </div>
         <p className="text-xs text-muted-foreground">
            Your pantry items and dietary restrictions from settings will be automatically considered.
          </p>
        <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
          {isLoading ? (
            <Sparkles className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            <Send className="mr-2 h-5 w-5" />
          )}
          Find Substitute
        </Button>
      </form>
      <RecipeDisplay recipe={generatedSubstitution} isLoading={isLoading} title="Ingredient Substitution Suggestion" />
    </AiFeatureCard>
  );
}

