// Text utilities for handling Arabic and mixed content

export function hasArabic(text: string): boolean {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
}

export function hasEnglish(text: string): boolean {
  return /[a-zA-Z]/.test(text);
}

export function isMixedContent(text: string): boolean {
  return hasArabic(text) && hasEnglish(text);
}

export function getTextDirection(text: string): 'ltr' | 'rtl' | 'auto' {
  if (isMixedContent(text)) {
    return 'auto';
  } else if (hasArabic(text)) {
    return 'rtl';
  } else {
    return 'ltr';
  }
}

export function getTextAlignment(text: string): 'left' | 'right' | 'start' {
  const direction = getTextDirection(text);
  if (direction === 'rtl') {
    return 'right';
  } else if (direction === 'ltr') {
    return 'left';
  } else {
    return 'start'; // Let browser decide
  }
}