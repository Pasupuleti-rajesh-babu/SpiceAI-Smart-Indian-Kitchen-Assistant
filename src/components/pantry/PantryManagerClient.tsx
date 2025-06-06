
"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { PANTRY_ITEMS_KEY, BARCODE_DATABASE_KEY } from '@/lib/localStorageKeys';
import type { PantryItem } from '@/types/pantry';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GlassCard } from '@/components/ui/GlassCard';
import { PlusCircle, Edit2, Trash2, AlertTriangle, CheckCircle, PackageSearch, Loader2, ScanBarcode, Info } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { format, differenceInDays, parseISO, isValid } from 'date-fns';
import { useToast } from "@/hooks/use-toast";
import { cn } from '@/lib/utils';
import { 
  Html5QrcodeScanner, 
  Html5QrcodeScanType, 
  QrcodeErrorCallback, 
  QrcodeSuccessCallback,
  Html5QrcodeSupportedFormats
} from 'html5-qrcode';

type BarcodeDatabase = { [barcode: string]: string };
const HTML5_QRCODE_READER_ID = "html5-qrcode-reader";
const UPCITEMDB_API_URL = "https://api.upcitemdb.com/prod/trial/lookup";

interface UpcItemDbResponse {
  code: string;
  total?: number;
  offset?: number;
  items?: Array<{
    ean?: number | string;
    title?: string;
    upc?: string;
    gtin?: string;
    asin?: string;
    description?: string;
    brand?: string;
    model?: string;
    dimension?: string;
    weight?: string;
    category?: string;
    currency?: string;
    lowest_recorded_price?: number | null;
    highest_recorded_price?: number | null;
    images?: string[];
    offers?: Array<{
      merchant?: string;
      domain?: string;
      title?: string;
      currency?: string;
      list_price?: string | null;
      price?: number;
      shipping?: string;
      condition?: string;
      availability?: string;
      link?: string;
      updated_t?: number;
    }>;
  }>;
  message?: string;
}


