"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Ultra-aggressive storage cleaner specifically for students
 * Clears ALL storage on every page navigation to ensure completely fresh experience
 */
export default function StudentStorageCleaner() {
  const pathname = usePathname();

  useEffect(() => {
    // Skip admin pages
    if (pathname?.startsWith('/admin')) {
      return;
    }

    // ULTRA-AGGRESSIVE CLEARING: Clear everything on every page change
    const clearEverything = () => {
      try {
        // Clear localStorage
        localStorage.clear();
        
        // Clear sessionStorage
        sessionStorage.clear();
        
        // Clear all cookies
        document.cookie.split(";").forEach(cookie => {
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
        
        // Clear caches
        if ('caches' in window) {
          caches.keys().then(names => {
            names.forEach(name => {
              caches.delete(name);
            });
          }).catch(() => {
            // Silently handle cache clearing errors
          });
        }
        
        // Clear IndexedDB databases
        if ('indexedDB' in window) {
          const commonDBNames = [
            'localforage',
            'keyval-store', 
            'exam-data',
            'user-data',
            'app-data',
            'student-data',
            'attempt-data',
            'question-data'
          ];
          
          commonDBNames.forEach(dbName => {
            try {
              const deleteReq = indexedDB.deleteDatabase(dbName);
              deleteReq.onerror = () => {
                // Silently handle errors - database might not exist
              };
            } catch (error) {
              // Silently handle IndexedDB errors
            }
          });
        }
        
        // Clear WebSQL (if it exists - deprecated but some browsers still have it)
        if ('openDatabase' in window) {
          try {
            // @ts-ignore - WebSQL is deprecated but might exist
            const db = window.openDatabase('', '', '', '');
            if (db) {
              db.transaction((tx: any) => {
                tx.executeSql('DROP TABLE IF EXISTS data');
              });
            }
          } catch (error) {
            // Silently handle WebSQL errors
          }
        }
        
        console.log(`🧹 STUDENT: All storage cleared on navigation to ${pathname}`);
      } catch (error) {
        console.warn('Could not clear student storage:', error);
      }
    };

    // Clear immediately
    clearEverything();
    
    // Also clear after a short delay to catch any storage that might be set after initial load
    const timeoutId = setTimeout(clearEverything, 100);
    
    return () => {
      clearTimeout(timeoutId);
    };
  }, [pathname]);

  // This component doesn't render anything
  return null;
}

/**
 * Hook to manually trigger storage clearing
 */
export function useClearStudentStorage() {
  return () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      
      // Clear cookies
      document.cookie.split(";").forEach(cookie => {
        const eqPos = cookie.indexOf("=");
        const name = eqPos > -1 ? cookie.substring(0, eqPos).trim() : cookie.trim();
        
        if (name) {
          document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
          document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${window.location.hostname}`;
        }
      });
      
      console.log('🧹 Manual student storage clear completed');
      return true;
    } catch (error) {
      console.error('Failed to clear student storage:', error);
      return false;
    }
  };
}