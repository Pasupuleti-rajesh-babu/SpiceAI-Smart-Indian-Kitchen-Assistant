
import SettingsClient from '@/components/settings/SettingsClient';
import { Settings as SettingsIcon } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-8 flex items-center space-x-3">
        <SettingsIcon className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold text-foreground">App Settings</h1>
      </header>
      <p className="mb-6 text-muted-foreground">
        Customize your SpiceAI experience. Changes are saved locally in your browser.
      </p>
      <SettingsClient />
    </div>
  );
}
