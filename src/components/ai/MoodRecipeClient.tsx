
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AiFeatureCard from '@/components/ai/AiFeatureCard';
import RecipeDisplay from '@/components/ai/RecipeDisplay';
import type { Recipe } from '@/types/recipe';
import { moodBasedRecipe, type MoodBasedRecipeInput } from '@/ai/flows/mood-based-recipe';
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChefHat, Sparkles, Send, Loader2 } from 'lucide-react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { APP_SETTINGS_KEY, AI_MOOD_RECIPE_RESULT_KEY } from '@/lib/localStorageKeys';
import type { AppSettings } from '@/types/settings';
import { defaultAppSettings } from '@/types/settings';

const moodOptions = ["Happy", "Sad", "Stressed", "Tired", "Energetic", "Adventurous", "Comfort-seeking", "Celebratory"];

export default function MoodRecipeClient() {
  const [mood, setMood] = useState('');
  const [customMood, setCustomMood] = useState('');
  const [generatedRecipe, setGeneratedRecipe] = useLocalStorage<Recipe | null>(AI_MOOD_RECIPE_RESULT_KEY, null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [settings] = useLocalStorage<AppSettings>(APP_SETTINGS_KEY, defaultAppSettings);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const effectiveMood = mood === 'Other' ? customMood : mood;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveMood.trim()) {
      toast({ title: "Missing Mood", description: "Please select or enter your mood.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    setGeneratedRecipe(null); // Clear previous result before fetching new one
    try {
      const input: MoodBasedRecipeInput = { 
        mood: effectiveMood,
        cuisinePreferences: settings.cuisinePreferences && settings.cuisinePreferences.length > 0 ? settings.cuisinePreferences : undefined,
      };
      const result = await moodBasedRecipe(input);
      setGeneratedRecipe(result as Recipe); // Cast as Recipe; AI output matches
      toast({ title: "Recipe Found!", description: `AI found a recipe for when you're feeling ${effectiveMood}.`, variant: "default" });
    } catch (error) {
      console.error("Error generating mood-based recipe:", error);
      toast({ title: "Error", description: "Failed to get recipe. Please try again.", variant: "destructive" });
    }
    setIsLoading(false);
  };

  if (!hasMounted) {
    return (
      <AiFeatureCard
        title="Mood-Based Recipes"
        description="Tell us how you're feeling, and we'll suggest a comforting Indian recipe based on your preferences."
        icon={ChefHat}
      >
        <div className="flex justify-center items-center min-h-[200px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AiFeatureCard>
    );
  }

  return (
    <AiFeatureCard
      title="Mood-Based Recipes"
      description="Tell us how you're feeling, and we'll suggest a comforting Indian recipe based on your preferences."
      icon={ChefHat}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <Label htmlFor="mood" className="text-sm font-medium">How are you feeling today?</Label>
          <Select value={mood} onValueChange={setMood}>
            <SelectTrigger className="w-full mt-1">
              <SelectValue placeholder="Select your mood" />
            </SelectTrigger>
            <SelectContent>
              {moodOptions.map(option => (
                <SelectItem key={option} value={option}>{option}</SelectItem>
              ))}
              <SelectItem value="Other">Other (Please specify)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {mood === 'Other' && (
          <div>
            <Label htmlFor="customMood" className="text-sm font-medium">Specify your mood:</Label>
            <Input
              id="customMood"
              value={customMood}
              onChange={(e) => setCustomMood(e.target.value)}
              placeholder="e.g., Nostalgic, Playful"
              className="mt-1"
              required={mood === 'Other'}
            />
          </div>
        )}
        {hasMounted && (
         <p className="text-xs text-muted-foreground">
            Your cuisine preferences from settings (currently: {settings.cuisinePreferences?.join(', ') || 'Any Indian'}) will be considered.
          </p>
        )}
        <Button type="submit" disabled={isLoading || !effectiveMood.trim()} className="w-full sm:w-auto">
          {isLoading ? (
            <Sparkles className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            <Send className="mr-2 h-5 w-5" />
          )}
          Get Recipe Suggestion
        </Button>
      </form>
      <RecipeDisplay recipe={generatedRecipe} isLoading={isLoading} />
    </AiFeatureCard>
  );
}

