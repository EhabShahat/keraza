import type { Metadata, Viewport } from "next";
import { Tajawal } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import StorageCleaner from "@/components/StorageCleaner";
import StudentStorageCleaner from "@/components/StudentStorageCleaner";

const appSans = Tajawal({
  variable: "--font-app-sans",
  subsets: ["latin", "arabic"],
  weight: ["400", "500", "700"],
  display: "swap",
  preload: false, // Disable automatic preloading to avoid unused font warnings
});

export const metadata: Metadata = {
  title: process.env.APP_BRAND_NAME || "Advanced Exam App",
  description: "Secure, flexible exam delivery",
  other: {
    google: 'notranslate',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" translate="no" className="notranslate">
      <head>
        {/* Enhanced mobile compatibility */}
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="theme-color" content="#2563eb" />
        {/* Prevent browser extensions from interfering */}
        <meta name="google" content="notranslate" />
        <meta name="robots" content="noindex, nofollow, notranslate, noimageindex" />
        
        {/* Polyfills for old browsers */}
        <script dangerouslySetInnerHTML={{
          __html: `
            // Polyfill for Array.includes (IE11 and older)
            if (!Array.prototype.includes) {
              Array.prototype.includes = function(searchElement) {
                return this.indexOf(searchElement) !== -1;
              };
            }
            
            // Polyfill for Object.assign (IE11 and older)
            if (typeof Object.assign !== 'function') {
              Object.assign = function(target) {
                if (target == null) throw new TypeError('Cannot convert undefined or null to object');
                var to = Object(target);
                for (var index = 1; index < arguments.length; index++) {
                  var nextSource = arguments[index];
                  if (nextSource != null) {
                    for (var nextKey in nextSource) {
                      if (Object.prototype.hasOwnProperty.call(nextSource, nextKey)) {
                        to[nextKey] = nextSource[nextKey];
                      }
                    }
                  }
                }
                return to;
              };
            }
            
            // Polyfill for fetch (old browsers)
            if (!window.fetch) {
              window.fetch = function(url, options) {
                return new Promise(function(resolve, reject) {
                  var xhr = new XMLHttpRequest();
                  xhr.open(options && options.method || 'GET', url);
                  
                  if (options && options.headers) {
                    for (var key in options.headers) {
                      xhr.setRequestHeader(key, options.headers[key]);
                    }
                  }
                  
                  xhr.onload = function() {
                    resolve({
                      ok: xhr.status >= 200 && xhr.status < 300,
                      status: xhr.status,
                      json: function() { return Promise.resolve(JSON.parse(xhr.responseText)); },
                      text: function() { return Promise.resolve(xhr.responseText); }
                    });
                  };
                  
                  xhr.onerror = function() {
                    reject(new Error('Network error'));
                  };
                  
                  xhr.send(options && options.body || null);
                });
              };
            }
            
            // Browser-specific fixes moved to CSS to avoid hydration mismatch
            // These fixes are now handled via CSS classes and media queries
            
            // Note: Viewport handling is now managed by Next.js viewport export
            // iOS zoom prevention is handled by the viewport configuration above
          `
        }} />
      </head>
      <body
        className={`${appSans.variable} antialiased font-sans`}
        style={{ 
          WebkitTextSizeAdjust: '100%',
          textSizeAdjust: '100%',
          WebkitTapHighlightColor: 'transparent'
        }}
      >
        <StorageCleaner />
        <StudentStorageCleaner />
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
