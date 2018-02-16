---
layout: post
title:  "Add Logo to All Images In Folder"
date:   2017-03-06 03:07:00 +0200
tags: [shell terminal imagemagick batch-processing]
---

# Goal
**We want to superimpose (or overlay) our logo image on top of all images in the current directory.**

> These instructions are for **macOS**, and they assume a basic level of familiarity with entering commands via the **Terminal**.

This example shows how to overlay an image (such as a logo) on every image in the current directory.  It works on macOS 10.12, and it probably works in Linux.

The command will create new images having the original image name with the word **logo_** prepended.  So `an_image.png` is used to create a new file, `logo_an_image.png`.

## Pre-requisites

* You're on a modern Mac
* You have [HomeBrew](http://brew.sh/) or [MacPorts](http://www.macports.org/) installed
* You have installed [ImageMagick](https://www.imagemagick.org/script/download.php#macosx)

## Assumptions

1. You aren't afraid to use the Terminal
2. You want to process all images in the current directory
3. Your logo image is in a subfolder of this directory called "logo", and the logo filename is "logo.png"

You can change all of the settings and names once you understand the command.

## Risks and Caveats

If something goes wrong, you could lose data.  It is wise to make regular backups, and it is also wise play with this command first in a test folder with some sample images and logo image.

This may not be the most efficient or terse solution to the problem, so feel free to share better solutions.

```bash
cd my_test_folder_with_copies_of_images

find . -type f -maxdepth 1 \( -iname "*.jpg" -o -iname "*.png" \) \
    | tr -d './' \
    | tr '\n' '\0' \
    | xargs -0 -n1 -I {} \
    composite -gravity SouthWest -geometry +10+10 \
        logo/logo.png {} logo_{}
```

## What is Happening?

In short, we get a list of the image files in the current directory, then use the `composite` command from [ImageMagick](https://www.imagemagick.org/script/index.php) to add our logo image down near the lower left (_SouthWest_) corner of each image from our found list.


Let's explore this line by line.  Note that the trailing `\` (backslash) tells the shell to continue the command on the next line.  it's a good way to break up the long compound command into more readable chunks.

    find . -type f -maxdepth 1 \( -iname "*.jpg" -o -iname "*.png" \) \

First, we need to get a list of all image files in the current directory.  The command for that is `find`.
* `.` (dot) means apply the command to the current directory
* `-type f` means to only list files (not directories)
* `-maxdepth 1` means to only look at the current level; don't go into any sub-directories
* `\( -iname "*.jpg" -o -iname "*.png" \)` from the inside out, this says to use the `-iname` flag to search, case-insensitive, for files ending in `.jpg`, `-o` (or) (do another case-insensitive search for files ending in `.png`).  Then we need to wrap that expression with `(` and `)` so they get processed together.  If we don't do that, the arguments will get parsed from left to right in a way that will not give us the correct result.  Lastly, we have to _escape_ the `(` and `)` with leading `\` backslashes so the shell doesn't try to interpret them.

Next, we [pipe](https://en.wikipedia.org/wiki/Pipeline_(Unix)) `|` the output of `find` into `sed`, the _stream editor_.  `find` is listing the files it finds with a path showing the current directory (`.`) - it looks like this: `./an_image.png`.  However, since we will need to prepend the word **logo_** to the beginning of our output files, we need to get rid of the `./` from each source file name.  `sed` does this for us.
* provide a substitution rule string, denoted by the leading and closing `'` (single quote)
* `s|a|b|` says "search" for a, replace with b
* our `a` in this case is `\./` , which is the `./` that we want to remove, but we have to _escape_ that `.` so the shell won't try to interpret it
* the `b` (replace) field is empty because we don't want to replace the search text with anything - we just want to eliminate the search term

Then we pipe the output of the previous step into `tr`, [translate](https://en.wikipedia.org/wiki/Tr_(Unix)).



[Example project code](https://github.com/michaelteter/CoreDataSimpleFetch)

Once you have done the essential steps like creating a project with [x] CoreData included, and you have imported CoreData in the code, this is the
basic method of fetching (all rows) from a table:

```swift
    func fetchData() {
        let ad  = UIApplication.shared.delegate as! AppDelegate
        let moc = ad.persistentContainer.viewContext
        let fetchReq: NSFetchRequest<Person> = NSFetchRequest(entityName: "Person")
        fetchReq.sortDescriptors = [NSSortDescriptor(key: "name", ascending: true)]

        do {
            let fetchResult = try moc.fetch(fetchReq as! NSFetchRequest<NSFetchRequestResult>) as! [Person]
            for r in fetchResult {
                // do something with each object returned, such as
                print("\(r.name!)")
            }
        } catch {
            let er = error as NSError
            // do something with the er (error)
        }
    }
```
