import { useState, useRef, useEffect } from 'react';
import { CHAR_WIDTH, CHAR_HEIGHT, SAFARI_CURSOR_Y_OFFSET, MOUSE_MOVE_THROTTLE } from '../constants';
import { CursorState, Size, ClickRipple, WhiteoutState, WhiteInState, WhiteOverlayState } from '../types';
import { getGridDimensions } from '../utils';

export const useCursor = (
  textRef: React.RefObject<HTMLPreElement>,
  size: Size
) => {
  const cursorRef = useRef<CursorState>({
    grid: { x: 0, y: 0 },
    normalized: { x: 0, y: 0 },
    isInWindow: false,
    isActive: false,
    clickRipples: [],
    whiteout: null,
    whiteIn: null,
    whiteOverlay: null
  });
  
  const [cursor, setCursor] = useState(cursorRef.current);
  const lastMouseMoveTime = useRef(0);
  const maxRipples = 5; // Maximum number of active ripples at once
  const whiteInAnimationRef = useRef<number | null>(null);
  const whiteoutAnimationRef = useRef<number | null>(null);
  const whiteOverlayAnimationRef = useRef<number | null>(null);
  // Add mousedown tracking for hold duration
  const mouseDownInfo = useRef<{
    active: boolean;
    position: { x: number; y: number };
    startTime: number;
  } | null>(null);

  // Mouse movement tracking
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const now = performance.now();
      if (now - lastMouseMoveTime.current < MOUSE_MOVE_THROTTLE) {
        return;
      }
      lastMouseMoveTime.current = now;
      
      if (!size.width || !size.height || !textRef.current) return;
      
      // Skip mouse tracking if whiteout is active
      if (cursorRef.current.whiteout?.active || cursorRef.current.whiteIn?.active) {
        return;
      }
      
      const rect = textRef.current.getBoundingClientRect();
      const relativeX = e.clientX - rect.left;
      const relativeY = e.clientY - rect.top + SAFARI_CURSOR_Y_OFFSET;
      
      updateCursorPosition(relativeX, relativeY);
    };

    const handleMouseLeave = () => {
      cursorRef.current = {
        ...cursorRef.current,
        isInWindow: false
      };
      setCursor(cursorRef.current);
    };

    const handleMouseEnter = () => {
      cursorRef.current = {
        ...cursorRef.current,
        isInWindow: true
      };
      setCursor(cursorRef.current);
    };
    
    const handleMouseDown = (e: MouseEvent) => {
      if (!size.width || !size.height || !textRef.current) return;
      
      const rect = textRef.current.getBoundingClientRect();
      const relativeX = e.clientX - rect.left;
      const relativeY = e.clientY - rect.top + SAFARI_CURSOR_Y_OFFSET;
      
      const normalizedX = (relativeX / (size.width || 1)) * 2 - 1;
      const normalizedY = (relativeY / (size.height || 1)) * 2 - 1;
      
      // Initialize mousedown tracking
      mouseDownInfo.current = {
        active: true,
        position: { x: normalizedX, y: normalizedY },
        startTime: Date.now()
      };
      
      // Create an initial small mousedown ripple effect
      const initialRipple: ClickRipple = {
        position: { x: normalizedX, y: normalizedY },
        timestamp: Date.now(),
        lifespan: 800, // Shorter lifespan for initial ripple
        intensity: 0.3, // Lower intensity for initial effect
        speedFactor: 1.0
      };
      
      const updatedRipples = [initialRipple, ...cursorRef.current.clickRipples]
        .slice(0, maxRipples);
      
      cursorRef.current = {
        ...cursorRef.current,
        isActive: true,
        clickRipples: updatedRipples
      };
      
      setCursor(cursorRef.current);
    };
    
    const handleMouseUp = (e: MouseEvent) => {
      if (!mouseDownInfo.current?.active || !size.width || !size.height || !textRef.current) {
        // If no active mousedown, just update the isActive state
        cursorRef.current = {
          ...cursorRef.current,
          isActive: false
        };
        setCursor(cursorRef.current);
        return;
      }
      
      // Calculate hold duration
      const holdDuration = Date.now() - mouseDownInfo.current.startTime;
      
      // Get current mouse position for the ripple
      const rect = textRef.current.getBoundingClientRect();
      const relativeX = e.clientX - rect.left;
      const relativeY = e.clientY - rect.top + SAFARI_CURSOR_Y_OFFSET;
      
      const normalizedX = (relativeX / (size.width || 1)) * 2 - 1;
      const normalizedY = (relativeY / (size.height || 1)) * 2 - 1;
      
      // Intensity increases with hold duration (clamped to reasonable max)
      // Map holdDuration from 0-2000ms to intensity 0.5-1.0
      const holdIntensity = Math.min(1.0, 0.5 + (holdDuration / 2000) * 0.5);
      
      // Lifespan also increases with hold duration
      // Map holdDuration from 0-2000ms to lifespan 1000-3000ms
      const holdLifespan = 1000 + (holdDuration / 2000) * 2000;
      
      // Generate random speed factor between 0.8-1.5 with slight bias based on hold duration
      const speedBoost = Math.min(0.3, holdDuration / 5000); // Small boost based on hold time
      const speedFactor = 0.8 + Math.random() * 0.7 + speedBoost;
      
      // New ripple with timestamp
      const newRipple: ClickRipple = {
        position: { x: normalizedX, y: normalizedY },
        timestamp: Date.now(),
        lifespan: holdLifespan,
        intensity: holdIntensity,
        speedFactor
      };
      
      // Add new ripple and maintain maximum ripples limit
      const updatedRipples = [newRipple, ...cursorRef.current.clickRipples]
        .slice(0, maxRipples);
      
      cursorRef.current = {
        ...cursorRef.current,
        isActive: false,
        clickRipples: updatedRipples
      };
      
      setCursor(cursorRef.current);
      
      // Reset mousedown tracking
      mouseDownInfo.current = null;
    };

    // Keep the click handler to maintain existing behavior
    const handleClick = (e: MouseEvent) => {
      // This is now just a fallback handler for click events
      // Only create a ripple if there was no mousedown/mouseup sequence
      if (mouseDownInfo.current === null && !cursorRef.current.whiteout?.active) {
        if (!size.width || !size.height || !textRef.current) return;
        
        const rect = textRef.current.getBoundingClientRect();
        const relativeX = e.clientX - rect.left;
        const relativeY = e.clientY - rect.top + SAFARI_CURSOR_Y_OFFSET;
        
        const normalizedX = (relativeX / (size.width || 1)) * 2 - 1;
        const normalizedY = (relativeY / (size.height || 1)) * 2 - 1;
        
        // Generate fallback ripple with default values
        const lifespan = 1000 + Math.random() * 2000;
        const intensity = 0.5 + Math.random() * 0.5;
        const speedFactor = 0.8 + Math.random() * 0.7;
        
        const newRipple: ClickRipple = {
          position: { x: normalizedX, y: normalizedY },
          timestamp: Date.now(),
          lifespan,
          intensity,
          speedFactor
        };
        
        const updatedRipples = [newRipple, ...cursorRef.current.clickRipples]
          .slice(0, maxRipples);
        
        cursorRef.current = {
          ...cursorRef.current,
          clickRipples: updatedRipples
        };
        
        setCursor(cursorRef.current);
      }
    };
    
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mouseenter', handleMouseEnter);
    window.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('click', handleClick);
    
    // Add touch event listeners to the text element
    const element = textRef.current;
    if (element) {
      element.addEventListener('touchstart', handleTouchStart, { passive: false });
      element.addEventListener('touchmove', handleTouchMove, { passive: false });
      element.addEventListener('touchend', handleTouchEnd);
      element.addEventListener('touchcancel', handleTouchEnd);
    }
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseenter', handleMouseEnter);
      window.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('click', handleClick);
      
      // Remove touch event listeners
      if (element) {
        element.removeEventListener('touchstart', handleTouchStart);
        element.removeEventListener('touchmove', handleTouchMove);
        element.removeEventListener('touchend', handleTouchEnd);
        element.removeEventListener('touchcancel', handleTouchEnd);
      }
    };
  }, [size, textRef]);

  // Touch handlers
  const handleTouchMove = (e: TouchEvent) => {
    const now = performance.now();
    if (now - lastMouseMoveTime.current < MOUSE_MOVE_THROTTLE) {
      return;
    }
    lastMouseMoveTime.current = now;
    
    if (!size.width || !size.height || !textRef.current) return;
    
    // Skip tracking if whiteout is active
    if (cursorRef.current.whiteout?.active || cursorRef.current.whiteIn?.active) {
      return;
    }
    
    const touch = e.touches[0];
    const rect = textRef.current.getBoundingClientRect();
    const relativeX = touch.clientX - rect.left;
    const relativeY = touch.clientY - rect.top + SAFARI_CURSOR_Y_OFFSET;
    
    updateCursorPosition(relativeX, relativeY);
  };

  const handleTouchStart = (e: TouchEvent) => {
    if (!size.width || !size.height || !textRef.current) return;
    
    const touch = e.touches[0];
    const rect = textRef.current.getBoundingClientRect();
    const relativeX = touch.clientX - rect.left;
    const relativeY = touch.clientY - rect.top + SAFARI_CURSOR_Y_OFFSET;
    
    updateCursorPosition(relativeX, relativeY, true);
  };

  const handleTouchEnd = () => {
    cursorRef.current = {
      ...cursorRef.current,
      isActive: false
    };
    setCursor(cursorRef.current);
  };

  // Helper function to update cursor position
  const updateCursorPosition = (relativeX: number, relativeY: number, isTouchStart: boolean = false) => {
    const gridX = Math.floor(relativeX / CHAR_WIDTH);
    const gridY = Math.floor(relativeY / CHAR_HEIGHT);
    
    const gridDimensions = getGridDimensions(size.width || 0, size.height || 0);
    const normalizedX = (gridX / gridDimensions.cols) * 2 - 1;
    const normalizedY = (gridY / gridDimensions.rows) * 2 - 1;
    
    // Update ripples on every move
    const currentTime = Date.now();
    const activeRipples = cursorRef.current.clickRipples.filter(ripple => {
      const age = currentTime - ripple.timestamp;
      return age < ripple.lifespan;
    });

    cursorRef.current = {
      grid: { x: gridX, y: gridY },
      normalized: { x: normalizedX, y: normalizedY },
      isInWindow: true,
      isActive: isTouchStart ? true : cursorRef.current.isActive,
      clickRipples: activeRipples,
      whiteout: cursorRef.current.whiteout,
      whiteIn: cursorRef.current.whiteIn,
      whiteOverlay: cursorRef.current.whiteOverlay
    };
    
    if (performance.now() % 100 < MOUSE_MOVE_THROTTLE) {
      setCursor(cursorRef.current);
    }
  };

  // Function to activate the white overlay
  const activateWhiteOverlay = () => {
    console.log('🌟 Activating white overlay');
    
    // Create white overlay state
    const newOverlay: WhiteOverlayState = {
      active: true,
      timestamp: Date.now(),
      fadeInComplete: false
    };
    
    // Store in session storage for persistence across page loads
    try {
      sessionStorage.setItem('whiteOverlayActive', 'true');
      sessionStorage.setItem('whiteOverlayTimestamp', String(Date.now()));
    } catch (e) {
      console.warn('Unable to store white overlay state in sessionStorage', e);
    }
    
    // Update cursor state with the new overlay
    cursorRef.current = {
      ...cursorRef.current,
      whiteOverlay: newOverlay
    };
    
    setCursor({...cursorRef.current});
    
    // Create the DOM element for the overlay
    createWhiteOverlayElement();
  };
  
  // Function to create the white overlay DOM element
  const createWhiteOverlayElement = () => {
    if (typeof document === 'undefined') return;
    
    // Remove any existing overlay
    const existingOverlay = document.getElementById('white-transition-overlay');
    if (existingOverlay) {
      document.body.removeChild(existingOverlay);
    }
    
    // Create new overlay
    const overlay = document.createElement('div');
    overlay.id = 'white-transition-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = '#ffffff';
    overlay.style.zIndex = '9999';
    overlay.style.opacity = '0'; // Start transparent
    overlay.style.transition = 'opacity 100ms ease';
    overlay.style.pointerEvents = 'none';
    
    document.body.appendChild(overlay);
    
    // Force a reflow
    void overlay.offsetHeight;
    
    // Fade in
    overlay.style.opacity = '1';
    
    // Mark fade-in as complete after transition
    setTimeout(() => {
      if (cursorRef.current.whiteOverlay) {
        cursorRef.current = {
          ...cursorRef.current,
          whiteOverlay: {
            ...cursorRef.current.whiteOverlay,
            fadeInComplete: true
          }
        };
        setCursor({...cursorRef.current});
      }
    }, 100);
  };
  
  // Function to deactivate the white overlay
  const deactivateWhiteOverlay = () => {
    console.log('🌟 Deactivating white overlay');
    
    // Clear session storage
    try {
      sessionStorage.removeItem('whiteOverlayActive');
      sessionStorage.removeItem('whiteOverlayTimestamp');
    } catch (e) {
      console.warn('Unable to clear white overlay state from sessionStorage', e);
    }
    
    // Get the overlay element
    const overlay = document.getElementById('white-transition-overlay');
    if (overlay) {
      // Fade out
      overlay.style.opacity = '0';
      
      // Remove after transition
      setTimeout(() => {
        if (overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
      }, 100);
    }
    
    // Update cursor state
    cursorRef.current = {
      ...cursorRef.current,
      whiteOverlay: null
    };
    
    setCursor({...cursorRef.current});
  };

  // Function to start a white-in effect
  const startWhiteIn = (position: { x: number; y: number }) => {
    console.log('🌟 Starting white-in effect');
    
    // Before starting the white-in effect, ensure the cursor position is initialized
    // This allows the background animation to properly display with the mouse "in the window"
    // Convert from normalized coordinates to grid coordinates
    if (size.width && size.height) {
      const gridDimensions = getGridDimensions(size.width, size.height);
      // Convert from normalized (-1 to 1) to grid coordinates
      const gridX = Math.floor(((position.x + 1) / 2) * gridDimensions.cols);
      const gridY = Math.floor(((position.y + 1) / 2) * gridDimensions.rows);
      
      // Update cursor state to indicate the mouse is in the window at the white-in position
      cursorRef.current = {
        ...cursorRef.current,
        grid: { x: gridX, y: gridY },
        normalized: position,
        isInWindow: true, // Critical for background animation
      };
      
      // Update cursor state immediately
      setCursor({...cursorRef.current});
    }
    
    // Create a fresh white-in object
    const newWhiteIn: WhiteInState = {
      active: true,
      position,
      timestamp: Date.now(),
      progress: 1, // Start fully white (1) and fade in to fully visible (0)
      duration: 1000 // 2 seconds for the full white-in
    };
    
    // Clear any existing animation frame
    if (whiteInAnimationRef.current) {
      cancelAnimationFrame(whiteInAnimationRef.current);
    }
    
    // Directly update cursor state to trigger immediate re-render
    cursorRef.current = {
      ...cursorRef.current,
      whiteIn: newWhiteIn
    };
    
    setCursor({...cursorRef.current});
    
    // Start the animation immediately
    animateWhiteIn(newWhiteIn);
  };

  // Animate the white-in effect
  const animateWhiteIn = (whiteIn: WhiteInState) => {
    const updateWhiteIn = () => {
      const currentTime = Date.now();
      
      if (!whiteIn) return;
      
      const elapsed = currentTime - whiteIn.timestamp;
      // Progress goes from 1 to 0 (reverse of whiteout)
      const progress = Math.max(0, 1 - (elapsed / whiteIn.duration));
      
      // Update the white-in progress
      cursorRef.current = {
        ...cursorRef.current,
        whiteIn: {
          ...whiteIn,
          progress
        }
      };
      
      setCursor({...cursorRef.current});
      
      // Check if we need to deactivate the white overlay
      // Deactivate when progress is below 95% (first 5% of animation)
      if (progress < 0.95 && cursorRef.current.whiteOverlay?.active) {
        deactivateWhiteOverlay();
      }
      
      // If the white-in is complete, clean up
      if (progress <= 0) {
        console.log('✅ White-in complete');
        // Set white-in to inactive
        cursorRef.current = {
          ...cursorRef.current,
          whiteIn: null
        };
        setCursor({...cursorRef.current});
        
        // Simulate a mouse click at the white-in focus position to trigger a ripple effect
        simulateClick(whiteIn.position);
      } else {
        whiteInAnimationRef.current = requestAnimationFrame(updateWhiteIn);
      }
    };
    
    whiteInAnimationRef.current = requestAnimationFrame(updateWhiteIn);
  };

  // Function to simulate a mouse click at a specific position to trigger ripple effect
  const simulateClick = (position: { x: number; y: number }) => {
    console.log('🖱️ Simulating click at position:', position);
    
    if (!size.width || !size.height || !textRef.current) return;
    
    // Convert normalized coordinates to pixel coordinates
    // const pixelX = ((position.x + 1) / 2) * rect.width + rect.left; // Removed
    // const pixelY = ((position.y + 1) / 2) * rect.height + rect.top; // Removed
    
    // Generate random parameters for the ripple (similar to handleClick)
    const lifespan = 1000 + Math.random() * 2000;
    const intensity = 0.5 + Math.random() * 0.5;
    const speedFactor = 0.8 + Math.random() * 0.7;
    
    // Create the new ripple
    const newRipple: ClickRipple = {
      position,
      timestamp: Date.now(),
      lifespan,
      intensity,
      speedFactor
    };
    
    // Add new ripple and maintain maximum ripples limit
    const updatedRipples = [newRipple, ...cursorRef.current.clickRipples]
      .slice(0, maxRipples);
    
    // Ensure the cursor is recognized as being in the window for the background animation
    cursorRef.current = {
      ...cursorRef.current,
      clickRipples: updatedRipples,
      isInWindow: true, // Ensure this flag is set for the animation
      normalized: position
    };
    
    setCursor(cursorRef.current);
  };

  // Function to start a whiteout effect
  const startWhiteout = (position: { x: number; y: number }, targetUrl: string) => {
    console.log('🌟 Starting whiteout effect to:', targetUrl);
    
    // Create a fresh whiteout object without carrying over any previous state
    const newWhiteout = {
      active: true,
      position,
      timestamp: Date.now(),
      targetUrl,
      progress: 0,
      duration: 1000, // 1.5 seconds for the full whiteout
      justStarted: true // Flag to indicate this is the beginning of the whiteout
    };
    
    // Clear any existing animation frame
    if (whiteoutAnimationRef.current) {
      cancelAnimationFrame(whiteoutAnimationRef.current);
    }
    
    // Directly update cursor state to trigger immediate re-render
    cursorRef.current = {
      ...cursorRef.current,
      whiteout: newWhiteout
    };
    
    setCursor({...cursorRef.current});
    
    // Start the animation immediately without waiting for the effect
    animateWhiteout(newWhiteout);
    
    // After a short delay, turn off the justStarted flag
    setTimeout(() => {
      if (cursorRef.current.whiteout) {
        cursorRef.current = {
          ...cursorRef.current,
          whiteout: {
            ...cursorRef.current.whiteout,
            justStarted: false
          }
        };
        setCursor({...cursorRef.current});
      }
    }, 100);
  };

  // Animate the whiteout effect
  const animateWhiteout = (whiteout: WhiteoutState) => {
    const updateWhiteout = () => {
      const currentTime = Date.now();
      
      if (!whiteout) return;
      
      const elapsed = currentTime - whiteout.timestamp;
      const progress = Math.min(1, elapsed / whiteout.duration);
      
      // Update the whiteout progress
      cursorRef.current = {
        ...cursorRef.current,
        whiteout: {
          ...whiteout,
          progress
        }
      };
      
      setCursor({...cursorRef.current});
      
      // Check if we need to activate the white overlay
      // Activate when progress is above 95% (final 5% of animation)
      if (progress > 0.95 && !cursorRef.current.whiteOverlay?.active) {
        activateWhiteOverlay();
      }
      
      // If the whiteout is complete, navigate to the target URL
      if (progress >= 1) {
        console.log('✅ Whiteout complete, navigating to:', whiteout.targetUrl);

        // Store a flag in sessionStorage to indicate we need a white-in on the next page
        try {
          sessionStorage.setItem('needsWhiteIn', 'true');
          // Store the timestamp to prevent immediate re-triggering
          sessionStorage.setItem('lastWhiteInTimestamp', String(Date.now()));
          // Store the target position for white-in (current cursor or center)
          const position = cursorRef.current.isInWindow 
            ? JSON.stringify(cursorRef.current.normalized)
            : JSON.stringify({ x: 0, y: 0 });
          sessionStorage.setItem('whiteInPosition', position);
        } catch (e) {
          console.warn('Unable to store white-in state in sessionStorage', e);
        }

        setTimeout(() => {
          window.location.href = whiteout.targetUrl;
        }, 100); // Small delay to ensure the whiteout is fully visible
      } else {
        whiteoutAnimationRef.current = requestAnimationFrame(updateWhiteout);
      }
    };
    
    whiteoutAnimationRef.current = requestAnimationFrame(updateWhiteout);
  };

  // Check for overlay state in sessionStorage on mount
  useEffect(() => {
    try {
      const overlayActive = sessionStorage.getItem('whiteOverlayActive');
      if (overlayActive === 'true') {
        console.log('😎 Restoring white overlay from previous page');
        // Reactivate the overlay
        createWhiteOverlayElement();
        
        // Set overlay state
        cursorRef.current = {
          ...cursorRef.current,
          whiteOverlay: {
            active: true,
            timestamp: Number(sessionStorage.getItem('whiteOverlayTimestamp') || Date.now()),
            fadeInComplete: true
          }
        };
        
        setCursor({...cursorRef.current});
      }
    } catch (e) {
      console.warn('Error checking sessionStorage for whiteOverlayActive', e);
    }
  }, []);

  // Check for "needsWhiteIn" in sessionStorage on mount
  useEffect(() => {
    try {
      const needsWhiteIn = sessionStorage.getItem('needsWhiteIn');
      if (needsWhiteIn === 'true' && size.width && size.height) {
        // Get the stored position for white-in
        let position = { x: 0, y: 0 }; // Default to center
        try {
          const storedPosition = sessionStorage.getItem('whiteInPosition');
          if (storedPosition) {
            position = JSON.parse(storedPosition);
          }
        } catch (e) {
          console.warn('Error parsing stored position', e);
        }

        // Clear the flag to prevent duplicate white-ins
        sessionStorage.removeItem('needsWhiteIn');
        
        // Initialize cursor state with the white-in position before starting the effect
        const gridDimensions = getGridDimensions(size.width, size.height);
        // Convert from normalized (-1 to 1) to grid coordinates
        const gridX = Math.floor(((position.x + 1) / 2) * gridDimensions.cols);
        const gridY = Math.floor(((position.y + 1) / 2) * gridDimensions.rows);
        
        // Update cursor state to indicate the mouse is in the window at the white-in position
        cursorRef.current = {
          ...cursorRef.current,
          grid: { x: gridX, y: gridY },
          normalized: position,
          isInWindow: true, // Critical for background animation
        };
        
        // Update cursor state immediately
        setCursor({...cursorRef.current});
        
        // Execute white-in after a short delay to ensure the page is ready
        setTimeout(() => {
          startWhiteIn(position);
        }, 100);
      }
    } catch (e) {
      console.warn('Error checking sessionStorage for needsWhiteIn', e);
    }
  }, [size.width, size.height]);

  // Clean up animations on unmount
  useEffect(() => {
    return () => {
      if (whiteoutAnimationRef.current) {
        cancelAnimationFrame(whiteoutAnimationRef.current);
      }
      if (whiteInAnimationRef.current) {
        cancelAnimationFrame(whiteInAnimationRef.current);
      }
      if (whiteOverlayAnimationRef.current) {
        cancelAnimationFrame(whiteOverlayAnimationRef.current);
      }
    };
  }, []);

  // Return required cursor state and methods
  return {
    cursor,
    cursorRef,
    startWhiteout,
    startWhiteIn,
    simulateClick
  };
}; 