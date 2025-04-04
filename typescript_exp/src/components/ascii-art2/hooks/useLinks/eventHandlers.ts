// Find a link URL from an event target or its parents
export const getLinkUrl = (element: HTMLElement | null): string | null => {
  if (!element) return null;
  
  // Check for various link indicators in priority order
  if (element.hasAttribute('data-url')) {
    return element.getAttribute('data-url');
  }
  
  if (element.hasAttribute('data-href')) {
    return element.getAttribute('data-href');
  }
  
  if (element.tagName === 'A' && element.hasAttribute('href')) {
    return element.getAttribute('href');
  }
  
  // Check data-link-overlay attribute
  if (element.hasAttribute('data-link-overlay')) {
    const url = element.getAttribute('data-url') || element.getAttribute('data-href');
    if (url) return url;
  }
  
  // Try parent element up to 3 levels
  let parent = element.parentElement;
  let level = 0;
  while (parent && level < 3) {
    if (parent.hasAttribute('data-url')) {
      return parent.getAttribute('data-url');
    }
    
    if (parent.hasAttribute('data-href')) {
      return parent.getAttribute('data-href');
    }
    
    if (parent.hasAttribute('data-link-overlay')) {
      const url = parent.getAttribute('data-url') || parent.getAttribute('data-href');
      if (url) return url;
    }
    
    parent = parent.parentElement;
    level++;
  }
  
  return null;
};

// Handle document click events for link detection
export const handleDocumentClick = (
  e: MouseEvent,
  startWhiteout: (position: { x: number; y: number }, targetUrl: string) => void
) => {
  // Get the click target
  const target = e.target as HTMLElement;
  
  // Try to find a link URL from the clicked element
  const url = getLinkUrl(target);
  
  if (url) {
    // Found a link! Prevent default navigation and handle it
    e.preventDefault();
    e.stopPropagation();
    
    // Find the position of the click relative to window
    if (!document.body.contains(target)) {
      return; // Safety check in case the element is no longer in the DOM
    }
    
    // Get approximate normalized position from window coordinates
    const x = (e.clientX / window.innerWidth) * 2 - 1;
    const y = (e.clientY / window.innerHeight) * 2 - 1;
    
    console.log('Click handler found link:', url);
    startWhiteout({ x, y }, url);
  }
};

// Handle touch events for link detection
export const handleDocumentTouch = (
  e: TouchEvent,
  startWhiteout: (position: { x: number; y: number }, targetUrl: string) => void
) => {
  if (e.touches.length !== 1) return; // Only handle single touches
  
  const touch = e.touches[0];
  const target = touch.target as HTMLElement;
  
  // Try to find a link URL from the touched element
  const url = getLinkUrl(target);
  
  if (url) {
    // Prevent default to avoid double tap delay
    e.preventDefault();
    
    // Get approximate normalized position
    const x = (touch.clientX / window.innerWidth) * 2 - 1;
    const y = (touch.clientY / window.innerHeight) * 2 - 1;
    
    console.log('Touch handler found link:', url);
    
    // Start whiteout immediately on touchstart
    startWhiteout({ x, y }, url);
  }
}; 