# shell-file-mode

A port of [shell-file-mode](https://github.com/rnml/shell-file-mode) to VSCode.

Install from [the VSCode extension marketplace](https://marketplace.visualstudio.com/items?itemName=mtakeda.shell-file-mode).

| command                              | keybinding   | keybinding (mac) |
|--------------------------------------|--------------|------------------|
| shell-file-mode.findShellFile        | ctrl+shift+f | cmd+shift+f      |
| shell-file-mode.insertShellFileBlock | ctrl+shfit+i | cmd+shift+i      |
| shell-file-mode.runShellFileBlock    | ctrl+shift+r | cmd+shift+r      |

## TODOs:

- `shell-file-mode.openShellFile` and `shell-file-mode.runShellFile` should move
  cursor to appropriate position in the block
- add some tests?
- refactor codebase to reduce duplication
- make shell file path configurable
