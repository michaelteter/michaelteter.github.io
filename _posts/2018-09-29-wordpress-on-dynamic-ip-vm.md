---
layout: post
title:  "Wordpress (on dynamic IP virtual machine) redirects to old IP"
date:   2018-09-29 20:42:00 +0700
tags: [Wordpress dynamic-ip]
---

## Problem

Wordpress on a Virtual Machine keeps redirecting to old IP address

Using a virtual machine with a dynamic IP bridged to the host machine, and
the host machine connects to various different WIFI networks... I found that
my development Wordpress site on my (virtualbox) VM kept redirecting my web
browser to the old/original IP address the VM had when Wordpress was first
setup.

I do not yet know the correct solution; surely there is one, but the crude
manual fix is to change the (unfortunately?) hard-coded IP address in the Wordpress
site database.

Login to the WP database and check the following:

```
mysql> select * from wp_options where option_name in ('siteurl', 'home');       
+-----------+-------------+---------------------+----------+
| option_id | option_name | option_value        | autoload |
+-----------+-------------+---------------------+----------+
|         2 | home        | http://192.168.1.17 | yes      |
|         1 | siteurl     | http://192.168.1.17 | yes      |
+-----------+-------------+---------------------+----------+
```

You'll probably see two rows returned that have the VM's old IP address.
(What were they thinking with this?)

Surely this is a dirty fix, and there's a more correct solution.  But make the
following change:

```
mysql> update wp_options set option_value='http://10.0.1.8' where option_name in ('siteurl','home');
Query OK, 2 rows affected (0.00 sec)
Rows matched: 2  Changed: 2  Warnings: 0
```

With this change, the incorrect redirect should be resolved.

Naturally you will use whatever IP address in the sql update that your current VM is using; and 
pay attention to your original option_value.  If it was https, then use https in your SQL update.
