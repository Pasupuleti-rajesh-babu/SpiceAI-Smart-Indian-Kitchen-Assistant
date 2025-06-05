
"use client";

import React, { useEffect } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { APP_SETTINGS_KEY } from '@/lib/localStorageKeys';
import type { AppSettings } from '@/types/settings';
import { defaultAppSettings } from '@/types/settings';

export function ThemeHandler({ children }: { children: React.ReactNode }) {
  const [settings] = useLocalStorage<AppSettings>(APP_SETTINGS_KEY, defaultAppSettings);

  useEffect(() => {
    // This effect runs on the client after hydration, and now after every re-render of ThemeHandler.
    // It applies the theme class based on settings and then signals that the theme is applied.
    const root = document.documentElement;
    if (settings.darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    // Indicate that the theme has been programmatically set.
    // This is used by CSS to unhide the body, preventing a flash of incorrectly styled content.
    root.classList.add('theme-applied');

  }); // No dependency array: runs after every render

  // Children are always part of the React tree.
  // Their visibility is controlled by the CSS rule involving 'theme-applied'.
  return <>{children}</>;
}
