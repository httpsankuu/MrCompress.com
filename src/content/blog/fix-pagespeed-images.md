---
title: "How to fix 'Serve images in next-gen formats' in Google PageSpeed"
description: "Learn how to improve your Core Web Vitals by converting traditional JPG and PNG images to modern formats like WebP and AVIF."
pubDate: "2026-06-02"
category: "SEO"
---

If you've run a Lighthouse or Google PageSpeed Insights report lately, you've likely seen the recommendation to "Serve images in next-gen formats."

## What are Next-Gen Formats?
Next-gen formats refer to image formats like **WebP** and **AVIF**. These formats have superior compression and quality characteristics compared to their older JPEG and PNG ancestors.

## Why it Matters
Serving images in these formats significantly reduces the amount of data a user needs to download, leading to:
1. Faster Page Load Times
2. Improved LCP (Largest Contentful Paint)
3. Better Search Engine Rankings

## How to Fix It
The easiest way to fix this is to convert your existing assets.
1. Download your current images.
2. Use **MrCompress** to convert them to WebP or AVIF.
3. Replace the files on your server.
4. Update your HTML to use the `<picture>` tag for better fallback support.

```html
<picture>
  <source srcset="image.avif" type="image/avif">
  <source srcset="image.webp" type="image/webp">
  <img src="image.jpg" alt="Description">
</picture>
```

By making this simple switch, you'll see an immediate boost in your performance scores.
