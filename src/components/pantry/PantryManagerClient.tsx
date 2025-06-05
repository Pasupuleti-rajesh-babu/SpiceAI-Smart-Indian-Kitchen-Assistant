
"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { PANTRY_ITEMS_KEY } from '@/lib/localStorageKeys';
import type { PantryItem } from '@/types/pantry';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GlassCard } from '@/components/ui/GlassCard';
import { PlusCircle, Edit2, Trash2, CalendarDays, AlertTriangle, CheckCircle, PackageSearch, Loader2, ScanBarcode, Video, VideoOff } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { format, differenceInDays, parseISO, isValid } from 'date-fns';
import { useToast } from "@/hooks/use-toast";
import { cn } from '@/lib/utils';
import { BrowserCodeReader, NotFoundException } from '@zxing/library';

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
  const [scannerError, setScannerError] = useState<string | null>(null);

  useEffect(() => {
    setHasMounted(true);
    codeReaderRef.current = new BrowserCodeReader();
  }, []);

  const startScanner = useCallback(async () => {
    if (!isScannerOpen || !codeReaderRef.current || !videoRef.current) return;
    setScannerError(null);
    setHasCameraPermission(null); // Reset for loading state

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      setHasCameraPermission(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Ensure video plays, catch potential errors if it doesn't
        videoRef.current.play().catch(playError => {
            console.error("Error playing video stream:", playError);
            setScannerError("Could not start video stream. Ensure your camera is not in use by another application and permissions are granted.");
            setHasCameraPermission(false);
            // Stop tracks if play fails
             stream.getTracks().forEach(track => track.stop());
        });

        codeReaderRef.current.decodeFromVideoElement(videoRef.current, (result, err) => {
          if (result) {
            setNewItemName(result.getText());
            toast({ title: "Barcode Scanned!", description: `Item: ${result.getText()}` });
            setIsScannerOpen(false); // Close dialog on successful scan
          }
          if (err && !(err instanceof NotFoundException)) {
            console.error("Barcode scanning error:", err);
            setScannerError("Error during barcode scanning. Please try again.");
          }
        });
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      let message = 'Camera access denied or no camera found. Please enable camera permissions in your browser settings.';
      if (error instanceof Error) {
        if (error.name === "NotAllowedError") {
          message = "Camera permission was denied. Please enable it in your browser settings.";
        } else if (error.name === "NotFoundError") {
          message = "No camera was found. Please ensure a camera is connected and enabled.";
        } else if (error.name === "NotReadableError") {
            message = "The camera is currently in use by another application or a hardware error occurred.";
        }
      }
      setScannerError(message);
      setHasCameraPermission(false);
      toast({
        variant: 'destructive',
        title: 'Camera Access Error',
        description: message,
      });
    }
  }, [isScannerOpen, toast]);

  useEffect(() => {
    if (isScannerOpen) {
      startScanner();
    } else {
      // Stop camera and scanner when dialog is closed
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
      if (codeReaderRef.current) {
        codeReaderRef.current.reset();
      }
      // Don't reset hasCameraPermission here, so the error message persists if needed
      // setHasCameraPermission(null); 
      // setScannerError(null); 
    }
    
    // Cleanup function for component unmount if scanner is open
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
      if (codeReaderRef.current) {
        codeReaderRef.current.reset();
      }
    };
  }, [isScannerOpen, startScanner]);


  const handleAddItem = () => {
    if (!newItemName.trim() || !newItemQuantity.trim()) {
      toast({ title: "Missing Information", description: "Please provide item name and quantity.", variant: "destructive" });
      return;
    }
    const newItem: PantryItem = {
      id: Date.now().toString(),
      name: newItemName.trim(),
      quantity: newItemQuantity.trim(),
      expiryDate: newItemExpiryDate || undefined,
      addedDate: new Date().toISOString(),
    };
    setPantryItems([...pantryItems, newItem]);
    setNewItemName('');
    setNewItemQuantity('');
    setNewItemExpiryDate('');
    toast({ title: "Item Added", description: `${newItem.name} has been added to your pantry.`, variant: "default" });
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
    const daysLeft = differenceInDays(date, today);

    if (daysLeft < 0) return { text: `Expired ${Math.abs(daysLeft)} days ago`, icon: AlertTriangle, color: 'text-red-600 font-semibold' };
    if (daysLeft <= 7) return { text: `Expires in ${daysLeft} days`, icon: AlertTriangle, color: 'text-yellow-500' };
    return { text: `Expires on ${format(date, 'MMM dd, yyyy')}`, icon: CheckCircle, color: 'text-green-500' };
  };

  const filteredItems = pantryItems
    .filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      const aDate = a.expiryDate ? parseISO(a.expiryDate) : new Date(8640000000000000); // Far future for no expiry
      const bDate = b.expiryDate ? parseISO(b.expiryDate) : new Date(8640000000000000);
      if (!isValid(aDate) && isValid(bDate)) return 1;
      if (isValid(aDate) && !isValid(bDate)) return -1;
      if (!isValid(aDate) && !isValid(bDate)) return 0;
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
      <GlassCard>
        <h2 className="mb-4 text-xl font-semibold text-foreground">Add New Item</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Label htmlFor="itemName" className="text-sm font-medium">Item Name</Label>
            <Input
              id="itemName"
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder="e.g., Basmati Rice or scan barcode"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="itemQuantity" className="text-sm font-medium">Quantity</Label>
            <Input
              id="itemQuantity"
              type="text"
              value={newItemQuantity}
              onChange={(e) => setNewItemQuantity(e.target.value)}
              placeholder="e.g., 1 kg, 2 cans"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="itemExpiry" className="text-sm font-medium">Expiry Date (Optional)</Label>
            <Input
              id="itemExpiry"
              type="date"
              value={newItemExpiryDate}
              onChange={(e) => setNewItemExpiryDate(e.target.value)}
              className="mt-1"
            />
          </div>
          <div className="flex space-x-2 mt-auto sm:mt-7 self-end lg:col-span-1">
            <Dialog open={isScannerOpen} onOpenChange={setIsScannerOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Scan Barcode">
                  <ScanBarcode className="h-5 w-5" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[480px] bg-background/90 backdrop-blur-md">
                <DialogHeader>
                  <DialogTitle>Scan Barcode</DialogTitle>
                </DialogHeader>
                <div className="py-4">
                  {/* Video element always in DOM as per guideline, visual state handled by classes/overlays */}
                  <video 
                    ref={videoRef} 
                    className={cn(
                        "w-full aspect-video rounded-md bg-muted",
                        // Hide if error or permission denied and we want to show only the alert
                        // For now, let it be visible but show alert on top/below
                    )} 
                    autoPlay 
                    muted 
                    playsInline // Important for iOS
                  />

                  {hasCameraPermission === null && !scannerError && (
                      <div className="flex flex-col items-center justify-center h-48">
                          <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                          <p className="text-muted-foreground">Initializing camera...</p>
                      </div>
                  )}
                  
                  {scannerError && ( // Show general scanner errors
                    <Alert variant="destructive" className="mt-2">
                      <VideoOff className="h-4 w-4" />
                      <AlertTitle>Scanner Error</AlertTitle>
                      <AlertDescription>{scannerError}</AlertDescription>
                    </Alert>
                  )}

                  {/* Specific alert for camera permission denied, shown even if video tag is present */}
                  {hasCameraPermission === false && !scannerError && (
                    <Alert variant="destructive" className="mt-2">
                      <VideoOff className="h-4 w-4" />
                      <AlertTitle>Camera Access Required</AlertTitle>
                      <AlertDescription>
                        Please allow camera access in your browser to use the barcode scanner. You may need to reset permissions in your browser settings for this site.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button onClick={handleAddItem} className="flex-grow">
              <PlusCircle className="mr-2 h-5 w-5" /> Add
            </Button>
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-semibold text-foreground">Your Pantry Items</h2>
            <Input 
                type="search"
                placeholder="Search items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="mt-2 sm:mt-0 sm:w-64"
            />
        </div>
        {filteredItems.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground">
            <PackageSearch className="mx-auto mb-2 h-12 w-12" />
            <p>Your pantry is empty or no items match your search.</p>
            <p>Add some items using the form above!</p>
          </div>
        ) : (
          <ul className="space-y-4">
            {filteredItems.map((item) => {
              const expiryStatus = getExpiryStatus(item.expiryDate);
              return (
                <li
                  key={item.id}
                  className="rounded-lg border border-border/70 bg-background/50 p-4 shadow-sm transition-all hover:shadow-md dark:bg-neutral-800/50"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-lg font-medium text-primary">{item.name}</h3>
                      <p className="text-sm text-foreground/80">Quantity: {item.quantity}</p>
                      <div className="mt-1 flex items-center text-sm">
                        {expiryStatus.icon && <expiryStatus.icon className={cn("mr-1.5 h-4 w-4", expiryStatus.color)} />}
                        <span className={cn(expiryStatus.color)}>{expiryStatus.text}</span>
                      </div>
                       <p className="text-xs text-muted-foreground mt-1">Added: {format(parseISO(item.addedDate), 'MMM dd, yyyy')}</p>
                    </div>
                    <div className="mt-3 space-x-2 sm:mt-0">
                       <Dialog>
                        <DialogTrigger asChild>
                           <Button variant="outline" size="sm" onClick={() => handleStartEdit(item)}>
                            <Edit2 className="mr-1 h-4 w-4" /> Edit
                          </Button>
                        </DialogTrigger>
                        {editingItem && editingItem.id === item.id && (
                           <DialogContent className="sm:max-w-[425px] bg-background/90 backdrop-blur-md">
                             <DialogHeader>
                               <DialogTitle>Edit {editingItem.name}</DialogTitle>
                             </DialogHeader>
                             <div className="grid gap-4 py-4">
                               <div>
                                 <Label htmlFor="editItemName" className="text-right">Name</Label>
                                 <Input id="editItemName" value={editItemName} onChange={(e) => setEditItemName(e.target.value)} className="col-span-3" />
                               </div>
                               <div>
                                 <Label htmlFor="editItemQuantity" className="text-right">Quantity</Label>
                                 <Input id="editItemQuantity" value={editItemQuantity} onChange={(e) => setEditItemQuantity(e.target.value)} className="col-span-3" />
                               </div>
                               <div>
                                 <Label htmlFor="editItemExpiry" className="text-right">Expiry Date</Label>
                                 <Input id="editItemExpiry" type="date" value={editItemExpiryDate} onChange={(e) => setEditItemExpiryDate(e.target.value)} className="col-span-3" />
                               </div>
                             </div>
                             <DialogFooter>
                               <DialogClose asChild>
                                 <Button type="button" variant="outline">Cancel</Button>
                               </DialogClose>
                               <DialogClose asChild>
                                <Button type="submit" onClick={handleSaveEdit}>Save changes</Button>
                               </DialogClose>
                             </DialogFooter>
                           </DialogContent>
                         )}
                       </Dialog>
                      <Button variant="destructive" size="sm" onClick={() => handleDeleteItem(item.id)}>
                        <Trash2 className="mr-1 h-4 w-4" /> Delete
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </GlassCard>
    </div>
  );
}

    