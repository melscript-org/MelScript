# MelScript Support for VS Code

Official syntax highlighting support for [MelScript](https://github.com/melscript-org/MelScript).

## Features

- **Syntax Highlighting**: Automatically colors code inside `<mel>` tags in HTML files and `.mel` files.
- **Run MelScript**: Execute `.mel` files directly in VS Code with a live preview (Click the "Play" button in the editor title or run command `MelScript: Run MelScript`).
- **Embedded Language**: Treats content within `<mel>...</mel>` as MelScript.

## Usage

### Syntax Highlighting
1. Open any `.html` file and use `<mel>` tags.
2. Or open any `.mel` file.

### Running Code
1. Open a `.mel` file.
2. Click the **Run** icon (Play button) in the editor toolbar.
3. A preview window will open showing the output of your script.

```html
<mel>
  function hello(name) {
    print("Hello " + name);
  }
  
  hello("World");
</mel>
```

## Installation

This extension is available on the [VS Code Marketplace](https://marketplace.visualstudio.com/).

## Contributing

Source code is available at [GitHub](https://github.com/melscript-org/MelScript).
