
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AiFeatureCard from '@/components/ai/AiFeatureCard';
import RecipeDisplay from '@/components/ai/RecipeDisplay';
import type { Recipe } from '@/types/recipe';
import { aiRecipeQuery, type AiRecipeQueryInput, type AiRecipeQueryOutput } from '@/ai/flows/ai-query';
import { useToast } from "@/hooks/use-toast";
import { FileQuestion, Sparkles, Send, Loader2 } from 'lucide-react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { APP_SETTINGS_KEY, AI_QUERY_RESULT_KEY } from '@/lib/localStorageKeys';
import type { AppSettings } from '@/types/settings';
import { defaultAppSettings } from '@/types/settings';

export default function AiQueryClient() {
  const [query, setQuery] = useState('');
  const [generatedRecipe, setGeneratedRecipe] = useLocalStorage<Recipe | null>(AI_QUERY_RESULT_KEY, null);
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
    setGeneratedRecipe(null); // Clear previous result before fetching new one
    try {
      const input: AiRecipeQueryInput = {
        query,
        cuisinePreferences: settings.cuisinePreferences && settings.cuisinePreferences.length > 0 ? settings.cuisinePreferences : undefined,
      };
      const result: AiRecipeQueryOutput = await aiRecipeQuery(input);
      // The result now directly matches the Recipe structure for a single detailed recipe
      setGeneratedRecipe(result as Recipe); 
      toast({ title: "Recipe Found!", description: `AI has a suggestion for "${query}".`, variant: "default" });
    } catch (error) {
      console.error("Error querying recipes:", error);
      toast({ title: "Error", description: "Failed to get a recipe suggestion. Please try again.", variant: "destructive" });
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
      description="Ask for recipes in natural language (e.g., 'Dinner for 4, no onion-garlic'). We'll provide one detailed recipe."
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
          Get Recipe Idea
        </Button>
      </form>
      {/* The title for RecipeDisplay will now default to "AI Generated Recipe" or use recipeName if present */}
      <RecipeDisplay recipe={generatedRecipe} isLoading={isLoading} />
    </AiFeatureCard>
  );
}

