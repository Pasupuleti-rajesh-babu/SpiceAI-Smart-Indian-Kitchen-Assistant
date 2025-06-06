
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
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
  
  const actualVideoRef = useRef<HTMLVideoElement | null>(null);
  const [isVideoElementReady, setIsVideoElementReady] = useState(false);
  const codeReaderRef = useRef<BrowserCodeReader | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const streamForCleanupRef = useRef<MediaStream | null>(null);
  const [scannerError, setScannerError] = useState<string | null>(null);
  
  const [barcodeDb, setBarcodeDb] = useLocalStorage<BarcodeDatabase>(BARCODE_DATABASE_KEY, {});
  const [lastScannedBarcode, setLastScannedBarcode] = useState<string | null>(null);

  const isScannerOpenRef = useRef(isScannerOpen); // Ref to track current scanner open state for async callbacks

  useEffect(() => {
    isScannerOpenRef.current = isScannerOpen;
  }, [isScannerOpen]);

  useEffect(() => {
    setHasMounted(true);
    if (!codeReaderRef.current) {
      codeReaderRef.current = new BrowserCodeReader(undefined, {
        tryHarder: true,
        formats: [], // Try all formats by default
      });
    }
  }, []);
  
  const videoCallbackRef = useCallback((node: HTMLVideoElement | null) => {
    if (node) {
      actualVideoRef.current = node;
      setIsVideoElementReady(true);
    } else {
      actualVideoRef.current = null;
      setIsVideoElementReady(false);
    }
  }, []);


  const stopCurrentScan = useCallback(() => {
    // 1. Stop scanner controls if they exist
    if (controlsRef.current && typeof controlsRef.current.stop === 'function') {
      try {
        controlsRef.current.stop();
      } catch (e) {
        console.warn("Error stopping scanner controls:", e);
      }
    }
    controlsRef.current = null;

    // 2. Stop media stream tracks
    if (streamForCleanupRef.current) {
      streamForCleanupRef.current.getTracks().forEach(track => track.stop());
      streamForCleanupRef.current = null;
    }

    // 3. Clear video element source
    if (actualVideoRef.current && actualVideoRef.current.srcObject) {
        actualVideoRef.current.srcObject = null;
    }
    
    // 4. Reset the BrowserCodeReader instance itself
    if (codeReaderRef.current && typeof codeReaderRef.current.reset === 'function') {
      try {
        codeReaderRef.current.reset(); 
      } catch (e) {
        console.warn("Error resetting code reader:", e);
      }
    }
  }, []);


  const handleScanSuccess = useCallback((scannedValue: string) => {
    if (!isScannerOpenRef.current) return; // Check if scanner should still be active

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
    setIsScannerOpen(false); // This will trigger the useEffect to cleanup
  }, [barcodeDb, toast, setIsScannerOpen, setNewItemName, setLastScannedBarcode]);
  
  const handleScanError = useCallback((error: any) => {
    if (!isScannerOpenRef.current) return; // Check if scanner should still be active

    if (error instanceof NotFoundException || error instanceof ChecksumException || error instanceof FormatException) {
      // These are expected during scanning when no barcode is found, do not set as a permanent error.
      // You could update a temporary status like "Searching for barcode..." here if desired.
      return; 
    }
    // For other errors that occur during an active scan
    console.error("Barcode scanning error during active scan:", error);
    if (isScannerOpenRef.current) { // Double check, as state might be changing
        setScannerError("Error during barcode scanning. Try adjusting camera, lighting, or ensure only one barcode is visible.");
        // Potentially stop and restart scan or provide user feedback
    }
  }, [setScannerError]);

  useEffect(() => {
    // This effect manages the camera and scanner lifecycle based on isScannerOpen
    if (!isScannerOpen) {
      stopCurrentScan();
      // Reset camera related states when dialog closes, if they aren't already null
      if (hasCameraPermission !== null || scannerError !== null) { 
        setHasCameraPermission(null);
        setScannerError(null);
      }
      return; // Early exit if scanner is not supposed to be open
    }

    // Scanner is supposed to be open, proceed with initialization
    if (isVideoElementReady && actualVideoRef.current && codeReaderRef.current) {
      const videoElement = actualVideoRef.current;
      const localCodeReader = codeReaderRef.current;

      // Function to initialize camera and scanner
      const initializeCameraAndScanner = async () => {
        // Always stop any existing scan before starting a new one
        stopCurrentScan();

        if (!isScannerOpenRef.current) return; // Check if dialog closed during async ops

        setScannerError(null); 
        setHasCameraPermission(null); // Set to loading state

        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
          if (!isScannerOpenRef.current) { // Dialog closed while getting stream
            stream.getTracks().forEach(track => track.stop());
            return;
          }
          streamForCleanupRef.current = stream; 

          if (!actualVideoRef.current) { // Video element became unavailable
             stopCurrentScan();
             return;
          }
          videoElement.srcObject = stream;
          
          videoElement.onloadedmetadata = async () => {
            if (!isScannerOpenRef.current || !actualVideoRef.current) {
              stopCurrentScan();
              return;
            }
            try {
                await videoElement.play(); 
                if (!isScannerOpenRef.current) { // Dialog closed while playing
                    stopCurrentScan();
                    return;
                }
                setHasCameraPermission(true); 
                setScannerError(null); // Clear any previous setup error
                
                if (localCodeReader && actualVideoRef.current) { 
                    // Start decoding
                    controlsRef.current = localCodeReader.decodeFromVideoElement(
                        actualVideoRef.current,
                        (result: Result | undefined, error: any) => {
                          // This callback is from ZXing, check ref for current dialog state
                          if (!isScannerOpenRef.current) return;
                          if (result) {
                            handleScanSuccess(result.getText());
                          } else if (error) {
                            handleScanError(error);
                          }
                        }
                    );
                } else {
                     if (isScannerOpenRef.current) setScannerError("Scanner components not ready after video play.");
                }
            } catch (playError) {
                console.error('Error playing video:', playError);
                if(isScannerOpenRef.current) {
                    setScannerError("Could not play video stream. Check permissions or console.");
                    setHasCameraPermission(false);
                }
                stopCurrentScan(); // Cleanup on play error
            }
          };

          videoElement.onerror = () => { // Video element global error
            if(isScannerOpenRef.current) {
                console.error('Video element encountered an error');
                setScannerError("Video element encountered an error.");
                setHasCameraPermission(false);
            }
            stopCurrentScan(); // Cleanup on video error
          };

        } catch (err: any) { // Error from getUserMedia
          if(isScannerOpenRef.current) {
            console.error('Error initializing camera or scanner:', err);
            let message = 'Could not initialize camera.';
            if (err.name === "NotAllowedError") message = "Camera permission denied. Please enable it in browser settings.";
            else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") message = "No camera found. Ensure one is connected and not in use by another app.";
            else if (err.name === "NotReadableError" || err.name === "TrackStartError") message = "Camera is in use or there's a hardware issue.";
            else if (err.message && typeof err.message === 'string' && err.message.length < 150) message = err.message;
            setScannerError(message);
            setHasCameraPermission(false);
          }
          stopCurrentScan(); // Cleanup on getUserMedia error
        }
      };

      initializeCameraAndScanner();
    } else if (isScannerOpen && !isVideoElementReady) {
      // This case means dialog is open, but video element isn't mounted yet.
      // Set to loading state, but don't show "component not ready" error yet.
      setHasCameraPermission(null);
      setScannerError(null); 
    }
    
    // Cleanup function for this main effect
    return () => { 
      stopCurrentScan();
    };
  }, [isScannerOpen, isVideoElementReady, stopCurrentScan, handleScanSuccess, handleScanError]); // Dependencies for the main effect


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
      const aDate = a.expiryDate && isValid(parseISO(a.expiryDate)) ? parseISO(a.expiryDate) : new Date(8640000000000000);
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
                    <video ref={videoCallbackRef} className="h-full w-full object-cover" playsInline autoPlay muted />
                    
                    {/* Overlay for loading/error states */}
                    {(hasCameraPermission === null || (hasCameraPermission === false && scannerError) || (!isVideoElementReady && isScannerOpen && hasCameraPermission !== false && !scannerError) ) && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 p-4 text-center">
                        {(hasCameraPermission === null && !scannerError && isVideoElementReady) && ( 
                            <>
                            <Loader2 className="h-10 w-10 animate-spin text-primary mb-2" />
                            <p className="text-muted-foreground">Initializing camera...</p>
                            </>
                        )}
                        {(!isVideoElementReady && isScannerOpen && !scannerError && hasCameraPermission === null /* Only show if not yet errored or succeeded */) && (
                            <>
                            <Loader2 className="h-10 w-10 animate-spin text-primary mb-2" />
                            <p className="text-muted-foreground">Preparing video element...</p>
                            </>
                        )}
                        {(hasCameraPermission === false && scannerError) && ( 
                            <Alert variant="destructive" className="w-full">
                            <VideoOff className="h-5 w-5" />
                            <AlertTitle>Camera Error</AlertTitle>
                            <AlertDescription>{scannerError || "Unknown camera error."}</AlertDescription>
                            </Alert>
                        )}
                        </div>
                    )}
                  </div>
                   {/* Error message for active scanning issues, distinct from setup errors */}
                   { (hasCameraPermission === true && scannerError) && ( 
                        <Alert variant="default" className="mt-4 border-yellow-500/50 text-yellow-700 dark:text-yellow-400 [&>svg]:text-yellow-500">
                        <AlertTriangle className="h-5 w-5" />
                        <AlertTitle>Scanning Issue</AlertTitle>
                        <AlertDescription>{scannerError}</AlertDescription>
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
                  !expiry.icon && 'border-transparent'
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
