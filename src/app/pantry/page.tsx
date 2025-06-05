
import PantryManagerClient from '@/components/pantry/PantryManagerClient';
import { ShoppingBasket } from 'lucide-react';

export default function PantryPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-8 flex items-center space-x-3">
        <ShoppingBasket className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold text-foreground">Pantry Manager</h1>
      </header>
      <p className="mb-6 text-muted-foreground">
        Keep your kitchen stocked and organized. Add, edit, or remove items from your pantry.
      </p>
      <PantryManagerClient />
    </div>
  );
}
