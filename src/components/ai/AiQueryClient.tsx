
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AiFeatureCard from '@/components/ai/AiFeatureCard';
import RecipeDisplay from '@/components/ai/RecipeDisplay';
import type { Recipe } from '@/types/recipe';
import { aiRecipeQuery, type AiRecipeQueryInput } from '@/ai/flows/ai-query';
import { useToast } from "@/hooks/use-toast";
import { FileQuestion, Sparkles, Send, Loader2 } from 'lucide-react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { APP_SETTINGS_KEY } from '@/lib/localStorageKeys';
import type { AppSettings } from '@/types/settings';
import { defaultAppSettings } from '@/types/settings';

export default function AiQueryClient() {
  const [query, setQuery] = useState('');
  const [generatedRecipes, setGeneratedRecipes] = useState<Recipe | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [settings] = useLocalStorage<AppSettings>(APP_SETTINGS_KEY, defaultAppSettings);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) {
      toast({ title: "Missing Query", description: "Please enter your recipe query.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    setGeneratedRecipes(null);
    try {
      const input: AiRecipeQueryInput = { 
        query,
        cuisinePreferences: settings.cuisinePreferences && settings.cuisinePreferences.length > 0 ? settings.cuisinePreferences : undefined,
      };
      const result = await aiRecipeQuery(input);
      setGeneratedRecipes({ 
        recipeName: '', // Not applicable directly
        ingredients: '', // Not applicable
        instructions: '', // Not applicable
        recipeSuggestions: result.recipeSuggestions 
      });
      toast({ title: "Recipes Found!", description: `AI has some suggestions for "${query}".`, variant: "default" });
    } catch (error) {
      console.error("Error querying recipes:", error);
      toast({ title: "Error", description: "Failed to get recipe suggestions. Please try again.", variant: "destructive" });
    }
    setIsLoading(false);
  };

  if (!hasMounted) {
    return (
      <AiFeatureCard
        title="AI Recipe Query"
        description="Ask for recipes in natural language (e.g., 'Dinner for 4, no onion-garlic')."
        icon={FileQuestion}
      >
        <div className="flex justify-center items-center min-h-[200px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AiFeatureCard>
    );
  }

  return (
    <AiFeatureCard
      title="AI Recipe Query"
      description="Ask for recipes in natural language (e.g., 'Dinner for 4, no onion-garlic')."
      icon={FileQuestion}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <Label htmlFor="query" className="text-sm font-medium">Your Recipe Request</Label>
          <Input
            id="query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g., Quick vegetarian lunch for one"
            className="mt-1"
            required
          />
        </div>
        {hasMounted && (
          <p className="text-xs text-muted-foreground">
              Your cuisine preferences from settings (currently: {settings.cuisinePreferences?.join(', ') || 'Any Indian'}) will be considered.
          </p>
        )}
        <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
           {isLoading ? (
            <Sparkles className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            <Send className="mr-2 h-5 w-5" />
          )}
          Get Recipe Ideas
        </Button>
      </form>
      <RecipeDisplay recipe={generatedRecipes} isLoading={isLoading} title="AI Recipe Suggestions" />
    </AiFeatureCard>
  );
}
