
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
const INTERNAL_API_LOOKUP_URL = "/api/lookup-barcode";

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

  const lookupBarcodeOnApi = useCallback(async (barcode: string): Promise<string | null> => {
    setIsApiLoading(true);
    setScannerMessage(`Looking up barcode ${barcode}...`);
    try {
      const response = await fetch(INTERNAL_API_LOOKUP_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ upc: barcode }),
      });

      const data: UpcItemDbResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `API error: ${response.status}`);
      }

      if (data.code === "OK" && data.items && data.items.length > 0 && data.items[0].title) {
        const productTitle = data.items[0].title;
        setNewItemName(productTitle);
        toast({ title: "Product Found!", description: `Item: ${productTitle}` });
        setScannerMessage(`Found: ${productTitle}`);
        return productTitle;
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
      const errorMessage = error.message || "Unknown error";
      if (errorMessage.toLowerCase().includes("failed to fetch")) {
        console.warn("Error looking up barcode via internal API (Failed to fetch):", errorMessage);
        toast({
          title: "Network Error or API Issue",
          description: "Could not connect to the lookup service. Please check your internet connection or try again later. This could also be a temporary API or CORS issue if not using the proxy correctly.",
          variant: "destructive"
        });
        setScannerMessage(`API Error: Network issue. Add manually.`);
      } else if (errorMessage.toLowerCase().includes("exceed burst limit") || errorMessage.toLowerCase().includes("rate limit")) {
        console.warn("Error looking up barcode via internal API (Rate Limit):", errorMessage);
        toast({
          title: "API Rate Limit Reached",
          description: "You've made too many requests to the barcode lookup service. Please try again later.",
          variant: "destructive"
        });
        setScannerMessage(`API Error: Rate limit. Add manually.`);
      } else {
        console.error("Error looking up barcode via internal API:", errorMessage);
        toast({
          title: "API Error",
          description: errorMessage || "Failed to lookup barcode. Please enter name manually.",
          variant: "destructive"
        });
        setScannerMessage(`API Error: ${errorMessage}. Add manually.`);
      }
      setNewItemName('');
    } finally {
      setIsApiLoading(false);
    }
    return null;
  }, [toast, setNewItemName, setScannerMessage, setIsApiLoading]);


  const onScanSuccess: QrcodeSuccessCallback = useCallback(async (decodedText, decodedResult) => {
    if (!isScannerOpenRef.current) return;

    console.log(`Scan result: ${decodedText}`, decodedResult);
    setManualBarcode(decodedText); // Populate manual barcode input with scanned value
    setLastScannedBarcode(decodedText);

    const knownItemName = barcodeDb[decodedText];
    if (knownItemName) {
        setNewItemName(knownItemName);
        toast({ title: "Barcode Matched!", description: `Item: ${knownItemName} (from your records)` });
        setScannerMessage(`Found in your records: ${knownItemName}`);
    } else {
        await lookupBarcodeOnApi(decodedText);
    }

    setIsScannerOpen(false); // Close scanner on success
  }, [barcodeDb, toast, setIsScannerOpen, setLastScannedBarcode, setNewItemName, setManualBarcode, lookupBarcodeOnApi]);

  const onScanFailure: QrcodeErrorCallback = useCallback((errorMessage) => {
      if (!isScannerOpenRef.current) return;

      const lowerError = typeof errorMessage === 'string' ? errorMessage.toLowerCase() : JSON.stringify(errorMessage).toLowerCase();
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
            // Avoid overwriting important messages (like API results or actual errors) with "Point camera..."
            if (currentMsg && (currentMsg.startsWith("Scan Error:") || currentMsg.startsWith("Error starting scanner:") || currentMsg.startsWith("Looking up") || currentMsg.startsWith("Found:") || currentMsg.startsWith("API Error") || currentMsg.startsWith("API Issue") || currentMsg.startsWith("No details for"))) return currentMsg;
            return "Point camera at barcode.";
        });
      } else if (errorMessage) {
        // For other errors, show them but don't make them overly alarming if they are just scanning attempts.
        // We rely on the Alert variant to differentiate.
        const msg = typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage);
        setScannerMessage(`Scan Error: ${msg}. Try adjusting position or lighting.`);
      } else {
        setScannerMessage("Scanning... Point camera at barcode.");
      }
  }, []);


  useEffect(() => {
    let timerId: NodeJS.Timeout | null = null;

    if (isScannerOpen) {
      // Use setTimeout to ensure the DOM element is available
      timerId = setTimeout(() => {
        if (!isScannerOpenRef.current) return; // Check again in case it closed quickly

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
              formatsToSupport: [ // Explicitly list formats
                Html5QrcodeSupportedFormats.UPC_A,
                Html5QrcodeSupportedFormats.UPC_E,
                Html5QrcodeSupportedFormats.EAN_13,
                Html5QrcodeSupportedFormats.EAN_8,
                Html5QrcodeSupportedFormats.CODE_128,
              ],
            },
            /* verbose= */ false
          );

          try {
            scanner.render(onScanSuccess, onScanFailure);
            if (isScannerOpenRef.current) { // Check if still open before setting message
              setScannerMessage("Scanner active. Point camera at barcode.");
            }
            html5QrCodeScannerRef.current = scanner;
          } catch (renderError: any) {
            console.error("Error calling Html5QrcodeScanner.render():", renderError);
            if (isScannerOpenRef.current) {
               setScannerMessage(`Error starting scanner: ${renderError.message || "Unknown error"}`);
            }
          }
        }
      }, 0); // Delay of 0ms pushes to next event loop tick

    } else {
      // Cleanup when dialog is closed
      if (html5QrCodeScannerRef.current) {
        html5QrCodeScannerRef.current.clear()
          .catch(err => {
            // Log clear errors but don't typically show to user unless persistent
            console.warn("Error clearing scanner on dialog close:", err);
          });
        html5QrCodeScannerRef.current = null; // Ensure it's reset
      }
      setScannerMessage(null); // Clear any messages
    }

    return () => {
      if (timerId) {
        clearTimeout(timerId);
      }
      // Ensure scanner is cleared if effect unmounts while open (e.g., component unmount)
      // This check is important because `isScannerOpen` might be true during unmount.
      if (html5QrCodeScannerRef.current && !isScannerOpenRef.current) { // Only clear if it should be closed
         html5QrCodeScannerRef.current.clear().catch(err => console.warn("Scanner clear failed on effect cleanup:", err));
         html5QrCodeScannerRef.current = null;
      }
    };
  }, [isScannerOpen, onScanSuccess, onScanFailure]); // Callbacks are memoized

  // Additional cleanup specifically for component unmount
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
    if (!newItemName.trim()) {
      toast({ title: "Missing Item Name", description: "Please provide the item name.", variant: "destructive" });
      return;
    }

    const currentNewItemName = newItemName.trim();
    const currentManualBarcode = manualBarcode.trim(); // Use the state for manual barcode
    const currentNewItemQuantity = newItemQuantity.trim();

    const newItem: PantryItem = {
      id: Date.now().toString(),
      name: currentNewItemName,
      quantity: currentNewItemQuantity || undefined,
      expiryDate: newItemExpiryDate || undefined,
      addedDate: new Date().toISOString(),
    };
    setPantryItems(prevItems => [...prevItems, newItem]);

    // Determine which barcode to associate (prefer scanned if name matches, else manual)
    let barcodeToAssociate: string | null = null;

    // If manual barcode is entered and item name is NOT just the barcode number itself
    if (currentManualBarcode && currentNewItemName !== currentManualBarcode) {
        barcodeToAssociate = currentManualBarcode;
    }
    // If a barcode was scanned (lastScannedBarcode) and item name is NOT that barcode,
    // and either no manual barcode was entered OR the manual barcode IS the item name
    // (implying the API lookup populated newItemName from the scanned code)
    else if (lastScannedBarcode && currentNewItemName !== lastScannedBarcode && (!currentManualBarcode || currentNewItemName === currentManualBarcode)) {
        barcodeToAssociate = lastScannedBarcode;
    }


    if (barcodeToAssociate && barcodeDb[barcodeToAssociate] !== currentNewItemName) {
        setBarcodeDb(prevDb => ({ ...prevDb, [barcodeToAssociate!]: currentNewItemName }));
        toast({ title: "Item Added & Barcode Named", description: `Saved '${currentNewItemName}' for barcode ${barcodeToAssociate}.`, variant: "default" });
    } else if (barcodeToAssociate && barcodeDb[barcodeToAssociate] === currentNewItemName) {
        // Barcode already known and matches, just confirm item added
        toast({ title: "Item Added", description: `${currentNewItemName} added to pantry. (Barcode ${barcodeToAssociate} already known)`, variant: "default" });
    }
     else {
      // No barcode or barcode already known and matches
      toast({ title: "Item Added", description: `${currentNewItemName} added to pantry.`, variant: "default" });
    }

    setNewItemName('');
    setNewItemQuantity('');
    setNewItemExpiryDate('');
    setLastScannedBarcode(null); // Clear after adding
    setManualBarcode(''); // Clear manual barcode input
  };

  const handleStartEdit = (item: PantryItem) => {
    setEditingItem(item);
    setEditItemName(item.name);
    setEditItemQuantity(item.quantity || '');
    setEditItemExpiryDate(item.expiryDate || '');
  };

  const handleSaveEdit = () => {
    if (!editingItem || !editItemName.trim()) {
      toast({ title: "Missing Item Name", description: "Please provide the item name for the edit.", variant: "destructive" });
      return;
    }
    const currentEditItemQuantity = editItemQuantity.trim();
    setPantryItems(
      pantryItems.map((item) =>
        item.id === editingItem.id
          ? { ...item, name: editItemName.trim(), quantity: currentEditItemQuantity || undefined, expiryDate: editItemExpiryDate || undefined }
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
    today.setHours(0,0,0,0); // Normalize today to the start of the day
    const daysLeft = differenceInDays(date, today);

    if (daysLeft < 0) return { text: `Expired ${Math.abs(daysLeft)} days ago`, icon: AlertTriangle, color: 'text-red-600 font-semibold' };
    if (daysLeft <= 7) return { text: `Expires in ${daysLeft} days`, icon: AlertTriangle, color: 'text-yellow-500' };
    return { text: `Expires on ${format(date, 'MMM dd, yyyy')}`, icon: CheckCircle, color: 'text-green-500' };
  };

  const filteredItems = pantryItems
    .filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      // Sort by expiry date, items without expiry or invalid dates go to the bottom
      const aDate = a.expiryDate && isValid(parseISO(a.expiryDate)) ? parseISO(a.expiryDate) : new Date(8640000000000000); // Far future date
      const bDate = b.expiryDate && isValid(parseISO(b.expiryDate)) ? parseISO(b.expiryDate) : new Date(8640000000000000); // Far future date
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
            <Label htmlFor="manualBarcode">Enter/Scanned Barcode (Optional)</Label>
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
            <Label htmlFor="newItemQuantity">Quantity (Optional)</Label>
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
                    {/* This div is targeted by Html5QrcodeScanner */}
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
                  !expiry.icon && 'border-transparent' // Or some default like border-muted
                )}>
                  <h3 className="text-lg font-semibold text-foreground">{item.name}</h3>
                  <p className="text-sm text-muted-foreground">Quantity: {item.quantity || 'N/A'}</p>
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

      {/* Edit Item Dialog */}
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
                <Label htmlFor="editItemQuantity">Quantity (Optional)</Label>
                <Input
                  id="editItemQuantity"
                  value={editItemQuantity}
                  onChange={(e) => setEditItemQuantity(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="editItemExpiryDate">Expiry Date (Optional)</Label>
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

