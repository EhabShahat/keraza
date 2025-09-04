import { LogoImageProps } from "./types";

export default function LogoImage({
  logoUrl,
  brandName,
  size,
  sizeClasses,
  className,
  imageLoading,
  onLoad,
  onError
}: LogoImageProps) {
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
          src={logoUrl}
          alt={brandName || "Logo"}
          className={`${sizeClasses[size]} mx-auto object-contain transition-opacity duration-200 ${
            imageLoading ? "opacity-0 absolute inset-0" : "opacity-100"
          }`}
          onLoad={onLoad}
          onError={onError}
          loading="eager"
        />
      </div>
      
      {/* Brand name below logo if both exist */}
      {brandName && !imageLoading && (
        <div className="mt-3">
          <h1 className={`font-semibold text-[var(--foreground)] ${
            size === "sm" ? "text-sm" : 
            size === "md" ? "text-lg" : 
            "text-xl"
          }`}>
            {brandName}
          </h1>
        </div>
      )}
    </div>
  );
}