'use client';

import { useState, useEffect, useCallback } from 'react';

interface ScreenshotProtectionOptions {
  enableTabSwitchDetection?: boolean;
  enableDeviceScanning?: boolean;
  onTabSwitch?: (data: { hidden: boolean; timestamp: number }) => void;
  onSuspiciousActivity?: (activity: string, details?: any) => void;
}

export function useScreenshotProtection({
  enableTabSwitchDetection = true,
  enableDeviceScanning = false,
  onTabSwitch,
  onSuspiciousActivity
}: ScreenshotProtectionOptions = {}) {
  const [isActive, setIsActive] = useState(true);
  const [warningVisible, setWarningVisible] = useState(false);
  const [suspiciousActivity, setSuspiciousActivity] = useState<string[]>([]);

  const disable = useCallback(() => {
    setIsActive(false);
  }, []);

  const enable = useCallback(() => {
    setIsActive(true);
  }, []);

  // Device scanning functionality
  useEffect(() => {
    if (!enableDeviceScanning || !isActive) return;

    let scanInterval: NodeJS.Timeout;
    
    const scanForDevices = async () => {
      try {
        // Check for connected media devices
        if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoDevices = devices.filter(device => device.kind === 'videoinput');
          
          if (videoDevices.length > 1) {
            onSuspiciousActivity?.('Multiple video devices detected', { 
              deviceCount: videoDevices.length,
              timestamp: Date.now()
            });
          }
        }
      } catch (error) {
        // Silently handle permission errors
      }
    };

    // Scan every 30 seconds
    scanInterval = setInterval(scanForDevices, 30000);
    
    // Initial scan
    scanForDevices();

    return () => {
      if (scanInterval) {
        clearInterval(scanInterval);
      }
    };
  }, [enableDeviceScanning, isActive, onSuspiciousActivity]);

  // Tab switch detection only (no screenshot protection)
  useEffect(() => {
    if (!enableTabSwitchDetection) return;

    const handleVisibilityChange = () => {
      const isHidden = document.hidden;
      const timestamp = Date.now();
      
      onTabSwitch?.({ hidden: isHidden, timestamp });
      
      if (isHidden) {
        onSuspiciousActivity?.('Tab switched away from exam', { timestamp });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enableTabSwitchDetection, onTabSwitch, onSuspiciousActivity]);

  return {
    isActive,
    warningVisible,
    suspiciousActivity,
    disable,
    enable,
    // Removed all screenshot protection functionality
    WarningComponent: null
  };
}
