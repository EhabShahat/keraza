import { LogoFallbackProps } from "./types";

export default function LogoFallback({ 
  brandName, 
  size, 
  sizeClasses, 
  className 
}: LogoFallbackProps) {
  return (
    <div className={`text-center ${className}`}>
      {brandName ? (
        <div className="flex items-center justify-center">
          <div className={`${sizeClasses[size]} flex items-center justify-center`}>
            <h1 className={`font-bold text-[var(--foreground)] ${
              size === "sm" ? "text-lg" : 
              size === "md" ? "text-2xl" : 
              "text-3xl"
            }`}>
              {brandName}
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