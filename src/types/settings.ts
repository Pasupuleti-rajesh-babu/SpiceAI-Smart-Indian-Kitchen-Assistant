
export interface AppSettings {
  geminiApiKey: string;
  cuisinePreferences: string[];
  allergies: string[];
  calorieGoals: number | null;
  darkMode: boolean;
  language: string;
}

export const defaultAppSettings: AppSettings = {
  geminiApiKey: '',
  cuisinePreferences: ['North Indian', 'South Indian'],
  allergies: [],
  calorieGoals: 2000,
  darkMode: false,
  language: 'en',
};
