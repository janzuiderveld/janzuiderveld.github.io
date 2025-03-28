import { useRef, useState, useEffect } from 'react';

const selectedCharacterSet = "$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/|()1{}[]?-_+~<>i!lI;:,^`'. ";
const characterSetLength = selectedCharacterSet.length;
const SCALE_FACTOR = 8; // New constant to control overall scaling

const AsciiArtGenerator = () => {
    const textRef = useRef<HTMLPreElement>(null);
    const textContentRef = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState<{ height: number | null; width: number | null }>({ height: null, width: null });
    const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [textArea, setTextArea] = useState({
        x: 0.3,
        y: 0.2,
        width: 0.4,
        height: 0.6
    });

    // Add placeholder text
    const placeholderText = `Welcome to my website!
    
This is a sample text that demonstrates how the ASCII art border adapts to the content. The border will flow and animate around this text, creating an organic, living frame.

Feel free to explore and interact with the animation using your mouse!`;

    // Add effect to update text area based on content size
    useEffect(() => {
        const updateTextAreaSize = () => {
            if (!textContentRef.current || !size.width || !size.height) return;

            const contentRect = textContentRef.current.getBoundingClientRect();
            const padding = 20; // Padding in pixels
            
            // Convert pixel measurements to normalized values (0-1)
            const newTextArea = {
                x: (contentRect.left - padding) / window.innerWidth,
                y: (contentRect.top - padding) / window.innerHeight,
                width: (contentRect.width + padding * 2) / window.innerWidth,
                height: (contentRect.height + padding * 2) / window.innerHeight
            };

            setTextArea(newTextArea);
        };

        updateTextAreaSize();
        window.addEventListener('resize', updateTextAreaSize);
        return () => window.removeEventListener('resize', updateTextAreaSize);
    }, [size]);

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
        const timeFactor = time * 0.00008;
        const size = Math.min(cols, rows);
        const aspectRatio = aspect * 0.2;
        const position = {
            x: ((4 * (x - cols / 6.25)) / size) * aspectRatio,
            y: (5 * (y - rows / 4)) / size,
        };

        // Calculate normalized position (0 to 1)
        const normalizedX = x / cols;
        const normalizedY = y / rows;

        // Create more organic noise based on position and time
        const noiseFreq = 8;
        const noiseAmp = 0.015;
        const borderNoise = (
            Math.sin(normalizedX * noiseFreq + timeFactor * 2) * 
            Math.cos(normalizedY * noiseFreq - timeFactor) * noiseAmp +
            Math.sin(normalizedX * noiseFreq * 1.5 - timeFactor) * 
            Math.cos(normalizedY * noiseFreq * 1.5 + timeFactor * 1.5) * noiseAmp * 0.5
        );

        // Calculate distance from the text area borders with noise
        const distanceFromBorderX = Math.min(
            Math.abs(normalizedX - (textArea.x + borderNoise)),
            Math.abs(normalizedX - (textArea.x + textArea.width + borderNoise))
        );
        const distanceFromBorderY = Math.min(
            Math.abs(normalizedY - (textArea.y + borderNoise * 1.5)),
            Math.abs(normalizedY - (textArea.y + textArea.height + borderNoise * 1.5))
        );

        const distanceFromBorder = Math.min(distanceFromBorderX, distanceFromBorderY);
        const borderThickness = 0.008 + Math.abs(borderNoise);
        
        // Create a more organic border detection
        const isOnBorder = distanceFromBorder <= borderThickness &&
            normalizedX >= textArea.x - borderThickness * 2 &&
            normalizedX <= textArea.x + textArea.width + borderThickness * 2 &&
            normalizedY >= textArea.y - borderThickness * 2 &&
            normalizedY <= textArea.y + textArea.height + borderThickness * 2;

        if (isOnBorder) {
            const wave1 = Math.sin(position.x * 2 + timeFactor + mousePos.x) * 
                         Math.cos(position.y * 2 - timeFactor + mousePos.y);
            const wave2 = Math.cos(position.x * position.y + timeFactor * 2);
            const mouseInfluence = Math.sqrt(
                Math.pow(normalizedX * 2 - 1 - mousePos.x, 2) + 
                Math.pow(normalizedY * 2 - 1 - mousePos.y, 2)
            );
            const mouseRipple = Math.sin(mouseInfluence * 8 - timeFactor * 4) / (mouseInfluence + 1);
            
            // Use more varied characters for an organic border
            const borderChars = "@%&WM#*8B@$";
            const borderIndex = Math.floor(((wave1 + wave2 + mouseRipple + borderNoise + 4) / 8) * borderChars.length);
            return borderChars[Math.abs(borderIndex % borderChars.length)];
        }

        // Check if we're inside the text area with organic edges
        const isInsideTextArea = 
            normalizedX > textArea.x + borderNoise && 
            normalizedX < textArea.x + textArea.width + borderNoise &&
            normalizedY > textArea.y + borderNoise && 
            normalizedY < textArea.y + textArea.height + borderNoise;

        if (isInsideTextArea) {
            return ' ';
        }

        // Calculate distance from mouse position to current point
        const mouseInfluence = Math.sqrt(
            Math.pow((x / cols) * 2 - 1 - mousePos.x, 2) + 
            Math.pow((y / rows) * 2 - 1 - mousePos.y, 2)
        );
        
        // Create more complex wave patterns using multiple sine and cosine functions
        const wave1 = Math.sin(position.x * 2 + timeFactor + mousePos.x) * 
                     Math.cos(position.y * 2 - timeFactor + mousePos.y);
        const wave2 = Math.cos(position.x * position.y + timeFactor * 2);
        const spiral = Math.sin(Math.sqrt(position.x * position.x + position.y * position.y) * 4 - timeFactor * 3);
        
        // Add mouse influence to create a ripple effect
        const mouseRipple = Math.sin(mouseInfluence * 8 - timeFactor * 4) / (mouseInfluence + 1);
        
        // Combine the waves with different weights
        const combined = (wave1 * 0.3 + wave2 * 0.2 + spiral * 0.2 + mouseRipple * 0.3 + 1) / 2;
        
        const index = Math.floor(combined * characterSetLength + (Math.floor(x + y) % 2)) % characterSetLength;
        
        return selectedCharacterSet[index];
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

        const cols = Math.floor(size.width / 6) * 1.6;
        const rows = Math.floor(size.height / 6);
        const aspectRatio = cols / rows;

        let animationFrameId: number;
        
        const animate = () => {
            let content = '';
            for (let y = 0; y < rows; y++) {
                for (let x = 0; x < cols; x++) {
                    content += calculateCharacter(x, y, cols, rows, aspectRatio, Date.now());
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
    }, [size, mousePos]);

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <pre
                ref={textRef}
                style={{
                    position: 'absolute',
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
            <div
                ref={textContentRef}
                style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    maxWidth: '40%',
                    padding: '20px',
                    color: 'black',
                    fontSize: '16px',
                    lineHeight: '1.5',
                    zIndex: 1,
                    fontFamily: 'Arial, sans-serif',
                }}
            >
                {placeholderText.split('\n').map((text, index) => (
                    <p key={index} style={{ margin: '0 0 1em 0' }}>
                        {text}
                    </p>
                ))}
            </div>
        </div>
    );
};

export default AsciiArtGenerator;