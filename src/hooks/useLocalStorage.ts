
"use client";

import { useState, useEffect, useCallback } from 'react';

// Define a type for the detail of our custom event
interface StorageUpdateDetail<T = any> {
  key: string;
  newValue: T;
  oldValue: T | null;
}

function getSavedValue<T>(key: string, initialValue: T | (() => T)): T {
  if (typeof window === 'undefined') {
    return typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue;
  }
  const savedValue = localStorage.getItem(key);
  if (savedValue !== null && savedValue !== "undefined") {
    try {
      return JSON.parse(savedValue);
    } catch (error) {
      console.error("Error parsing localStorage key:", key, savedValue, error);
    }
  }
  return typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue;
}

export function useLocalStorage<T>(key: string, initialValue: T | (() => T)) {
  const [_value, _setValue] = useState<T>(() => getSavedValue(key, initialValue));

  // This is the function that components will call to update the value.
  const updateValue = useCallback((newValue: T | ((prevState: T) => T)) => {
    // Determine the actual new value (handling functional updates)
    const valueToStore = typeof newValue === 'function' 
        ? (newValue as (prevState: T) => T)(_value) // Pass current hook state to functional update
        : newValue;

    // Update the hook's own state FIRST. This ensures the component calling updateValue re-renders.
    _setValue(valueToStore);

    // Then, update localStorage and dispatch the custom event for other hook instances.
    if (typeof window !== 'undefined') {
      const oldValueInStorage = localStorage.getItem(key);
      localStorage.setItem(key, JSON.stringify(valueToStore));
      
      window.dispatchEvent(new CustomEvent<StorageUpdateDetail<T>>('onLocalStorageUpdate', {
        detail: { 
            key, 
            newValue: valueToStore, 
            oldValue: oldValueInStorage ? JSON.parse(oldValueInStorage) : null 
        }
      }));
    }
  }, [key, _value, _setValue]); // _value and _setValue are dependencies

  // Effect to listen for:
  // 1. Standard 'storage' events (from other tabs/windows)
  // 2. Custom 'onLocalStorageUpdate' events (from the same page)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStandardStorageChange = (event: StorageEvent) => {
      if (event.key === key) {
        if (event.newValue !== null) {
          try {
            const parsedNewValue = JSON.parse(event.newValue);
            if (JSON.stringify(_value) !== JSON.stringify(parsedNewValue)) {
              _setValue(parsedNewValue);
            }
          } catch (error) {
            console.error("Error parsing storage event value:", event.newValue, error);
          }
        } else { // Item was removed or cleared in another tab
          const reevaluatedInitialValue = typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue;
          if (JSON.stringify(_value) !== JSON.stringify(reevaluatedInitialValue)) {
            _setValue(reevaluatedInitialValue);
          }
        }
      }
    };

    const handleCustomStorageUpdate = (event: Event) => {
      // Ensure it's our custom event and the correct type
      const customEvent = event as CustomEvent<StorageUpdateDetail<T>>;
      if (customEvent.detail && customEvent.detail.key === key) {
        // Only update if the new value is actually different from the current state
        // This helps prevent potential re-render loops.
        if (JSON.stringify(_value) !== JSON.stringify(customEvent.detail.newValue)) {
          _setValue(customEvent.detail.newValue);
        }
      }
    };

    window.addEventListener('storage', handleStandardStorageChange);
    window.addEventListener('onLocalStorageUpdate', handleCustomStorageUpdate);

    return () => {
      window.removeEventListener('storage', handleStandardStorageChange);
      window.removeEventListener('onLocalStorageUpdate', handleCustomStorageUpdate);
    };
  }, [key, initialValue, _value, _setValue]); // Include _value and _setValue

  return [_value, updateValue] as const;
}
