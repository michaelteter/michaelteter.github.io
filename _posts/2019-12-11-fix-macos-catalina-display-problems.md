---
layout: post
title:  "Fix macOS Catalina Display Problems"
date:   2019-12-11 14:57:00 -0100
tags: [macOS Catalina graphics display problem]
---

## Problem

macOS Catalina sometimes does not display right click context menu, or top screen dropdown menus only appear partially (and possibly with gaps, in strange colors, etc.).

## Solution

Uncheck (disable) **Reduce transparency** in System Preferences->Accessibility->Display.

I had at some previous time enabled reduced transparency to alleviate some aesthetic issue, but apparently Catalina has introduced some display bugs that this option affects.

With the option unchecked, the display problem is resolved (for me).

