"use client";

import React, { useState, useRef, useCallback, useEffect } from 'react';

interface AnnotationPoint {
  id: string;
  x: number;
  y: number;
  label: string;
  color: string;
}

interface ImageAnnotationQuestionProps {
  imageUrl: string;
  question: string;
  annotations?: AnnotationPoint[];
  onAnnotationChange?: (annotations: AnnotationPoint[]) => void;
  readonly?: boolean;
  showLabels?: boolean;
  maxAnnotations?: number;
  className?: string;
}

const ANNOTATION_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', 
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'
];

export default function ImageAnnotationQuestion({
  imageUrl,
  question,
  annotations = [],
  onAnnotationChange,
  readonly = false,
  showLabels = true,
  maxAnnotations = 10,
  className = ""
}: ImageAnnotationQuestionProps) {
  const [currentAnnotations, setCurrentAnnotations] = useState<AnnotationPoint[]>(annotations);
  const [selectedAnnotation, setSelectedAnnotation] = useState<string | null>(null);
  const [isAddingAnnotation, setIsAddingAnnotation] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Update annotations when prop changes
  useEffect(() => {
    setCurrentAnnotations(annotations);
  }, [annotations]);

  // Handle image load
  const handleImageLoad = useCallback(() => {
    if (imageRef.current) {
      setImageDimensions({
        width: imageRef.current.offsetWidth,
        height: imageRef.current.offsetHeight
      });
      setImageLoaded(true);
    }
  }, []);

  // Handle click on image to add annotation
  const handleImageClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (readonly || !isAddingAnnotation || currentAnnotations.length >= maxAnnotations) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const newAnnotation: AnnotationPoint = {
      id: `annotation-${Date.now()}`,
      x,
      y,
      label: `Point ${currentAnnotations.length + 1}`,
      color: ANNOTATION_COLORS[currentAnnotations.length % ANNOTATION_COLORS.length]
    };

    const updatedAnnotations = [...currentAnnotations, newAnnotation];
    setCurrentAnnotations(updatedAnnotations);
    onAnnotationChange?.(updatedAnnotations);
    setIsAddingAnnotation(false);
  }, [readonly, isAddingAnnotation, currentAnnotations, maxAnnotations, onAnnotationChange]);

  // Remove annotation
  const removeAnnotation = useCallback((id: string) => {
    if (readonly) return;
    
    const updatedAnnotations = currentAnnotations.filter(ann => ann.id !== id);
    setCurrentAnnotations(updatedAnnotations);
    onAnnotationChange?.(updatedAnnotations);
    setSelectedAnnotation(null);
  }, [readonly, currentAnnotations, onAnnotationChange]);

  // Update annotation label
  const updateAnnotationLabel = useCallback((id: string, label: string) => {
    if (readonly) return;

    const updatedAnnotations = currentAnnotations.map(ann =>
      ann.id === id ? { ...ann, label } : ann
    );
    setCurrentAnnotations(updatedAnnotations);
    onAnnotationChange?.(updatedAnnotations);
  }, [readonly, currentAnnotations, onAnnotationChange]);

  // Clear all annotations
  const clearAllAnnotations = useCallback(() => {
    if (readonly) return;
    
    setCurrentAnnotations([]);
    onAnnotationChange?.([]);
    setSelectedAnnotation(null);
  }, [readonly, onAnnotationChange]);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Question */}
      <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
        <h3 className="text-lg font-semibold text-slate-800 mb-2">Image Annotation Question</h3>
        <p className="text-slate-700">{question}</p>
      </div>

      {/* Controls */}
      {!readonly && (
        <div className="flex flex-wrap items-center gap-3 p-4 bg-white rounded-xl border border-slate-200">
          <button
            onClick={() => setIsAddingAnnotation(!isAddingAnnotation)}
            disabled={currentAnnotations.length >= maxAnnotations}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              isAddingAnnotation
                ? 'bg-blue-600 text-white'
                : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
            } disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            {isAddingAnnotation ? 'Click on image to add point' : 'Add Annotation'}
          </button>

          <button
            onClick={clearAllAnnotations}
            disabled={currentAnnotations.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium bg-red-100 text-red-700 hover:bg-red-200 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Clear All
          </button>

          <div className="text-sm text-slate-600">
            {currentAnnotations.length} / {maxAnnotations} annotations
          </div>
        </div>
      )}

      {/* Image with Annotations */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div
          ref={containerRef}
          className={`relative inline-block w-full ${
            isAddingAnnotation ? 'cursor-crosshair' : 'cursor-default'
          }`}
          onClick={handleImageClick}
        >
          <img
            ref={imageRef}
            src={imageUrl}
            alt="Annotation target"
            className="w-full h-auto max-h-96 object-contain"
            onLoad={handleImageLoad}
            draggable={false}
          />

          {/* Annotation Points */}
          {imageLoaded && currentAnnotations.map((annotation) => (
            <div
              key={annotation.id}
              className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group"
              style={{
                left: `${annotation.x}%`,
                top: `${annotation.y}%`,
              }}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedAnnotation(annotation.id);
              }}
            >
              {/* Annotation Point */}
              <div
                className={`w-4 h-4 rounded-full border-2 border-white shadow-lg transition-transform group-hover:scale-125 ${
                  selectedAnnotation === annotation.id ? 'scale-125' : ''
                }`}
                style={{ backgroundColor: annotation.color }}
              />

              {/* Label */}
              {showLabels && (
                <div
                  className="absolute top-5 left-1/2 transform -translate-x-1/2 px-2 py-1 text-xs font-medium text-white rounded shadow-lg whitespace-nowrap"
                  style={{ backgroundColor: annotation.color }}
                >
                  {annotation.label}
                </div>
              )}

              {/* Remove button (appears on hover) */}
              {!readonly && selectedAnnotation === annotation.id && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeAnnotation(annotation.id);
                  }}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ))}

          {/* Adding annotation hint */}
          {isAddingAnnotation && (
            <div className="absolute inset-0 bg-blue-500 bg-opacity-10 flex items-center justify-center">
              <div className="bg-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium text-slate-700">
                Click anywhere on the image to add an annotation point
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Annotations List */}
      {currentAnnotations.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h4 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            Annotations ({currentAnnotations.length})
          </h4>
          
          <div className="space-y-2">
            {currentAnnotations.map((annotation, index) => (
              <div
                key={annotation.id}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                  selectedAnnotation === annotation.id
                    ? 'border-blue-300 bg-blue-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
                onClick={() => setSelectedAnnotation(annotation.id)}
              >
                {/* Color indicator */}
                <div
                  className="w-4 h-4 rounded-full border-2 border-white shadow-sm"
                  style={{ backgroundColor: annotation.color }}
                />

                {/* Label input */}
                {!readonly ? (
                  <input
                    type="text"
                    value={annotation.label}
                    onChange={(e) => updateAnnotationLabel(annotation.id, e.target.value)}
                    className="flex-1 px-3 py-1 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter annotation label"
                  />
                ) : (
                  <span className="flex-1 text-slate-700">{annotation.label}</span>
                )}

                {/* Position info */}
                <div className="text-xs text-slate-500 font-mono">
                  ({Math.round(annotation.x)}%, {Math.round(annotation.y)}%)
                </div>

                {/* Remove button */}
                {!readonly && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeAnnotation(annotation.id);
                    }}
                    className="text-red-500 hover:text-red-700 p-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
