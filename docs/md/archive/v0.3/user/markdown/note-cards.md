# Note Cards & Topics

These components are designed for high-level organization, typically used on your index pages to list notes or categories.

## `<NoteCards />`

Generates a responsive grid of cards for your notes. It automatically pulls data from your project's note structure.

```jsx
<NoteCards />
```

## `<TopicList />`

Generates a list of topics or categories, ideal for organizing a large knowledge base into scannable sections.

```jsx
<TopicList desc="Custom introductory text here..." />
```

### Props

| Prop   | Type  | Default                         | Description                                 |
| :----- | :---- | :------------------------------ | :------------------------------------------ |
| `desc` | `str` | `"Click on the links below..."` | Introductory text displayed above the list. |

> [!TIP]
> These components are best used on "Index" pages (e.g., `notes/index.md` or `notes/guide/index.md`) to provide a bird's-eye view of your content.
