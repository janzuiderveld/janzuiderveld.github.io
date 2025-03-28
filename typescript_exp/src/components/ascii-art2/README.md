# ASCII Art Generator - Text Box Anchoring

The ASCII Art Generator component now supports anchoring text boxes to other text boxes with specific offsets.

## Basic Usage

To use the anchoring functionality, you need to:

1. Give names to the text boxes you want to use as anchors
2. Specify which text box to anchor to and the offset values

## Properties

The following properties have been added to support anchoring:

| Property | Type | Description |
|----------|------|-------------|
| `name` | string | A unique identifier for the text box |
| `anchorTo` | string | The name of another text box to anchor to |
| `anchorOffsetX` | number | Horizontal offset from the anchor point (can be negative) |
| `anchorOffsetY` | number | Vertical offset from the anchor point (can be negative) |
| `anchorPoint` | 'topLeft' \| 'topRight' \| 'bottomLeft' \| 'bottomRight' \| 'center' | Which point of the anchor text box to use (default: 'topLeft') |

## Example

```tsx
const textContent = [
  // Define a named text box as an anchor
  {
    name: "header",
    text: "Main Header",
    x: 50,
    y: 10,
    centered: true,
    fontName: "ascii"
  },
  
  // Anchor a text box to the header
  {
    text: "This text will be positioned relative to the header",
    anchorTo: "header",
    anchorPoint: "bottomLeft",
    anchorOffsetX: 0,
    anchorOffsetY: 5,
    maxWidthPercent: 60
  },
  
  // Another example with different anchor point
  {
    name: "sidebar",
    text: "Navigation",
    x: 10,
    y: 30,
    fontName: "ascii"
  },
  
  // Anchor links to the sidebar
  {
    text: "* Home\n* About\n* Contact",
    anchorTo: "sidebar",
    anchorPoint: "bottomLeft",
    anchorOffsetX: 2,
    anchorOffsetY: 3
  }
];

// Use the text content in the AsciiArtGenerator
<AsciiArtGenerator textContent={textContent} />
```

## Notes

- Anchored text boxes will be positioned after their anchor boxes are positioned
- If you create circular dependencies in your anchoring, the system will use the defined x/y values as fallback
- Anchor offsets are in character grid cells, not percentages
- You can chain anchors (A anchored to B, which is anchored to C) 