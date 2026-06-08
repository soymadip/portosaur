# Tabs

Use the `<Tabs />` and `<TabItem />` components to create tabbed content blocks. This is ideal for showing code in multiple languages or providing alternative versions of the same information.

## Basic Usage

````jsx
<Tabs>
  <TabItem value="js" label="JavaScript">
    ```javascript console.log("Hello World"); ```
  </TabItem>
  <TabItem value="py" label="Python">
    ```python print("Hello World") ```
  </TabItem>
</Tabs>
````

## Props

### `<Tabs />`

| Prop           | Type  | Description                                                 |
| :------------- | :---- | :---------------------------------------------------------- |
| `defaultValue` | `str` | The value of the tab to show by default.                    |
| `groupId`      | `str` | Sync selection across multiple tab blocks with the same ID. |

### `<TabItem />`

| Prop      | Type   | Description                                   |
| :-------- | :----- | :-------------------------------------------- |
| `value`   | `str`  | **(Required)** Unique identifier for the tab. |
| `label`   | `str`  | The text displayed on the tab button.         |
| `default` | `bool` | Set to `true` to make this the default tab.   |
