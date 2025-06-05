
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Archive, Sparkles, Settings as SettingsIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/pantry', label: 'Pantry', icon: Archive },
  { href: '/ai-features', label: 'AI Magic', icon: Sparkles },
  { href: '/settings', label: 'Settings', icon: SettingsIcon },
];

export default function BottomNavigationBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/80 backdrop-blur-lg dark:bg-neutral-900/80">
      <div className="mx-auto flex h-16 max-w-md items-center justify-around px-4 md:h-20">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 rounded-lg p-2 text-sm transition-colors hover:bg-accent/50 dark:hover:bg-accent/30',
                isActive ? 'text-primary dark:text-primary' : 'text-foreground/70 dark:text-foreground/60'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <item.icon className={cn('h-6 w-6', isActive ? 'text-primary dark:text-primary' : '')} />
              <span className={cn('text-xs', isActive ? 'font-semibold' : '')}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
