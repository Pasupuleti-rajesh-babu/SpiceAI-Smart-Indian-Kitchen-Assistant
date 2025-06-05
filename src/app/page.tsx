
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/ui/GlassCard';
import { Utensils, ShoppingBasket, Lightbulb, Settings } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

export default function HomePage() {
  return (
    <div className="container mx-auto min-h-screen px-4 py-8 md:py-12">
      <header className="mb-12 text-center">
        <Image 
          src="https://placehold.co/120x120.png" 
          alt="SpiceAI Logo" 
          width={100} 
          height={100} 
          className="mx-auto mb-4 rounded-full shadow-ios-medium"
          data-ai-hint="spices logo" 
        />
        <h1 className="text-4xl font-bold tracking-tight text-primary sm:text-5xl md:text-6xl">
          SpiceAI
        </h1>
        <p className="mt-3 text-lg text-foreground/80 sm:mt-4 sm:text-xl">
          Your Smart Indian Kitchen Assistant
        </p>
      </header>

      <GlassCard className="mb-10 p-6 md:p-8">
        <h2 className="mb-4 text-2xl font-semibold text-foreground">Namaste! Welcome to SpiceAI.</h2>
        <p className="mb-2 text-foreground/90">
          Discover authentic Indian recipes, manage your pantry efficiently, and plan your meals with the help of AI.
        </p>
        <p className="text-foreground/90">
          Explore the sections below to get started:
        </p>
      </GlassCard>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-2">
        <ActionCard
          href="/ai-features"
          icon={Lightbulb}
          title="AI Magic"
          description="Generate recipes, meal plans, get ingredient substitutions, and more with AI."
          color="text-yellow-500"
        />
        <ActionCard
          href="/pantry"
          icon={ShoppingBasket}
          title="Pantry Manager"
          description="Keep track of your ingredients and get suggestions."
          color="text-green-500"
        />
        <ActionCard
          href="/settings"
          icon={Settings}
          title="Settings"
          description="Customize your preferences, API keys, and app experience."
          color="text-blue-500"
        />
         <ActionCard
          href="/ai-features#mood-recipes"
          icon={Utensils}
          title="Mood Recipes"
          description="Feeling tired or happy? Get recipe suggestions based on your mood."
          color="text-purple-500"
        />
      </div>

      <footer className="mt-16 border-t border-border/50 pt-8 text-center">
        <p className="text-sm text-muted-foreground">
          Happy Cooking with SpiceAI!
        </p>
      </footer>
    </div>
  );
}

interface ActionCardProps {
  href: string;
  icon: React.ElementType;
  title: string;
  description: string;
  color?: string;
}

function ActionCard({ href, icon: Icon, title, description, color }: ActionCardProps) {
  return (
    <Link href={href} passHref>
      <GlassCard className="flex h-full transform flex-col transition-all duration-300 hover:scale-105 hover:shadow-ios-strong">
        <div className="mb-4 flex items-center">
          <Icon className={cn("mr-3 h-8 w-8", color ? color : "text-primary")} />
          <h3 className="text-xl font-semibold text-foreground">{title}</h3>
        </div>
        <p className="flex-grow text-sm text-foreground/80">
          {description}
        </p>
        <Button variant="link" className="mt-4 self-start px-0 text-primary">
          Explore {title} &rarr;
        </Button>
      </GlassCard>
    </Link>
  );
}

