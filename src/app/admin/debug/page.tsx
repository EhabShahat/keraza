"use client";

import { useState, useEffect } from "react";
import { clearAllStorage } from "@/components/StorageCleaner";

interface StorageItem {
  key: string;
  value: string;
  size: number;
}

interface StorageInfo {
  localStorage: {
    available: boolean;
    items: StorageItem[];
    totalSize: number;
  };
  sessionStorage: {
    available: boolean;
    items: StorageItem[];
    totalSize: number;
  };
  cookies: {
    available: boolean;
    items: { key: string; value: string }[];
  };
  browser: {
    userAgent: string;
    cookieEnabled: boolean;
    onLine: boolean;
    language: string;
    platform: string;
  };
}

export default function DebugPage() {
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setIsClient(true);
    if (typeof window !== 'undefined') {
      updateStorageInfo();
    }
  }, []);

  const updateStorageInfo = () => {
    if (typeof window === 'undefined') return;

    try {
      const info: StorageInfo = {
        localStorage: {
          available: typeof Storage !== 'undefined',
          items: Object.keys(localStorage).map(key => ({
            key,
            value: localStorage.getItem(key) || '',
            size: new Blob([localStorage.getItem(key) || '']).size
          })),
          totalSize: 0
        },
        sessionStorage: {
          available: typeof sessionStorage !== 'undefined',
          items: Object.keys(sessionStorage).map(key => ({
            key,
            value: sessionStorage.getItem(key) || '',
            size: new Blob([sessionStorage.getItem(key) || '']).size
          })),
          totalSize: 0
        },
        cookies: {
          available: typeof document !== 'undefined',
          items: document.cookie.split(';').map(cookie => {
            const [key, ...valueParts] = cookie.trim().split('=');
            return {
              key: key || '',
              value: valueParts.join('=') || ''
            };
          }).filter(item => item.key)
        },
        browser: {
          userAgent: navigator.userAgent,
          cookieEnabled: navigator.cookieEnabled,
          onLine: navigator.onLine,
          language: navigator.language,
          platform: navigator.platform
        }
      };

      // Calculate total sizes
      info.localStorage.totalSize = info.localStorage.items.reduce((total, item) => total + item.size, 0);
      info.sessionStorage.totalSize = info.sessionStorage.items.reduce((total, item) => total + item.size, 0);

      setStorageInfo(info);
    } catch (error) {
      console.error('Error getting storage info:', error);
      setMessage({ type: 'error', text: `Error getting storage info: ${error}` });
    }
  };

  const clearAllStorageHandler = () => {
    if (confirm('This will clear ALL localStorage, sessionStorage, and cookies. Continue?')) {
      try {
        const success = clearAllStorage();
        if (success) {
          updateStorageInfo();
          setMessage({ type: 'success', text: 'All storage cleared successfully' });
        } else {
          setMessage({ type: 'error', text: 'Failed to clear storage' });
        }
      } catch (error) {
        setMessage({ type: 'error', text: `Failed to clear storage: ${error}` });
      }
    }
  };

  const clearSpecificItem = (type: 'localStorage' | 'sessionStorage', key: string) => {
    try {
      if (type === 'localStorage') {
        localStorage.removeItem(key);
      } else {
        sessionStorage.removeItem(key);
      }
      updateStorageInfo();
      setMessage({ type: 'success', text: `Removed ${key} from ${type}` });
    } catch (error) {
      setMessage({ type: 'error', text: `Failed to remove ${key}: ${error}` });
    }
  };

  const exportStorageData = () => {
    const data = JSON.stringify(storageInfo, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `storage-debug-${new Date().toISOString().slice(0, 19)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setMessage({ type: 'success', text: 'Storage data exported' });
  };

  const forceStudentClear = () => {
    if (confirm('This will force clear all student storage on their next page load. Continue?')) {
      localStorage.setItem('force_clear_student_storage', 'true');
      setMessage({ type: 'success', text: 'Student storage will be cleared on their next page load' });
    }
  };

  if (!isClient) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">🔍 Storage Debug Tool</h1>
            <p className="text-gray-600 mt-1">
              Debug localStorage, sessionStorage, cookies, and browser issues
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={updateStorageInfo}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              🔄 Refresh
            </button>
            <button
              onClick={exportStorageData}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            >
              📥 Export
            </button>
            <button
              onClick={forceStudentClear}
              className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors"
            >
              🧹 Force Student Clear
            </button>
            <button
              onClick={clearAllStorageHandler}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              🗑️ Clear All
            </button>
          </div>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-lg ${
          message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.text}
          <button
            onClick={() => setMessage(null)}
            className="ml-2 text-sm underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">⚡ Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h3 className="font-medium text-blue-900 mb-2">🧹 Clear Student Storage</h3>
            <p className="text-sm text-blue-700 mb-3">
              Force clear all student localStorage/sessionStorage on their next page load
            </p>
            <button
              onClick={forceStudentClear}
              className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
            >
              Force Clear
            </button>
          </div>
          
          <div className="p-4 bg-red-50 rounded-lg border border-red-200">
            <h3 className="font-medium text-red-900 mb-2">🗑️ Clear My Storage</h3>
            <p className="text-sm text-red-700 mb-3">
              Clear your own localStorage (you'll need to log in again)
            </p>
            <button
              onClick={() => {
                if (confirm('This will clear your localStorage and log you out. Continue?')) {
                  localStorage.clear();
                  sessionStorage.clear();
                  window.location.href = '/admin/login';
                }
              }}
              className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
            >
              Clear Mine
            </button>
          </div>
        </div>
      </div>

      {/* Browser Info */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">🌐 Browser Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div><strong>User Agent:</strong> <span className="break-all">{storageInfo?.browser?.userAgent}</span></div>
          <div><strong>Cookies Enabled:</strong> {storageInfo?.browser?.cookieEnabled ? '✅' : '❌'}</div>
          <div><strong>Online:</strong> {storageInfo?.browser?.onLine ? '✅' : '❌'}</div>
          <div><strong>Language:</strong> {storageInfo?.browser?.language}</div>
          <div><strong>Platform:</strong> {storageInfo?.browser?.platform}</div>
        </div>
      </div>

      {/* LocalStorage */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            💾 LocalStorage ({storageInfo?.localStorage?.items?.length || 0} items, {Math.round((storageInfo?.localStorage?.totalSize || 0) / 1024)}KB)
          </h2>
          <span className={`px-2 py-1 rounded text-sm ${
            storageInfo?.localStorage?.available ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {storageInfo?.localStorage?.available ? 'Available' : 'Not Available'}
          </span>
        </div>
        
        {storageInfo?.localStorage?.items && storageInfo.localStorage.items.length > 0 ? (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {storageInfo.localStorage.items.map((item, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded border">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 truncate">{item.key}</div>
                  <div className="text-sm text-gray-600 truncate">
                    {item.value.length > 100 ? `${item.value.substring(0, 100)}...` : item.value}
                  </div>
                  <div className="text-xs text-gray-500">{item.size} bytes</div>
                </div>
                <button
                  onClick={() => clearSpecificItem('localStorage', item.key)}
                  className="ml-2 px-2 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200"
                >
                  ❌
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-4">No localStorage items</p>
        )}
      </div>

      {/* SessionStorage */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            🔄 SessionStorage ({storageInfo?.sessionStorage?.items?.length || 0} items, {Math.round((storageInfo?.sessionStorage?.totalSize || 0) / 1024)}KB)
          </h2>
          <span className={`px-2 py-1 rounded text-sm ${
            storageInfo?.sessionStorage?.available ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {storageInfo?.sessionStorage?.available ? 'Available' : 'Not Available'}
          </span>
        </div>
        
        {storageInfo?.sessionStorage?.items && storageInfo.sessionStorage.items.length > 0 ? (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {storageInfo.sessionStorage.items.map((item, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded border">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 truncate">{item.key}</div>
                  <div className="text-sm text-gray-600 truncate">
                    {item.value.length > 100 ? `${item.value.substring(0, 100)}...` : item.value}
                  </div>
                  <div className="text-xs text-gray-500">{item.size} bytes</div>
                </div>
                <button
                  onClick={() => clearSpecificItem('sessionStorage', item.key)}
                  className="ml-2 px-2 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200"
                >
                  ❌
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-4">No sessionStorage items</p>
        )}
      </div>

      {/* Cookies */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          🍪 Cookies ({storageInfo?.cookies?.items?.length || 0} items)
        </h2>
        
        {storageInfo?.cookies?.items && storageInfo.cookies.items.length > 0 ? (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {storageInfo.cookies.items.map((item, index) => (
              <div key={index} className="p-3 bg-gray-50 rounded border">
                <div className="font-medium text-gray-900">{item.key}</div>
                <div className="text-sm text-gray-600 truncate">
                  {item.value.length > 100 ? `${item.value.substring(0, 100)}...` : item.value}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-4">No cookies found</p>
        )}
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-blue-900 mb-2">💡 How to Use This Tool</h2>
        <ul className="text-blue-800 space-y-1 text-sm">
          <li>• <strong>Refresh:</strong> Updates all storage information</li>
          <li>• <strong>Export:</strong> Downloads storage data as JSON for analysis</li>
          <li>• <strong>Force Student Clear:</strong> Clears all student storage on their next page load</li>
          <li>• <strong>Clear All:</strong> Removes all localStorage, sessionStorage, and cookies</li>
          <li>• <strong>Individual Remove:</strong> Click ❌ next to any item to remove it</li>
          <li>• Use this tool to debug student storage issues and conflicts</li>
        </ul>
      </div>
    </div>
  );
}