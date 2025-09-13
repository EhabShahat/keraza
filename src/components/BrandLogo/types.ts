export interface BrandLogoProps {
  logoUrl?: string | null;
  brandName?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
  showFallback?: boolean;
  useAppSettings?: boolean;
}

export interface SizeClasses {
  sm: string;
  md: string;
  lg: string;
}

export interface LogoFallbackProps {
  brandName: string | null;
  size: "sm" | "md" | "lg";
  sizeClasses: SizeClasses;
  className: string;
}

export interface LogoImageProps {
  logoUrl: string;
  brandName: string | null;
  size: "sm" | "md" | "lg";
  sizeClasses: SizeClasses;
  className: string;
  imageLoading: boolean;
  onLoad: () => void;
  onError: () => void;
}