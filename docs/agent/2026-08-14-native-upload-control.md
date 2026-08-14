# Native upload control

The composer upload entry now follows the resident command button: a 28px circular control, a 14px paperclip, Harness selector and interaction tokens, and a short native tooltip. Image recognition swaps the glyph for a spinner without changing the toolbar width. Errors use a compact warning indicator whose accessible label and tooltip contain the full message, so a long backend error does not push the composer controls around.

The control keeps its styles and SVGs inside the plugin bundle. Importing the primitives package would either add a new loader dependency or inline a much larger UI package for one button.
