---
layout: post
title:  "Printing human dates with Timex in Elixir"
date:   2018-02-17 01:32:00 +0200
tags: [Elixir Timex date dates]
---

The [Timex](https://hexdocs.pm/timex/getting-started.html) library for Elixir provides a vast
array of functions for processing dates and times.  However, its documentation may not be useful
to everyone (such as me).

My need was to take an integer such as 20180125 and turn that into a string like "15 Jan, 2018".
But digging through the Timex docs didn't give me the final guidance that I needed -- namely the
`format()` example.  What I did find for examples appeared to be designed for writing APIs, not
for presenting dates/times to humans.

**Update**: After solving this, I was informed of another library that has a lovely landing
documentation page.  It appears this [Cldr Dates & Times](https://hexdocs.pm/ex_cldr_dates_times/readme.html)
library may even be a better choice than Timex when it comes to presenting date/time data
to humans.

### TLDR; The Format I Needed

    Timex.format!(my_date, "%d %b, %Y", :strftime)

**What I Started With**: `20180125`

**What I Wanted**: `25 Jan, 2018`

### Getting There

Getting from this date represented as an integer is easy.  Try this in iex:

```
iex(27)> 20180125 
         |> Integer.to_string 
         |> Timex.parse!("%Y%m%d", :strftime)
~N[2018-01-25 00:00:00]
```

This takes the integer, converts it to a string, and then uses Timex.parse(),
providing a strftime string that describes how to parse the string.

There are probably many good sources of information on strftime strings,
but I found this [Python strftime](http://strftime.org/) page useful.

The output is a good step forward, but it's certainly not
for normal human consumption.  The final step is the `Timex.format!()` function
mentioned above.  Note the `format!`, which returns the datetime or blows up
if the parsing fails.  Without the **!**, you get back a tuple of the usual
`{:ok, ...}` or `{:error, ...}` variety.  

Referring to the [strftime](http://strftime.org/) docs, you can choose a format
string to suit your output needs.  Then apply the `Timex.format!()` function.
In my case, I wanted `%d` (day number), `%b` (local month abbreviation), and
`%Y` (four digit year).

```
iex(28)> 20180125 
         |> Integer.to_string 
         |> Timex.parse!("%Y%m%d", :strftime) 
         |> Timex.format!("%d %b, %Y", :strftime)
"25 Jan, 2018"
```



