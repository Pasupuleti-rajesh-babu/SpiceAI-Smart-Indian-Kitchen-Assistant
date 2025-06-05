
import AiMealPlannerClient from '@/components/ai/AiMealPlannerClient';
import AiSubstitutionClient from '@/components/ai/AiSubstitutionClient';
import AiQueryClient from '@/components/ai/AiQueryClient';
import MoodRecipeClient from '@/components/ai/MoodRecipeClient';
import { GlassCard } from '@/components/ui/GlassCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BrainCircuit, Replace, ChefHat, CalendarHeart, CookingPot, FileQuestion, Zap, Users, History, Recycle, MapPinned, BookOpen, Camera, PartyPopper, Lightbulb } from 'lucide-react';
import Image from 'next/image';

export default function AiFeaturesPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-8 text-center">
         <Lightbulb className="mx-auto mb-3 h-12 w-12 text-primary" />
        <h1 className="text-4xl font-bold text-foreground">AI Magic for Your Kitchen</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Unlock powerful AI tools to enhance your cooking experience.
        </p>
      </header>

      <Tabs defaultValue="meal-planner" className="w-full">
        <TabsList className="grid w-full grid-cols-2 gap-2 mb-6 md:grid-cols-4">
          <TabsTrigger value="meal-planner" className="text-xs sm:text-sm px-2 py-1 sm:px-3 sm:py-1.5"><CalendarHeart className="mr-1 h-4 w-4 sm:mr-2 sm:h-5 sm:w-5" />Meal Planner</TabsTrigger>
          <TabsTrigger value="substitution" className="text-xs sm:text-sm px-2 py-1 sm:px-3 sm:py-1.5"><Replace className="mr-1 h-4 w-4 sm:mr-2 sm:h-5 sm:w-5" />Substitutions</TabsTrigger>
          <TabsTrigger value="ai-query" className="text-xs sm:text-sm px-2 py-1 sm:px-3 sm:py-1.5"><FileQuestion className="mr-1 h-4 w-4 sm:mr-2 sm:h-5 sm:w-5" />AI Query</TabsTrigger>
          <TabsTrigger value="mood-recipes" className="text-xs sm:text-sm px-2 py-1 sm:px-3 sm:py-1.5"><ChefHat className="mr-1 h-4 w-4 sm:mr-2 sm:h-5 sm:w-5" />Mood Recipes</TabsTrigger>
        </TabsList>

        <TabsContent value="meal-planner">
          <AiMealPlannerClient />
        </TabsContent>
        <TabsContent value="substitution">
          <AiSubstitutionClient />
        </TabsContent>
        <TabsContent value="ai-query">
          <AiQueryClient />
        </TabsContent>
        <TabsContent value="mood-recipes" id="mood-recipes">
          <MoodRecipeClient />
        </TabsContent>
      </Tabs>

      <GlassCard className="mt-12">
        <h2 className="mb-4 text-2xl font-semibold text-foreground">More AI Features Coming Soon!</h2>
        <p className="mb-6 text-muted-foreground">
          We're cooking up even more intelligent tools to revolutionize your kitchen. Stay tuned for:
        </p>
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureTeaser icon={CookingPot} name="Health Goal-to-Meal Translator" />
          <FeatureTeaser icon={Users} name="AI Portion Calculator" />
          <FeatureTeaser icon={History} name="Pantry Refill Predictor" />
          <FeatureTeaser icon={Recycle} name="Zero-Waste Cooking Mode" />
          <FeatureTeaser icon={MapPinned} name="Regional Recipe Exploration" />
          <FeatureTeaser icon={BookOpen} name="Ingredient Storyteller" />
          <FeatureTeaser icon={Camera} name="Reverse Recipe Generator" />
          <FeatureTeaser icon={PartyPopper} name="Festive AI Mode" />
          <FeatureTeaser icon={Zap} name="Recipe ELI5 Mode" />
        </div>
         <div className="mt-8 text-center">
            <Image 
              src="https://placehold.co/500x300.png" 
              alt="Future AI features in kitchen" 
              width={500} 
              height={300} 
              className="mx-auto rounded-lg shadow-ios-medium"
              data-ai-hint="kitchen future technology" 
            />
          </div>
      </GlassCard>
    </div>
  );
}

interface FeatureTeaserProps {
  icon: React.ElementType;
  name: string;
}

function FeatureTeaser({ icon: Icon, name }: FeatureTeaserProps) {
  return (
    <div className="flex items-center space-x-3 rounded-md p-2 ">
      <Icon className="h-6 w-6 text-primary/80" />
      <span className="text-sm text-foreground/90">{name}</span>
    </div>
  );
}
