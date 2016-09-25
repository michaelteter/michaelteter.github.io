---
layout: post
title:  "Xcode 8 Swift 3 CoreData simple fetch"
date:   2016-09-25 10:58:50 +0200
tags: [swift swift3 iOS CoreData fetch]
---

This minimal example demonstrates how to fetch all records from a CoreData table.  (It also out of necessity demonstrates how to add records.)

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