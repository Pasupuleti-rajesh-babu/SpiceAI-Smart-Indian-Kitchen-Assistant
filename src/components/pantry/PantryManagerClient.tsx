
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { format, differenceInDays, parseISO, isValid } from 'date-fns';
import { useToast } from "@/hooks/use-toast";
import { cn } from '@/lib/utils';
import { BrowserCodeReader, NotFoundException, type IScannerControls, type Result } from '@zxing/library';

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

  const cleanupScanner = useCallback(() => {
    if (controlsRef.current) {
      controlsRef.current.stop();
      controlsRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
    }
  }, []);

  const handleScanSuccess = useCallback((scannedValue: string) => {
    const knownItemName = barcodeDb[scannedValue];
    if (knownItemName) {
      setNewItemName(knownItemName);
      toast({ title: "Barcode Matched!", description: `Item: ${knownItemName} (from your records)` });
      setLastScannedBarcode(null); 
    } else {
      setNewItemName(scannedValue); 
      toast({ title: "New Barcode Scanned!", description: `Value: ${scannedValue}. Please enter item name.` });
      setLastScannedBarcode(scannedValue); 
    }
    setIsScannerOpen(false); // Close dialog on success
  }, [barcodeDb, setNewItemName, setIsScannerOpen, setLastScannedBarcode, toast]);
  
  const handleScanError = useCallback((error: any) => {
    if (error instanceof NotFoundException) {
      return; 
    }
    console.error("Barcode scanning error during active scan:", error);
    // Check if the dialog is still supposed to be open before setting an error.
    const dialogStillOpen = !!document.querySelector('[data-radix-dialog-content][aria-modal="true"]');
    if (isScannerOpen || dialogStillOpen) { // isScannerOpen might be stale here if setIsScannerOpen(false) was just called
        setScannerError("Error during barcode scanning. Try adjusting camera or lighting.");
    }
  }, [isScannerOpen]);


  useEffect(() => {
    const codeReader = codeReaderRef.current;
    let initTimeoutId: NodeJS.Timeout | null = null;

    if (isScannerOpen) {
      setScannerError(null);
      setHasCameraPermission(null); // Reset to loading state

      initTimeoutId = setTimeout(async () => {
        const videoElement = videoRef.current;
        if (!videoElement || !codeReader) {
          setScannerError("Video element or scanner not ready. Please try reopening the scanner.");
          setHasCameraPermission(false);
          return;
        }

        try {
          if (videoElement.srcObject) { // Clean up any old stream
            (videoElement.srcObject as MediaStream).getTracks().forEach(track => track.stop());
          }

          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
          videoElement.srcObject = stream;
          videoElement.muted = true; 
          videoElement.playsInline = true; 
          
          await videoElement.play();
          setHasCameraPermission(true);
          setScannerError(null); // Clear any previous error

          controlsRef.current = codeReader.decodeFromVideoElement(
            videoElement,
            (result, error) => {
              const dialogStillOpenCheck = !!document.querySelector('[data-radix-dialog-content][aria-modal="true"]');
               if ((!isScannerOpen && !dialogStillOpenCheck)) {
                 // If dialog was closed while scanner was active, cleanup should have been called by main effect return or onOpenChange
                 return;
               }
               if (!document.body.contains(videoElement)) { // If video element is detached
                 return;
               }

              if (result) {
                handleScanSuccess(result.getText());
              } else if (error) {
                handleScanError(error);
              }
            }
          );
        } catch (err: any) {
          console.error('Error initializing camera/scanner:', err);
          let message = 'Could not initialize camera. Ensure permissions are granted and no other app is using it.';
          if (err.name === "NotAllowedError") message = "Camera permission denied. Please enable it in your browser settings.";
          else if (err.name === "NotFoundError") message = "No camera found. Ensure a camera is connected.";
          else if (err.name === "NotReadableError") message = "Camera is currently in use by another application or there might be a hardware issue.";
          else if (err.message && typeof err.message === 'string' && err.message.length < 100) message = err.message;
          
          setScannerError(message);
          setHasCameraPermission(false);
          cleanupScanner(); // Attempt cleanup on critical init error
        }
      }, 100); // 100ms delay to allow DOM to settle
    }

    return () => { // This cleanup runs when isScannerOpen becomes false, or when component unmounts
      if (initTimeoutId) {
        clearTimeout(initTimeoutId);
      }
      cleanupScanner();
    };
  }, [isScannerOpen, handleScanSuccess, handleScanError, cleanupScanner]);


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
    setPantryItems([...pantryItems, newItem]);

    if (capturedLastScannedBarcode && currentNewItemName !== capturedLastScannedBarcode) {
      setBarcodeDb(prevDb => ({ ...prevDb, [capturedLastScannedBarcode]: currentNewItemName }));
      toast({ title: "Barcode Named", description: `Saved '${currentNewItemName}' for barcode ${capturedLastScannedBarcode}.`, variant: "default" });
    } else if (!capturedLastScannedBarcode) {
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

  useEffect(() => {
    if (lastScannedBarcode && newItemName !== lastScannedBarcode && newItemName !== barcodeDb[lastScannedBarcode]) {
        // Logic for associating name with barcode happens in handleAddItem.
    }
  }, [newItemName, lastScannedBarcode, barcodeDb]);


  if (!hasMounted) {
    return (
      <GlassCard className="space-y-8 p-6 md:p-8 flex justify-center items-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </GlassCard>
    );
  }
  
  const handleDialogOpe<ctrl63>