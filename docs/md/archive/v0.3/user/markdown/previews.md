# Interactive Previews

{{meta.project.title}} transforms static links into an **interactive multitasking system**. Instead of forcing users away to a new tab, Interactive Previews keep them engaged with your content by opening references in a premium, responsive window.

---

## Component Reference

### `<Pv />` Props

| Prop          | Type      | Default   | Description                                          |
| :------------ | :-------- | :-------- | :--------------------------------------------------- |
| **`href`**    | `string`  | -         | The path to the file or URL.                         |
| **`sources`** | `array`   | -         | Array of `{path, label}` objects for tabbed views.   |
| **`mode`**    | `string`  | `"popup"` | Starting layout: `"popup"`, `"pip"`, or `"dock"`.    |
| `title`       | `string`  | -         | Custom title for the window header.                  |
| `id`          | `string`  | -         | Custom ID for the URL hash (e.g. `#my-id:pv-popup`). |
| `modeSwitch`  | `boolean` | `true`    | Show/hide the multitasking (Dock/PiP) toggle.        |
| `underline`   | `boolean` | `true`    | Show the distinctive dashed link style.              |
| `desc`        | `string`  | -         | Tooltip text shown on hover.                         |

---

### `<SrcPv />`

A specialized trigger for lists. Perfect for "Resources" or "Downloads" sections.

```jsx
<SrcPv
  prefixText="Resources: "
  sources={[
    { path: "https://github.com", label: "GitHub" },
    { path: "/manual.pdf", label: "User Manual" },
  ]}
/>
```

---

## Why use Previews?

- **Keep the Flow**: Users can view PDFs, images, or code without losing their scroll position on the main article.
- **Contextual Learning**: Display a code sample in a side-dock while the user reads the explanation.
- **Immersive references**: Show full external websites or complex documents in a beautiful, controlled UI.

---

## The Core Component: `<Pv />`

The `<Pv />` (Preview) component is your primary tool. Wrap any link or text with it to make it "Preview-able".

```jsx
<Pv href="/resume.pdf">View my Resume</Pv>
```

### Automatic File Detection

You don't need to tell {{meta.project.title}} what kind of file it is. The system automatically detects and renders:

- **Documents**: PDFs (with zoom/search).
- **Code**: 100+ languages with syntax highlighting.
- **Images**: High-res previews with click-to-zoom.
- **Websites**: Full external sites with a "Visit" fallback.

---

## Choosing your Layout

{{meta.project.title}} features a **3-tier adaptive engine** that ensures your previews look great on any device. You can set the starting `mode`, and the user can switch between them using the header controls.

### 1. Popup (The Immersive Choice)

The default mode. It opens a centered, high-contrast modal that focuses the user's entire attention on the document. Best for Resumes, full-screen images, or critical references.

```jsx
<Pv href="/design-spec.pdf" mode="popup">
  Open Specification
</Pv>
```

### 2. PiP (The Multitasker)

**Picture-in-Picture** mode creates a floating window that stays visible while the user scrolls the main page.

- **Mobile**: Becomes a YouTube-style mini-player at the bottom.
- **Desktop**: A sleek floating window you can drag anywhere.

```jsx
<Pv href="/demo.mp4" mode="pip">
  Watch Demo while reading
</Pv>
```

### 3. Dock (The Pro Workflow)

Splits the screen to show content side-by-side.

- **Desktop**: Pushes the documentation to the left and docks the preview to the right (like a professional IDE).
- **Mobile**: Becomes a bottom-half "Peek" sheet.

```jsx
<Pv href="/api-example.js" mode="dock">
  View Code Side-by-Side
</Pv>
```

---

## Advanced Features

### Tabbed Collections (Multi-Source)

You can group related files into a single preview window using the `sources` prop. Users can switch between files using an integrated tab bar.

```jsx
<Pv
  title="Project Source"
  sources={[
    { path: "/src/index.js", label: "Logic" },
    { path: "/src/styles.css", label: "Theme" },
  ]}
>
  Browse Project Files
</Pv>
```

### Stable Deep Linking

Every preview generates a unique URL hash. If a user finds a specific file in your dock, they can copy the URL and share it. When the next person opens that link, {{meta.project.title}} will **automatically open the previewer** to that exact file and mode.

**Format**: `#my-slug:pv-dock`
