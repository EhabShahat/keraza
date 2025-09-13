import { useState, useEffect, useMemo, useCallback } from "react";
import { BrandLogoProps, SizeClasses } from "../types";

interface UseBrandLogoStateProps {
  logoUrl?: string | null;
  brandName?: string | null;
  size: "sm" | "md" | "lg";
  useAppSettings: boolean;
}

export function useBrandLogoState({ 
  logoUrl, 
  brandName, 
  size,
  useAppSettings 
}: UseBrandLogoStateProps) {
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

  const sizeClasses: SizeClasses = useMemo(() => ({
    sm: "h-8",
    md: "h-32",
    lg: "h-64"
  }), []);

  const handleImageLoad = useCallback(() => {
    setImageLoading(false);
    setImageError(false);
  }, []);

  const handleImageError = useCallback(() => {
    setImageLoading(false);
    setImageError(true);
  }, []);

  // Determine which logo URL and brand name to use
  const effectiveLogoUrl: string | null = useAppSettings ? appLogoUrl : (logoUrl ?? null);
  const effectiveBrandName: string | null = useAppSettings ? appBrandName : (brandName ?? null);
  
  return {
    imageError,
    imageLoading,
    effectiveLogoUrl,
    effectiveBrandName,
    handleImageLoad,
    handleImageError,
    sizeClasses
  };
}