# Details

The `<Details />` component provides a styled disclosure widget (accordion) for hiding and showing content. It's a great way to include extra information without cluttering the main page.

## Usage

```jsx
<Details title="Click to reveal more info">
  This is the hidden content that appears when you click the header. You can
  include **Markdown** or even other components inside here.
</Details>
```

## Props

| Prop    | Type      | Description                                       |
| :------ | :-------- | :------------------------------------------------ |
| `title` | `string`  | The text displayed in the header button.          |
| `open`  | `boolean` | If `true`, the accordion will be open by default. |
