# pic-od-vsc

<a href="https://marketplace.visualstudio.com/items?itemName=frostming.pic-od-vsc" target="__blank"><img src="https://img.shields.io/visual-studio-marketplace/v/frostming.pic-od-vsc.svg?color=eee&amp;label=VS%20Code%20Marketplace&logo=visual-studio-code" alt="Visual Studio Marketplace Version" /></a>
<a href="https://kermanx.github.io/reactive-vscode/" target="__blank"><img src="https://img.shields.io/badge/made_with-reactive--vscode-%23007ACC?style=flat&labelColor=%23229863"  alt="Made with reactive-vscode" /></a>

## Configurations

<!-- configs -->

| Key                  | Description                                                                                | Type     | Default                    |
| -------------------- | ------------------------------------------------------------------------------------------ | -------- | -------------------------- |
| `pic-od.binaryPath`  | Path to the pic-od binary                                                                  | `string` | `"pic-od"`                 |
| `pic-od.profile`     | Profile name to use for upload                                                             | `string` | `""`                       |
| `pic-od.urlTemplate` | Template for inserting the uploaded image URL. Available placeholders: ${fileName}, ${url} | `string` | `"![${fileName}](${url})"` |

<!-- configs -->

## Commands

<!-- commands -->

| Command                      | Title                                    |
| ---------------------------- | ---------------------------------------- |
| `pic-od.uploadFromClipboard` | Pic OpenDAL: Upload Image from Clipboard |
| `pic-od.uploadFromExplorer`  | Pic OpenDAL: Upload Image                |

<!-- commands -->

## License

[MIT](./LICENSE.md) License © 2025 [Frost Ming](https://github.com/frostming)
