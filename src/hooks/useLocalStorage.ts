
"use client";

import { useState, useEffect, useCallback } from 'react';

function getSavedValue<T>(key: string, initialValue: T | (() => T)): T {
  if (typeof window === 'undefined') {
    return typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue;
  }
  const savedValue = localStorage.getItem(key);
  if (savedValue !== null && savedValue !== "undefined") { // Check for "undefined" string
    try {
      return JSON.parse(savedValue);
    } catch (error) {
      console.error("Error parsing localStorage key:", key, savedValue, error);
      // Fallback to initialValue if parsing fails
    }
  }
  return typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue;
}

export function useLocalStorage<T>(key: string, initialValue: T | (() => T)) {
  const [value, setValue] = useState<T>(() => getSavedValue(key, initialValue));

  const updateValue = useCallback((newValue: T | ((prevState: T) => T)) => {
    setValue(prev => {
      const result = typeof newValue === 'function' ? (newValue as (prevState: T) => T)(prev) : newValue;
      if (typeof window !== 'undefined') {
        localStorage.setItem(key, JSON.stringify(result));
      }
      return result;
    });
  }, [key]);
  
  // Effect to update localStorage when value changes
  // This is mostly to ensure the initial state from server/initialValue is written if not already there
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const currentValueInStorage = localStorage.getItem(key);
      if (currentValueInStorage === null || JSON.parse(currentValueInStorage) !== value) {
         localStorage.setItem(key, JSON.stringify(value));
      }
    }
  }, [key, value]);


  // Effect to listen for storage changes from other tabs/windows
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === key && event.newValue !== null) {
        try {
          setValue(JSON.parse(event.newValue));
        } catch (error) {
          console.error("Error parsing storage event value:", event.newValue, error);
        }
      } else if (event.key === key && event.newValue === null) {
        // Item was removed or cleared
        setValue(typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [key, initialValue]);


  return [value, updateValue] as const;
}
