# Plan: Replacing Hitboxes with Surface Regions

This document describes how we plan to replace the Blender hitboxes with annotation regions
defined in the XML, and how we'll build toward an editor that edits the XML and builds the site.

## The problem

Right now, each clickable text needs an invisible cube placed over it in Blender (see
[Building_a_model.md](../Building_a_model.md)). This has several drawbacks:

* Annotators have to know Blender.
* The highlight is a glowing box floating around the text, not the painted surface itself.
* Hitboxes stand slightly proud of the surface, so at grazing angles a click can catch the side
  of a neighboring hitbox instead of the text you aimed at.

## The idea

Clickable areas don't have to be geometry. When a click's ray hits the coffin mesh, three.js
already tells us *where* it hit (the 3D point, the face, and the texture coordinate). We can
decide which text was clicked by checking that point against **regions** stored in the page XML.

A region is a 2D outline drawn on the surface of the coffin, given enough depth to enclose the
surface underneath it:

* **Outline:** a polygon of any shape (rectangle, L-shape, tapering band, curved lunette), or a
  circle/ellipse for round features.
* **Plane and normal:** the plane the outline lies in, and the direction the surface faces.
* **Depth:** how far the region extends in front of and behind the plane, so that curved surfaces
  fall inside it.

Proposed XML (exact format to be settled in Stage 1):

```xml
<link ref="text7">
  <region normal="0 0 1" depth="0.03">
    <pt>0.12 0.84 -0.03</pt>
    <pt>0.19 0.86 -0.03</pt>
    <pt>0.21 0.71 -0.02</pt>
    <pt>0.15 0.63 -0.02</pt>
    <pt>0.10 0.70 -0.03</pt>
  </region>
</link>
```

A `link` may contain several regions with the same `ref`, for texts that wrap around a corner or
across a strongly curved area.

### How clicking works

1. Raycast against the coffin mesh itself (there are no extra meshes).
2. Convert the hit point into the model's own coordinates (`worldToLocal`), so rotating the model
   doesn't matter.
3. For each region, check:
   * the point is within the region's depth of its plane;
   * the point, flattened onto the plane, is inside the outline (standard point-in-polygon test);
   * the surface faces roughly the same way as the region (smoothed normal within ~60° of the
     region's normal).
4. If more than one region matches (it shouldn't, if they don't overlap), pick the one whose plane
   is closest to the hit point.

### How highlighting works

The coffin's material gets a small shader addition that tints every pixel inside the selected
region (using the same depth, outline and normal tests). The highlight lands on the painted surface
itself. For very detailed outlines, the region can instead be drawn into a small mask image and
projected onto the surface.

### Curvature

A flat outline with no depth would only cross a curved surface along a line, so regions always
have depth. The authoring tool measures it automatically: it raycasts a grid of points across the
outlined area and sets the depth to cover the furthest point from the plane, plus a margin. The
normal check stops a generously deep region from highlighting the far side of the coffin wall.

One region handles curves up to roughly 60–90°. Beyond that, use several regions per text.

### Limits

* Regions follow the outline of a panel or band, not the strokes of individual hieroglyphs.
* Deeply sculpted areas (face, wig) may be awkward; see "Future: ID maps" below.
* At steep grazing angles, one screen pixel covers a lot of surface, so clicks get imprecise. This
  is true of any method. A hover highlight (showing what you're about to select) helps.

## Stages

Each stage should be usable on its own before we start the next one.

### Stage 1: Regions in the viewer

Goal: prove the approach on one real coffin.

* [ ] Add region elements to the schema (`tools/schema/model.rng`).
* [ ] Pass regions through to the page in `tools/xslt/page2html.xsl`.
* [ ] In `src/main.js`, add the click test (above) alongside or instead of hitbox lookup.
* [ ] Add the highlight shader to the coffin material.
* [ ] Write region XML by hand for one coffin (`amenirdis` for a quick test, or the coffin with the
  most curved/irregular inscriptions for a harder one).
* [ ] Fix the existing bug in `intersectObject` (`src/main.js`): `intersects.length > 1` should
  be `> 0`, otherwise a click that hits exactly one object is ignored.

Done when: that coffin works without hitboxes, including at odd angles and near edges.

### Stage 2: Annotate mode

Goal: author regions without Blender.

* [ ] Add an "annotate" mode to the viewer.
* [ ] Click points around an inscription; the tool fits a plane, flattens the outline and measures
  the depth.
* [ ] Show the resulting `<region>` XML for the annotator to copy into the page file.
* [ ] Warn when a new region overlaps an existing one.
* [ ] Add a hover highlight.

Done when: someone who doesn't use Blender can annotate a coffin by clicking and pasting.

### Stage 3: Local editor that saves

Goal: edit pages without hand-editing XML.

* [ ] A small Python web server (like `build.py`), run on the annotator's machine.
* [ ] Open a page's XML; show the model alongside forms for each text (`descr`, `al`, `tr`, `hi`).
* [ ] Save regions and text edits straight back into the XML file.
* [ ] A **Build** button that runs `build.py` and shows the result, with validation errors shown
  in readable form.

The published site stays fully static; the editor is only a local authoring tool.

### Stage 4: The rest

* [ ] Create new pages and add them to `site.xml`.
* [ ] Import models and JSesh SVGs into the assets directory.
* [ ] Preview the Manuel de Codage transliteration as Unicode.
* [ ] Optional: brush-painted regions (stored as a stroke path plus radius), if drawing outlines
  proves too slow.

## Ground rules

1. **The XML stays the single source of truth.** The editor reads and writes the same files people
   edit by hand today. Anyone can still fix things with a text editor.
2. **Saving must not mangle the files.** Python's built-in XML library drops comments and reflows
   formatting, which makes every save a messy git diff. Use `lxml`, or make targeted edits.

## Future: ID maps (optional)

If we ever need highlights that follow the exact shape of the inscriptions, the alternative is an
**ID map**: a second image laid out like the model's texture, with each text region filled in a
flat unique color. A click reads the color under the hit point's texture coordinate.

This needs a clean texture layout, which photogrammetry exports don't have. The pipeline would be:

1. **Simplify the mesh** (Instant Meshes, Blender's Remesh/QuadriFlow, or Decimate). Keep the
   original high-detail mesh.
2. **Unwrap by hand** in Blender, with seams along the natural edges of the coffin, so each face is
   one large piece with the text upright.
3. **Put the color back**: either re-texture from the original photos in Agisoft Metashape
   (*Build Texture*, mapping mode "Keep UV"), or bake color and a normal map from the high-detail
   mesh in Blender (Cycles → Bake → "Selected to Active").
4. **Paint the ID map** in a 2D editor over the texture, or in Blender's Texture Paint mode.

Cautions: save ID maps as PNG, never JPEG (compression shifts the colors); turn off texture
smoothing for the ID map; and re-check the ID map whenever the model is re-exported.

A middle path: keep authoring regions as above, and later write a script that bakes them into an
ID map automatically.
