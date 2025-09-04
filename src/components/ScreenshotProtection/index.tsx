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
    isProtected,
    warningVisible,
    suspiciousActivity,
    enableProtection,
    disableProtection,
  } = useScreenshotProtection({
    onScreenshotDetected: () => {
      onViolation?.('screenshot_attempt');
    },
    onSuspiciousActivity: (activity, details) => {
      onSuspiciousActivity?.(activity, details);
    },
    onTabSwitch: (details) => {
      onTabSwitch?.(details);
    },
    onDeviceDetected: (devices) => {
      onDeviceDetected?.(devices);
    },
    enableKeyboardBlocking: true,
    enableRightClickBlocking: true,
    enableDevToolsBlocking: true,
    enableTabSwitchDetection,
    enableDeviceScanning,
  });

  useEffect(() => {
    if (enabled) {
      enableProtection();
    } else {
      disableProtection();
    }
  }, [enabled, enableProtection, disableProtection]);

  return (
    <div className={enabled ? 'exam-protected' : ''}>
      {children}
      
      {warningVisible && (
        <div className="screenshot-warning">
          <div className="mb-4">
            <svg className="w-16 h-16 mx-auto mb-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold mb-4">⚠️ Security Warning</h2>
          <p className="text-lg mb-4">{suspiciousActivity}</p>
          <p className="text-sm opacity-75">
            This action has been logged. Please continue with your exam normally.
          </p>
          <div className="mt-6 text-xs opacity-50">
            This warning will disappear automatically in a few seconds.
          </div>
        </div>
      )}
    </div>
  );
}
