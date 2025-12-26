---
layout: page
title: Digital Art
permalink: /digital-art/
---

<link href="https://cdn.jsdelivr.net/npm/glightbox/dist/css/glightbox.min.css" rel="stylesheet" />
<script src="https://cdn.jsdelivr.net/npm/glightbox/dist/js/glightbox.min.js"></script>

<h1>Generative Art</h1>
<p>These are examples of my generative art, created with custom algorithms.
Each piece is unique, using randomness and procedural design. Click any image to view full size.</p>

<div class="gallery" style="display:flex; flex-wrap:wrap; gap:10px;">
  {% for image in site.static_files %}
    {% if image.path contains '/assets/art/thumbs/' %}
      {% assign full_path = image.path | replace: '/thumbs', '' %}
      <a href="{{ full_path }}" class="glightbox" data-gallery="genart">
        <img src="{{ image.path }}" width="220" height="auto" loading="lazy" style="border-radius:8px; box-shadow:0 2px 6px rgba(0,0,0,0.1);" />
      </a>
    {% endif %}
  {% endfor %}
</div>

<script>
  const lightbox = GLightbox({ selector: '.glightbox' });
</script>
