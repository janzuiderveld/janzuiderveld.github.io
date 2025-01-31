import { useRef, useState, useEffect, useCallback } from 'react';

const selectedCharacterSet = "$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/|()1{}[]?-_+~<>i!lI;:,^`'. ";
const characterSetLength = selectedCharacterSet.length;
const SCALE_FACTOR = 8;
const FRAME_DURATION = 1000 / 60; // Target 60 FPS

const BORDER_FREQUENCY = 0.2;  // Controls how wavy the border is
const BORDER_SPEED = 0.0001;   // Controls how fast the border animates
const NOISE_SCALE = 0.1;       // Controls size changes of the blob
const BLOB_INDEX_BOOST = 10;   // Controls how "light" the blob area appears

const CHAR_WIDTH = 6;  // Base width of each character cell
const CHAR_HEIGHT = 12; // Base height of each character cell

const AsciiArtGenerator = () => {
    const textRef = useRef<HTMLPreElement>(null);
    const lastFrameTimeRef = useRef<number>(0);
    const [size, setSize] = useState<{ height: number | null; width: number | null }>({ height: null, width: null });
    const [cursor, setCursor] = useState<{
        grid: { x: number; y: number };      // Position in character grid
        normalized: { x: number; y: number }; // Position in -1 to 1 space
        isInWindow: boolean;
    }>({
        grid: { x: 0, y: 0 },
        normalized: { x: 0, y: 0 },
        isInWindow: false
    });
    const [textContent, setTextContent] = useState<Array<{text: string, x: number, y: number}>>([
        { text: "Hello World World World World World", x: 150, y: 30 },
        { text: "This is a test", x: 20, y: 12 }
    ]);

    const calculateCharacter = useCallback((x: number, y: number, cols: number, rows: number, aspect: number, time: number) => {
        const textPadding = 10;
        const timeFactor = time * 0.00008;

        // Check text blob influence first
        let maxTextInfluence = 0;
        textContent.forEach(textItem => {
            const textLength = textItem.text.length;
            const nearestX = Math.max(textItem.x, Math.min(x, textItem.x + textLength));
            const nearestY = textItem.y;
            
            const dx = (x - nearestX) * 1;
            const dy = (y - nearestY) * 2;
            const distanceSquared = dx * dx + dy * dy;
            
            const baseRadius = textPadding * 3;
            const maxRadius = baseRadius + NOISE_SCALE * textPadding * 3;
            
            if (distanceSquared > maxRadius * maxRadius) return;
            
            const distance = Math.sqrt(distanceSquared);
            const angle = Math.atan2(dy, dx);
            
            const noise = 
                Math.sin(angle * 3 + timeFactor + dx * BORDER_FREQUENCY) * 0.9 +
                Math.sin(angle * 5 + dy * BORDER_FREQUENCY - timeFactor * 2) * 0.8;
            
            const spiral = Math.sin(distance * 0.3 + timeFactor * 3) * 0.8;
            const dynamicRadius = baseRadius + (noise + spiral) * NOISE_SCALE * textPadding;
            
            const influence = Math.max(0, 1 - (distance / dynamicRadius));
            maxTextInfluence = Math.max(maxTextInfluence, influence);
        });

        // If we're inside or near a text area
        if (maxTextInfluence > 0) {
            // Check if we're exactly on a text character
            const textChar = textContent.find(textItem => 
                y === textItem.y && x >= textItem.x && x < textItem.x + textItem.text.length
            );
            
            if (textChar) {
                return textChar.text[x - textChar.x];
            }

            if (maxTextInfluence > 0.8) {
                return ' ';
            }
        }

        // Original background animation calculation
        const size = Math.min(cols, rows);
        const aspectRatio = aspect * 0.2;
        const position = {
            x: ((4 * (x - cols / 6.25)) / size) * aspectRatio,
            y: (5 * (y - rows / 4)) / size,
        };
        
        const mouseInfluence = Math.sqrt(
            Math.pow((x / cols) * 2 - 1 - cursor.normalized.x, 2) + 
            Math.pow((y / rows) * 2 - 1 - cursor.normalized.y, 2)
        );
        
        // Strengthen cursor effect
        const cursorRadius = 0.3; // Increase radius of effect
        const cursorIntensity = cursor.isActive ? Math.max(0, 1 - (mouseInfluence / cursorRadius)) : 0;
        const cursorEffect = cursorIntensity * 0.8; // Increase intensity of the effect
        
        const wave1 = Math.sin(position.x * 2 + timeFactor + cursor.normalized.x) * 
                     Math.cos(position.y * 2 - timeFactor + cursor.normalized.y);
        const wave2 = Math.cos(position.x * position.y + timeFactor * 2);
        const spiral = Math.sin(Math.sqrt(position.x * position.x + position.y * position.y) * 4 - timeFactor * 3);
        const mouseRipple = Math.sin(mouseInfluence * 8 - timeFactor * 4) / (mouseInfluence + 1);
        
        // Boost the combined value near cursor
        let combined = (wave1 * 0.3 + wave2 * 0.2 + spiral * 0.2 + mouseRipple * 0.3 + 1) / 2;
        combined = Math.min(1, combined + cursorEffect); // Add cursor brightness boost

        const index = Math.floor(combined * characterSetLength + (Math.floor(x + y) % 2));

        // Blend with text influence if needed
        if (maxTextInfluence > 0) {
            const steepness = 3;
            const adjustedInfluence = Math.pow(maxTextInfluence, steepness);
            const blendedIndex = Math.floor(index * (1 - adjustedInfluence)) + Math.floor(BLOB_INDEX_BOOST * adjustedInfluence);
            return selectedCharacterSet[Math.min(characterSetLength - 1, blendedIndex)];
        }
        
        return selectedCharacterSet[index % characterSetLength];
    }, [cursor, textContent]);

    const getGridDimensions = useCallback((width: number, height: number) => {
        // Calculate grid dimensions based on actual character proportions
        const cols = Math.floor(width / CHAR_WIDTH);
        const rows = Math.floor(height / CHAR_HEIGHT);
        return { cols, rows };
    }, []);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!size.width || !size.height || !textRef.current) return;
            
            const rect = textRef.current.getBoundingClientRect();
            
            // Get position relative to the element in pixels
            const relativeX = e.clientX - rect.left;
            const relativeY = e.clientY - rect.top;
            
            // Convert to grid coordinates
            const gridX = Math.floor(relativeX / CHAR_WIDTH);
            const gridY = Math.floor(relativeY / CHAR_HEIGHT);
            
            // Get grid dimensions
            const { cols, rows } = getGridDimensions(size.width, size.height);
            
            // Calculate normalized coordinates based on grid position
            const normalizedX = (gridX / cols) * 2 - 1;
            const normalizedY = (gridY / rows) * 2 - 1;
            
            setCursor({
                grid: { x: gridX, y: gridY },
                normalized: { x: normalizedX, y: normalizedY },
                isInWindow: true
            });
        };

        const handleMouseLeave = () => {
            setCursor(prev => ({
                ...prev,
                isInWindow: false
            }));
        };

        const handleMouseEnter = () => {
            setCursor(prev => ({
                ...prev,
                isInWindow: true
            }));
        };
        
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseenter', handleMouseEnter);
        window.addEventListener('mouseleave', handleMouseLeave);
        
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseenter', handleMouseEnter);
            window.removeEventListener('mouseleave', handleMouseLeave);
        };
    }, [size, getGridDimensions]);

    useEffect(() => {
        const handleResize = () => {
            setSize({ height: window.innerHeight, width: window.innerWidth });
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const element = textRef.current;
        if (!element || !size.width || !size.height) return;

        const cols = Math.floor(size.width / 6);
        const rows = Math.floor(size.height / 6);
        const aspectRatio = cols / rows;
        
        let animationFrameId: number;
        let contentArray: string[] = new Array(rows);
        
        const animate = (timestamp: number) => {
            if (timestamp - lastFrameTimeRef.current >= FRAME_DURATION) {
                lastFrameTimeRef.current = timestamp;
                
                for (let y = 0; y < rows; y++) {
                    let rowContent = '';
                    for (let x = 0; x < cols; x++) {
                        rowContent += calculateCharacter(x, y, cols, rows, aspectRatio, timestamp);
                    }
                    contentArray[y] = rowContent;
                }
                
                element.textContent = contentArray.join('\n');
            }
            
            animationFrameId = requestAnimationFrame(animate);
        };

        animate(0);

        return () => {
            cancelAnimationFrame(animationFrameId);
        };
    }, [size, calculateCharacter]);

    return (
        <pre
            ref={textRef}
            style={{
                height: '100vh',
                width: '100vw',
                overflow: 'hidden',
                whiteSpace: 'pre',
                backgroundColor: 'white',
                color: 'black',
                fontSize: `${SCALE_FACTOR}px`,
                lineHeight: `${SCALE_FACTOR}px`,
                margin: 0,
                padding: 0,
            }}
        />
    );
};

export default AsciiArtGenerator;