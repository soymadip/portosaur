# Code Blocks

{{meta.project.title}} uses Prism.js for syntax highlighting. We also provide extra functionality to highlight and annotate your code snippets effectively.

## Magic Comments

You can use special comments inside your code blocks to highlight lines. These are commonly known as "Magic Comments".

### Highlight Line

Highlight important parts of your code using `// highlight-next-line`.
This highlights the line with a subtle accent background.

```javascript
function greet() {
  // highlight-next-line
  console.log("This line is highlighted!");
  return true;
}
```

### Highlight Block

You can highlight multiple lines at once by wrapping them in `highlight-start` and `highlight-end` comments.

```javascript
function init() {
  console.log("Setting up...");
  // highlight-start
  startServer();
  connectDatabase();
  // highlight-end
  console.log("Ready!");
}
```

### Error Line

Show an incorrect or failing line of code by using `// error-next-line`.
This highlights the line in red to indicate an error or bad practice.

```javascript
function calculate() {
  // error-next-line
  let result = 1 / 0; // Division by zero
}
```

### Success Line

Highlight a successful or correct line of code using `// success-next-line`.
This highlights the line in green.

```javascript
function calculate() {
  // success-next-line
  let result = Number.MAX_VALUE; // Safe!
}
```
