import { useRef, useState, useEffect } from 'react';

const selectedCharacterSet = "$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/|()1{}[]?-_+~<>i!lI;:,^`'. ";
const characterSetLength = selectedCharacterSet.length;
const SCALE_FACTOR = 8; // New constant to control overall scaling

const AsciiArtGenerator = () => {
    const textRef = useRef<HTMLPreElement>(null);
    const [size, setSize] = useState<{ height: number | null; width: number | null }>({ height: null, width: null });
    const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

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

export default AsciiArtGenerator;import { useRef, useState, useEffect } from 'react';

const selectedCharacterSet = "$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/|()1{}[]?-_+~<>i!lI;:,^`'. ";
const characterSetLength = selectedCharacterSet.length;
const SCALE_FACTOR = 8; // New constant to control overall scaling

const AsciiArtGenerator = () => {
    const textRef = useRef<HTMLPreElement>(null);
    const [size, setSize] = useState<{ height: number | null; width: number | null }>({ height: null, width: null });
    const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

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