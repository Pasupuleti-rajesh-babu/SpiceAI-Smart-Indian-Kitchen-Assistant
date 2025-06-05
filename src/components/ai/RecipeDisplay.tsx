
import React from 'react';
import type { Recipe, DailyMealPlan } from '@/types/recipe';
import { GlassCard } from '@/components/ui/GlassCard';
import { Utensils, ListChecks, AlertTriangle, Sparkles, BarChart3, Leaf, Heart, CalendarDays } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';


interface RecipeDisplayProps {
  recipe: Recipe | null;
  isLoading?: boolean;
  title?: string;
  onToggleSaveMeal?: (dayIndex: number, mealType: 'breakfast' | 'lunch' | 'dinner') => void;
}

function formatMultilineText(text: string): string[] {
  return text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
}

const MealCard: React.FC<{
  mealName: string;
  mealType: 'breakfast' | 'lunch' | 'dinner';
  isSaved?: boolean;
  onSaveToggle: () => void;
}> = ({ mealName, mealType, isSaved, onSaveToggle }) => {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="font-medium text-foreground/95 capitalize">{mealType}:</p>
        <p>{mealName}</p>
      </div>
      <Button variant="ghost" size="icon" onClick={onSaveToggle} aria-label={`Save ${mealType}`}>
        <Heart className={cn("h-5 w-5", isSaved ? "fill-red-500 text-red-500" : "text-muted-foreground")} />
      </Button>
    </div>
  );
};


