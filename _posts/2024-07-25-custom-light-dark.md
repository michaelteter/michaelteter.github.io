---
layout: post
title: "Macos + Wezterm + VSCode light/dark switcher"
date: 2024-07-25 18:36:00 -0100
tags: [macos wezterm vscode configuration]
---

## My zsh command-line approach to toggling my light/dark modes for the dev tools I use

In my `~/.zshrc` I have the following:

```sh
# Function to change WezTerm, VSCode theme, and macOS appearance
change_themes() {
  local wezterm_theme=$1
  local vscode_theme=$2
  local macos_mode=$3
  local settings_file="$HOME/Library/Application Support/Code/User/settings.json"

  # Update WezTerm theme
  sed -i '' "s/^config\.color_scheme.*$/config.color_scheme = \"$wezterm_theme\"/" ~/.config/wezterm/wezterm.lua

  # Update VSCode theme
  sed -i '' "s/\"workbench\.colorTheme\": \".*\"/\"workbench.colorTheme\": \"$vscode_theme\"/" "$settings_file"

  # Update macOS appearance
  if [ "$macos_mode" = "dark" ]; then
    osascript -e 'tell app "System Events" to tell appearance preferences to set dark mode to true'
  else
    osascript -e 'tell app "System Events" to tell appearance preferences to set dark mode to false'
  fi
}

alias light='change_themes "Alabaster" "Default Light+" "light"'
alias dark='change_themes "3024 (dark) (terminal.sexy)" "Panda Syntax" "dark"'
```

Then from any terminal app that's using zshell and my normal zshell dotfile,

`light` to change my themes to Light mode.

`dark` to change the themes to Dark mode.

Obviously you can choose your own theme names in the aliases, and you can change the alias names as well. (Be sure to check `which dark` or whatever names you choose so you don't
shadow some other program with that name.)

Remember to `source ~/.zshrc` after you change your zshell config file so your changes are recognized in your current shell while setting this up.
