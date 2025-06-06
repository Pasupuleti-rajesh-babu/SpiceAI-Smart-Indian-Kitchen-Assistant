
export interface PantryItem {
  id: string;
  name: string;
  quantity?: string; // Made quantity optional
  expiryDate?: string;
  addedDate: string;
}

