
"use client";

import React, { useEffect } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { APP_SETTINGS_KEY } from '@/lib/localStorageKeys';
import type { AppSettings } from '@/types/settings';
import { defaultAppSettings } from '@/types/settings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { GlassCard } from '@/components/ui/GlassCard';
import { Checkbox } from '@/components/ui/checkbox';
import { Save, Sun, Moon } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

const availableCuisinePreferences = ['North Indian', 'South Indian', 'Bengali', 'Gujarati', 'Maharashtrian', 'Punjabi', 'Rajasthani', 'Other'];
const availableLanguages = [{ code: 'en', name: 'English' }, { code: 'hi', name: 'Hindi' }];

export default function SettingsClient() {
  const [settings, setSettings] = useLocalStorage<AppSettings>(APP_SETTINGS_KEY, defaultAppSettings);
  const { toast } = useToast();

  // Ensure settings always has all default keys, useful for migrations or new settings
  useEffect(() => {
    setSettings(prev => ({ ...defaultAppSettings, ...prev }));
  }, [setSettings]);


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
        const { checked } = e.target as HTMLInputElement;
        if (name === 'cuisinePreferences' || name === 'allergies') {
            setSettings(prev => ({
                ...prev,
                [name]: checked 
                    ? [...(prev[name as keyof AppSettings] as string[]), value]
                    : (prev[name as keyof AppSettings] as string[]).filter(item => item !== value)
            }));
        } else {
             setSettings(prev => ({ ...prev, [name]: checked }));
        }
    } else {
        setSettings(prev => ({ ...prev, [name]: type === 'number' ? (value === '' ? null : Number(value)) : value }));
    }
  };

  const handleCuisinePreferenceChange = (cuisine: string) => {
    setSettings(prev => {
      const currentPrefs = prev.cuisinePreferences || [];
      const newPrefs = currentPrefs.includes(cuisine)
        ? currentPrefs.filter(c => c !== cuisine)
        : [...currentPrefs, cuisine];
      return { ...prev, cuisinePreferences: newPrefs };
    });
  };
  
  const handleAllergiesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const allergiesArray = e.target.value.split(',').map(s => s.trim()).filter(s => s !== '');
    setSettings(prev => ({ ...prev, allergies: allergiesArray }));
  };

  const handleSaveSettings = () => {
    // useLocalStorage already saves on change, this button is more for user feedback
    toast({
      title: "Settings Saved",
      description: "Your preferences have been updated.",
    });
  };

  return (
    <GlassCard className="space-y-8 p-6 md:p-8">
      <div>
        <h2 className="mb-1 text-xl font-semibold text-foreground">Personalization</h2>
        <p className="text-sm text-muted-foreground mb-4">Tailor SpiceAI to your tastes.</p>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="geminiApiKey" className="block text-sm font-medium">Gemini API Key</Label>
            <Input
              id="geminiApiKey"
              name="geminiApiKey"
              type="password"
              value={settings.geminiApiKey || ''}
              onChange={handleInputChange}
              placeholder="Enter your Gemini API Key"
              className="mt-1"
            />
            <p className="mt-1 text-xs text-muted-foreground">Your API key is stored locally in your browser.</p>
          </div>

          <div>
            <Label className="block text-sm font-medium mb-1">Cuisine Preferences</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {availableCuisinePreferences.map(cuisine => (
                <div key={cuisine} className="flex items-center space-x-2">
                  <Checkbox
                    id={`cuisine-${cuisine}`}
                    checked={(settings.cuisinePreferences || []).includes(cuisine)}
                    onCheckedChange={() => handleCuisinePreferenceChange(cuisine)}
                  />
                  <Label htmlFor={`cuisine-${cuisine}`} className="text-sm font-normal">{cuisine}</Label>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="allergies" className="block text-sm font-medium">Allergies (comma-separated)</Label>
            <Input
              id="allergies"
              name="allergies"
              type="text"
              value={(settings.allergies || []).join(', ')}
              onChange={handleAllergiesChange}
              placeholder="e.g., peanuts, gluten, shellfish"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="calorieGoals" className="block text-sm font-medium">Daily Calorie Goal (optional)</Label>
            <Input
              id="calorieGoals"
              name="calorieGoals"
              type="number"
              value={settings.calorieGoals === null ? '' : settings.calorieGoals}
              onChange={handleInputChange}
              placeholder="e.g., 2000"
              className="mt-1"
            />
          </div>
        </div>
      </div>
      
      <div className="border-t border-border/50 pt-6">
        <h2 className="mb-1 text-xl font-semibold text-foreground">Appearance & Language</h2>
         <p className="text-sm text-muted-foreground mb-4">Adjust visual and language settings.</p>
        <div className="space-y-4">
           <div className="flex items-center justify-between">
            <Label htmlFor="darkMode" className="text-sm font-medium flex items-center">
                {settings.darkMode ? <Moon className="mr-2 h-5 w-5" /> : <Sun className="mr-2 h-5 w-5" />}
                Dark Mode
            </Label>
            <Switch
              id="darkMode"
              name="darkMode"
              checked={settings.darkMode || false}
              onCheckedChange={(checked) => setSettings(prev => ({ ...prev, darkMode: checked }))}
            />
          </div>

          <div>
            <Label htmlFor="language" className="block text-sm font-medium">Language</Label>
             <select
              id="language"
              name="language"
              value={settings.language || 'en'}
              onChange={(e) => setSettings(prev => ({ ...prev, language: e.target.value }))}
              className="mt-1 block w-full rounded-md border-input bg-background p-2 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
            >
              {availableLanguages.map(lang => (
                <option key={lang.code} value={lang.code}>{lang.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="mt-8 flex justify-end border-t border-border/50 pt-6">
        <Button onClick={handleSaveSettings}>
          <Save className="mr-2 h-5 w-5" /> Save Preferences
        </Button>
      </div>
    </GlassCard>
  );
}
