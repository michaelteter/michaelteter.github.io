---
layout: post
title:  "Swift3 iOS Transparent UINavigationBar Example"
date:   2016-09-13 00:34:50 +0200
tags: [swift swift3 iOS UINavigationBar]
---

There are probably a number of ways to do this, but one simple way to make a navbar transparent is to add the following code to each view controller:

```swift
    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        if let nav = self.navigationController?.navigationBar {
            nav.setBackgroundImage(UIImage(), for: .default)
            nav.shadowImage = UIImage()
            nav.isTranslucent = true
        }
    }
```

The result should look like this (two color background is to illustrate the transparency):

![Example](assets/NavbarTransparent.png)