---
layout: post
title:  "Case-insensitive Sorting in Swift 3"
date:   2016-09-12 00:34:50 +0200
categories: Swift selector
---
Sorting with CoreData is pretty simple, but I ran into difficulty while trying to get string sorting to be case-insensitive.  Examples I found worked, but they gave deprecation warnings regarding using selectors.  This is the solution that worked for me:


{% highlight swift %}
sortDescriptors.append(NSSortDescriptor(key: "title", ascending: true, selector: #selector(NSString.localizedCaseInsensitiveCompare)))
{% endhighlight %}

Of course this leaves out a lot of detail, but the importance of the example is in the proper (Swift 3) selector use.
