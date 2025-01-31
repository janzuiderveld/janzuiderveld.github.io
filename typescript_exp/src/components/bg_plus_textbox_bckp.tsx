import { useRef, useState, useEffect } from 'react';

// const selectedCharacterSet = "$@B%8&WM#ZO0QLCJUYX*ahkbdpqwmnvzoxcrjft!|/{}()[]?-_+~<;:^,.'` ";
const selectedCharacterSet = "$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/|()1{}[]?-_+~<>i!lI;:,^`'. ";
const characterSetLength = selectedCharacterSet.length;
const SCALE_FACTOR = 10; // New constant to control overall scaling
const BORDER_FREQUENCY = 0.2;  // Controls how wavy the border is
const BORDER_SPEED = 0.0001;   // Controls how fast the border animates
const NOISE_SCALE = 0.;       // Increased from 0.3 for more dramatic size changes
const BLOB_INDEX_BOOST = 10; // Adjust this value to change how "light" the blob area appears

const AsciiArtGenerator = () => {
    const textRef = useRef<HTMLPreElement>(null);
    const [size, setSize] = useState<{ height: number | null; width: number | null }>({ height: null, width: null });
    const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [textContent, setTextContent] = useState<Array<{text: string, x: number, y: number}>>([
        { text: "Hello World World World World World", x: 150, y: 30 },
        { text: "This is a test", x: 20, y: 12 }
    ]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            setMousePos({
                x: (e.clientX / window.innerWidth) * 2 - 1,  // Normalize to [-1, 1]
                y: (e.clientY / window.innerHeight) * 2 - 1
            });
        };
        
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    const calculateCharacter = (x: number, y: number, cols: number, rows: number, aspect: number, time: number) => {
        const textPadding = 10;
        const timeFactor = time * BORDER_SPEED;
        
        // Calculate cursor influence
        const cursorX = (mousePos.x + 1) * cols / 2;  // Convert from [-1,1] to [0,cols]
        const cursorY = (mousePos.y + 1) * rows / 2;  // Convert from [-1,1] to [0,rows]
        const cursorDx = x - cursorX;
        const cursorDy = (y - cursorY) * 2;
        const cursorDistanceSquared = cursorDx * cursorDx + cursorDy * cursorDy;
        const cursorRadius = textPadding * 2;
        const cursorMaxRadius = cursorRadius + NOISE_SCALE * textPadding * 2;
        
        let cursorInfluence = 0;
        if (cursorDistanceSquared <= cursorMaxRadius * cursorMaxRadius) {
            const cursorDistance = Math.sqrt(cursorDistanceSquared);
            const cursorAngle = Math.atan2(cursorDy, cursorDx);
            
            const cursorNoise = 
                Math.sin(cursorAngle * 3 + timeFactor + cursorDx * BORDER_FREQUENCY) * 0.9 +
                Math.sin(cursorAngle * 5 + cursorDy * BORDER_FREQUENCY - timeFactor * 2) * 0.8;
            
            const cursorSpiral = Math.sin(cursorDistance * 0.3 + timeFactor * 3) * 0.8;
            const cursorDynamicRadius = cursorRadius + (cursorNoise + cursorSpiral) * NOISE_SCALE * textPadding;
            
            cursorInfluence = Math.max(0, 1 - (cursorDistance / cursorDynamicRadius));
        }
        
        // Check text area first - most common case
        let maxTextInfluence = 0;
        textContent.forEach(textItem => {
            const textLength = textItem.text.length;
            
            // Calculate distance to nearest point on the text rectangle
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
            
            // Calculate influence (1 at center, 0 at edge)
            const influence = Math.max(0, 1 - (distance / dynamicRadius));
            maxTextInfluence = Math.max(maxTextInfluence, influence);
        });

        // Use the maximum of cursor and text influences
        const totalInfluence = Math.max(maxTextInfluence, cursorInfluence);

        // If we're inside or near a text area or cursor
        if (totalInfluence > 0) {
            // Check if we're exactly on a text character
            const textChar = textContent.find(textItem => 
                y === textItem.y && x >= textItem.x && x < textItem.x + textItem.text.length
            );
            
            if (textChar) {
                return textChar.text[x - textChar.x];
            }

            // Create gradient effect
            if (totalInfluence > 0.8) {
                return ' '; // Guaranteed space around text and cursor
            }
        }

        // Background pattern calculation (for both normal background and gradient areas)
        const size = Math.min(cols, rows);
        const position = {
            x: ((4 * (x - cols / 6.25)) / size) * (aspect * 0.2),
            y: (5 * (y - rows / 4)) / size,
        };
        
        const mouseDistX = (x / cols) * 2 - 1 - mousePos.x;
        const mouseDistY = (y / rows) * 2 - 1 - mousePos.y;
        const mouseInfluence = Math.sqrt(mouseDistX * mouseDistX + mouseDistY * mouseDistY);
        
        const wave = Math.sin(position.x * 2 + timeFactor + mousePos.x + 
                             position.y * 2 - timeFactor + mousePos.y) * 0.3;
        const spiral = Math.sin(Math.sqrt(position.x * position.x + position.y * position.y) * 4 - timeFactor * 3) * 0.2;
        const mouseRipple = Math.sin(mouseInfluence * 8 - timeFactor * 4) / (mouseInfluence + 1) * 0.3;
        
        const combined = (wave + spiral + mouseRipple + 1) / 2;
        const index = Math.floor(combined * characterSetLength + (x + y) % 2);
        
        // If we're in a gradient area, blend with the influence
        if (totalInfluence > 0) {
            const steepness = 3;
            const adjustedInfluence = Math.pow(totalInfluence, steepness);
            const blendedIndex = Math.floor(index * (1 - adjustedInfluence)) + Math.floor(BLOB_INDEX_BOOST * adjustedInfluence);
            return selectedCharacterSet[Math.min(characterSetLength - 1, blendedIndex)];
        }
        
        return selectedCharacterSet[index % characterSetLength];
    };

    useEffect(() => {
        const handleResize = () => {
            setSize({ height: window.innerHeight, width: window.innerWidth });
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    useEffect(() => {
        const element = textRef.current;
        if (!element || !size.width || !size.height) return;

        const cols = Math.floor(size.width / 6);
        const rows = Math.floor(size.height / 6) * 0.6;
        const aspectRatio = cols / rows;

        let animationFrameId: number;
        
        const animate = () => {
            let content = '';
            const time = Date.now();
            
            for (let y = 0; y < rows; y++) {
                for (let x = 0; x < cols; x++) {
                    content += calculateCharacter(x, y, cols, rows, aspectRatio, time);
                }
                content += '\n';
            }
            element.textContent = content;
            animationFrameId = requestAnimationFrame(animate);
        };

        animate();

        return () => {
            cancelAnimationFrame(animationFrameId);
        };
    }, [size, mousePos, textContent]);

    return (
        <pre
            ref={textRef}
            style={{
                height: '100%',
                overflow: 'hidden',
                whiteSpace: 'pre',
                width: '100%',
                backgroundColor: 'white',
                color: 'black',
                fontSize: `${SCALE_FACTOR}px`,
                lineHeight: `${SCALE_FACTOR}px`,
            }}
        />
    );
};

export default AsciiArtGenerator;