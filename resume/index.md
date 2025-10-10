---
layout: page
title: Resume
permalink: /resume/
---

[Download PDF version](/michaelteter_resume.pdf)

{% capture resume_content %}
{% include_relative michaelteter_resume.md %}
{% endcapture %}

{{ resume_content | markdownify }}
