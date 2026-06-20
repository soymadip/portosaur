# UI Components

Portosaur provides global UI components that you can use anywhere inside your `.mdx` files without needing to import them.

---

## `<Btn>`

The `<Btn>` component is a sleek, highly configurable button that automatically handles semantic coloring, custom icons, tooltips, and client-side page routing.

### Basic Usage

The simplest button wraps text in `<Btn>` and defaults to a neutral style:

```mdx
<Btn>Click Me</Btn>
```

### Color Variants

You can change the color using the `variant` prop to establish visual hierarchy:

```mdx
<Btn primary>Primary</Btn>
<Btn secondary>Secondary</Btn>
<Btn success>Success</Btn>
<Btn info>Info</Btn>
<Btn warning>Warning</Btn>
<Btn danger>Danger</Btn>
```

### External & Internal Links

Passing the `href` prop converts the component into a client-side Docusaurus `<Link>` to prevent full page reloads for internal pages.

- For external links, it defaults to opening securely in a new tab.
- For internal links, it defaults to standard page-to-page routing in the same tab.
- Pass the `sameTab` prop to force external links to open in the same tab.

```mdx
{/* External Link */}

<Btn primary href="https://github.com/your-username">
  Visit my GitHub
</Btn>

{/* Internal Link (opens in same tab) */}

<Btn secondary href="/docs" sameTab>
  Go to Documentation
</Btn>
```

### Button Icons

You can pass Emojis, image URLs, or SVG React components directly to the `icon` prop. The button automatically sizes and aligns them next to the text.

```mdx
{/* Using an Emoji */}

<Btn icon="🚀">Launch Project</Btn>

{/* Using an Image/SVG URL */}

<Btn icon="https://github.githubassets.com/favicons/favicon.svg">GitHub</Btn>

{/* Using an SVG React Component */}
import IconClose from '@site/assets/img/svg/icon-close.svg';

<Btn danger icon={<IconClose />}>
  Close
</Btn>
```

### Hover Tooltips (Hints)

Add a hover message using the `desc` or `hint` prop.

```mdx
<Btn danger hint="This action is destructive and cannot be undone.">
  Delete Project
</Btn>
```

### Btn API Reference

The `<Btn>` component accepts the following props:

| Prop                      | Type                  | Default | Description                                                                                     |
| :------------------------ | :-------------------- | :------ | :---------------------------------------------------------------------------------------------- |
| `primary`, `danger`, etc. | `boolean`             | `false` | Boolean flags for color style (`primary`, `secondary`, `success`, `info`, `warning`, `danger`). |
| `icon`                    | `string` \| `element` | `null`  | Emoji, image URL path, or SVG component to render as a leading icon.                            |
| `href`                    | `string`              | `null`  | Link destination. Enables client-side Routing via Docusaurus `<Link>`.                          |
| `sameTab`                 | `boolean`             | `false` | Forces external links to open in the same tab instead of a new tab.                             |
| `desc` / `hint`           | `string`              | `null`  | Styled hover tooltip message. Defaults to top position.                                         |
| `disabled`                | `boolean`             | `false` | Disables button interactions and styles.                                                        |
| `as`                      | `string` \| `element` | `null`  | Custom tag or component to render as (e.g. `button`, `a`).                                      |
| `className`               | `string`              | `""`    | Custom CSS classes to apply to the button.                                                      |
| `style`                   | `object`              | `null`  | Inline styles to apply to the button.                                                           |

---

## `<Dropdown>`

The `<Dropdown>` component attaches a hover-activated overlay menu to a button or custom element. It includes a smart 150ms delay to prevent accidental closes when the cursor moves.

### Basic Usage

The simplest way is to pass a `label` string. This automatically creates a default button trigger:

```jsx
<Dropdown
  label="Downloads"
  items={[
    { id: "1", label: "Download PDF", onClick: () => alert("Downloading PDF") },
    {
      id: "2",
      label: "Download Source",
      onClick: () => alert("Downloading Source"),
    },
  ]}
/>
```

### Custom Triggers

You can pass a custom element (like a custom styled `<Btn>`) or a plain HTML tag to the `trigger` prop. The dropdown automatically handles click/hover toggles and appends a down arrow (`▼`) to React elements:

```jsx
{
  /* Custom Btn trigger with variant and icon */
}
<Dropdown
  trigger={
    <Btn primary icon="⚙️">
      Settings
    </Btn>
  }
  items={[
    { id: "1", label: "Edit Profile" },
    { id: "2", label: "Sign Out" },
  ]}
/>;

{
  /* Custom inline span trigger */
}
<Dropdown
  trigger={
    <span style={{ cursor: "pointer", color: "var(--ifm-color-primary)" }}>
      Select Mode
    </span>
  }
  items={[
    { id: "1", label: "Standard View" },
    { id: "2", label: "Compact View" },
  ]}
/>;
```

### Dropdown Items with Icons & Links

Dropdown items support rendering leading icons (Emojis or SVGs) and standard links (`href` / `sameTab`):

```jsx
import IconMoon from "@site/assets/img/svg/icon-moon.svg";
import IconSun from "@site/assets/img/svg/icon-sun.svg";

<Dropdown
  label="Settings"
  items={[
    { id: "theme-dark", label: "Dark Theme", icon: IconMoon, active: true },
    { id: "theme-light", label: "Light Theme", icon: IconSun },
    { id: "help", label: "Help Center", icon: "❓", href: "/docs/help" },
  ]}
/>;
```

### Dropdown API Reference

#### Component Props

| Prop            | Type                  | Default  | Description                                                                                                                                                             |
| :-------------- | :-------------------- | :------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `*` (Btn Props) | `any`                 | `null`   | If omitting `trigger`, any button-specific props (e.g. `primary`, `icon`, `disabled`, `hint`) passed directly to `<Dropdown>` will be forwarded to the default trigger. |
| `label`         | `string`              | `"Menu"` | Text displayed on the default button trigger (if `trigger` is omitted).                                                                                                 |
| `trigger`       | `element` \| `string` | `null`   | Custom React element or text string to use as the click/hover trigger.                                                                                                  |
| `items`         | `array`               | `[]`     | Array of menu item objects (see structure below).                                                                                                                       |
| `hoverDelay`    | `number`              | `150`    | Buffer delay (ms) before the dropdown menu closes when the mouse leaves.                                                                                                |
| `className`     | `string`              | `""`     | Custom CSS class applied to the outer dropdown container.                                                                                                               |
| `style`         | `object`              | `null`   | Inline styles applied to the outer dropdown container.                                                                                                                  |

#### Item Object Properties

Each object inside the `items` array supports the following properties:

| Key       | Type                  | Default      | Description                                                                     |
| :-------- | :-------------------- | :----------- | :------------------------------------------------------------------------------ |
| `label`   | `string`              | **Required** | The text label to display on the menu item.                                     |
| `id`      | `string`              | `index`      | Unique React key. Defaults to loop index if omitted.                            |
| `icon`    | `string` \| `element` | `null`       | Leading icon (Emoji, URL, or SVG React component).                              |
| `active`  | `boolean`             | `false`      | Toggles active styling (highlighting) on the item.                              |
| `onClick` | `function`            | `null`       | Click callback handler.                                                         |
| `href`    | `string`              | `null`       | URL target. If provided, renders the item as a client-side Docusaurus `<Link>`. |
| `sameTab` | `boolean`             | `false`      | Forces external links to open in the same tab instead of a new tab.             |
