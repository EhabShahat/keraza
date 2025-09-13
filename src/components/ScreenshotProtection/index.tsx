'use client';

import { useScreenshotProtection } from '@/hooks/useScreenshotProtection';
import { useEffect } from 'react';

interface ScreenshotProtectionProps {
  children: React.ReactNode;
  enabled?: boolean;
  onViolation?: (type: string) => void;
  onSuspiciousActivity?: (activity: string, details?: any) => void;
  onTabSwitch?: (details: { hidden: boolean; timestamp: number }) => void;
  onDeviceDetected?: (devices: any[]) => void;
  enableTabSwitchDetection?: boolean;
  enableDeviceScanning?: boolean;
}

export default function ScreenshotProtection({ 
  children, 
  enabled = true, 
  onViolation,
  onSuspiciousActivity,
  onTabSwitch,
  onDeviceDetected,
  enableTabSwitchDetection = true,
  enableDeviceScanning = true
}: ScreenshotProtectionProps) {
  const {
    isActive,
    warningVisible,
    suspiciousActivity,
    enable,
    disable,
  } = useScreenshotProtection({
    onSuspiciousActivity: (activity, details) => {
      onSuspiciousActivity?.(activity, details);
    },
    onTabSwitch: (details) => {
      onTabSwitch?.(details);
    },
    enableTabSwitchDetection,
    enableDeviceScanning,
  });

  useEffect(() => {
    if (enabled) {
      enable();
    } else {
      disable();
    }
  }, [enabled, enable, disable]);

  return (
    <div className={enabled ? 'exam-protected' : ''}>
      {children}
      
      {/* Warning component removed - no screenshot protection warnings */}
    </div>
  );
}
