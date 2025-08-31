"use client";

import { useEffect } from "react";

/**
 * Component that clears all browser storage on app load
 * This ensures users get a completely fresh experience every time
 */
export default function StorageCleaner() {
  useEffect(() => {
    // ALWAYS clear all storage on app load for students
    try {
      const currentPath = window.location.pathname;
      
      // Don't clear storage for admin pages to preserve admin sessions
      if (currentPath.startsWith('/admin')) {
        return;
      }

      // AUTOMATIC CLEARING: Always clear everything for students
      // This ensures students get a completely fresh experience every single time
      
      // Clear localStorage completely
      localStorage.clear();
      
      // Clear sessionStorage completely
      sessionStorage.clear();
      
      // Clear all cookies
      clearAllCookies();
      
      // Clear any cached data
      if ('caches' in window) {
        caches.keys().then(names => {
          names.forEach(name => {
            caches.delete(name);
          });
        }).catch(error => {
          console.warn('Could not clear caches:', error);
        });
      }

      // Clear IndexedDB if available (more thorough clearing)
      if ('indexedDB' in window) {
        try {
          // Clear common IndexedDB databases that might exist
          const commonDBNames = ['localforage', 'keyval-store', 'exam-data', 'user-data'];
          commonDBNames.forEach(dbName => {
            const deleteReq = indexedDB.deleteDatabase(dbName);
            deleteReq.onerror = () => {
              // Silently handle errors - database might not exist
            };
          });
        } catch (error) {
          // Silently handle IndexedDB errors
        }
      }

      console.log('🧹 AUTOMATIC: All student storage cleared for fresh experience');
    } catch (error) {
      // Silently handle any storage errors (e.g., in private browsing)
      console.warn('Could not clear storage:', error);
    }
  }, []);

  // This component doesn't render anything
  return null;
}

/**
 * Function to clear all cookies
 * Note: Due to browser security, we can only clear cookies for the current domain
 */
function clearAllCookies() {
  try {
    // Get all cookies
    const cookies = document.cookie.split(";");
    
    // Clear each cookie
    cookies.forEach(cookie => {
      const eqPos = cookie.indexOf("=");
      const name = eqPos > -1 ? cookie.substring(0, eqPos).trim() : cookie.trim();
      
      if (name) {
        // Clear cookie for current path
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
        
        // Clear cookie for root domain
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${window.location.hostname}`;
        
        // Clear cookie for parent domain (if subdomain)
        const domain = window.location.hostname;
        const parts = domain.split('.');
        if (parts.length > 2) {
          const parentDomain = '.' + parts.slice(-2).join('.');
          document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${parentDomain}`;
        }
      }
    });
  } catch (error) {
    console.warn('Could not clear cookies:', error);
  }
}

/**
 * More aggressive cleaner that clears everything including admin sessions
 * Use this if you want to clear ALL storage regardless of page
 */
export function AggressiveStorageCleaner() {
  useEffect(() => {
    try {
      // Clear everything
      localStorage.clear();
      sessionStorage.clear();
      clearAllCookies();
      
      // Clear IndexedDB if available
      if ('indexedDB' in window) {
        // This is more complex and might require specific database names
        // For now, we'll just log that it exists
        console.log('IndexedDB detected - manual clearing may be needed');
      }
      
      // Clear Web SQL (deprecated but still might exist)
      if ('openDatabase' in window) {
        console.log('Web SQL detected - manual clearing may be needed');
      }
      
      console.log('🧹 AGGRESSIVE: All storage cleared');
    } catch (error) {
      console.warn('Could not perform aggressive clearing:', error);
    }
  }, []);

  return null;
}

/**
 * Utility function to manually clear storage (can be called from anywhere)
 */
export function clearAllStorage() {
  try {
    localStorage.clear();
    sessionStorage.clear();
    clearAllCookies();
    
    // Clear caches
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => {
          caches.delete(name);
        });
      });
    }
    
    console.log('🧹 Manual storage clear completed');
    return true;
  } catch (error) {
    console.error('Failed to clear storage:', error);
    return false;
  }
}