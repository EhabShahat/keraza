/**
 * Image compression utility for exam platform
 * Compresses images while maintaining quality for exam questions and annotations
 */

interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
  maxSizeKB?: number;
}

interface CompressionResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  dataUrl: string;
}

export class ImageCompressor {
  private static readonly DEFAULT_OPTIONS: Required<CompressionOptions> = {
    maxWidth: 1920,
    maxHeight: 1080,
    quality: 0.8,
    format: 'jpeg',
    maxSizeKB: 500
  };

  /**
   * Compress an image file with specified options
   */
  static async compressImage(
    file: File, 
    options: CompressionOptions = {}
  ): Promise<CompressionResult> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }

      img.onload = () => {
        try {
          // Calculate new dimensions while maintaining aspect ratio
          const { width, height } = this.calculateDimensions(
            img.width, 
            img.height, 
            opts.maxWidth, 
            opts.maxHeight
          );

          canvas.width = width;
          canvas.height = height;

          // Draw and compress
          ctx.drawImage(img, 0, 0, width, height);
          
          // Try different quality levels to meet size requirements
          this.compressToTargetSize(canvas, opts, file.size)
            .then(result => resolve(result))
            .catch(reject);
            
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * Compress multiple images in batch
   */
  static async compressBatch(
    files: File[], 
    options: CompressionOptions = {}
  ): Promise<CompressionResult[]> {
    const results: CompressionResult[] = [];
    
    for (const file of files) {
      try {
        const result = await this.compressImage(file, options);
        results.push(result);
      } catch (error) {
        console.error(`Failed to compress ${file.name}:`, error);
        // Continue with other files
      }
    }
    
    return results;
  }

  /**
   * Calculate optimal dimensions maintaining aspect ratio
   */
  private static calculateDimensions(
    originalWidth: number,
    originalHeight: number,
    maxWidth: number,
    maxHeight: number
  ): { width: number; height: number } {
    let { width, height } = { width: originalWidth, height: originalHeight };

    // Scale down if necessary
    if (width > maxWidth) {
      height = (height * maxWidth) / width;
      width = maxWidth;
    }

    if (height > maxHeight) {
      width = (width * maxHeight) / height;
      height = maxHeight;
    }

    return { width: Math.round(width), height: Math.round(height) };
  }

  /**
   * Compress canvas to target file size
   */
  private static async compressToTargetSize(
    canvas: HTMLCanvasElement,
    options: Required<CompressionOptions>,
    originalSize: number
  ): Promise<CompressionResult> {
    let quality = options.quality;
    let attempts = 0;
    const maxAttempts = 10;
    const targetSizeBytes = options.maxSizeKB * 1024;

    while (attempts < maxAttempts) {
      const dataUrl = canvas.toDataURL(`image/${options.format}`, quality);
      const blob = await this.dataUrlToBlob(dataUrl);
      
      if (blob.size <= targetSizeBytes || quality <= 0.1) {
        const file = new File([blob], `compressed.${options.format}`, {
          type: `image/${options.format}`
        });

        return {
          file,
          originalSize,
          compressedSize: blob.size,
          compressionRatio: Math.round((1 - blob.size / originalSize) * 100),
          dataUrl
        };
      }

      quality -= 0.1;
      attempts++;
    }

    // Fallback if we can't meet target size
    const dataUrl = canvas.toDataURL(`image/${options.format}`, 0.1);
    const blob = await this.dataUrlToBlob(dataUrl);
    const file = new File([blob], `compressed.${options.format}`, {
      type: `image/${options.format}`
    });

    return {
      file,
      originalSize,
      compressedSize: blob.size,
      compressionRatio: Math.round((1 - blob.size / originalSize) * 100),
      dataUrl
    };
  }

  /**
   * Convert data URL to Blob
   */
  private static dataUrlToBlob(dataUrl: string): Promise<Blob> {
    return fetch(dataUrl).then(res => res.blob());
  }

  /**
   * Validate image file
   */
  static validateImageFile(file: File): { valid: boolean; error?: string } {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const maxSizeMB = 10;

    if (!allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: 'Invalid file type. Please upload JPEG, PNG, WebP, or GIF images.'
      };
    }

    if (file.size > maxSizeMB * 1024 * 1024) {
      return {
        valid: false,
        error: `File size too large. Maximum size is ${maxSizeMB}MB.`
      };
    }

    return { valid: true };
  }

  /**
   * Get image dimensions without loading full image
   */
  static getImageDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
        URL.revokeObjectURL(img.src);
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  }
}

/**
 * React hook for image compression
 */
export function useImageCompression() {
  const compressImage = async (
    file: File, 
    options?: CompressionOptions
  ): Promise<CompressionResult> => {
    const validation = ImageCompressor.validateImageFile(file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    return ImageCompressor.compressImage(file, options);
  };

  const compressBatch = async (
    files: File[], 
    options?: CompressionOptions
  ): Promise<CompressionResult[]> => {
    // Validate all files first
    for (const file of files) {
      const validation = ImageCompressor.validateImageFile(file);
      if (!validation.valid) {
        throw new Error(`${file.name}: ${validation.error}`);
      }
    }

    return ImageCompressor.compressBatch(files, options);
  };

  return {
    compressImage,
    compressBatch,
    validateImageFile: ImageCompressor.validateImageFile,
    getImageDimensions: ImageCompressor.getImageDimensions
  };
}
