---
layout: post
title:  "Compiling Elixir Modules In Windows"
date:   2018-07-06 10:55:00 +0200
tags: [Elixir Windows Powershell]
---

## Problem

I wanted to do some Elixir/Phoenix development in Windows 10 (don't ask why...),
but I couldn't build my Phoenix app due to a failure building the comeonin module.

```
could not compile dependency :comeonin, "mix compile" failed. You can 
recompile this dependency with "mix deps.compile comeonin", update it with "mix
deps.update comeonin" or clean it with "mix deps.clean comeonin"
** (Mix.Error) Could not find the program `nmake`.
```

The issue is that even though I had installed the Visual Studio Community 
development tools (which includes nmake), the build tools are not visible
in the path on Powershell.

Visual Studio does provide a batch file to make those tools visible, but
running that script only makes the tools visible to the (temporary) shell
that the script runs in.

## Solution

### Pre-reqs

1. Erlang and Elixir (Windows packages) are installed.
2. MS Visual Studio, or the Community version, or the MS build tools, are installed.

### Build Tools Paths

From pre-req 2, determine the path to your *vcvars64.bat* script.  For me this was
```
C:\Program Files (x86)\Microsoft Visual Studio\2017\Community\VC\Auxiliary\Build\vcvars64.bat
```

### Powershell Profile

Edit the Powershell profile file.  If the file doesn't exist, create it.  The path is
```
C:\Users\your_username_here\Documents\WindowsPowerShell\Microsoft.PowerShell_profile.ps1
```

Add the following code to the profile

```
function Invoke-CmdScript {
  param(
    [String] $scriptName 
  )
  $cmdLine = """$scriptName"" $args & set"
  & $Env:SystemRoot\system32\cmd.exe /c $cmdLine |
  select-string '^([^=]*)=(.*)$' | foreach-object {
    $varName = $_.Matches[0].Groups[1].Value
    $varValue = $_.Matches[0].Groups[2].Value
    set-item Env:$varName $varValue
  }
}

Invoke-CmdScript "C:\Program Files (x86)\Microsoft Visual Studio\2017\Community\VC\Auxiliary\Build\vcvars64.bat"
```

The function allows you to run a script, the one that makes the build tools visible,
but instead of losing the context after that script ends, the settings are propogated
back to the calling shell (Powershell).

The profile then uses that Invoke-CmdScript function to call the vcvars64.bat script that we
got from step 2 of the prereqs.

With this done, you should be able to successfully build/compile Elixir modules within Windows 10.

