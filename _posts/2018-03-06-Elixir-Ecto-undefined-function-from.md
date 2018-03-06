---
layout: post
title:  "Solving the Elixir/Ecto error 'undefined function from/2'"
date:   2018-03-06 05:17:00 +0200
tags: [Elixir Ecto query from]
---

## Problem

In Elixir, when trying to write an Ecto query such as this:

```
q = from(v in Vol,
    where: v.user_id == ^user.id,
    order_by: [desc: v.inserted_at])
```

you may encounter the error:

```
undefined function from/2
```

This is a rather difficult error to search for on a search engine, and
more than once over time I have encountered it and had to dig around to find
the solution.

## Solution

```
import Ecto.Query
```

Do this before your use of from/2 to include the functions provided by Ecto.Query.



