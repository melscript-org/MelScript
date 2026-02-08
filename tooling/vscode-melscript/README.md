# MelScript Support for VS Code

Official syntax highlighting support for [MelScript](https://github.com/melscript-org/MelScript).

## Features

- **Syntax Highlighting**: Automatically colors code inside `<mel>` tags in HTML files.
- **Embedded Language**: Treats content within `<mel>...</mel>` as MelScript (syntax similar to JavaScript).

## Usage

1. Open any `.html` file.
2. Write your MelScript code inside `<mel>` tags.
3. Enjoy syntax highlighting!

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
