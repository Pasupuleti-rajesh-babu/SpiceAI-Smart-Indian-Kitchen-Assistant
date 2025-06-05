
"use client";

import React, { useEffect } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { APP_SETTINGS_KEY } from '@/lib/localStorageKeys';
import type { AppSettings } from '@/types/settings';
import { defaultAppSettings } from '@/types/settings';

export function ThemeHandler({ children }: { children: React.ReactNode }) {
  const [settings] = useLocalStorage<AppSettings>(APP_SETTINGS_KEY, defaultAppSettings);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (settings.darkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [settings.darkMode]);

  return <>{children}</>;
}
