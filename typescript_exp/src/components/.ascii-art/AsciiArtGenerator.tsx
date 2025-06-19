import { useRef, useState, useEffect } from 'react';
import {
  AsciiArtGeneratorProps,
  LinkPosition,
  CursorState,
  BlobGridCache,
  SCALE_FACTOR,
  CHAR_WIDTH,
  CHAR_HEIGHT,
  FRAME_DURATION,
  MOUSE_MOVE_THROTTLE,
  selectedCharacterSet,
  characterSetLength,
  getGridDimensions,
  calculateCharacter
} from './asciiArtUtils';
import {
  useAsciiArtCache,
  useContentHeight,
  useMaxScroll,
  useTextPositionCache,
  useBuildBlobCache,
  useTrigTables
} from './AsciiArtGeneratorHelpers';

// Interface for click animation state
interface ClickAnimation {
  id: number;
  x: number;
  y: number;
  isLink: boolean;
  timestamp: number;
  type: 'ripple' | 'bloom';
  active: boolean;
  progress: number;
}

// Debug log entry interface
interface DebugLogEntry {
  id: number;
  message: string;
  timestamp: number;
}

const AsciiArtGenerator = ({ textContent, maxScrollHeight }: AsciiArtGeneratorProps) => {
    const textRef = useRef<HTMLDivElement>(null);
    const lastFrameTimeRef = useRef<number>(0);
    const [size, setSize] = useState<{ height: number | null; width: number | null }>({ height: null, width: null });
    
    // Scroll state
    const scrollOffsetRef = useRef(0);
    const isScrolling = useRef(false);
    const scrollVelocity = useRef(0);
    const lastScrollTime = useRef(0);
    
    // Link state
    const linkPositionsRef = useRef<LinkPosition[]>([]);
    
    // Click animation state
    const [clickAnimations, setClickAnimations] = useState<ClickAnimation[]>([]);
    const animationIdCounter = useRef(0);
    
    // Debug state
    const [showDebug, setShowDebug] = useState(false);
    const [debugLogs, setDebugLogs] = useState<DebugLogEntry[]>([]);
    const debugLogIdCounter = useRef(0);
    
    // Add debug log function
    const addDebugLog = (message: string) => {
        const id = debugLogIdCounter.current++;
        const newLog = { id, message, timestamp: Date.now() };
        setDebugLogs(prev => [newLog, ...prev].slice(0, 10)); // Keep only last 10 logs
    };
    
    // Create a direct function to trigger animations
    const triggerClickAnimation = (x: number, y: number, isLink: boolean) => {
        const animationId = animationIdCounter.current++;
        addDebugLog(`Animation triggered: id=${animationId}, isLink=${isLink}, pos=(${x}, ${y})`);
        
        // Determine animation type based on isLink
        const animationType: 'ripple' | 'bloom' = isLink ? 'bloom' : 'ripple';
        
        setClickAnimations(prevAnimations => {
            const newAnimations = [
                ...prevAnimations,
                {
                    id: animationId,
                    x: x,
                    y: y,
                    isLink: isLink,
                    timestamp: performance.now(),
                    type: animationType,
                    active: true,
                    progress: 0
                }
            ];
            
            addDebugLog(`Total animations: ${newAnimations.length}`);
            return newAnimations;
        });
        
        // Clean up old animations after they finish
        setTimeout(() => {
            setClickAnimations(prevAnimations => {
                const newAnimations = prevAnimations.filter(animation => animation.id !== animationId);
                addDebugLog(`Animation ${animationId} removed, ${newAnimations.length} remaining`);
                return newAnimations;
            });
        }, isLink ? 800 : 500); // Longer duration for link animations
    };
    
    // Check if a click is on a link
    const checkIfClickOnLink = (x: number, y: number, clientX: number, clientY: number): boolean => {
        // First check if the click is directly on an <a> tag using document.elementFromPoint
        const element = document.elementFromPoint(clientX, clientY);
        if (element && (element.tagName === 'A' || element.closest('a'))) {
            addDebugLog(`Link detected via DOM at (${clientX}, ${clientY})`);
            return true;
        }
        
        // Then check via our manual link position tracking
        if (!size.width || !size.height || !textRef.current) return false;
        
        const width = textRef.current.clientWidth;
        const height = textRef.current.clientHeight;
        
        const clickX = x / width;
        const clickY = y / height;
        
        const { cols, rows } = getGridDimensions(size.width, size.height);
        const gridX = Math.floor(clickX * cols);
        const gridY = Math.floor(clickY * rows);
        
        const scrolledY = Math.floor(scrollOffsetRef.current / CHAR_HEIGHT);
        
        for (const link of linkPositionsRef.current) {
            const effectiveY = link.y - (link.textKey.includes('-fixed') ? 0 : scrolledY);
            if (gridX >= link.startX && gridX <= link.endX && gridY === effectiveY) {
                addDebugLog(`Link detected via position tracking: ${link.url}`);
                return true;
            }
        }
        
        return false;
    };
    
    // Toggle debug overlay with 'd' key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'd') {
                setShowDebug(prev => !prev);
            }
        };
        
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);
    
    const lastFrameRef = useRef<string[][]>([]);

    // Cursor references
    const cursorRef = useRef<CursorState>({
        grid: { x: 0, y: 0 },
        normalized: { x: 0, y: 0 },
        isInWindow: false,
        isActive: false
    });
    
    const lastMouseMoveTime = useRef(0);

    // Touch gesture
    const touchStartY = useRef(0);
    const touchStartTime = useRef(0);
    const lastTouchY = useRef(0);
    const isTouching = useRef(false);

    // Blob cache
    const blobGridCache = useRef<BlobGridCache>({
        grid: {},
        startX: 0,
        startY: 0,
        width: 0,
        height: 0
    });

    const spatialGridRef = useRef<{[key: string]: Array<{textKey: string, x: number, y: number}>}>({});
    const needsRebuildRef = useRef(true);
    const rebuildCacheTimeoutRef = useRef<number | null>(null);
    const scrollTimeoutRef = useRef<number | null>(null);

    // Get utilities using custom hooks
    const asciiArtCache = useAsciiArtCache(textContent);
    const contentHeight = useContentHeight(textContent);
    const maxScroll = useMaxScroll(size, contentHeight, maxScrollHeight);
    const { sinTable, cosTable } = useTrigTables();

    // Build the text position cache
    const textPositionCache = useTextPositionCache(
      size,
      textContent,
      asciiArtCache,
      linkPositionsRef
    );

    // Build blob cache function
    const buildBlobCache = useBuildBlobCache(size, textPositionCache, scrollOffsetRef);

    // Enhanced scrolling effect with speed detection
    useEffect(() => {
        let animationFrameId: number;
        
        const updateScroll = (timestamp: number) => {
            const elapsed = timestamp - lastScrollTime.current;
            lastScrollTime.current = timestamp;
            
            if (elapsed > 0) {
                if (!isScrolling.current && scrollVelocity.current !== 0) {
                    const friction = 0.95;
                    scrollVelocity.current *= Math.pow(friction, elapsed / 16);
                    
                    if (Math.abs(scrollVelocity.current) < 0.1) {
                        scrollVelocity.current = 0;
                    } else {
                        let newOffset = scrollOffsetRef.current + scrollVelocity.current;
                        newOffset = Math.max(0, Math.min(maxScroll, newOffset));
                        if (newOffset === 0 || newOffset === maxScroll) {
                            scrollVelocity.current = 0;
                        }
                        scrollOffsetRef.current = newOffset;
                        if (Math.abs(scrollVelocity.current) > 5) {
                            needsRebuildRef.current = true;
                        }
                    }
                }
            }
            animationFrameId = requestAnimationFrame(updateScroll);
        };
        
        animationFrameId = requestAnimationFrame(updateScroll);
        return () => cancelAnimationFrame(animationFrameId);
    }, [maxScroll]);

    // Wheel scroll
    useEffect(() => {
        if (!textRef.current) return;
        
        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            isScrolling.current = true;
            
            const scrollMultiplier = 1.0;
            let delta = e.deltaY * scrollMultiplier;
            
            let newScrollOffset = scrollOffsetRef.current + delta;
            newScrollOffset = Math.max(0, Math.min(maxScroll, newScrollOffset));
            
            scrollOffsetRef.current = newScrollOffset;
            
            scrollVelocity.current = delta * 0.8;
            lastScrollTime.current = performance.now();
            
            if (Math.abs(delta) > 50) {
                needsRebuildRef.current = true;
            }
            
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
            }
            
            scrollTimeoutRef.current = setTimeout(() => {
                isScrolling.current = false;
            }, 150);
        };
        
        const element = textRef.current;
        element.addEventListener('wheel', handleWheel, { passive: false });
        
        return () => {
            element.removeEventListener('wheel', handleWheel);
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
            }
        };
    }, [maxScroll]);

    // Animation
    useEffect(() => {
        const element = textRef.current;
        if (!element || !size.width || !size.height) return;

        const { cols, rows } = getGridDimensions(size.width, size.height);
        const aspectRatio = size.width / size.height;
        
        // Ensure lastFrameRef has enough rows allocated
        if (!lastFrameRef.current || lastFrameRef.current.length !== rows) {
            lastFrameRef.current = new Array(rows)
                .fill(null)
                .map(() => new Array(cols).fill(' '));
        }
        
        let animationFrameId: number;
        
        const BASE_CHUNK_SIZE = 15;
        const numChunks = Math.ceil(rows / BASE_CHUNK_SIZE);
        
        // We'll build rowBuffers as an array of string arrays
        const rowBuffers: string[][] = new Array(rows)
            .fill(null)
            .map(() => new Array(cols).fill(' '));
        
        const animate = (timestamp: number) => {
            if (timestamp - lastFrameTimeRef.current >= FRAME_DURATION) {
                // Set quality based on scrolling state
                let skipFactor = 1;
                let chunkSizeFactor = 1;
                
                const isCompletelyStill = !isScrolling.current && Math.abs(scrollVelocity.current) < 0.05;
                
                if (!isCompletelyStill) {
                    if (Math.abs(scrollVelocity.current) > 40) {
                        skipFactor = 3;
                        chunkSizeFactor = 3;
                    } else if (Math.abs(scrollVelocity.current) > 20) {
                        skipFactor = 2;
                        chunkSizeFactor = 2;
                    } else {
                        skipFactor = 2;
                        chunkSizeFactor = 1.5;
                    }
                }
                
                lastFrameTimeRef.current = timestamp;
                const adjustedChunkSize = Math.ceil(BASE_CHUNK_SIZE * chunkSizeFactor);
                
                // Clear all row buffers at the start of each frame
                for (let y = 0; y < rows; y++) {
                    for (let x = 0; x < cols; x++) {
                        rowBuffers[y][x] = ' ';
                    }
                }
                
                // Render in chunks with full screen refresh on each frame
                for (let chunk = 0; chunk < numChunks; chunk++) {
                    const startRow = chunk * BASE_CHUNK_SIZE;
                    const endRow = Math.min(startRow + adjustedChunkSize, rows);
                    
                    for (let y = startRow; y < endRow; y++) {
                        for (let x = 0; x < cols; x += skipFactor) {
                            const char = calculateCharacterWithAnimation(
                                x, y, cols, rows, aspectRatio, timestamp,
                                cursorRef.current, scrollOffsetRef.current, 
                                textPositionCache, blobGridCache.current,
                                clickAnimations, sinTable, cosTable
                            );
                            rowBuffers[y][x] = char;
                            // Fill in skipped positions with the same character if needed
                            for (let i = 1; i < skipFactor && x + i < cols; i++) {
                                rowBuffers[y][x+i] = char;
                            }
                        }
                    }
                }
                
                // Now store rowBuffers in lastFrameRef 
                for (let y = 0; y < rows; y++) {
                    for (let x = 0; x < cols; x++) {
                        lastFrameRef.current[y][x] = rowBuffers[y][x];
                    }
                }
                
                // Check if textContent contains HTML tags/styled text
                const hasStyledText = textContent.some(item => 
                    item.text && (
                        item.text.includes('**') || // Bold
                        item.text.includes('//') || // Italic
                        item.text.includes('[') && item.text.includes('](') || // Links
                        item.text.includes('&&') // Color
                    )
                );
                
                console.log('Has styled text?', hasStyledText);
                
                // Clear the element content before updating
                while (element.firstChild) {
                    element.removeChild(element.firstChild);
                }
                
                // Instead of using innerHTML which isn't working well for styling,
                // we'll create DOM elements directly with proper styling
                const containers: HTMLDivElement[] = [];
                
                // First, extract all links from textContent for direct application
                const allLinks: Array<{text: string, url: string}> = [];
                textContent.forEach(item => {
                    if (!item.text) return;
                    
                    // Extract link information using regex
                    const linkRegex = /\[(.*?)\]\((.*?)\)/g;
                    let match;
                    while ((match = linkRegex.exec(item.text)) !== null) {
                        allLinks.push({
                            text: match[1],
                            url: match[2]
                        });
                    }
                });
                
                console.log('Found links:', allLinks);
                
                // Create a div for each line
                for (let y = 0; y < rows; y++) {
                    const lineDiv = document.createElement('div');
                    lineDiv.style.whiteSpace = 'pre';
                    lineDiv.style.lineHeight = `${SCALE_FACTOR}px`;
                    lineDiv.style.height = `${SCALE_FACTOR}px`;
                    lineDiv.style.fontFamily = 'monospace';
                    
                    // Add the text content for this line
                    const lineText = rowBuffers[y].join('');
                    
                    // Check if this line contains link text
                    let processedLine = lineText;
                    for (const link of allLinks) {
                        // Replace the link text with a styled version
                        const linkText = link.text;
                        if (processedLine.includes(linkText)) {
                            const parts = processedLine.split(linkText);
                            processedLine = '';
                            
                            for (let i = 0; i < parts.length; i++) {
                                processedLine += parts[i];
                                if (i < parts.length - 1) {
                                    // Insert link element
                                    const linkSpan = document.createElement('a');
                                    linkSpan.href = link.url;
                                    linkSpan.target = '_blank';
                                    linkSpan.textContent = linkText;
                                    linkSpan.style.color = '#3498db';
                                    linkSpan.style.textDecoration = 'underline';
                                    linkSpan.style.cursor = 'pointer';
                                    linkSpan.style.fontWeight = 'bold';
                                    
                                    lineDiv.appendChild(document.createTextNode(processedLine));
                                    lineDiv.appendChild(linkSpan);
                                    
                                    processedLine = ''; // Reset for next part
                                }
                            }
                            
                            if (processedLine) {
                                lineDiv.appendChild(document.createTextNode(processedLine));
                            }
                            
                            // Skip setting textContent since we've added nodes
                            processedLine = '';
                            break;
                        }
                    }
                    
                    // If no links were processed, set the text content directly
                    if (processedLine) {
                        lineDiv.textContent = processedLine;
                    }
                    
                    // Store the line
                    containers.push(lineDiv);
                    element.appendChild(lineDiv);
                }
                
                // If this text is styled, we need to manually apply bold and italic styling
                if (hasStyledText && false) { // Temporarily disable other styling to focus on links
                    console.log('Applying styling with direct DOM manipulation');
                    
                    // Find all instances of **bold**
                    const boldRegex = /\*\*(.*?)\*\*/g;
                    for (let i = 0; i < containers.length; i++) {
                        const lineDiv = containers[i];
                        const text = lineDiv.textContent || '';
                        let match;
                        let lastIndex = 0;
                        let newHtml = '';
                        
                        // Reset the regex
                        boldRegex.lastIndex = 0;
                        
                        while ((match = boldRegex.exec(text)) !== null) {
                            // Add text before the match
                            newHtml += text.substring(lastIndex, match.index);
                            
                            // Add the bold text
                            newHtml += `<span style="font-weight: bold !important;" class="bold">${match[1]}</span>`;
                            
                            // Update the last index
                            lastIndex = match.index + match[0].length;
                        }
                        
                        // Add any remaining text
                        if (lastIndex < text.length) {
                            newHtml += text.substring(lastIndex);
                        }
                        
                        // Only update if styling was found
                        if (newHtml !== text) {
                            lineDiv.innerHTML = newHtml;
                        }
                    }
                    
                    // Find all instances of //italic//
                    const italicRegex = /\/\/(.*?)\/\//g;
                    for (let i = 0; i < containers.length; i++) {
                        const lineDiv = containers[i];
                        const html = lineDiv.innerHTML;
                        
                        // Replace italic markers with styled spans
                        const newHtml = html.replace(
                            italicRegex,
                            '<span style="font-style: italic !important;" class="italic">$1</span>'
                        );
                        
                        // Only update if styling was found
                        if (newHtml !== html) {
                            lineDiv.innerHTML = newHtml;
                        }
                    }
                    
                    // Find all instances of [link](url)
                    const linkRegex = /\[(.*?)\]\((.*?)\)/g;
                    for (let i = 0; i < containers.length; i++) {
                        const lineDiv = containers[i];
                        const html = lineDiv.innerHTML;
                        
                        // Replace link markers with actual links
                        const newHtml = html.replace(
                            linkRegex,
                            '<a href="$2" target="_blank" style="color: #3498db !important; text-decoration: underline !important; cursor: pointer !important; font-weight: bold !important;">$1</a>'
                        );
                        
                        // Only update if styling was found
                        if (newHtml !== html) {
                            lineDiv.innerHTML = newHtml;
                            console.log('Applied link styling to line', i);
                        }
                    }
                    
                    // Find all instances of &&red&&
                    const redRegex = /&&(.*?)&&/g;
                    for (let i = 0; i < containers.length; i++) {
                        const lineDiv = containers[i];
                        const html = lineDiv.innerHTML;
                        
                        // Replace red text markers with styled spans
                        const newHtml = html.replace(
                            redRegex,
                            '<span style="color: #FF0000 !important;" class="red">$1</span>'
                        );
                        
                        // Only update if styling was found
                        if (newHtml !== html) {
                            lineDiv.innerHTML = newHtml;
                        }
                    }
                }
                
                // Find all instances of link text in the rendered content
                // and create absolutely positioned overlays for them
                const specialOverlay = document.querySelector('.styled-content-overlay') as HTMLDivElement;
                if (specialOverlay) {
                    // Clear the overlay
                    while (specialOverlay.firstChild) {
                        specialOverlay.removeChild(specialOverlay.firstChild);
                    }
                    
                    // Make sure the overlay can receive pointer events for links
                    specialOverlay.style.pointerEvents = 'none'; // Default to none to allow scrolling
                    
                    // Collect links from text content
                    console.log('Link positions:', linkPositionsRef.current);
                    
                    // Handle link positions directly
                    for (const link of linkPositionsRef.current) {
                        console.log('Processing link position:', link);
                        const scrolledY = Math.floor(scrollOffsetRef.current / CHAR_HEIGHT);
                        const effectiveY = link.y - (link.textKey.includes('-fixed') ? 0 : scrolledY);
                        
                        // Create a link overlay
                        const linkOverlay = document.createElement('a');
                        linkOverlay.style.position = 'absolute';
                        linkOverlay.style.left = `${link.startX * CHAR_WIDTH}px`;
                        linkOverlay.style.top = `${effectiveY * CHAR_HEIGHT}px`;
                        linkOverlay.style.width = `${(link.endX - link.startX + 1) * CHAR_WIDTH}px`;
                        linkOverlay.style.height = `${CHAR_HEIGHT}px`;
                        linkOverlay.style.backgroundColor = 'transparent';
                        linkOverlay.style.zIndex = '100';
                        linkOverlay.style.pointerEvents = 'auto';
                        linkOverlay.style.cursor = 'pointer';
                        linkOverlay.href = link.url;
                        linkOverlay.target = '_blank';
                        linkOverlay.rel = 'noopener noreferrer';
                        
                        // Add click handler to ensure proper navigation
                        linkOverlay.addEventListener('click', (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            window.open(link.url, '_blank', 'noopener,noreferrer');
                        });
                        
                        // Add wheel event handler to ensure scrolling works when the mouse is over a link
                        linkOverlay.addEventListener('wheel', (e) => {
                            // Prevent the link from capturing wheel events
                            e.stopPropagation();
                            
                            // Find the text element and dispatch the event to it
                            if (textRef.current) {
                                const wheelEvent = new WheelEvent('wheel', {
                                    deltaX: e.deltaX,
                                    deltaY: e.deltaY,
                                    deltaZ: e.deltaZ,
                                    deltaMode: e.deltaMode,
                                    bubbles: true
                                });
                                textRef.current.dispatchEvent(wheelEvent);
                            }
                        });
                        
                        // Add the link to the overlay
                        specialOverlay.appendChild(linkOverlay);
                        console.log('Added link overlay at', linkOverlay.style.left, linkOverlay.style.top);
                    }
                    
                    // Now handle bold, italic, and colored text
                    if (textContent.some(item => 
                        item.text && (
                            item.text.includes('**') || // Bold
                            item.text.includes('//') || // Italic
                            item.text.includes('&&') // Color
                        )
                    )) {
                        // Extract styling information from text content
                        textContent.forEach(item => {
                            if (!item.text) return;
                            
                            // Process bold text
                            const boldRegex = /\*\*(.*?)\*\*/g;
                            let boldMatch;
                            while ((boldMatch = boldRegex.exec(item.text)) !== null) {
                                console.log('Found bold text:', boldMatch[1]);
                                // We would apply similar overlay approach as links
                                // if we had position information for bold text
                            }
                            
                            // Process italic text
                            const italicRegex = /\/\/(.*?)\/\//g;
                            let italicMatch;
                            while ((italicMatch = italicRegex.exec(item.text)) !== null) {
                                console.log('Found italic text:', italicMatch[1]);
                                // We would apply similar overlay approach as links
                                // if we had position information for italic text
                            }
                            
                            // Process colored text
                            const redRegex = /&&(.*?)&&/g;
                            let redMatch;
                            while ((redMatch = redRegex.exec(item.text)) !== null) {
                                console.log('Found red text:', redMatch[1]);
                                // We would apply similar overlay approach as links
                                // if we had position information for colored text
                            }
                        });
                    }
                }
            }
            
            if (needsRebuildRef.current && !rebuildCacheTimeoutRef.current) {
                rebuildCacheTimeoutRef.current = window.setTimeout(() => {
                    const result = buildBlobCache();
                    if (result) {
                        blobGridCache.current = result;
                        spatialGridRef.current = result.spatialGrid;
                    }
                    needsRebuildRef.current = false;
                    rebuildCacheTimeoutRef.current = null;
                }, 100);
            }
            
            animationFrameId = requestAnimationFrame(animate);
        };
        
        // Initial build of the blob cache
        const initialCache = buildBlobCache();
        if (initialCache) {
            blobGridCache.current = initialCache;
            spatialGridRef.current = initialCache.spatialGrid;
        }
        needsRebuildRef.current = false;
        
        animationFrameId = requestAnimationFrame(animate);
        
        return () => {
            cancelAnimationFrame(animationFrameId);
            if (rebuildCacheTimeoutRef.current) {
                clearTimeout(rebuildCacheTimeoutRef.current);
                rebuildCacheTimeoutRef.current = null;
            }
        };
    }, [size, textPositionCache, buildBlobCache, sinTable, cosTable]);

    // Window resize handler
    useEffect(() => {
        const handleResize = () => {
            if (textRef.current) {
                const { width, height } = textRef.current.getBoundingClientRect();
                setSize({ width, height });
                cursorRef.current.isInWindow = false;
                needsRebuildRef.current = true;
            }
        };
        
        handleResize();
        window.addEventListener('resize', handleResize);
        
        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    // Mouse move handler
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!textRef.current || !size.width || !size.height) return;
            
            const currentTime = performance.now();
            if (currentTime - lastMouseMoveTime.current < MOUSE_MOVE_THROTTLE) return;
            lastMouseMoveTime.current = currentTime;
            
            const { left, top, width, height } = textRef.current.getBoundingClientRect();
            const x = (e.clientX - left) / width;
            const y = (e.clientY - top) / height;
            
            const isInside = x >= 0 && x <= 1 && y >= 0 && y <= 1;
            
            const { cols, rows } = getGridDimensions(size.width, size.height);
            const gridX = Math.floor(x * cols);
            const gridY = Math.floor(y * rows);
            
            const newState: CursorState = {
                grid: { x: gridX, y: gridY },
                normalized: { x: x * 2 - 1, y: y * 2 - 1 },
                isInWindow: isInside,
                isActive: true
            };
            
            cursorRef.current = newState;
        };
        
        const handleMouseLeave = () => {
            cursorRef.current.isInWindow = false;
        };
        
        const handleMouseEnter = () => {
            cursorRef.current.isInWindow = true;
        };
        
        window.addEventListener('mousemove', handleMouseMove);
        const element = textRef.current;
        if (element) {
            element.addEventListener('mouseenter', handleMouseEnter);
            element.addEventListener('mouseleave', handleMouseLeave);
        }
        
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            if (element) {
                element.removeEventListener('mouseenter', handleMouseEnter);
                element.removeEventListener('mouseleave', handleMouseLeave);
            }
        };
    }, [size]);

    // Touch event handlers for mobile support
    useEffect(() => {
        if (!textRef.current) return;
        
        const handleTouchStart = (e: TouchEvent) => {
            if (e.touches.length === 1) {
                isTouching.current = true;
                touchStartY.current = e.touches[0].clientY;
                lastTouchY.current = e.touches[0].clientY;
                touchStartTime.current = performance.now();
                isScrolling.current = true;
                e.preventDefault();
            }
        };
        
        const handleTouchMove = (e: TouchEvent) => {
            if (e.touches.length === 1 && isTouching.current) {
                const currentY = e.touches[0].clientY;
                const deltaY = lastTouchY.current - currentY;
                lastTouchY.current = currentY;
                
                let newOffset = scrollOffsetRef.current + deltaY * 2;
                newOffset = Math.max(0, Math.min(maxScroll, newOffset));
                scrollOffsetRef.current = newOffset;
                
                scrollVelocity.current = deltaY * 2;
                lastScrollTime.current = performance.now();
                
                if (Math.abs(deltaY) > 10) {
                    needsRebuildRef.current = true;
                }
                
                e.preventDefault();
            }
        };
        
        const handleTouchEnd = (e: TouchEvent) => {
            if (isTouching.current) {
                const touchDuration = performance.now() - touchStartTime.current;
                const touchDeltaY = touchStartY.current - lastTouchY.current;
                
                if (touchDuration < 300 && Math.abs(touchDeltaY) > 30) {
                    // It's a flick/swipe
                    scrollVelocity.current = (touchDeltaY / touchDuration) * 30;
                }
                
                isTouching.current = false;
                
                if (scrollTimeoutRef.current) {
                    clearTimeout(scrollTimeoutRef.current);
                }
                
                scrollTimeoutRef.current = setTimeout(() => {
                    isScrolling.current = false;
                }, 150);
                
                e.preventDefault();
            }
        };
        
        const element = textRef.current;
        element.addEventListener('touchstart', handleTouchStart, { passive: false });
        element.addEventListener('touchmove', handleTouchMove, { passive: false });
        element.addEventListener('touchend', handleTouchEnd, { passive: false });
        
        return () => {
            element.removeEventListener('touchstart', handleTouchStart);
            element.removeEventListener('touchmove', handleTouchMove);
            element.removeEventListener('touchend', handleTouchEnd);
        };
    }, [maxScroll]);

    // Use effect to log animation state changes
    useEffect(() => {
        if (clickAnimations.length > 0) {
            addDebugLog(`Animation state changed: ${clickAnimations.length} active animations`);
        }
    }, [clickAnimations]);
    
    // Make sure the click overlay is working properly
    const clickCaptureRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
        // Add click capture debugging
        const captureElement = clickCaptureRef.current;
        if (captureElement) {
            const originalOnClick = captureElement.onclick;
            
            addDebugLog(`Click overlay initialized (${captureElement.clientWidth}x${captureElement.clientHeight})`);
            
            // Keep original onClick, just add debugging
            captureElement.onclick = (e) => {
                addDebugLog(`Raw click on capture overlay at (${e.clientX}, ${e.clientY})`);
                
                if (originalOnClick) {
                    // @ts-ignore - TypeScript doesn't know about originalOnClick's type
                    originalOnClick.call(captureElement, e);
                }
            };
            
            return () => {
                captureElement.onclick = originalOnClick;
            };
        }
    }, []);
    
    // Effect to update animation progress
    useEffect(() => {
        if (clickAnimations.length === 0) return;
        
        const updateAnimationProgress = () => {
            setClickAnimations(prevAnimations => {
                return prevAnimations.map(animation => {
                    const elapsed = performance.now() - animation.timestamp;
                    const duration = animation.isLink ? 800 : 500; // ms
                    const progress = Math.min(100, (elapsed / duration) * 100);
                    
                    return {
                        ...animation,
                        progress,
                        active: progress < 100
                    };
                });
            });
        };
        
        const animationFrameId = requestAnimationFrame(updateAnimationProgress);
        return () => cancelAnimationFrame(animationFrameId);
    }, [clickAnimations]);
    
    // Render click animations
    const renderClickAnimations = () => {
        if (clickAnimations.length === 0) {
            return null;
        }
        
        // Now that we're applying the animation effect directly to the ASCII characters,
        // we'll keep the visual overlay minimal - just a subtle indicator
        return clickAnimations.map(animation => {
            const elapsed = performance.now() - animation.timestamp;
            const duration = animation.isLink ? 800 : 500; // ms
            const progress = Math.min(1, elapsed / duration);
            
            // Calculate size based on progress
            let size;
            if (animation.isLink) {
                // For links, still grow but smaller overall effect
                const maxDimension = Math.max(textRef.current?.clientWidth || 0, textRef.current?.clientHeight || 0);
                size = maxDimension * progress * 0.5; // Reduced size
            } else {
                // For normal clicks, minimal visual indication
                const bounceProgress = Math.sin(progress * Math.PI);
                size = bounceProgress * 100; // Smaller size
            }
            
            // Very subtle opacity
            const opacity = showDebug ? 0.3 : 0.15; // Even less visible in normal mode
            
            return (
                <div 
                    key={animation.id}
                    style={{
                        position: 'absolute',
                        left: animation.x,
                        top: animation.y,
                        width: size,
                        height: size,
                        borderRadius: '50%',
                        backgroundColor: showDebug ? 'rgba(255, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.2)',
                        transform: 'translate(-50%, -50%)',
                        opacity: opacity,
                        pointerEvents: 'none',
                        zIndex: 900,
                        mixBlendMode: 'screen',
                        filter: 'blur(1px)',
                    }}
                />
            );
        });
    };

    // Render debug info
    const renderDebugOverlay = () => {
        if (!showDebug) return null;
        
        return (
            <div 
                style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    width: '300px',
                    background: 'rgba(0, 0, 0, 0.8)',
                    color: 'white',
                    padding: '10px',
                    borderRadius: '5px',
                    zIndex: 1000,
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    maxHeight: '80vh',
                    overflowY: 'auto',
                }}
            >
                <h3 style={{ margin: '0 0 10px 0' }}>Debug Overlay (press 'd' to toggle)</h3>
                
                <div style={{ marginBottom: '10px' }}>
                    <strong>Click Animations:</strong> {clickAnimations.length}
                </div>
                
                {clickAnimations.length > 0 && (
                    <div style={{ marginBottom: '10px' }}>
                        <strong>Active Animations:</strong>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>
                                    <th style={{ textAlign: 'left', padding: '2px', borderBottom: '1px solid #444' }}>ID</th>
                                    <th style={{ textAlign: 'left', padding: '2px', borderBottom: '1px solid #444' }}>Type</th>
                                    <th style={{ textAlign: 'left', padding: '2px', borderBottom: '1px solid #444' }}>Pos</th>
                                    <th style={{ textAlign: 'left', padding: '2px', borderBottom: '1px solid #444' }}>Age (ms)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {clickAnimations.map(anim => (
                                    <tr key={anim.id}>
                                        <td style={{ padding: '2px' }}>{anim.id}</td>
                                        <td style={{ padding: '2px' }}>{anim.isLink ? 'Link' : 'Normal'}</td>
                                        <td style={{ padding: '2px' }}>({Math.round(anim.x)}, {Math.round(anim.y)})</td>
                                        <td style={{ padding: '2px' }}>{Math.round(performance.now() - anim.timestamp)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                
                <div>
                    <strong>Event Log:</strong>
                    <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #444', padding: '5px', marginTop: '5px' }}>
                        {debugLogs.map(log => (
                            <div key={log.id} style={{ fontSize: '11px', marginBottom: '3px' }}>
                                <span style={{ color: '#aaa' }}>[{new Date(log.timestamp).toLocaleTimeString()}]</span> {log.message}
                            </div>
                        ))}
                    </div>
                </div>
                
                <div style={{ marginTop: '10px' }}>
                    <button 
                        onClick={() => {
                            addDebugLog('Manual test animation created');
                            // Don't directly modify state - use our helper function
                            triggerClickAnimation(100, 100, false);
                        }}
                        style={{
                            padding: '5px 10px',
                            background: '#555',
                            color: 'white',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            marginRight: '5px'
                        }}
                    >
                        Test Normal Click
                    </button>
                    <button 
                        onClick={() => {
                            addDebugLog('Manual test link animation created');
                            // Don't directly modify state - use our helper function
                            triggerClickAnimation(100, 100, true);
                        }}
                        style={{
                            padding: '5px 10px',
                            background: '#555',
                            color: 'white',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: 'pointer'
                        }}
                    >
                        Test Link Click
                    </button>
                </div>
            </div>
        );
    };

    // Calculate the effect of click animations on character selection
    function calculateClickAnimationEffect(
        x: number,
        y: number,
        clickAnimations: ClickAnimation[],
        scrollY: number
    ): number {
        let effect = 0;
        
        // Check each active click animation
        for (const animation of clickAnimations) {
            if (!animation.active) continue;
            
            // Calculate distance from this point to the animation center
            const dx = x - animation.x / CHAR_WIDTH;
            const dy = (y + Math.floor(scrollY / CHAR_HEIGHT)) - animation.y / CHAR_HEIGHT;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // Calculate effect based on distance and animation progress
            const maxRadius = animation.type === 'ripple' ? 15 : 8;
            const animationProgress = animation.progress / 100;
            
            let animationEffect = 0;
            
            if (animation.type === 'ripple') {
                // For ripple: create expanding ring effect
                const ringWidth = 3;
                const ringRadius = animationProgress * maxRadius;
                const distanceFromRing = Math.abs(distance - ringRadius);
                
                if (distanceFromRing < ringWidth) {
                    // Points near the ring are affected
                    animationEffect = 1 - (distanceFromRing / ringWidth);
                }
            } else if (animation.type === 'bloom') {
                // For bloom: create expanding circle effect that fades
                const bloomRadius = animationProgress * maxRadius;
                
                if (distance < bloomRadius) {
                    // Inside the bloom circle - effect fades with distance and time
                    animationEffect = (1 - distance / bloomRadius) * (1 - animationProgress);
                }
            }
            
            // Accumulate the strongest effect
            effect = Math.max(effect, animationEffect);
        }
        
        return effect;
    }

    // Wrapper function for character calculation that incorporates click animations
    function calculateCharacterWithAnimation(
        x: number, 
        y: number, 
        cols: number, 
        rows: number, 
        aspect: number, 
        time: number,
        cursorState: CursorState,
        scrollY: number,
        textPositionCache: any,
        blobGridCache: BlobGridCache,
        clickAnimations: ClickAnimation[],
        sinTable: number[],
        cosTable: number[]
    ) {
        // First check if there's any text content at this position
        const gridKey = `${x},${y}`;
        const fixedChar = textPositionCache.grid[gridKey];
        if (fixedChar && fixedChar.fixed) return fixedChar.char;
        
        const scrolledY = Math.floor(scrollY / CHAR_HEIGHT);
        const scrolledGridKey = `${x},${y + scrolledY}`;
        const scrolledChar = textPositionCache.grid[scrolledGridKey];
        if (scrolledChar && !scrolledChar.fixed) return scrolledChar.char;
        
        // Calculate animation effect
        const animationEffect = calculateClickAnimationEffect(x, y, clickAnimations, scrollY);
        
        // If there's a strong animation effect, modify character selection
        if (animationEffect > 0) {
            // Get the original character result
            const originalChar = calculateCharacter(
                x, y, cols, rows, aspect, time, cursorState, scrollY, 
                textPositionCache, blobGridCache, sinTable, cosTable
            );
            
            // If the original is a space or we're in the blob area, don't modify
            if (originalChar === ' ') return originalChar;
            
            // Find the index of the original character
            const originalIndex = selectedCharacterSet.indexOf(originalChar);
            if (originalIndex === -1) return originalChar; // Safety check
            
            // Shift the index based on animation effect
            // For stronger animation effect, use characters that are more "dense"
            const newIndex = Math.min(
                characterSetLength - 1,
                Math.max(
                    0,
                    Math.floor(originalIndex - (animationEffect * 8)) // Shift toward denser characters
                )
            );
            
            return selectedCharacterSet[newIndex];
        }
        
        // No animation effect, use regular character calculation
        return calculateCharacter(
            x, y, cols, rows, aspect, time, cursorState, scrollY, 
            textPositionCache, blobGridCache, sinTable, cosTable
        );
    }

    return (
        <div 
            ref={textRef} 
            className="ascii-art-container"
            style={{ 
            position: 'relative', 
            width: '100%',
            height: '100%',
            overflow: 'hidden',
            backgroundColor: 'white',
            color: 'black'
            }}
        >
            <style>
                {`
                .ascii-art-text a {
                    cursor: pointer !important;
                    color: #3498db !important;
                    text-decoration: underline !important;
                    font-weight: normal !important;
                }
                .ascii-art-text .bold, .ascii-art-text span.bold {
                    font-weight: bold !important;
                }
                .ascii-art-text .italic, .ascii-art-text span.italic {
                    font-style: italic !important;
                }
                .ascii-art-text .red, .ascii-art-text span.red {
                    color: #FF0000 !important;
                }
                /* Match even when nested */
                .ascii-art-text * a {
                    cursor: pointer !important;
                    color: #3498db !important;
                    text-decoration: underline !important;
                }
                .ascii-art-text * .bold, .ascii-art-text * span.bold {
                    font-weight: bold !important;
                }
                .ascii-art-text * .italic, .ascii-art-text * span.italic {
                    font-style: italic !important;
                }
                .ascii-art-text * .red, .ascii-art-text * span.red {
                    color: #FF0000 !important;
                }
                /* Ensure links have appropriate styling no matter where they appear */
                .ascii-art-container a, .ascii-art-container a:visited, .ascii-art-container a:hover {
                    color: #3498db !important;
                    cursor: pointer !important;
                    text-decoration: underline !important;
                }
                `}
            </style>
            <div 
                ref={textRef} 
                className="ascii-art-container"
                style={{ 
                    whiteSpace: 'pre', 
                    overflow: 'hidden',
                    padding: 0,
                    margin: 0,
                    width: '100%',
                    height: '100%',
                    fontFamily: 'monospace',
                    fontSize: `${SCALE_FACTOR}px`,
                    lineHeight: `${SCALE_FACTOR}px`,
                    cursor: 'default',
                    position: 'relative'
                }}
            >
                {/* This will render both the ASCII art and styled content */}
            </div>
            
            {/* Render special styled content directly in React */}
            <div 
                className="styled-content-overlay"
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    overflow: 'hidden',
                    pointerEvents: 'none', // Let clicks pass through to the text layer
                    zIndex: 10,
                    padding: 0,
                    margin: 0,
                    touchAction: 'none', // Prevent touch events from being captured
                }}
            >
                {/* 
                    We can place styled elements with absolute positioning here 
                    for complex styling needs not handled by the ASCII renderer
                */}
            </div>
            
            {/* Render click animations */}
            <div 
                className="click-animations-overlay"
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    overflow: 'hidden',
                    pointerEvents: 'none', // Let clicks pass through
                    zIndex: 900, // High z-index but below the click overlay
                }}
            >
                {renderClickAnimations()}
            </div>
            
            {/* NEW: Click capturing overlay - sits on top of everything except debug */}
            <div 
                ref={clickCaptureRef}
                className="click-capture-overlay"
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    overflow: 'hidden',
                    backgroundColor: showDebug ? 'rgba(255, 0, 0, 0.05)' : 'transparent', // Slight visual indicator in debug mode
                    zIndex: 950, // Just below debug overlay but above animations
                    cursor: 'pointer',
                }}
                onClick={(e) => {
                    if (!textRef.current) {
                        addDebugLog("Click ignored: textRef is null");
                        return;
                    }
                    
                    // Get relative position within the container
                    const rect = textRef.current.getBoundingClientRect();
                    const relativeX = e.clientX - rect.left;
                    const relativeY = e.clientY - rect.top;
                    
                    // Log the click
                    addDebugLog(`Click captured at (${relativeX}, ${relativeY})`);
                    
                    // Check if the click was on a link
                    const isLink = checkIfClickOnLink(relativeX, relativeY, e.clientX, e.clientY);
                    
                    if (isLink) {
                        // If this is an <a> tag, we do nothing additional as the browser will handle it
                        // For custom tracked links, we rely on the checkIfClickOnLink function to handle it
                        addDebugLog("Click was on a link");
                    }
                    
                    // Create the animation
                    triggerClickAnimation(relativeX, relativeY, isLink);
                }}
            />
            
            {/* Debug overlay - should be on top of everything */}
            {renderDebugOverlay()}
        </div>
    );
};

export default AsciiArtGenerator;