"use client";

import { useState, useEffect } from "react";
import { supabaseServer } from "@/lib/supabase/server";

interface BrandLogoProps {
  logoUrl?: string | null;
  brandName?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
  showFallback?: boolean;
  useAppSettings?: boolean;
}

export default function BrandLogo({ 
  logoUrl, 
  brandName, 
  size = "md", 
  className = "",
  showFallback = true,
  useAppSettings = false
}: BrandLogoProps) {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [appLogoUrl, setAppLogoUrl] = useState<string | null>(null);
  const [appBrandName, setAppBrandName] = useState<string | null>(null);
  
  // Fetch app settings if useAppSettings is true
  useEffect(() => {
    if (useAppSettings) {
      const fetchAppSettings = async () => {
        try {
          const response = await fetch('/api/public/settings');
          if (response.ok) {
            const data = await response.json();
            setAppLogoUrl(data.brand_logo_url || null);
            setAppBrandName(data.brand_name || null);
          }
        } catch (error) {
          console.error('Error fetching app settings:', error);
        }
      };
      
      fetchAppSettings();
    }
  }, [useAppSettings]);

  const sizeClasses = {
    sm: "h-8",
    md: "h-32",
    lg: "h-64"
  };

  const handleImageLoad = () => {
    setImageLoading(false);
    setImageError(false);
  };

  const handleImageError = () => {
    setImageLoading(false);
    setImageError(true);
  };

  // Determine which logo URL and brand name to use
  const effectiveLogoUrl = useAppSettings ? appLogoUrl : logoUrl;
  const effectiveBrandName = useAppSettings ? appBrandName : brandName;
  
  // If no logo URL or image failed to load, show fallback
  if (!effectiveLogoUrl || imageError) {
    if (!showFallback) return null;
    
    return (
      <div className={`text-center ${className}`}>
        {effectiveBrandName ? (
          <div className="flex items-center justify-center">
            <div className={`${sizeClasses[size]} flex items-center justify-center`}>
              <h1 className={`font-bold text-[var(--foreground)] ${
                size === "sm" ? "text-lg" : 
                size === "md" ? "text-2xl" : 
                "text-3xl"
              }`}>
                {effectiveBrandName}
              </h1>
            </div>
          </div>
        ) : (
          <div className={`${sizeClasses[size]} flex items-center justify-center mx-auto`}>
            <div className="flex items-center justify-center w-full h-full bg-gray-100 rounded-lg border-2 border-dashed border-gray-300">
              <svg 
                className={`text-gray-400 ${
                  size === "sm" ? "w-4 h-4" : 
                  size === "md" ? "w-8 h-8" : 
                  "w-12 h-12"
                }`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" 
                />
              </svg>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`text-center ${className}`}>
      <div className="relative inline-block">
        {/* Loading skeleton - styled to match the img exactly */}
        {imageLoading && (
          <div 
            className={`${sizeClasses[size]} w-auto min-w-16 mx-auto bg-gray-200 animate-pulse rounded`}
            style={{ 
              aspectRatio: "auto", 
              display: "block",
              maxWidth: "100%"
            }}
          />
        )}
        
        {/* Actual image */}
        <img
          src={effectiveLogoUrl}
          alt={effectiveBrandName || "Logo"}
          className={`${sizeClasses[size]} mx-auto object-contain transition-opacity duration-200 ${
            imageLoading ? "opacity-0 absolute inset-0" : "opacity-100"
          }`}
          onLoad={handleImageLoad}
          onError={handleImageError}
          loading="eager"
        />
      </div>
      
      {/* Brand name below logo if both exist */}
      {effectiveBrandName && !imageError && !imageLoading && (
        <div className="mt-3">
          <h1 className={`font-semibold text-[var(--foreground)] ${
            size === "sm" ? "text-sm" : 
            size === "md" ? "text-lg" : 
            "text-xl"
          }`}>
            {effectiveBrandName}
          </h1>
        </div>
      )}
    </div>
  );
}