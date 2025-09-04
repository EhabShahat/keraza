'use client';

import { useEffect, useState, useCallback } from 'react';

interface ScreenshotProtectionOptions {
  onSuspiciousActivity?: (activity: string, details?: any) => void;
  onTabSwitch?: (details: { hidden: boolean; timestamp: number }) => void;
  onDeviceDetected?: (devices: any[]) => void;
  enableTabSwitchDetection?: boolean;
  enableDeviceScanning?: boolean;
}

export function useScreenshotProtection(options: ScreenshotProtectionOptions = {}) {
  const [warningVisible, setWarningVisible] = useState(false);
  const [suspiciousActivity, setSuspiciousActivity] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);

  const {
    onSuspiciousActivity,
    onTabSwitch,
    onDeviceDetected,
    enableTabSwitchDetection = true,
    enableDeviceScanning = true,
  } = options;

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

  // Device scanning (if enabled)
  useEffect(() => {
    if (!enableDeviceScanning) return;

    const scanDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        onDeviceDetected?.(devices);
      } catch (error) {
        // Device scanning failed - this is normal in many browsers
      }
    };

    scanDevices();
  }, [enableDeviceScanning, onDeviceDetected]);

  const disable = useCallback(() => {
    setIsActive(false);
    setWarningVisible(false);
    setSuspiciousActivity(null);
  }, []);

  const enable = useCallback(() => {
    setIsActive(true);
  }, []);

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

  // Advanced mobile screenshot detection methods
  const detectMobileScreenshot = useCallback(() => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                     'ontouchstart' in window;
    
    if (!isMobile) return;

    // Method 1: Aggressive screenshot detection via multiple signals
    let lastScreenshotTime = 0;
    
    const detectScreenshotAttempt = () => {
      const now = Date.now();
      if (now - lastScreenshotTime < 5000) return; // Avoid spam
      
      showWarning('⚠️ Mobile screenshot detected! This activity is being logged.');
      onScreenshotDetected?.();
      lastScreenshotTime = now;
      
      // Log the violation with detailed info
      onSuspiciousActivity?.('mobile_screenshot_attempt', {
        timestamp: now,
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        screenSize: `${screen.width}x${screen.height}`,
        viewportSize: `${window.innerWidth}x${window.innerHeight}`
      });
    };

    // Method 2: Detect screenshot via clipboard monitoring
    const monitorClipboard = async () => {
      if (navigator.clipboard && navigator.clipboard.read) {
        try {
          const clipboardItems = await navigator.clipboard.read();
          for (const item of clipboardItems) {
            if (item.types.includes('image/png') || item.types.includes('image/jpeg')) {
              showWarning('Screenshot detected in clipboard!');
              onScreenshotDetected?.();
              
              // Clear clipboard
              try {
                await navigator.clipboard.writeText('');
              } catch (e) {
                // Ignore clipboard clear errors
              }
            }
          }
        } catch (e) {
          // Ignore permission errors
        }
      }
    };

    // Method 3: Detect rapid focus changes (screenshot notifications)
    let focusChangeCount = 0;
    let lastFocusChange = Date.now();
    
    const handleFocusChange = () => {
      const now = Date.now();
      if (now - lastFocusChange < 300) {
        focusChangeCount++;
        if (focusChangeCount >= 3) {
          showWarning('Mobile screenshot detected!');
          onScreenshotDetected?.();
          focusChangeCount = 0;
        }
      } else {
        focusChangeCount = 0;
      }
      lastFocusChange = now;
    };

    // Start monitoring with multiple detection methods
    const clipboardInterval = setInterval(monitorClipboard, 1000);
    
    // Monitor for various screenshot indicators
    window.addEventListener('focus', handleFocusChange);
    window.addEventListener('blur', handleFocusChange);
    document.addEventListener('visibilitychange', handleFocusChange);
    
    // Additional mobile-specific detection
    document.addEventListener('touchstart', detectScreenshotAttempt, { passive: true });
    document.addEventListener('touchend', detectScreenshotAttempt, { passive: true });

    return () => {
      clearInterval(clipboardInterval);
      window.removeEventListener('focus', handleFocusChange);
      window.removeEventListener('blur', handleFocusChange);
      document.removeEventListener('visibilitychange', handleFocusChange);
      document.removeEventListener('touchstart', detectScreenshotAttempt);
      document.removeEventListener('touchend', detectScreenshotAttempt);
    };
  }, [showWarning, onScreenshotDetected]);

  // Detect screen recording and screenshot via Page Visibility API changes
  const detectScreenCapture = useCallback(() => {
    let lastVisibilityChange = Date.now();
    let suspiciousActivityCount = 0;

    const handleVisibilityChange = () => {
      const now = Date.now();
      const timeSinceLastChange = now - lastVisibilityChange;
      
      // Rapid visibility changes might indicate screenshot/recording
      if (timeSinceLastChange < 100) {
        suspiciousActivityCount++;
        
        if (suspiciousActivityCount > 3) {
          showWarning('Suspicious screen capture activity detected!');
          onScreenshotDetected?.();
          suspiciousActivityCount = 0; // Reset counter
        }
      } else {
        suspiciousActivityCount = Math.max(0, suspiciousActivityCount - 1);
      }
      
      lastVisibilityChange = now;
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [showWarning, onScreenshotDetected]);

  // Detect iOS screenshot gesture (home + power button) - DISABLED to prevent false positives
  const detectIOSScreenshot = useCallback(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (!isIOS) return;

    // Disabled overly sensitive touch detection that triggers on normal gestures
    // Only keep clipboard monitoring for actual screenshot detection
    let lastScreenshotCheck = 0;

    const checkClipboard = async () => {
      const now = Date.now();
      if (now - lastScreenshotCheck < 2000) return; // Cooldown period
      
      try {
        if (navigator.clipboard && navigator.clipboard.read) {
          const clipboardItems = await navigator.clipboard.read();
          for (const item of clipboardItems) {
            if (item.types.includes('image/png') || item.types.includes('image/jpeg')) {
              showWarning('Screenshot detected in clipboard!');
              onScreenshotDetected?.();
              lastScreenshotCheck = now;
              break;
            }
          }
        }
      } catch (e) {
        // Clipboard access denied - this is normal
      }
    };

    // Check clipboard periodically instead of on every touch
    const intervalId = setInterval(checkClipboard, 3000);

    const handleTouchStart = () => {
      // Removed aggressive touch detection
    };

    const handleTouchEnd = () => {
      // Removed aggressive touch detection
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [showWarning, onScreenshotDetected]);

  // Enhanced mobile screenshot protection with multiple layers
  const addMobileScreenshotCSS = useCallback(() => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                     'ontouchstart' in window;
    
    if (!isMobile) return;

    // Create style element for mobile protection
    const style = document.createElement('style');
    style.id = 'mobile-screenshot-protection';
    style.textContent = `
      /* Prevent screenshot on Android - FLAG_SECURE simulation */
      html, body {
        -webkit-touch-callout: none !important;
        -webkit-user-select: none !important;
        -khtml-user-select: none !important;
        -moz-user-select: none !important;
        -ms-user-select: none !important;
        user-select: none !important;
        -webkit-tap-highlight-color: transparent !important;
        -webkit-appearance: none !important;
        background-attachment: fixed !important;
      }
      
      /* Prevent screenshot capture of content */
      * {
        -webkit-touch-callout: none !important;
        -webkit-user-select: none !important;
        user-select: none !important;
        -webkit-appearance: none !important;
        -webkit-transform: translateZ(0) !important;
        transform: translateZ(0) !important;
        will-change: transform !important;
      }
      
      /* Block screenshot sharing and context menus */
      img, video, canvas, svg {
        -webkit-touch-callout: none !important;
        -webkit-user-select: none !important;
        user-select: none !important;
        pointer-events: none !important;
        -webkit-appearance: none !important;
        -webkit-transform: translateZ(0) !important;
        transform: translateZ(0) !important;
      }
      
      /* Anti-screenshot overlay technique */
      body::before {
        content: '';
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: transparent;
        z-index: 9999;
        pointer-events: none;
        mix-blend-mode: difference;
        opacity: 0.01;
      }
      
      /* Dynamic content protection */
      .exam-content {
        -webkit-transform: translateZ(0) !important;
        transform: translateZ(0) !important;
        will-change: transform !important;
        backface-visibility: hidden !important;
        -webkit-backface-visibility: hidden !important;
      }
      
      /* Hide content during potential screenshot */
      @media screen and (max-width: 768px) {
        .screenshot-blur {
          filter: blur(20px) brightness(0.3) !important;
          opacity: 0.1 !important;
          transition: all 0.05s ease !important;
          -webkit-transform: scale(0.8) !important;
          transform: scale(0.8) !important;
        }
        
        .screenshot-hide {
          visibility: hidden !important;
          opacity: 0 !important;
          display: none !important;
        }
      }
    `;
    
    document.head.appendChild(style);
    
    // Add exam-content class to main content areas
    const contentElements = document.querySelectorAll('main, .exam-container, [data-exam-content]');
    contentElements.forEach(el => el.classList.add('exam-content'));
    
    return () => {
      const existingStyle = document.getElementById('mobile-screenshot-protection');
      if (existingStyle) {
        existingStyle.remove();
      }
      contentElements.forEach(el => el.classList.remove('exam-content'));
    };
  }, []);

  // Detect Android screenshot notification
  const detectAndroidScreenshot = useCallback(() => {
    const isAndroid = /Android/i.test(navigator.userAgent);
    if (!isAndroid) return;

    // Monitor for rapid page visibility changes that might indicate screenshot
    let visibilityChangeCount = 0;
    let lastChangeTime = Date.now();

    const handleAndroidVisibilityChange = () => {
      const now = Date.now();
      const timeDiff = now - lastChangeTime;
      
      if (timeDiff < 500) { // Rapid changes within 500ms
        visibilityChangeCount++;
        
        if (visibilityChangeCount >= 2) {
          showWarning('Android screenshot detected!');
          onScreenshotDetected?.();
          
          // Temporarily hide/blur content
          document.body.classList.add('screenshot-blur');
          const contentElements = document.querySelectorAll('.exam-content, main, [data-exam-content]');
          contentElements.forEach(el => el.classList.add('screenshot-hide'));
          
          setTimeout(() => {
            document.body.classList.remove('screenshot-blur');
            contentElements.forEach(el => el.classList.remove('screenshot-hide'));
          }, 3000);
          
          visibilityChangeCount = 0;
        }
      } else {
        visibilityChangeCount = 0;
      }
      
      lastChangeTime = now;
    };

    document.addEventListener('visibilitychange', handleAndroidVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleAndroidVisibilityChange);
    };
  }, [showWarning, onScreenshotDetected]);

  // Detect screen recording via media devices
  const detectScreenRecording = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      // Monitor for new video devices that might indicate screen recording
      const checkForRecording = async () => {
        try {
          const currentDevices = await navigator.mediaDevices.enumerateDevices();
          const currentVideoDevices = currentDevices.filter(device => device.kind === 'videoinput');
          
          if (currentVideoDevices.length > videoDevices.length) {
            showWarning('Screen recording device detected!');
            onScreenshotDetected?.();
          }
        } catch (error) {
          // Silently handle permission errors
        }
      };

      const recordingCheckInterval = setInterval(checkForRecording, 5000);
      
      return () => {
        clearInterval(recordingCheckInterval);
      };
    } catch (error) {
      // Silently handle errors
    }
  }, [showWarning, onScreenshotDetected]);

  // Window focus/blur handlers
  const handleWindowBlur = useCallback(() => {
    if (enableTabSwitchDetection) {
      onTabSwitch?.({ hidden: true, timestamp: Date.now() });
      showWarning('Window lost focus during exam!');
    }
  }, [enableTabSwitchDetection, onTabSwitch, showWarning]);

  const handleWindowFocus = useCallback(() => {
    if (enableTabSwitchDetection) {
      onTabSwitch?.({ hidden: false, timestamp: Date.now() });
    }
  }, [enableTabSwitchDetection, onTabSwitch]);

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

  // Setup event listeners
  useEffect(() => {
    if (!isActive) return;

    const cleanupFunctions: (() => void)[] = [];

    // Keyboard blocking
    if (enableKeyboardBlocking) {
      document.addEventListener('keydown', handleKeyDown);
      cleanupFunctions.push(() => document.removeEventListener('keydown', handleKeyDown));
    }

    // Right-click blocking
    if (enableRightClickBlocking) {
      document.addEventListener('contextmenu', handleRightClick);
      cleanupFunctions.push(() => document.removeEventListener('contextmenu', handleRightClick));
    }

    // Text selection blocking
    document.addEventListener('selectstart', handleSelectStart);
    document.addEventListener('dragstart', handleDragStart);
    cleanupFunctions.push(() => {
      document.removeEventListener('selectstart', handleSelectStart);
      document.removeEventListener('dragstart', handleDragStart);
    });

    // Developer tools detection
    const devToolsInterval = setInterval(detectDevTools, 1000);
    cleanupFunctions.push(() => clearInterval(devToolsInterval));

    // Mobile screenshot detection
    const mobileCleanup = detectMobileScreenshot();
    if (mobileCleanup) cleanupFunctions.push(mobileCleanup);

    // Screen capture detection
    const captureCleanup = detectScreenCapture();
    if (captureCleanup) cleanupFunctions.push(captureCleanup);

    // iOS screenshot detection
    const iosCleanup = detectIOSScreenshot();
    if (iosCleanup) cleanupFunctions.push(iosCleanup);

    // CSS-based mobile protection
    const cssCleanup = addMobileScreenshotCSS();
    if (cssCleanup) cleanupFunctions.push(cssCleanup);

    // Android screenshot detection
    const androidCleanup = detectAndroidScreenshot();
    if (androidCleanup) cleanupFunctions.push(androidCleanup);

    // Screen recording detection
    detectScreenRecording().then(recordingCleanup => {
      if (recordingCleanup) cleanupFunctions.push(recordingCleanup);
    });

    // Tab switching detection
    if (enableTabSwitchDetection) {
      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('blur', handleWindowBlur);
      window.addEventListener('focus', handleWindowFocus);
      cleanupFunctions.push(() => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('blur', handleWindowBlur);
        window.removeEventListener('focus', handleWindowFocus);
      });
    }

    // Device scanning
    if (enableDeviceScanning) {
      scanForDevices();
      const deviceScanInterval = setInterval(scanForDevices, 30000); // Scan every 30 seconds
      cleanupFunctions.push(() => clearInterval(deviceScanInterval));
    }

    return () => {
      cleanupFunctions.forEach(cleanup => cleanup());
    };
  }, [
    isActive,
    enableKeyboardBlocking,
    enableRightClickBlocking,
    enableTabSwitchDetection,
    enableDeviceScanning,
    handleKeyDown,
    handleRightClick,
    handleSelectStart,
    handleDragStart,
    detectDevTools,
    detectMobileScreenshot,
    detectScreenCapture,
    detectIOSScreenshot,
    handleVisibilityChange,
    handleWindowBlur,
    handleWindowFocus,
    scanForDevices
  ]);

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
      (navigator as any).usb.addEventListener('connect', scanForDevices);
      (navigator as any).usb.addEventListener('disconnect', scanForDevices);
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
        (navigator as any).usb.removeEventListener('connect', scanForDevices);
        (navigator as any).usb.removeEventListener('disconnect', scanForDevices);
      }
      
      // Restore text selection
      document.body.style.userSelect = '';
      document.body.style.webkitUserSelect = '';
    };
  }, [handleKeyDown, handleRightClick, handleSelectStart, handleDragStart, handleVisibilityChange, detectDevTools, scanForDevices]);

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
