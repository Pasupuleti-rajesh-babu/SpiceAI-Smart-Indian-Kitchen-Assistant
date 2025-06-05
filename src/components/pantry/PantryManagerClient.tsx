
"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { PANTRY_ITEMS_KEY, BARCODE_DATABASE_KEY } from '@/lib/localStorageKeys';
import type { PantryItem } from '@/types/pantry';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GlassCard } from '@/components/ui/GlassCard';
import { PlusCircle, Edit2, Trash2, AlertTriangle, CheckCircle, PackageSearch, Loader2, ScanBarcode, VideoOff } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { format, differenceInDays, parseISO, isValid } from 'date-fns';
import { useToast } from "@/hooks/use-toast";
import { cn } from '@/lib/utils';
import { BrowserCodeReader, NotFoundException, ChecksumException, FormatException, type IScannerControls, type Result } from '@zxing/library';

type BarcodeDatabase = { [barcode: string]: string };

export default function PantryManagerClient() {
  const [pantryItems, setPantryItems] = useLocalStorage<PantryItem[]>(PANTRY_ITEMS_KEY, []);
  const [newItemName, setNewItemName] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState('');
  const [newItemExpiryDate, setNewItemExpiryDate] = useState('');
  
  const [editingItem, setEditingItem] = useState<PantryItem | null>(null);
  const [editItemName, setEditItemName] = useState('');
  const [editItemQuantity, setEditItemQuantity] = useState('');
  const [editItemExpiryDate, setEditItemExpiryDate] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  const [hasMounted, setHasMounted] = useState(false);

  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const codeReaderRef = useRef<BrowserCodeReader | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [scannerError, setScannerError] = useState<string | null>(null);
  
  const [barcodeDb, setBarcodeDb] = useLocalStorage<BarcodeDatabase>(BARCODE_DATABASE_KEY, {});
  const [lastScannedBarcode, setLastScannedBarcode] = useState<string | null>(null);

  useEffect(() => {
    setHasMounted(true);
    if (!codeReaderRef.current) {
      codeReaderRef.current = new BrowserCodeReader();
    }
  }, []);
  
  const handleScanSuccess = useCallback((scannedValue: string) => {
    if (!isScannerOpen) return; // Prevent updates if dialog closed rapidly

    const knownItemName = barcodeDb[scannedValue];
    if (knownItemName) {
      setNewItemName(knownItemName);
      toast({ title: "Barcode Matched!", description: `Item: ${knownItemName} (from your records)` });
      setLastScannedBarcode(null); 
    } else {
      setNewItemName(scannedValue); 
      toast({ title: "New Barcode Scanned!", description: `Value: ${scannedValue}. Please enter item name or use as is.` });
      setLastScannedBarcode(scannedValue); 
    }
    setIsScannerOpen(false); 
  }, [barcodeDb, toast, setIsScannerOpen, setNewItemName, setLastScannedBarcode, isScannerOpen]);
  
  const handleScanError = useCallback((error: any) => {
    if (!isScannerOpen) return; 

    if (error instanceof NotFoundException || error instanceof ChecksumException || error instanceof FormatException) {
      // These are common scanning errors (e.g., no barcode found in frame), so we don't always show a UI error.
      // console.log("Minor scan error:", error.message);
      return; 
    }
    console.error("Barcode scanning error during active scan:", error);
    setScannerError("Error during barcode scanning. Try adjusting camera, lighting, or ensure only one barcode is visible.");
  }, [isScannerOpen, setScannerError]);

  useEffect(() => {
    let streamForCleanup: MediaStream | null = null;
    let activeControls: IScannerControls | null = null;

    const startScanner = async () => {
      if (!videoRef.current || !codeReaderRef.current) {
        setScannerError("Video or scanner component not ready.");
        setHasCameraPermission(false);
        return;
      }

      const currentVideoElement = videoRef.current;
      const currentCodeReader = codeReaderRef.current;

      setScannerError(null); // Clear previous errors
      setHasCameraPermission(null); // Indicate loading

      try {
        streamForCleanup = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        currentVideoElement.srcObject = streamForCleanup;
        
        await currentVideoElement.play();
        setHasCameraPermission(true); // Camera is active
        setScannerError(null); // Clear scanner error if camera access is successful
        
        // Ensure we only start decoding if the dialog is still meant to be open
        if (isScannerOpen && videoRef.current) { 
          activeControls = currentCodeReader.decodeFromVideoElement(
            currentVideoElement,
            (result: Result | undefined, error: any) => {
              if (!videoRef.current || !isScannerOpen) { // Double check if still relevant before processing
                   return;
              }
              if (result) {
                handleScanSuccess(result.getText());
              } else if (error) {
                handleScanError(error);
              }
            }
          );
          controlsRef.current = activeControls; // Store for potential cleanup
        } else {
           // If dialog closed before scanner could start, clean up immediately
           if (streamForCleanup) {
            streamForCleanup.getTracks().forEach(track => track.stop());
           }
           if(currentVideoElement) currentVideoElement.srcObject = null;
        }

      } catch (err: any) {
        console.error('Error in startScanner:', err);
        let message = 'Could not initialize camera.';
        if (err.name === "NotAllowedError") message = "Camera permission denied. Please enable it in browser settings.";
        else if (err.name === "NotFoundError") message = "No camera found. Ensure one is connected and not in use by another app.";
        else if (err.name === "NotReadableError") message = "Camera is in use or there's a hardware issue.";
        else if (err.name === "AbortError") message = "Camera setup was aborted.";
        else if (err.name === "SecurityError") message = "Camera access denied (e.g. not HTTPS).";
        else if (err.message && typeof err.message === 'string' && err.message.length < 150) message = err.message;
        
        setScannerError(message);
        setHasCameraPermission(false);

        if (streamForCleanup) {
          streamForCleanup.getTracks().forEach(track => track.stop());
        }
        if (currentVideoElement) currentVideoElement.srcObject = null;
        if (activeControls) {
            activeControls.stop();
        }
        controlsRef.current = null; // Clear ref
      }
    };
    
    const cleanup = () => {
      if (controlsRef.current) {
        controlsRef.current.stop();
        controlsRef.current = null;
      }
      if (activeControls) { // Also check the local var from startScanner
        activeControls.stop();
        activeControls = null;
      }
      if (videoRef.current && videoRef.current.srcObject) {
         const stream = videoRef.current.srcObject as MediaStream;
         stream.getTracks().forEach(track => track.stop());
         videoRef.current.srcObject = null;
      }
      if (streamForCleanup) { 
        streamForCleanup.getTracks().forEach(track => track.stop());
        streamForCleanup = null;
      }
      // Reset states relevant to the scanner dialog when it's confirmed closed
      setHasCameraPermission(null); 
      setScannerError(null);
    };

    if (isScannerOpen) {
      startScanner();
    } else {
      cleanup();
    }

    return () => { // Effect cleanup for when component unmounts or isScannerOpen changes
      cleanup();
    };
  }, [isScannerOpen, handleScanSuccess, handleScanError]); // Dependencies

  const handleAddItem = () => {
    if (!newItemName.trim() || !newItemQuantity.trim()) {
      toast({ title: "Missing Information", description: "Please provide item name and quantity.", variant: "destructive" });
      return;
    }
    
    const capturedLastScannedBarcode = lastScannedBarcode; 
    const currentNewItemName = newItemName.trim();

    const newItem: PantryItem = {
      id: Date.now().toString(),
      name: currentNewItemName,
      quantity: newItemQuantity.trim(),
      expiryDate: newItemExpiryDate || undefined,
      addedDate: new Date().toISOString(),
    };
    setPantryItems(prevItems => [...prevItems, newItem]);

    if (capturedLastScannedBarcode && currentNewItemName !== capturedLastScannedBarcode) {
      setBarcodeDb(prevDb => ({ ...prevDb, [capturedLastScannedBarcode]: currentNewItemName }));
      toast({ title: "Barcode Named", description: `Saved '${currentNewItemName}' for barcode ${capturedLastScannedBarcode}.`, variant: "default" });
    } else if (capturedLastScannedBarcode && currentNewItemName === capturedLastScannedBarcode){
       toast({ title: "Item Added", description: `Item with barcode ${currentNewItemName} added. Consider giving it a more descriptive name next time.`, variant: "default" });
    }
    else {
      toast({ title: "Item Added", description: `${currentNewItemName} added to pantry.`, variant: "default" });
    }
    
    setNewItemName('');
    setNewItemQuantity('');
    setNewItemExpiryDate('');
    setLastScannedBarcode(null); 
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
      const aDate = a.expiryDate ? parseISO(a.expiryDate) : new Date(8640000000000000); 
      const bDate = b.expiryDate ? parseISO(b.expiryDate) : new Date(8640000000000000); 
      
      const aIsValid = isValid(aDate);
      const bIsValid = isValid(bDate);

      if (aIsValid && !bIsValid) return -1; 
      if (!aIsValid && bIsValid) return 1;  
      if (!aIsValid && !bIsValid) return 0; 

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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 items-end">
          <div className="sm:col-span-2 md:col-span-1">
            <Label htmlFor="newItemName">Item Name</Label>
            <Input
              id="newItemName"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder="e.g., Milk, Eggs or scanned barcode"
              className="mt-1"
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
            />
          </div>
          <div className="flex space-x-2 items-center">
            <Button onClick={handleAddItem} className="w-full sm:w-auto flex-grow">
              <PlusCircle className="mr-2 h-5 w-5" /> Add Item
            </Button>
            <Dialog open={isScannerOpen} onOpenChange={setIsScannerOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Scan Barcode">
                  <ScanBarcode className="h-5 w-5" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px] md:max-w-md lg:max-w-lg p-0">
                <DialogHeader className="p-6 pb-2">
                  <DialogTitle>Scan Barcode</DialogTitle>
                </DialogHeader>
                <div className="p-6 pt-0">
                  <div className="relative aspect-video w-full overflow-hidden rounded-md border bg-muted">
                    <video ref={videoRef} className="h-full w-full object-cover" playsInline />
                     {/* Overlay for loading/error messages */}
                    {(hasCameraPermission === null || (hasCameraPermission === false && scannerError)) && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 p-4">
                        {hasCameraPermission === null && !scannerError && (
                            <>
                            <Loader2 className="h-10 w-10 animate-spin text-primary mb-2" />
                            <p className="text-muted-foreground text-center">Initializing camera...</p>
                            </>
                        )}
                        {hasCameraPermission === false && scannerError && (
                            <Alert variant="destructive" className="w-full">
                            <VideoOff className="h-5 w-5" />
                            <AlertTitle>Camera Error</AlertTitle>
                            <AlertDescription>{scannerError}</AlertDescription>
                            </Alert>
                        )}
                         {hasCameraPermission === true && scannerError && ( 
                            <Alert variant="default" className="mt-4 border-yellow-500/50 text-yellow-700 dark:text-yellow-400 [&>svg]:text-yellow-500">
                            <AlertTriangle className="h-5 w-5" />
                            <AlertTitle>Scanning Issue</AlertTitle>
                            <AlertDescription>{scannerError}</AlertDescription>
                            </Alert>
                        )}
                        </div>
                    )}
                  </div>
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
                  !expiry.color && 'border-transparent' 
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
