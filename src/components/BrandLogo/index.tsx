"use client";

import { memo } from "react";
import { BrandLogoProps } from "./types";
import LogoImage from "./LogoImage";
import LogoFallback from "./LogoFallback";
import { useBrandLogoState } from "./hooks/useBrandLogoState";

function BrandLogo({ 
  logoUrl, 
  brandName, 
  size = "md", 
  className = "",
  showFallback = true,
  useAppSettings = false
}: BrandLogoProps) {
  const {
    imageError,
    imageLoading,
    effectiveLogoUrl,
    effectiveBrandName,
    handleImageLoad,
    handleImageError,
    sizeClasses
  } = useBrandLogoState({ logoUrl, brandName, size, useAppSettings });
  
  // If no logo URL or image failed to load, show fallback
  if (!effectiveLogoUrl || imageError) {
    if (!showFallback) return null;
    return <LogoFallback 
      brandName={effectiveBrandName ?? null} 
      size={size} 
      sizeClasses={sizeClasses} 
      className={className} 
    />;
  }

  return (
    <LogoImage
      logoUrl={effectiveLogoUrl}
      brandName={effectiveBrandName ?? null}
      size={size}
      sizeClasses={sizeClasses}
      className={className}
      imageLoading={imageLoading}
      onLoad={handleImageLoad}
      onError={handleImageError}
    />
  );
}

export default memo(BrandLogo);

export type { BrandLogoProps } from "./types";