---
title: Creating a Custom Theme
description: A comprehensive guide to building and mapping custom color palettes for Portosaurus.
---

# Creating a Custom Theme

Portosaurus uses a robust, two-step CSS variable architecture for theming. This system ensures your colors remain perfectly synced across the entire site while maintaining strict contrast requirements for both Light and Dark modes.

Instead of hardcoding colors directly into UI components, theming is broken down into two distinct phases:

1. **Defining the Master Palette:** Creating a raw inventory of your colors.
2. **Functional Mapping:** Assigning those raw colors to specific UI elements based on the active theme.

---

## Step 1: The Master Palette

The `:root` block acts as your theme's master paint palette. This is where you declare your colors (e.g., exactly what hex code your specific brand of blue is).

Defining your raw colors here creates a "Single Source of Truth." If you ever want to tweak a shade, you only have to change it in this one spot, and every UI element using that color will update instantly.

```css
:root {
  /* Core Colors */
  --mytheme-blue: #007bff;
  --mytheme-blue-rgb: 0, 123, 255;

  /* Backgrounds */
  --mytheme-bg-light: #ffffff;
  --mytheme-bg-dark: #121212;
}
```

:::info Why not just use light/dark modes directly?
You often need different shades of the same color for light and dark modes to maintain accessibility. Your `:root` palette holds _all_ possible variations. Your light and dark mode blocks simply grab the tool they need for the job from this master list.
:::

---

## Step 2: Functional Mapping

Once your raw colors are defined, you map them to functional `--porto-*` variables inside the `[data-theme="light"]` and `[data-theme="dark"]` selectors.

This tells the CSS what **job** each color is performing in that specific mode.

### Light Mode Mapping

In light mode, you will generally map your lightest raw backgrounds to the `--porto-bg` variables, and your darkest foreground colors to `--porto-text`.

```css
[data-theme="light"] {
  --porto-primary: var(--mytheme-blue);
  --porto-bg: var(--mytheme-bg-light);
  --porto-text: #111111;
}
```

### Dark Mode Mapping

In dark mode, the logic inverts. Your darkest backgrounds take over the `--porto-bg` variables, and your text needs to become bright for readability. You may also need to map a slightly brighter version of your primary color so it doesn't get lost on a dark background.

```css
[data-theme="dark"] {
  /* You might map a brighter blue here for better contrast */
  --porto-primary: var(--mytheme-blue-bright);
  --porto-bg: var(--mytheme-bg-dark);
  --porto-text: #f5f5f5;
}
```

---

## Theming Template

Use the boilerplate below as a starting point. Copy this into a new `.css` file in your styles directory and fill in the blanks with your custom hex codes.

:::tip The Grayscale Continuum
Pay special attention to the `--porto-gray-0` through `--porto-gray-1000` scales. For a smooth theme, ensure there are no massive contrast "jumps" in the middle of your grayscale spectrum. If your raw palette lacks mid-tones, create interpolated mix variables in your `:root` block to bridge the gap!
:::

