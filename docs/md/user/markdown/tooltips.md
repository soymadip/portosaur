# Tooltips / Hints

Add interactive hints to any text or element using the `<Hint />` component.

## Usage

```jsx
You can hover over this <Hint msg="Surprise!">text</Hint> to see a tooltip.
```

## Props

| Prop     | Type   | Default | Description                                                                                                         |
| :------- | :----- | :------ | :------------------------------------------------------------------------------------------------------------------ |
| `msg`    | `str`  | `null`  | **(Required)** The text content to show inside the tooltip.                                                         |
| `bottom` | `bool` | `false` | Position the tooltip below the child.                                                                               |
| `left`   | `bool` | `false` | Position the tooltip to the left of the child.                                                                      |
| `right`  | `bool` | `false` | Position the tooltip to the right of the child. (If none of `bottom`, `left`, or `right` are set, defaults to top). |
| `noUl`   | `bool` | `false` | If `true`, disables the subtle dotted underline on the child element.                                               |
| `color`  | `str`  | `null`  | Custom text color for the tooltip.                                                                                  |
| `bg`     | `str`  | `null`  | Custom background color for the tooltip.                                                                            |
| `gap`    | `int`  | `5`     | Distance in pixels between the element and the tooltip.                                                             |
| `shadow` | `str`  | `null`  | Custom CSS shadow for the tooltip.                                                                                  |