export default function RecipeDisplay({ recipe, isLoading, title = "AI Generated Recipe", onToggleSaveMeal }: RecipeDisplayProps) {
  if (isLoading) {
    return (
      <GlassCard className="mt-6 animate-pulse">
        <div className="h-8 w-3/4 rounded bg-muted-foreground/20"></div>
        <div className="mt-4 space-y-2">
          <div className="h-4 w-1/4 rounded bg-muted-foreground/20"></div>
          <div className="h-4 w-full rounded bg-muted-foreground/10"></div>
          <div className="h-4 w-full rounded bg-muted-foreground/10"></div>
          <div className="h-4 w-2/3 rounded bg-muted-foreground/10"></div>
        </div>
        <div className="mt-4 space-y-2">
          <div className="h-4 w-1/4 rounded bg-muted-foreground/20"></div>
          <div className="h-4 w-full rounded bg-muted-foreground/10"></div>
          <div className="h-4 w-full rounded bg-muted-foreground/10"></div>
          <div className="h-4 w-3/4 rounded bg-muted-foreground/10"></div>
        </div>
      </GlassCard>
    );
  }

  if (!recipe) {
    return null;
  }

  const { recipeName, ingredients, instructions, reason, substituteIngredient, reasoning, isHealthy, isBudgetFriendly, recipeSuggestions, dailyMealPlans } = recipe;

  return (
    <GlassCard className="mt-6">
      {recipeName && ( // For single recipe display
        <div className="mb-6 flex items-center">
          <Utensils className="mr-3 h-7 w-7 text-primary" />
          <h2 className="text-2xl font-semibold text-primary">{recipeName}</h2>
        </div>
      )}
      
      {!recipeName && title && (dailyMealPlans || substituteIngredient || recipeSuggestions) && ( // For meal plans, substitutions, etc.
         <div className="mb-6 flex items-center">
          <Sparkles className="mr-3 h-7 w-7 text-primary" />
          <h2 className="text-2xl font-semibold text-primary">{title}</h2>
        </div>
      )}

      {reason && (
        <div className="mb-4 rounded-md border border-accent/50 bg-accent/10 p-3">
          <p className="text-sm text-accent-foreground dark:text-foreground"><Sparkles className="mr-2 inline h-4 w-4" />{reason}</p>
        </div>
      )}

      {substituteIngredient && (
        <div className="mb-4">
          <h3 className="mb-2 flex items-center text-lg font-medium text-foreground">
            <Leaf className="mr-2 h-5 w-5 text-green-500" />
            Suggested Substitute: <span className="ml-2 font-semibold text-primary">{substituteIngredient}</span>
          </h3>
          {isHealthy !== undefined && (
            <Badge variant={isHealthy ? "default" : "secondary"} className={isHealthy ? "bg-green-500 text-white" : ""}>
              {isHealthy ? "Healthy Choice" : "Consider Alternatives for Health"}
            </Badge>
          )}
          {isBudgetFriendly !== undefined && (
            <Badge variant={isBudgetFriendly ? "default" : "secondary"} className={isBudgetFriendly ? "ml-2 bg-blue-500 text-white" : "ml-2"}>
              {isBudgetFriendly ? "Budget Friendly" : "May Be Pricier"}
            </Badge>
          )}
          {reasoning && <p className="mt-2 text-sm text-muted-foreground">{reasoning}</p>}
        </div>
      )}
      
      {recipeSuggestions && recipeSuggestions.length > 0 && (
        <div className="mb-4">
           <h3 className="mb-2 flex items-center text-lg font-medium text-foreground">
            <BarChart3 className="mr-2 h-5 w-5 text-purple-500" /> Recipe Suggestions
          </h3>
          <ul className="list-disc space-y-1 pl-5 text-foreground/90">
            {recipeSuggestions.map((suggestion, index) => (
              <li key={index}>{suggestion}</li>
            ))}
          </ul>
        </div>
      )}

      {dailyMealPlans && dailyMealPlans.length > 0 && (
         <div className="mb-4">
           {!recipeName && !title && ( /* Only show this if it's not part of a larger recipe card */
            <h3 className="mb-3 flex items-center text-lg font-medium text-foreground">
                <CalendarDaysIcon className="mr-2 h-5 w-5 text-indigo-500" /> Your 7-Day Meal Plan
            </h3>
           )}
          <Accordion type="single" collapsible className="w-full" defaultValue="day-0">
            {dailyMealPlans.map((item, index) => (
              <AccordionItem value={`day-${index}`} key={index}>
                <AccordionTrigger className="hover:no-underline text-left">
                  <span className="font-semibold text-primary">{item.day}</span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 pl-2 pt-2 text-sm text-foreground/90">
                    {onToggleSaveMeal && (
                      <>
                        <MealCard 
                          mealName={item.breakfast} 
                          mealType="breakfast" 
                          isSaved={item.isBreakfastSaved} 
                          onSaveToggle={() => onToggleSaveMeal(index, 'breakfast')} 
                        />
                        <MealCard 
                          mealName={item.lunch} 
                          mealType="lunch" 
                          isSaved={item.isLunchSaved} 
                          onSaveToggle={() => onToggleSaveMeal(index, 'lunch')} 
                        />
                        <MealCard 
                          mealName={item.dinner} 
                          mealType="dinner" 
                          isSaved={item.isDinnerSaved} 
                          onSaveToggle={() => onToggleSaveMeal(index, 'dinner')} 
                        />
                      </>
                    )}
                    {!onToggleSaveMeal && ( // Fallback for non-interactive display
                        <>
                            <div><p className="font-medium">Breakfast:</p><p>{item.breakfast}</p></div>
                            <div><p className="font-medium">Lunch:</p><p>{item.lunch}</p></div>
                            <div><p className="font-medium">Dinner:</p><p>{item.dinner}</p></div>
                        </>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      )}

      {ingredients && !recipeSuggestions && !dailyMealPlans && ( // For single recipe display
        <div className="mb-4">
          <h3 className="mb-2 flex items-center text-lg font-medium text-foreground">
            <ListChecks className="mr-2 h-5 w-5 text-blue-500" /> Ingredients
          </h3>
          <ul className="list-disc space-y-1 pl-5 text-foreground/90">
            {formatMultilineText(ingredients).map((ingredient, idx) => (
              <li key={idx}>{ingredient}</li>
            ))}
          </ul>
        </div>
      )}

      {instructions && !recipeSuggestions && !dailyMealPlans && ( // For single recipe display
        <div>
          <h3 className="mb-2 flex items-center text-lg font-medium text-foreground">
            <Sparkles className="mr-2 h-5 w-5 text-yellow-500" /> Instructions
          </h3>
          <ol className="list-decimal space-y-2 pl-5 text-foreground/90">
            {formatMultilineText(instructions).map((step, idx) => (
              <li key={idx}>{step}</li>
            ))}
          </ol>
        </div>
      )}

      {!isLoading && !recipeName && !ingredients && !instructions && !substituteIngredient && (!recipeSuggestions || recipeSuggestions.length === 0) && (!dailyMealPlans || dailyMealPlans.length === 0) && (
        <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
          <AlertTriangle className="mb-2 h-10 w-10" />
          <p>No recipe details found or AI response format is unexpected.</p>
          <p className="text-xs mt-1">Please try generating or try your query again.</p>
        </div>
      )}
    </GlassCard>
  );
}

// Renamed to avoid conflict with lucide-react's CalendarDays if imported elsewhere
function CalendarDaysIcon(props: React.SVGProps<SVGSVGElement>) { 
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
      <path d="M8 14h.01" />
      <path d="M12 14h.01" />
      <path d="M16 14h.01" />
      <path d="M8 18h.01" />
      <path d="M12 18h.01" />
      <path d="M16 18h.01" />
    </svg>
  )
}

