---
layout: post
title:  "Bitbucket CI Pipeline never completes"
date:   2019-08-09 13:26:00 -0200
tags: [Bitbucket continuous-integration mocha]
---

## Problem

Bitbucket CI pipeline on Nodejs project with Mocha test never completes `npm test` phase.

I was exploring Bitbucket's continuous integration pipeline feature, following this
[Atlassian tutorial](https://www.atlassian.com/continuous-delivery/tutorials/continuous-integration-tutorial), but there were a few problems.  The most significant problem was that
the pipelines would never complete: they would hang on `npm test`.

![Never Ending Test](/assets/never_ending_npm_test.png)

Some of the problems with the tutorial were formatting or other little mistakes
made by the author (excusable, but a bit surprising... nobody edited it?)
Other issues were just differences of user interface of today's Bitbucket vs
what the guide author had available at time of publishing.

However, <strong>the cause of the hanging pipeline is that Mocha changed its default behavior
from auto-exit to keep-running</strong>.  Thus, `npm test` would never exit on its own.  So when
pipeline would run it, pipeline would hang on that step.

If you're like me, and new to the Bitbucket pipelines, you might inadvertently eat up all of your CI minutes... you have to manually stop them if they won't end naturally!

![Wasted Minutes](/assets/wasting_pipeline_minutes.png)

## Solution

The solution is to modify the project's package.json file, updating the [Mocha](https://mochajs.org)
line to this
```yaml
"scripts": {
    "test": "mocha --exit"
  },
```
[mocha command line options](https://mochajs.org/#command-line-usage)

With this change, Mocha will now exit when all tests are complete, and your Bitbucket pipeline will continue to its natural end.
