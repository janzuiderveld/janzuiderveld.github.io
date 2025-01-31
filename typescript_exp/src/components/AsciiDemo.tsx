import { useRef, useEffect } from 'react';
import { AsciiArtGenerator, type AsciiArtGeneratorRef } from './AsciiArtGenerator';

const AsciiDemo = () => {
    const asciiRef = useRef<AsciiArtGeneratorRef>(null);

    useEffect(() => {
        const textBoxes = [
            { text: "Welcome to", x: 10, y: 40 },
            { text: "ASCII Art", x: 150, y: 60 },
            // { text: "Generator", x: 155, y: 70 },
            // { text: "Move your mouse! Move your mouseMove your mouseMove your mouseMove your mouseMove your mouse", x: 140, y: 30 }
        ];

        textBoxes.forEach((box, index) => {
            setTimeout(() => {
                asciiRef.current?.addTextBox(box.text, box.x, box.y);
            }, index * 1000); // 1000ms (1 second) delay between each addition
        });
    }, []);

    return (
        <div>
            <AsciiArtGenerator ref={asciiRef} />
        </div>
    );
};

export default AsciiDemo;