export default function PantryManagerClient() {
  const [pantryItems, setPantryItems] = useLocalStorage<PantryItem[]>(PANTRY_ITEMS_KEY, []);
  const [newItemName, setNewItemName] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState('');
  const [newItemExpiryDate, setNewItemExpiryDate] = useState('');
  const [manualBarcode, setManualBarcode] = useState('');
  
  const [editingItem, setEditingItem] = useState<PantryItem | null>(null);
  const [editItemName, setEditItemName] = useState('');
  const [editItemQuantity, setEditItemQuantity] = useState('');
  const [editItemExpiryDate, setEditItemExpiryDate] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  const [hasMounted, setHasMounted] = useState(false);

  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const html5QrCodeScannerRef = useRef<Html5QrcodeScanner | null>(null);
  const isScannerOpenRef = useRef(isScannerOpen);
  const [scannerMessage, setScannerMessage] = useState<string | null>(null);
    
  const [barcodeDb, setBarcodeDb] = useLocalStorage<BarcodeDatabase>(BARCODE_DATABASE_KEY, {});
  const [lastScannedBarcode, setLastScannedBarcode] = useState<string | null>(null);
  const [isApiLoading, setIsApiLoading] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    isScannerOpenRef.current = isScannerOpen;
  }, [isScannerOpen]);

  const lookupBarcodeOnApi = useCallback(async (barcode: string) => {
    setIsApiLoading(true);
    setScannerMessage(`Looking up barcode ${barcode}...`);
    try {
      const response = await fetch(UPCITEMDB_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ upc: barcode }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Unknown API error" }));
        throw new Error(`API error: ${response.status} - ${errorData.message || 'Failed to fetch'}`);
      }

      const data: UpcItemDbResponse = await response.json();

      if (data.code === "OK" && data.items && data.items.length > 0 && data.items[0].title) {
        const productTitle = data.items[0].title;
        setNewItemName(productTitle);
        toast({ title: "Product Found!", description: `Item: ${productTitle}` });
        setScannerMessage(`Found: ${productTitle}`);
        return productTitle; // Return the found title
      } else if (data.code === "OK" && data.items && data.items.length === 0) {
        toast({ title: "Barcode Scanned", description: `No product details found for ${barcode}. Please enter name manually.`, variant: "default" });
        setScannerMessage(`No details for ${barcode}. Add manually.`);
        setNewItemName(''); 
      } else {
         toast({ title: "API Issue", description: data.message || `Could not retrieve details for ${barcode}.`, variant: "destructive" });
         setScannerMessage(`API Issue: ${data.message || 'Try again'}.`);
         setNewItemName('');
      }
    } catch (error: any) {
      if (error.message === "Failed to fetch") {
        console.warn("Network or CORS error looking up barcode:", error);
      } else {
        console.error("Error looking up barcode:", error);
      }
      const description = (error.message === "Failed to fetch"
        ? "Network error or API issue (e.g., CORS). Could not connect. Please enter name manually."
        : error.message) || "Failed to lookup barcode. Please enter name manually.";
      toast({ 
        title: "API Error", 
        description: description, 
        variant: "destructive" 
      });
      setScannerMessage(`API Error (Network/CORS?). Add manually.`);
      setNewItemName('');
    } finally {
      setIsApiLoading(false);
    }
    return null; // Return null if not found or error
  }, [toast, setNewItemName, setScannerMessage, setIsApiLoading]);


  const onScanSuccess: QrcodeSuccessCallback = useCallback(async (decodedText, decodedResult) => {
    if (!isScannerOpenRef.current) return;

    console.log(`Scan result: ${decodedText}`, decodedResult);
    setManualBarcode(decodedText); 
    setLastScannedBarcode(decodedText);
    
    const knownItemName = barcodeDb[decodedText];
    if (knownItemName) {
        setNewItemName(knownItemName);
        toast({ title: "Barcode Matched!", description: `Item: ${knownItemName} (from your records)` });
        setScannerMessage(`Found in your records: ${knownItemName}`);
    } else {
        await lookupBarcodeOnApi(decodedText); // This will set newItemName if found
    }
    
    setIsScannerOpen(false); 
  }, [barcodeDb, toast, setIsScannerOpen, setLastScannedBarcode, setNewItemName, setManualBarcode, lookupBarcodeOnApi]);

  const onScanFailure: QrcodeErrorCallback = useCallback((errorMessage) => {
      if (!isScannerOpenRef.current) return;
      
      const lowerError = errorMessage.toLowerCase();
      const typicalNotFoundMessages = [
        "notfoundexception", 
        "no multiformat readers were able to detect the code",
        "qr code no longer detected",
        "unable to query supported devices", 
        "insufficient vision",
        "no barcode or qr code detected"
      ];
      
      const isTypicalNotFound = typicalNotFoundMessages.some(msg => lowerError.includes(msg));

      if (isTypicalNotFound) {
        setScannerMessage(currentMsg => {
            // Avoid overwriting more specific messages like "Looking up..." or API results
            if (currentMsg && (currentMsg.startsWith("Scan Error:") || currentMsg.startsWith("Error starting scanner:") || currentMsg.startsWith("Looking up") || currentMsg.startsWith("Found:") || currentMsg.startsWith("API Error") || currentMsg.startsWith("API Issue") || currentMsg.startsWith("No details for"))) return currentMsg;
            return "Point camera at barcode.";
        });
      } else if (errorMessage) {
        // For genuine errors, prefix them to make it clear they are scan-related issues.
        setScannerMessage(`Scan Error: ${errorMessage}. Try adjusting position or lighting.`);
      } else {
        // Default message when scanning is active but no specific error/result yet.
        setScannerMessage("Scanning... Point camera at barcode.");
      }
  }, []);


  useEffect(() => {
    let timerId: NodeJS.Timeout | null = null;

    if (isScannerOpen) {
      // Use a timeout to ensure the DOM element is available
      timerId = setTimeout(() => {
        if (!isScannerOpenRef.current) return; // Check if dialog closed before timeout ran

        const readerDiv = document.getElementById(HTML5_QRCODE_READER_ID);
        if (!readerDiv) {
          console.error(`Element with ID ${HTML5_QRCODE_READER_ID} not found even after timeout.`);
          setScannerMessage("Scanner UI element not found. Cannot start. Please try reopening the dialog.");
          return;
        }

        if (!html5QrCodeScannerRef.current) {
          setScannerMessage("Initializing scanner...");
          const scanner = new Html5QrcodeScanner(
            HTML5_QRCODE_READER_ID,
            {
              fps: 10,
              qrbox: (viewfinderWidth, viewfinderHeight) => {
                const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
                const qrboxSize = Math.floor(minEdge * 0.8);
                return { width: qrboxSize, height: qrboxSize };
              },
              supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
              formatsToSupport: [ 
                Html5QrcodeSupportedFormats.UPC_A,
                Html5QrcodeSupportedFormats.UPC_E,
                Html5QrcodeSupportedFormats.EAN_13,
                Html5QrcodeSupportedFormats.EAN_8,
                Html5QrcodeSupportedFormats.CODE_128,
              ],
            },
            false // verbose = false
          );
          
          try {
            scanner.render(onScanSuccess, onScanFailure);
            // Check ref again in case dialog was closed very quickly
            if (isScannerOpenRef.current) {
              setScannerMessage("Scanner active. Point camera at barcode.");
            }
            html5QrCodeScannerRef.current = scanner;
          } catch (renderError: any) {
            console.error("Error calling Html5QrcodeScanner.render():", renderError);
            if (isScannerOpenRef.current) { // Only set message if still supposed to be open
               setScannerMessage(`Error starting scanner: ${renderError.message || "Unknown error"}`);
            }
          }
        }
      }, 0); // Delay of 0 ms pushes to next event loop tick

    } else {
      // Cleanup when dialog is closed
      if (html5QrCodeScannerRef.current) {
        html5QrCodeScannerRef.current.clear()
          .catch(err => {
            // Log warning, but don't bother user with toast for cleanup error
            console.warn("Error clearing scanner on dialog close:", err);
          });
        html5QrCodeScannerRef.current = null;
      }
      setScannerMessage(null); // Clear any scanner messages
    }
    
    // Cleanup timeout if dialog is closed before it executes
    return () => {
      if (timerId) {
        clearTimeout(timerId);
      }
      // This effect's primary cleanup is for when isScannerOpen changes.
      // The separate unmount effect handles component unmount.
      // If scanner is supposed to be closed, ensure it's cleared.
      if (html5QrCodeScannerRef.current && !isScannerOpenRef.current) { 
         html5QrCodeScannerRef.current.clear().catch(err => console.warn("Scanner clear failed on effect cleanup:", err));
         html5QrCodeScannerRef.current = null;
      }
    };
  }, [isScannerOpen, onScanSuccess, onScanFailure]); // Dependencies for scanner setup/teardown

  // Separate effect for component unmount cleanup
  useEffect(() => {
    return () => {
      if (html5QrCodeScannerRef.current) {
        html5QrCodeScannerRef.current.clear()
          .catch(err => {
            console.warn("Error clearing scanner on component unmount:", err);
          });
        html5QrCodeScannerRef.current = null;
      }
    };
  }, []);


  const handleAddItem = () => {
    if (!newItemName.trim() || !newItemQuantity.trim()) {
      toast({ title: "Missing Information", description: "Please provide item name and quantity.", variant: "destructive" });
      return;
    }
    
    const currentNewItemName = newItemName.trim();
    const currentManualBarcode = manualBarcode.trim();

    const newItem: PantryItem = {
      id: Date.now().toString(),
      name: currentNewItemName,
      quantity: newItemQuantity.trim(),
      expiryDate: newItemExpiryDate || undefined,
      addedDate: new Date().toISOString(),
    };
    setPantryItems(prevItems => [...prevItems, newItem]);

    // Determine which barcode to associate, preferring manual input if item name is different from it.
    let barcodeToAssociate: string | null = null;
    
    // If manual barcode is entered and it's different from the item name itself
    if (currentManualBarcode && currentNewItemName !== currentManualBarcode) {
        barcodeToAssociate = currentManualBarcode;
    } 
    // Else if a barcode was scanned (lastScannedBarcode), it's different from the item name,
    // and no manual barcode was entered (or manual barcode was same as item name, so not preferred for association)
    else if (lastScannedBarcode && currentNewItemName !== lastScannedBarcode && (!currentManualBarcode || currentNewItemName === currentManualBarcode)) {
        barcodeToAssociate = lastScannedBarcode;
    }


    // Update barcodeDb if a new association is made
    if (barcodeToAssociate && barcodeDb[barcodeToAssociate] !== currentNewItemName) { 
        setBarcodeDb(prevDb => ({ ...prevDb, [barcodeToAssociate!]: currentNewItemName }));
        toast({ title: "Item Added & Barcode Named", description: `Saved '${currentNewItemName}' for barcode ${barcodeToAssociate}.`, variant: "default" });
    } else if (barcodeToAssociate && barcodeDb[barcodeToAssociate] === currentNewItemName) {
        // Barcode was already known with this name, just added item
        toast({ title: "Item Added", description: `${currentNewItemName} added to pantry. (Barcode ${barcodeToAssociate} already known)`, variant: "default" });
    }
     else {
      // No barcode association, or barcode already known
      toast({ title: "Item Added", description: `${currentNewItemName} added to pantry.`, variant: "default" });
    }
    
    setNewItemName('');
    setNewItemQuantity('');
    setNewItemExpiryDate('');
    setLastScannedBarcode(null);
    setManualBarcode('');
  };

  const handleStartEdit = (item: PantryItem) => {
    setEditingItem(item);
    setEditItemName(item.name);
    setEditItemQuantity(item.quantity);
    setEditItemExpiryDate(item.expiryDate || '');
  };

  const handleSaveEdit = () => {
    if (!editingItem || !editItemName.trim() || !editItemQuantity.trim()) {
      toast({ title: "Missing Information", description: "Please provide item name and quantity for the edit.", variant: "destructive" });
      return;
    }
    setPantryItems(
      pantryItems.map((item) =>
        item.id === editingItem.id
          ? { ...item, name: editItemName.trim(), quantity: editItemQuantity.trim(), expiryDate: editItemExpiryDate || undefined }
          : item
      )
    );
    setEditingItem(null);
    toast({ title: "Item Updated", description: `${editItemName} has been updated.`, variant: "default" });
  };

  const handleDeleteItem = (id: string) => {
    const itemToDelete = pantryItems.find(item => item.id === id);
    setPantryItems(pantryItems.filter((item) => item.id !== id));
    if (itemToDelete) {
      toast({ title: "Item Deleted", description: `${itemToDelete.name} has been removed from your pantry.`, variant: "destructive" });
    }
  };

  const getExpiryStatus = (expiryDate?: string) => {
    if (!expiryDate) return { text: 'No expiry date', icon: null, color: 'text-muted-foreground' };
    const date = parseISO(expiryDate);
    if (!isValid(date)) return { text: 'Invalid date', icon: AlertTriangle, color: 'text-yellow-500' };
    
    const today = new Date();
    today.setHours(0,0,0,0); 
    const daysLeft = differenceInDays(date, today);

    if (daysLeft < 0) return { text: `Expired ${Math.abs(daysLeft)} days ago`, icon: AlertTriangle, color: 'text-red-600 font-semibold' };
    if (daysLeft <= 7) return { text: `Expires in ${daysLeft} days`, icon: AlertTriangle, color: 'text-yellow-500' };
    return { text: `Expires on ${format(date, 'MMM dd, yyyy')}`, icon: CheckCircle, color: 'text-green-500' };
  };

  const filteredItems = pantryItems
    .filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      const aDate = a.expiryDate && isValid(parseISO(a.expiryDate)) ? parseISO(a.expiryDate) : new Date(8640000000000000); // Far future date for no expiry
      const bDate = b.expiryDate && isValid(parseISO(b.expiryDate)) ? parseISO(b.expiryDate) : new Date(8640000000000000);
      return differenceInDays(aDate, bDate);
    });

  if (!hasMounted) {
    return (
      <GlassCard className="space-y-8 p-6 md:p-8 flex justify-center items-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </GlassCard>
    );
  }
  
  return (
    <div className="space-y-8">
      <GlassCard className="p-6 md:p-8">
        <h2 className="text-xl font-semibold mb-4 text-foreground">Add New Item</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 items-end">
          <div>
            <Label htmlFor="newItemName">Item Name</Label>
            <Input
              id="newItemName"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder="e.g., Milk, Eggs or scanned item"
              className="mt-1"
              disabled={isApiLoading}
            />
          </div>
           <div>
            <Label htmlFor="manualBarcode">Enter Barcode (Optional)</Label>
            <Input
              id="manualBarcode"
              value={manualBarcode}
              onChange={(e) => setManualBarcode(e.target.value)}
              placeholder="e.g., 123456789012"
              className="mt-1"
              disabled={isApiLoading}
            />
          </div>
          <div>
            <Label htmlFor="newItemQuantity">Quantity</Label>
            <Input
              id="newItemQuantity"
              value={newItemQuantity}
              onChange={(e) => setNewItemQuantity(e.target.value)}
              placeholder="e.g., 1 liter, 12 pieces"
              className="mt-1"
              disabled={isApiLoading}
            />
          </div>
          <div>
            <Label htmlFor="newItemExpiryDate">Expiry Date (Optional)</Label>
            <Input
              id="newItemExpiryDate"
              type="date"
              value={newItemExpiryDate}
              onChange={(e) => setNewItemExpiryDate(e.target.value)}
              className="mt-1"
              disabled={isApiLoading}
            />
          </div>
          <div className="sm:col-span-2 flex space-x-2 items-center">
            <Button onClick={handleAddItem} className="w-full sm:w-auto flex-grow" disabled={isApiLoading}>
              {isApiLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <PlusCircle className="mr-2 h-5 w-5" />}
              {isApiLoading ? "Looking up..." : "Add Item"}
            </Button>
            <Dialog open={isScannerOpen} onOpenChange={setIsScannerOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Scan Barcode" disabled={isApiLoading}>
                  <ScanBarcode className="h-5 w-5" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px] md:max-w-md lg:max-w-lg p-0">
                <DialogHeader className="p-6 pb-2">
                  <DialogTitle>Scan Barcode</DialogTitle>
                </DialogHeader>
                <div className="p-6 pt-0">
                  <div id={HTML5_QRCODE_READER_ID} className="w-full min-h-[250px] rounded-md border bg-muted overflow-hidden">
                    {/* html5-qrcode scanner will render here */}
                  </div>
                  {scannerMessage && (
                     <Alert 
                        variant={scannerMessage.startsWith("Scan Error:") || scannerMessage.startsWith("Error starting scanner:") || scannerMessage.startsWith("API Error") || scannerMessage.startsWith("API Issue") ? "destructive" : "default"} 
                        className="mt-4"
                    >
                        {scannerMessage.startsWith("Scan Error:") || scannerMessage.startsWith("Error starting scanner:") ? <AlertTriangle className="h-5 w-5" /> : 
                         scannerMessage.startsWith("API Error") || scannerMessage.startsWith("API Issue") ? <AlertTriangle className="h-5 w-5" /> :
                         scannerMessage.startsWith("Looking up") ? <Loader2 className="h-5 w-5 animate-spin" /> : 
                         scannerMessage.startsWith("Found:") ? <CheckCircle className="h-5 w-5" /> : 
                         <Info className="h-5 w-5" />}
                        <AlertTitle>
                            {scannerMessage.startsWith("Scan Error:") || scannerMessage.startsWith("Error starting scanner:") ? "Scanning Issue" : 
                             scannerMessage.startsWith("API Error") || scannerMessage.startsWith("API Issue") ? "API Problem" :
                             scannerMessage.startsWith("Looking up") ? "Processing" :
                             scannerMessage.startsWith("Found:") ? "Success" :
                             "Scanner Status"}
                        </AlertTitle>
                        <AlertDescription>{scannerMessage}</AlertDescription>
                    </Alert>
                  )}
                </div>
                <DialogFooter className="p-6 pt-2">
                    <Button variant="outline" onClick={() => setIsScannerOpen(false)}>Cancel</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </GlassCard>

      <GlassCard className="p-6 md:p-8">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h2 className="text-xl font-semibold text-foreground">Your Pantry Items</h2>
            <Input
                type="search"
                placeholder="Search items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full sm:w-64 md:w-72"
            />
        </div>

        {filteredItems.length === 0 ? (
          <div className="py-10 text-center">
            <PackageSearch className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="mt-4 text-lg text-muted-foreground">
              {searchTerm ? `No items match "${searchTerm}".` : "Your pantry is empty. Add some items!"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredItems.map((item) => {
              const expiry = getExpiryStatus(item.expiryDate);
              return (
                <GlassCard key={item.id} className={cn("p-4 space-y-2 border-l-4", 
                  expiry.color === 'text-red-600 font-semibold' && 'border-red-500',
                  expiry.color === 'text-yellow-500' && 'border-yellow-500',
                  expiry.color === 'text-green-500' && 'border-green-500',
                  !expiry.icon && 'border-transparent' // Default if no specific status
                )}>
                  <h3 className="text-lg font-semibold text-foreground">{item.name}</h3>
                  <p className="text-sm text-muted-foreground">Quantity: {item.quantity}</p>
                  <div className="flex items-center text-sm">
                    {expiry.icon && <expiry.icon className={cn("mr-1.5 h-4 w-4", expiry.color)} />}
                    <span className={cn(expiry.color)}>{expiry.text}</span>
                  </div>
                  <p className="text-xs text-muted-foreground/80">Added: {format(parseISO(item.addedDate), 'MMM dd, yyyy')}</p>
                  <div className="flex space-x-2 pt-2">
                    
                        <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStartEdit(item)}
                        >
                        <Edit2 className="mr-1.5 h-3.5 w-3.5" /> Edit
                        </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteItem(item.id)}
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
                    </Button>
                  </div>
                </GlassCard>
              );
            })}
          </div>
        )}
      </GlassCard>

      {editingItem && (
        <Dialog open={!!editingItem} onOpenChange={(isOpen) => { if (!isOpen) setEditingItem(null); }}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Edit {editingItem.name}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div>
                <Label htmlFor="editItemName">Item Name</Label>
                <Input
                  id="editItemName"
                  value={editItemName}
                  onChange={(e) => setEditItemName(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="editItemQuantity">Quantity</Label>
                <Input
                  id="editItemQuantity"
                  value={editItemQuantity}
                  onChange={(e) => setEditItemQuantity(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="editItemExpiryDate">Expiry Date</Label>
                <Input
                  id="editItemExpiryDate"
                  type="date"
                  value={editItemExpiryDate}
                  onChange={(e) => setEditItemExpiryDate(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setEditingItem(null)}>Cancel</Button>
              <Button onClick={handleSaveEdit}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

