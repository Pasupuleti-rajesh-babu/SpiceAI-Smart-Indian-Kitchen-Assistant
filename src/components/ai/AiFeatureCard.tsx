
import React from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import type { LucideIcon } from 'lucide-react';

interface AiFeatureCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  children: React.ReactNode;
}

export default function AiFeatureCard({ title, description, icon: Icon, children }: AiFeatureCardProps) {
  return (
    <GlassCard className="w-full">
      <div className="mb-6">
        <div className="flex items-center space-x-3 mb-2">
          <Icon className="h-8 w-8 text-primary" />
          <h2 className="text-2xl font-semibold text-foreground">{title}</h2>
        </div>
        <p className="text-muted-foreground">{description}</p>
      </div>
      {children}
    </GlassCard>
  );
}
