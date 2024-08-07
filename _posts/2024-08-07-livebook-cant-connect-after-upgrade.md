---
layout: post
title: "LiveBook Can't Connect After Upgrade"
date: 2024-08-07 21:18:00 -0100
tags: [elixir livebook troubleshooting]
---

## After LiveBook minor version upgrade, can't connect to node

There was a "small" change in the recent LiveBook project which
may prevent LiveBook from connecting to other nodes.

[LiveBook Changelog](https://github.com/livebook-dev/livebook/blob/v0.13.3/CHANGELOG.md?plain=1#L66)

To make your node visible to LiveBook now, you must use
long names.

Now when starting iex, use `--name` instead of --sname.

Then in the LiveBook config, specify the full node name such as myproject@mymac.local (for local Mac users).
