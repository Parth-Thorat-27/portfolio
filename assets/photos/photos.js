/**
 * The contact sheet on hobbies.html is built from this list.
 *
 * To add photographs:
 *   1. Drop the files into assets/photos/ (jpg, png, webp or avif).
 *      A subfolder becomes a series: assets/photos/cricket/final-over.jpg
 *      lands under "Cricket", and series show up as filter buttons.
 *   2. Run:  node tools/photos.mjs
 *
 * That rewrites this file — sizes, camera settings from EXIF, and a title taken
 * from the file name. Anything typed in by hand afterwards (title, place, alt)
 * is kept the next time it runs. Order here is the order on the page.
 *
 *   { src, w, h, title, place, series, alt, exif, thumb, view }
 *
 * thumb and view are the small copies tools/thumbs.py makes; run it before
 * photos.mjs and the page serves those instead of the originals.
 */
window.PHOTOS = [
  {"src":"assets/photos/csm.jpg","w":584,"h":1040,"title":"Csm","place":"","series":"","alt":"","exif":"","thumb":"assets/photos/thumbs/csm.webp","view":"assets/photos/web/csm.webp"},
  {"src":"assets/photos/Gemini_Generated_Image_sfh1oosfh1oosfh1 - Edited.png","w":992,"h":954,"title":"","place":"","series":"","alt":"","exif":"","thumb":"assets/photos/thumbs/Gemini_Generated_Image_sfh1oosfh1oosfh1 - Edited.webp","view":"assets/photos/web/Gemini_Generated_Image_sfh1oosfh1oosfh1 - Edited.webp"},
  {"src":"assets/photos/image.png","w":703,"h":856,"title":"","place":"","series":"","alt":"","exif":"","thumb":"assets/photos/thumbs/image.webp","view":"assets/photos/web/image.webp"},
  {"src":"assets/photos/IMG_6748 - Edited.jpg","w":1683,"h":2992,"title":"","place":"","series":"","alt":"","exif":"","thumb":"assets/photos/thumbs/IMG_6748 - Edited.webp","view":"assets/photos/web/IMG_6748 - Edited.webp"},
  {"src":"assets/photos/IMG_20240114_212217 (2).jpg","w":1072,"h":1192,"title":"","place":"","series":"","alt":"","exif":"","thumb":"assets/photos/thumbs/IMG_20240114_212217 (2).webp","view":"assets/photos/web/IMG_20240114_212217 (2).webp"},
  {"src":"assets/photos/IMG_20240115_073721 (1).jpg","w":1056,"h":1192,"title":"","place":"","series":"","alt":"","exif":"","thumb":"assets/photos/thumbs/IMG_20240115_073721 (1).webp","view":"assets/photos/web/IMG_20240115_073721 (1).webp"},
  {"src":"assets/photos/IMG_20240115_073742.jpg","w":1064,"h":1192,"title":"","place":"","series":"","alt":"","exif":"","thumb":"assets/photos/thumbs/IMG_20240115_073742.webp","view":"assets/photos/web/IMG_20240115_073742.webp"},
  {"src":"assets/photos/IMG_20240115_073801.jpg","w":1068,"h":1200,"title":"","place":"","series":"","alt":"","exif":"","thumb":"assets/photos/thumbs/IMG_20240115_073801.webp","view":"assets/photos/web/IMG_20240115_073801.webp"},
  {"src":"assets/photos/Untitled design (6).png","w":2630,"h":4674,"title":"","place":"","series":"","alt":"","exif":"","thumb":"assets/photos/thumbs/Untitled design (6).webp","view":"assets/photos/web/Untitled design (6).webp"},
  {"src":"assets/photos/WhatsApp Image 2025-12-21 at 1.10.30 PM 1 - Edited.jpg","w":1076,"h":588,"title":"","place":"","series":"","alt":"","exif":"","thumb":"assets/photos/thumbs/WhatsApp Image 2025-12-21 at 1.10.30 PM 1 - Edited.webp","view":"assets/photos/web/WhatsApp Image 2025-12-21 at 1.10.30 PM 1 - Edited.webp"},
  {"src":"assets/photos/Zk1kQ2E (1).jpg","w":1280,"h":1280,"title":"","place":"","series":"","alt":"","exif":"","thumb":"assets/photos/thumbs/Zk1kQ2E (1).webp","view":"assets/photos/web/Zk1kQ2E (1).webp"},
];
