
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
import { BrowserCodeReader, NotFoundException, ChecksumException, FormatException, type IScannerControls, type Result, DecodeHintType, BarcodeFormat } from '@zxing/library';

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

  const isScannerOpenRef = useRef(isScannerOpen); 

  useEffect(() => {
    isScannerOpenRef.current = isScannerOpen;
  }, [isScannerOpen]);

  useEffect(() => {
    setHasMounted(true);
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
    // Stop scanner controls first
    if (controlsRef.current && typeof controlsRef.current.stop === 'function') {
      try {
        controlsRef.current.stop();
      } catch (e) {
        console.warn("Error stopping scanner controls:", e);
      }
    }
    controlsRef.current = null;

    // Stop and release the media stream
    if (streamForCleanupRef.current) {
      streamForCleanupRef.current.getTracks().forEach(track => track.stop());
      streamForCleanupRef.current = null;
    }

    // Clear the video source
    if (actualVideoRef.current && actualVideoRef.current.srcObject) {
        actualVideoRef.current.srcObject = null;
    }
    
    // Reset the BrowserCodeReader instance
    if (codeReaderRef.current && typeof codeReaderRef.current.reset === 'function') {
      try {
        codeReaderRef.current.reset();
      } catch (e) {
        console.warn("Error resetting code reader:", e);
      }
    }
    codeReaderRef.current = null; // Ensure it's null for re-creation
  }, []);


  const handleScanSuccess = useCallback((scannedValue: string) => {
    if (!isScannerOpenRef.current) return; 

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
    setIsScannerOpen(false); // This will trigger the useEffect cleanup
  }, [barcodeDb, toast, setIsScannerOpen, setNewItemName, setLastScannedBarcode]);
  
  const handleScanError = useCallback((error: any) => {
    if (!isScannerOpenRef.current) return;
    
    // Log all errors for debugging, even "expected" ones
    console.debug("ZXing scan attempt error:", error?.message || error);

    if (error instanceof NotFoundException || error instanceof ChecksumException || error instanceof FormatException) {
      // These are expected errors if no barcode is found or it's unreadable. 
      // Do not flood UI with these, but good to log them for debugging.
      if (isScannerOpenRef.current && hasCameraPermission === true && !scannerError?.includes("No barcode found")) { 
         // setScannerError("No barcode found or unable to read. Try adjusting position/lighting."); // Potentially too noisy
      }
      return; 
    }
    // For other, unexpected errors during active scan:
    console.error("Barcode scanning error during active scan:", error);
    if (isScannerOpenRef.current) { 
        setScannerError(`Error during barcode scanning: ${error.message || "Unknown error"}`);
    }
  }, [hasCameraPermission, scannerError, setScannerError]); 

  useEffect(() => {
    if (!isScannerOpen) {
      stopCurrentScan();
      // Reset states only if they were previously set, to avoid flicker on initial mount
      if (hasCameraPermission !== null || scannerError !== null) { 
        setHasCameraPermission(null);
        setScannerError(null);
      }
      return; // Exit early if scanner is not supposed to be open
    }

    // Only proceed if scanner is open AND video element is ready
    if (isScannerOpen && isVideoElementReady && actualVideoRef.current) {
      
      const initializeCameraAndScanner = async () => {
        if (!isScannerOpenRef.current) return; // Double check, in case state changed during async ops

        stopCurrentScan(); // Ensure clean state before starting

        setScannerError(null); 
        setHasCameraPermission(null); // Indicate loading state

        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
          if (!isScannerOpenRef.current) { // Check again after await
            stream.getTracks().forEach(track => track.stop());
            return;
          }
          streamForCleanupRef.current = stream; 

          if (!actualVideoRef.current) { 
             if (isScannerOpenRef.current) setScannerError("Video element became unavailable.");
             stopCurrentScan();
             return;
          }
          actualVideoRef.current.srcObject = stream;
          
          actualVideoRef.current.onloadedmetadata = async () => {
            if (!isScannerOpenRef.current || !actualVideoRef.current) {
              stopCurrentScan();
              return;
            }
            try {
                await actualVideoRef.current!.play(); 
                if (!isScannerOpenRef.current) { // Check again after play
                    stopCurrentScan();
                    return;
                }
                setHasCameraPermission(true); 
                setScannerError(null); // Clear any previous setup error
                
                const hints = new Map();
                const formats = [
                    BarcodeFormat.QR_CODE, BarcodeFormat.EAN_13, BarcodeFormat.CODE_128, 
                    BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.DATA_MATRIX, 
                    BarcodeFormat.ITF, BarcodeFormat.CODABAR, BarcodeFormat.CODE_39, BarcodeFormat.CODE_93,
                    // Add other formats if needed
                ];
                hints.set(DecodeHintType.POSSIBLE_FORMATS, formats);
                hints.set(DecodeHintType.TRY_HARDER, true);

                // Create a new reader instance each time
                codeReaderRef.current = new BrowserCodeReader(hints); 
                                
                if (codeReaderRef.current && actualVideoRef.current && isScannerOpenRef.current) { 
                    // Start decoding from the video element.
                    // Important: This callback will be invoked continuously.
                    controlsRef.current = codeReaderRef.current.decodeFromVideoElement(
                        actualVideoRef.current,
                        (result: Result | undefined, error: any) => {
                          // Check isScannerOpenRef inside the callback, as it might have closed.
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
            } catch (playError: any) {
                console.error('Error playing video:', playError);
                if(isScannerOpenRef.current) {
                    setScannerError(`Could not play video stream: ${playError.message || "Unknown error"}`.trim());
                    setHasCameraPermission(false);
                }
                stopCurrentScan(); 
            }
          };

          actualVideoRef.current.onerror = (e) => { 
            if(isScannerOpenRef.current) {
                console.error('Video element encountered an error', e);
                setScannerError("Video element encountered an error.");
                setHasCameraPermission(false);
            }
            stopCurrentScan(); 
          };

        } catch (err: any) { 
          if(isScannerOpenRef.current) {
            console.error('Error initializing camera or scanner:', err);
            let message = 'Could not initialize camera.';
            if (err.name === "NotAllowedError") message = "Camera permission denied. Please enable it in browser settings.";
            else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") message = "No camera found. Ensure one is connected.";
            else if (err.name === "NotReadableError" || err.name === "TrackStartError") message = "Camera is in use or hardware issue.";
            else if (err.message && typeof err.message === 'string' && err.message.length < 150) message = err.message;
            setScannerError(message);
            setHasCameraPermission(false);
          }
          stopCurrentScan(); 
        }
      };

      initializeCameraAndScanner();
    }
    
    // Cleanup function for the useEffect hook
    return () => { 
      stopCurrentScan();
    };
  }, [isScannerOpen, isVideoElementReady, stopCurrentScan, handleScanSuccess, handleScanError]); // Added handleScanSuccess, handleScanError back as they are used in the effect scope now


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
                    <video 
                        ref={videoCallbackRef} 
                        className="h-full w-full object-cover" 
                        playsInline 
                        autoPlay // Added autoPlay for good measure
                        muted 
                    />
                    
                    {isScannerOpen && (hasCameraPermission === null || (hasCameraPermission === false && scannerError) || (!isVideoElementReady && hasCameraPermission !== false && !scannerError) ) && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 p-4 text-center">
                        {(!isVideoElementReady && hasCameraPermission === null && !scannerError ) && (
                             <>
                             <Loader2 className="h-10 w-10 animate-spin text-primary mb-2" />
                             <p className="text-muted-foreground">Preparing video element...</p>
                             </>
                        )}
                        {(isVideoElementReady && hasCameraPermission === null && !scannerError) && ( 
                            <>
                            <Loader2 className="h-10 w-10 animate-spin text-primary mb-2" />
                            <p className="text-muted-foreground">Initializing camera...</p>
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
                   { (hasCameraPermission === true && scannerError) && ( 
                        <Alert variant="default" className="mt-4 border-yellow-500/50 text-yellow-700 dark:text-yellow-400 [&>svg]:text-yellow-500">
                        <AlertTriangle className="h-5 w-5" />
                        <AlertTitle>Scanning Issue</AlertTitle>
                        <AlertDescription>{scannerError}</AlertDescription>
                        </Alert>
                    )}
                     { (hasCameraPermission === true && !scannerError) && (
                        <p className="mt-2 text-xs text-center text-muted-foreground">
                            Point camera at barcode. Ensure good lighting, focus, and barcode is clearly visible. Try different angles and distances for best results.
                        </p>
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

    