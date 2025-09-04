"use client";

import React, { useState, useCallback, useRef } from 'react';
import { useImageCompression } from '@/lib/imageCompression';

interface ImageUploadWidgetProps {
  onUpload: (files: File[], previews: string[]) => void;
  onError?: (error: string) => void;
  multiple?: boolean;
  maxFiles?: number;
  compressionOptions?: {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    maxSizeKB?: number;
  };
  className?: string;
}

interface UploadedImage {
  file: File;
  preview: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  status: 'uploading' | 'compressed' | 'error';
}

export default function ImageUploadWidget({
  onUpload,
  onError,
  multiple = false,
  maxFiles = 5,
  compressionOptions = {
    maxWidth: 1920,
    maxHeight: 1080,
    quality: 0.8,
    maxSizeKB: 500
  },
  className = ""
}: ImageUploadWidgetProps) {
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { compressImage, validateImageFile } = useImageCompression();

  const processFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    
    if (!multiple && fileArray.length > 1) {
      onError?.("Only one file is allowed");
      return;
    }

    if (images.length + fileArray.length > maxFiles) {
      onError?.(`Maximum ${maxFiles} files allowed`);
      return;
    }

    setIsProcessing(true);

    const newImages: UploadedImage[] = [];
    
    for (const file of fileArray) {
      const validation = validateImageFile(file);
      if (!validation.valid) {
        onError?.(validation.error || "Invalid file");
        continue;
      }

      const tempImage: UploadedImage = {
        file,
        preview: URL.createObjectURL(file),
        originalSize: file.size,
        compressedSize: file.size,
        compressionRatio: 0,
        status: 'uploading'
      };

      newImages.push(tempImage);
    }

    setImages(prev => [...prev, ...newImages]);

    // Process compression
    for (let i = 0; i < newImages.length; i++) {
      try {
        const result = await compressImage(newImages[i].file, compressionOptions);
        
        setImages(prev => prev.map(img => 
          img === newImages[i] ? {
            ...img,
            file: result.file,
            preview: result.dataUrl,
            compressedSize: result.compressedSize,
            compressionRatio: result.compressionRatio,
            status: 'compressed'
          } : img
        ));
      } catch (error) {
        setImages(prev => prev.map(img => 
          img === newImages[i] ? { ...img, status: 'error' } : img
        ));
        onError?.(`Failed to compress ${newImages[i].file.name}`);
      }
    }

    setIsProcessing(false);
  }, [images.length, maxFiles, multiple, onError, compressImage, compressionOptions]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFiles(files);
    }
  }, [processFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFiles(files);
    }
  }, [processFiles]);

  const removeImage = useCallback((index: number) => {
    setImages(prev => {
      const newImages = prev.filter((_, i) => i !== index);
      return newImages;
    });
  }, []);

  const handleUpload = useCallback(() => {
    const completedImages = images.filter(img => img.status === 'compressed');
    if (completedImages.length === 0) {
      onError?.("No images ready for upload");
      return;
    }

    const files = completedImages.map(img => img.file);
    const previews = completedImages.map(img => img.preview);
    onUpload(files, previews);
  }, [images, onUpload, onError]);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Upload Area */}
      <div
        className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-slate-300 hover:border-slate-400 bg-slate-50'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple={multiple}
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        
        <div className="space-y-4">
          <div className="w-16 h-16 mx-auto bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold text-slate-800">
              {isDragging ? 'Drop images here' : 'Upload Images'}
            </h3>
            <p className="text-slate-600 mt-1">
              Drag & drop or click to select {multiple ? `up to ${maxFiles} images` : 'an image'}
            </p>
            <p className="text-xs text-slate-500 mt-2">
              Supports JPEG, PNG, WebP, GIF • Max {compressionOptions.maxSizeKB}KB after compression
            </p>
          </div>
        </div>
      </div>

      {/* Image Previews */}
      {images.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-semibold text-slate-800 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Uploaded Images ({images.length})
          </h4>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {images.map((image, index) => (
              <div key={index} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <div className="relative">
                  <img
                    src={image.preview}
                    alt={`Upload ${index + 1}`}
                    className="w-full h-32 object-cover rounded-lg"
                  />
                  
                  {/* Status Overlay */}
                  {image.status === 'uploading' && (
                    <div className="absolute inset-0 bg-black bg-opacity-50 rounded-lg flex items-center justify-center">
                      <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                  
                  {image.status === 'error' && (
                    <div className="absolute inset-0 bg-red-500 bg-opacity-75 rounded-lg flex items-center justify-center">
                      <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  )}
                  
                  {/* Remove Button */}
                  <button
                    onClick={() => removeImage(index)}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                {/* File Info */}
                <div className="mt-3 space-y-1">
                  <div className="text-sm font-medium text-slate-800 truncate">
                    {image.file.name}
                  </div>
                  
                  {image.status === 'compressed' && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-slate-600">
                        <span>Original:</span>
                        <span>{formatFileSize(image.originalSize)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-slate-600">
                        <span>Compressed:</span>
                        <span>{formatFileSize(image.compressedSize)}</span>
                      </div>
                      {image.compressionRatio > 0 && (
                        <div className="text-xs text-green-600 font-medium">
                          {image.compressionRatio}% smaller
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Status Badge */}
                  <div className="flex justify-center">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      image.status === 'compressed' ? 'bg-green-100 text-green-800' :
                      image.status === 'uploading' ? 'bg-blue-100 text-blue-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {image.status === 'compressed' ? '✓ Ready' :
                       image.status === 'uploading' ? '⏳ Processing' :
                       '✗ Error'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload Button */}
      {images.length > 0 && (
        <div className="flex justify-end">
          <button
            onClick={handleUpload}
            disabled={isProcessing || images.every(img => img.status !== 'compressed')}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-semibold px-6 py-3 rounded-xl transition-colors disabled:cursor-not-allowed flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Upload {images.filter(img => img.status === 'compressed').length} Image{images.filter(img => img.status === 'compressed').length !== 1 ? 's' : ''}
          </button>
        </div>
      )}
    </div>
  );
}
