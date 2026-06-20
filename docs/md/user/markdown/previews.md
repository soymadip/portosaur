# Interactive Previews

You can use the `<Pv />` component to preview various file types, including PDFs, images, code files, and more.

Main difference with `<a>` tag is that this opens a preview window instead of navigating to the file.

---

## Basic Usage

<big>**Single File**</big>:

```mdx
Here is my <Pv href="/resume.pdf">Resume</Pv>.
```

<big>**Multiple Files**</big>:

```mdx
These are <Pv href={["/resume.pdf", "/work-samples.zip"]}>Resume & Samples</Pv>.
```

---

## `<Pv />` Props

| Prop         | Type              | Default | Description                                                                                                                                                                                                              |
| :----------- | :---------------- | :------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`href`**   | `string \| array` | -       | Can be:<br/>1. The root-relative (e.g. `/code/script.py`) or absolute URL of an asset<br/>2. External direct asset URL<br/>3. Embed URL<br/>4. An Array of above                                                         |
| `type`       | `string`          | `auto`  | Force a specific renderer. Can be:<br/>1. `video`: play as video<br/>2. `image`: view image<br/>3. `pdf`: render PDF document<br/>4. `text`: syntax highlighted code/text<br/>5. `web`: embed external site in an iframe |
| `title`      | `string`          | -       | Custom title for the window header.                                                                                                                                                                                      |
| `desc`       | `string`          | -       | Tooltip text shown on hover.                                                                                                                                                                                             |
| `id`         | `string`          | -       | Custom ID for the URL hash (e.g. `#my-id-pv?m=popup`).                                                                                                                                                                   |
| `dock`       | `boolean`         | `false` | Open in Dock mode.                                                                                                                                                                                                       |
| `pip`        | `boolean`         | `false` | Open in PiP mode.                                                                                                                                                                                                        |
| `modeSwitch` | `boolean`         | `true`  | Show/hide the mode switch (Dock/PiP) toggle.                                                                                                                                                                             |
| `noUl`       | `boolean`         | `false` | If `true`, disables the trigger link underline.                                                                                                                                                                          |

---

## Automatic File Detection

You don't need to tell what kind of file is it for the basic usage. The system automatically detects and renders:

- **Documents**: PDFs.
- **Code**: 100+ languages with syntax highlighting.
- **Images**: High-res previews with click-to-zoom.
- **Video**: Native video player (mp4, webm, ogg, mkv).
- **Websites**: Full external sites with a "Visit" fallback.

### Forcing a Specific Renderer

If your URL doesn't have a standard extension (like an API endpoint or a dynamic stream), the auto-detection might not work. You can force a specific renderer by passing the `type` prop:

```jsx
<Pv href="https://example.com/stream" type="video">
  Watch Live Stream
</Pv>
```

---

## Choosing your Layout

There are 3 layout modes. You can set the starting layout mode using boolean flags, and the user can switch between them using the header buttons.

### 1. Popup (default)

It opens a centered modal that focuses user's attention on the document.

```jsx
<Pv href="/design-spec.pdf">Open Specification</Pv>
```

### 2. PiP (`pip`)

Creates a floating window that stays visible while the user scrolls the main page.

- **Mobile**: Becomes a YouTube-style mini-player at the bottom.
- **Desktop**: A sleek floating window you can drag anywhere.

```jsx
<Pv href="/demo.mp4" pip>
  Watch Demo while reading
</Pv>
```

### 3. Dock (`dock`)

Splits the screen to show content side-by-side.

- **Desktop**: Pushes the documentation to the left and docks the preview to the right.
- **Mobile**: Becomes a bottom-half "Peek" sheet.

```jsx
<Pv href="/api-example.js" dock>
  View Code Side-by-Side
</Pv>
```

---

## Tabbed Preview (Multi-Source)

You can group related files into a single preview window by passing an array to the `href` prop. Users can switch between files using an tab bar.

```jsx
<Pv
  title="Project Source"
  href={[
    { path: "/src/index.js", label: "Logic" },
    { path: "/src/styles.css", label: "Theme" },
  ]}
>
  Browse Project Files
</Pv>
```

> [!INFO]
>
> You don't have to pass separate `path` and `label` objects. You can just pass an array of strings, and the filename will automatically be used as the tab label:
>
> ```jsx
> <Pv href={["/src/index.js", "/src/styles.css"]}>Browse Project Files</Pv>
> ```