```css title="src/css/custom-theme.css"
/**
 * 🎨 YOUR THEME NAME
 * 
 * STEP 1: DEFINE YOUR RAW PALETTE
 */

:root {
  /* Core Colors */
  --mytheme-red: #;
  --mytheme-orange: #;
  --mytheme-yellow: #;
  --mytheme-green: #;
  --mytheme-teal: #;
  --mytheme-blue: #;
  --mytheme-purple: #;
  --mytheme-pink: #;

  /* RGB variants for opacity (comma-separated, e.g., 255, 0, 0) */
  --mytheme-red-rgb: ;
  --mytheme-green-rgb: ;
  --mytheme-yellow-rgb: ;
  --mytheme-blue-rgb: ;

  /* Backgrounds & Surfaces (Light to Dark) */
  --mytheme-bg-0: #;
  --mytheme-bg-1: #;
  --mytheme-bg-2: #;
  --mytheme-bg-3: #;

  /* Text & Foreground (Dark to Light) */
  --mytheme-fg-0: #;
  --mytheme-fg-1: #;
  --mytheme-fg-2: #;
}

/**
 * STEP 2: MAP LIGHT MODE
 */
[data-theme="light"] {
  /* Primary Brand Color */
  --porto-primary: var(--mytheme-blue);
  --porto-primary-rgb: var(--mytheme-blue-rgb);
  --porto-primary-dark: #;
  --porto-primary-darker: #;
  --porto-primary-darkest: #;
  --porto-primary-light: #;
  --porto-primary-lighter: #;
  --porto-primary-lightest: #;

  /* Secondary & Semantic Colors */
  --porto-secondary: var(--mytheme-purple);
  --porto-success: var(--mytheme-green);
  --porto-warning: var(--mytheme-yellow);
  --porto-danger: var(--mytheme-red);
  --porto-info: var(--mytheme-blue);

  /* Standard Palette Mapping */
  --porto-red: var(--mytheme-red);
  --porto-orange: var(--mytheme-orange);
  --porto-yellow: var(--mytheme-yellow);
  --porto-green: var(--mytheme-green);
  --porto-teal: var(--mytheme-teal);
  --porto-blue: var(--mytheme-blue);
  --porto-purple: var(--mytheme-purple);
  --porto-pink: var(--mytheme-pink);

  /* Backgrounds, Surfaces & Borders */
  --porto-bg: var(--mytheme-bg-0);
  --porto-bg-alt: var(--mytheme-bg-1);
  --porto-surface-0: var(--mytheme-bg-2);
  --porto-surface-1: var(--mytheme-bg-3);
  --porto-surface-2: #;

  /* Text Elements */
  --porto-text: var(--mytheme-fg-0);
  --porto-text-muted: var(--mytheme-fg-2);
  --porto-border: var(--mytheme-bg-1);
  --porto-code: var(--mytheme-red);

  /* Grayscale Spectrum (0 to 1000) */
  --porto-gray-0: var(--mytheme-bg-0);
  --porto-gray-100: var(--mytheme-bg-1);
  --porto-gray-200: var(--mytheme-bg-2);
  --porto-gray-300: var(--mytheme-bg-3);
  --porto-gray-400: #;
  --porto-gray-500: #;
  --porto-gray-600: #;
  --porto-gray-700: var(--mytheme-fg-2);
  --porto-gray-800: var(--mytheme-fg-1);
  --porto-gray-900: var(--mytheme-fg-0);
  --porto-gray-1000: #; /* Deepest contrast */
}

/**
 * STEP 3: MAP DARK MODE
 */
[data-theme="dark"] {
  /* Primary Brand Color */
  --porto-primary: var(--mytheme-blue);
  --porto-primary-rgb: var(--mytheme-blue-rgb);
  --porto-primary-dark: #;
  --porto-primary-darker: #;
  --porto-primary-darkest: #;
  --porto-primary-light: #;
  --porto-primary-lighter: #;
  --porto-primary-lightest: #;

  /* Secondary & Semantic Colors */
  --porto-secondary: var(--mytheme-purple);
  --porto-success: var(--mytheme-green);
  --porto-warning: var(--mytheme-yellow);
  --porto-danger: var(--mytheme-red);
  --porto-info: var(--mytheme-blue);

  /* Standard Palette Mapping */
  --porto-red: var(--mytheme-red);
  --porto-orange: var(--mytheme-orange);
  --porto-yellow: var(--mytheme-yellow);
  --porto-green: var(--mytheme-green);
  --porto-teal: var(--mytheme-teal);
  --porto-blue: var(--mytheme-blue);
  --porto-purple: var(--mytheme-purple);
  --porto-pink: var(--mytheme-pink);

  /* Backgrounds, Surfaces & Borders */
  --porto-bg: var(--mytheme-bg-0);
  --porto-bg-alt: var(--mytheme-bg-1);
  --porto-surface-0: var(--mytheme-bg-2);
  --porto-surface-1: var(--mytheme-bg-3);
  --porto-surface-2: #;

  /* Text Elements */
  --porto-text: var(--mytheme-fg-0);
  --porto-text-muted: var(--mytheme-fg-2);
  --porto-border: var(--mytheme-bg-1);
  --porto-code: var(--mytheme-red);

  /* Grayscale Spectrum (0 to 1000) */
  /* TIP: Inverts the light mode spectrum. 0 is dark bg, 1000 is bright text. */
  --porto-gray-0: var(--mytheme-bg-0);
  --porto-gray-100: var(--mytheme-bg-1);
  --porto-gray-200: var(--mytheme-bg-2);
  --porto-gray-300: var(--mytheme-bg-3);
  --porto-gray-400: #;
  --porto-gray-500: #;
  --porto-gray-600: #;
  --porto-gray-700: var(--mytheme-fg-2);
  --porto-gray-800: var(--mytheme-fg-1);
  --porto-gray-900: var(--mytheme-fg-0);
  --porto-gray-1000: #; /* Highest contrast text */
}
```
