"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  placeholder?: string;
  quality?: number;
  priority?: boolean;
  onLoad?: () => void;
  onError?: (error: string) => void;
}

interface ImageState {
  isLoaded: boolean;
  isLoading: boolean;
  hasError: boolean;
  isInView: boolean;
}

export default function OptimizedImage({
  src,
  alt,
  width,
  height,
  className = "",
  placeholder = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2Y4ZmFmYyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk0YTNiOCI+TG9hZGluZy4uLjwvdGV4dD48L3N2Zz4=",
  quality = 80,
  priority = false,
  onLoad,
  onError
}: OptimizedImageProps) {
  const [state, setState] = useState<ImageState>({
    isLoaded: false,
    isLoading: false,
    hasError: false,
    isInView: false
  });

  const imgRef = useRef<HTMLImageElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Generate optimized image URL
  const getOptimizedSrc = useCallback((originalSrc: string, w?: number, h?: number, q: number = quality) => {
    // If it's already a data URL or external URL, return as is
    if (originalSrc.startsWith('data:') || originalSrc.startsWith('http')) {
      return originalSrc;
    }

    // Build optimization parameters
    const params = new URLSearchParams();
    if (w) params.set('w', w.toString());
    if (h) params.set('h', h.toString());
    params.set('q', q.toString());
    params.set('f', 'webp'); // Prefer WebP format

    return `${originalSrc}?${params.toString()}`;
  }, [quality]);

  // Handle image load
  const handleLoad = useCallback(() => {
    setState(prev => ({ ...prev, isLoaded: true, isLoading: false }));
    onLoad?.();
  }, [onLoad]);

  // Handle image error
  const handleError = useCallback(() => {
    setState(prev => ({ ...prev, hasError: true, isLoading: false }));
    onError?.("Failed to load image");
  }, [onError]);

  // Start loading image
  const startLoading = useCallback(() => {
    if (state.isLoading || state.isLoaded || state.hasError) return;

    setState(prev => ({ ...prev, isLoading: true }));
    
    const img = new Image();
    img.onload = handleLoad;
    img.onerror = handleError;
    img.src = getOptimizedSrc(src, width, height);
  }, [state, src, width, height, getOptimizedSrc, handleLoad, handleError]);

  // Set up intersection observer for lazy loading
  useEffect(() => {
    if (priority) {
      // Load immediately if priority is true
      startLoading();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setState(prev => ({ ...prev, isInView: true }));
            startLoading();
            observer.unobserve(entry.target);
          }
        });
      },
      {
        rootMargin: '50px' // Start loading 50px before entering viewport
      }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    observerRef.current = observer;

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [priority, startLoading]);

  // Generate srcSet for responsive images
  const generateSrcSet = useCallback(() => {
    if (!width) return undefined;

    const sizes = [0.5, 1, 1.5, 2]; // Different density ratios
    return sizes
      .map(ratio => {
        const scaledWidth = Math.round(width * ratio);
        const scaledHeight = height ? Math.round(height * ratio) : undefined;
        const optimizedSrc = getOptimizedSrc(src, scaledWidth, scaledHeight);
        return `${optimizedSrc} ${ratio}x`;
      })
      .join(', ');
  }, [src, width, height, getOptimizedSrc]);

  return (
    <div className={`relative overflow-hidden ${className}`} style={{ width, height }}>
      {/* Placeholder */}
      {!state.isLoaded && (
        <div className="absolute inset-0 bg-slate-100 animate-pulse flex items-center justify-center">
          {state.isLoading ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin"></div>
              <span className="text-xs text-slate-500">Loading...</span>
            </div>
          ) : state.hasError ? (
            <div className="flex flex-col items-center gap-2 text-slate-400">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs">Failed to load</span>
            </div>
          ) : (
            <img
              src={placeholder}
              alt="Loading placeholder"
              className="w-full h-full object-cover opacity-50"
            />
          )}
        </div>
      )}

      {/* Actual Image */}
      <img
        ref={imgRef}
        src={state.isLoading || state.isLoaded ? getOptimizedSrc(src, width, height) : placeholder}
        srcSet={generateSrcSet()}
        alt={alt}
        width={width}
        height={height}
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          state.isLoaded ? 'opacity-100' : 'opacity-0'
        }`}
        onLoad={handleLoad}
        onError={handleError}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
      />

      {/* Loading overlay */}
      {state.isLoading && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  );
}

// Hook for batch image preloading
export function useImagePreloader() {
  const preloadedImages = useRef<Set<string>>(new Set());

  const preloadImage = useCallback((src: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (preloadedImages.current.has(src)) {
        resolve();
        return;
      }

      const img = new Image();
      img.onload = () => {
        preloadedImages.current.add(src);
        resolve();
      };
      img.onerror = () => reject(new Error(`Failed to preload image: ${src}`));
      img.src = src;
    });
  }, []);

  const preloadImages = useCallback(async (sources: string[]): Promise<void> => {
    const promises = sources.map(src => preloadImage(src));
    await Promise.allSettled(promises);
  }, [preloadImage]);

  return { preloadImage, preloadImages };
}

// Component for image gallery with lazy loading
interface ImageGalleryProps {
  images: Array<{
    src: string;
    alt: string;
    caption?: string;
  }>;
  columns?: number;
  gap?: number;
  className?: string;
}

export function OptimizedImageGallery({ 
  images, 
  columns = 3, 
  gap = 4, 
  className = "" 
}: ImageGalleryProps) {
  return (
    <div 
      className={`grid ${className}`}
      style={{ 
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: `${gap * 0.25}rem`
      }}
    >
      {images.map((image, index) => (
        <div key={index} className="group cursor-pointer">
          <OptimizedImage
            src={image.src}
            alt={image.alt}
            className="rounded-lg overflow-hidden group-hover:shadow-lg transition-shadow duration-200"
            priority={index < 6} // Prioritize first 6 images
          />
          {image.caption && (
            <p className="mt-2 text-sm text-slate-600 text-center">{image.caption}</p>
          )}
        </div>
      ))}
    </div>
  );
}
