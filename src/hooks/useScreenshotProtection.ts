'use client';

import { useEffect, useState, useCallback } from 'react';

interface ScreenshotProtectionOptions {
  onScreenshotDetected?: () => void;
  onSuspiciousActivity?: (activity: string, details?: any) => void;
  onTabSwitch?: (details: { hidden: boolean; timestamp: number }) => void;
  onDeviceDetected?: (devices: any[]) => void;
  enableKeyboardBlocking?: boolean;
  enableRightClickBlocking?: boolean;
  enableDevToolsBlocking?: boolean;
  enableTabSwitchDetection?: boolean;
  enableDeviceScanning?: boolean;
}

export function useScreenshotProtection(options: ScreenshotProtectionOptions = {}) {
  const [isProtected, setIsProtected] = useState(false);
  const [warningVisible, setWarningVisible] = useState(false);
  const [suspiciousActivity, setSuspiciousActivity] = useState<string | null>(null);

  const {
    onScreenshotDetected,
    onSuspiciousActivity,
    onTabSwitch,
    onDeviceDetected,
    enableKeyboardBlocking = true,
    enableRightClickBlocking = true,
    enableDevToolsBlocking = true,
    enableTabSwitchDetection = true,
    enableDeviceScanning = true,
  } = options;

  const showWarning = useCallback((message: string) => {
    setSuspiciousActivity(message);
    setWarningVisible(true);
    onSuspiciousActivity?.(message);
    
    // Auto-hide warning after 5 seconds
    setTimeout(() => {
      setWarningVisible(false);
      setSuspiciousActivity(null);
    }, 5000);
  }, [onSuspiciousActivity]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enableKeyboardBlocking) return;

    // Block common screenshot shortcuts
    const blockedKeys = [
      // Windows screenshot shortcuts
      { key: 'PrintScreen', message: 'Screenshot attempt detected!' },
      { key: 'F12', message: 'Developer tools blocked!' },
      // Mac screenshot shortcuts
      { key: 's', meta: true, shift: true, message: 'Screenshot attempt detected!' },
      { key: '3', meta: true, shift: true, message: 'Screenshot attempt detected!' },
      { key: '4', meta: true, shift: true, message: 'Screenshot attempt detected!' },
      { key: '5', meta: true, shift: true, message: 'Screenshot attempt detected!' },
      // Developer tools shortcuts
      { key: 'F12', message: 'Developer tools blocked!' },
      { key: 'i', ctrl: true, shift: true, message: 'Developer tools blocked!' },
      { key: 'j', ctrl: true, shift: true, message: 'Developer tools blocked!' },
      { key: 'c', ctrl: true, shift: true, message: 'Developer tools blocked!' },
      { key: 'u', ctrl: true, message: 'View source blocked!' },
      // Mac developer tools
      { key: 'i', meta: true, alt: true, message: 'Developer tools blocked!' },
      { key: 'j', meta: true, alt: true, message: 'Developer tools blocked!' },
      { key: 'c', meta: true, alt: true, message: 'Developer tools blocked!' },
      { key: 'u', meta: true, alt: true, message: 'View source blocked!' },
    ];

    for (const blocked of blockedKeys) {
      const keyMatch = e.key === blocked.key || e.code === blocked.key;
      const metaMatch = blocked.meta ? e.metaKey : !e.metaKey;
      const ctrlMatch = blocked.ctrl ? e.ctrlKey : !e.ctrlKey;
      const shiftMatch = blocked.shift ? e.shiftKey : !e.shiftKey;
      const altMatch = blocked.alt ? e.altKey : !e.altKey;

      if (keyMatch && metaMatch && ctrlMatch && shiftMatch && altMatch) {
        e.preventDefault();
        e.stopPropagation();
        showWarning(blocked.message);
        onScreenshotDetected?.();
        return false;
      }
    }
  }, [enableKeyboardBlocking, showWarning, onScreenshotDetected]);

  const handleRightClick = useCallback((e: MouseEvent) => {
    if (!enableRightClickBlocking) return;
    
    e.preventDefault();
    e.stopPropagation();
    showWarning('Right-click is disabled during the exam!');
    return false;
  }, [enableRightClickBlocking, showWarning]);

  const handleSelectStart = useCallback((e: Event) => {
    e.preventDefault();
    return false;
  }, []);

  const handleDragStart = useCallback((e: DragEvent) => {
    e.preventDefault();
    return false;
  }, []);

  // Detect developer tools opening
  const detectDevTools = useCallback(() => {
    if (!enableDevToolsBlocking) return;

    // Skip detection on mobile devices
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                     window.innerWidth <= 768 || 
                     'ontouchstart' in window;
    
    if (isMobile) return;

    const threshold = 160;
    const widthThreshold = window.outerWidth - window.innerWidth > threshold;
    const heightThreshold = window.outerHeight - window.innerHeight > threshold;
    
    if (widthThreshold || heightThreshold) {
      showWarning('Developer tools detected! Please close them to continue.');
      onScreenshotDetected?.();
    }
  }, [enableDevToolsBlocking, showWarning, onScreenshotDetected]);

  // Enhanced tab switching detection
  const handleVisibilityChange = useCallback(() => {
    const timestamp = Date.now();
    const isHidden = document.hidden;
    
    if (enableTabSwitchDetection) {
      onTabSwitch?.({ hidden: isHidden, timestamp });
      
      if (isHidden) {
        showWarning('Tab switching detected during exam!');
        onSuspiciousActivity?.('tab_switch', { 
          action: 'tab_hidden', 
          timestamp,
          url: window.location.href 
        });
      } else {
        onSuspiciousActivity?.('tab_focus', { 
          action: 'tab_visible', 
          timestamp,
          url: window.location.href 
        });
      }
    }
  }, [showWarning, onSuspiciousActivity, onTabSwitch, enableTabSwitchDetection]);

  // Bluetooth and WiFi device scanning
  const scanForDevices = useCallback(async () => {
    if (!enableDeviceScanning) return;

    try {
      const devices: any[] = [];
      
      // Bluetooth scanning (if supported)
      if ('bluetooth' in navigator) {
        try {
          const bluetoothDevices = await (navigator as any).bluetooth.getDevices();
          devices.push(...bluetoothDevices.map((device: any) => ({
            type: 'bluetooth',
            name: device.name || 'Unknown Bluetooth Device',
            id: device.id,
            connected: device.gatt?.connected || false,
            timestamp: Date.now()
          })));
        } catch (e) {
          // Bluetooth not available or permission denied
        }
      }

      // Network interfaces scanning (limited in browsers)
      if ('connection' in navigator) {
        const connection = (navigator as any).connection;
        devices.push({
          type: 'network',
          effectiveType: connection.effectiveType,
          downlink: connection.downlink,
          rtt: connection.rtt,
          saveData: connection.saveData,
          timestamp: Date.now()
        });
      }

      // USB device detection (if supported)
      if ('usb' in navigator) {
        try {
          const usbDevices = await (navigator as any).usb.getDevices();
          devices.push(...usbDevices.map((device: any) => ({
            type: 'usb',
            vendorId: device.vendorId,
            productId: device.productId,
            productName: device.productName || 'Unknown USB Device',
            timestamp: Date.now()
          })));
        } catch (e) {
          // USB not available or permission denied
        }
      }

      if (devices.length > 0) {
        onDeviceDetected?.(devices);
        onSuspiciousActivity?.('devices_detected', { devices, count: devices.length });
      }
    } catch (error) {
      console.warn('Device scanning failed:', error);
    }
  }, [enableDeviceScanning, onDeviceDetected, onSuspiciousActivity]);

  // Monitor for new device connections
  const handleDeviceChange = useCallback(() => {
    if (enableDeviceScanning) {
      setTimeout(scanForDevices, 1000); // Delay to allow device enumeration
    }
  }, [enableDeviceScanning, scanForDevices]);

  const enableProtection = useCallback(() => {
    setIsProtected(true);
    
    // Add event listeners
    document.addEventListener('keydown', handleKeyDown, { capture: true });
    document.addEventListener('contextmenu', handleRightClick, { capture: true });
    document.addEventListener('selectstart', handleSelectStart, { capture: true });
    document.addEventListener('dragstart', handleDragStart, { capture: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Monitor for developer tools
    const devToolsInterval = setInterval(detectDevTools, 1000);
    
    // Initial device scan
    scanForDevices();
    
    // Monitor for device changes
    if ('usb' in navigator) {
      (navigator as any).usb.addEventListener('connect', handleDeviceChange);
      (navigator as any).usb.addEventListener('disconnect', handleDeviceChange);
    }
    
    // Periodic device scanning
    const deviceScanInterval = setInterval(scanForDevices, 30000); // Every 30 seconds
    
    // Disable text selection
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';
    
    return () => {
      clearInterval(devToolsInterval);
      clearInterval(deviceScanInterval);
      
      document.removeEventListener('keydown', handleKeyDown, { capture: true });
      document.removeEventListener('contextmenu', handleRightClick, { capture: true });
      document.removeEventListener('selectstart', handleSelectStart, { capture: true });
      document.removeEventListener('dragstart', handleDragStart, { capture: true });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      if ('usb' in navigator) {
        (navigator as any).usb.removeEventListener('connect', handleDeviceChange);
        (navigator as any).usb.removeEventListener('disconnect', handleDeviceChange);
      }
      
      // Restore text selection
      document.body.style.userSelect = '';
      document.body.style.webkitUserSelect = '';
    };
  }, [handleKeyDown, handleRightClick, handleSelectStart, handleDragStart, handleVisibilityChange, detectDevTools, scanForDevices, handleDeviceChange]);

  const disableProtection = useCallback(() => {
    setIsProtected(false);
    setWarningVisible(false);
    setSuspiciousActivity(null);
  }, []);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    
    if (isProtected) {
      cleanup = enableProtection();
    }
    
    return cleanup;
  }, [isProtected, enableProtection]);

  return {
    isProtected,
    warningVisible,
    suspiciousActivity,
    enableProtection: () => setIsProtected(true),
    disableProtection,
    showWarning,
  };
}
