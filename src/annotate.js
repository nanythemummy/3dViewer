/* global THREE, SurfaceRegion, newellNormal, pointInPolygon, surfaceNormalAt, REGION_MIN_FACING */

// Annotator is the viewer's "annotate mode", for drawing new surface regions
// by clicking around an inscription on the model, and for deleting regions.
// It turns on when the page's URL ends with ?annotate (e.g.
// amenirdis.html?annotate), and shows a panel over the model:
//
//   1. Choose which text the region is for.
//   2. Option+click (Alt+click) around the outline of the inscription. A
//      preview outline appears once there are three points.
//   3. Click Finish. The annotator works out which way the region faces and
//      how deep it must be by probing the model's surface, and warns if it
//      overlaps another text's region.
//
// The panel also lists the page's regions, each of which can be shown or
// deleted. After every change, it shows the page's complete set of <link>
// elements, to paste over the ones in the page's <model> element. Changes
// work in the viewer right away, until the page is reloaded, so you can
// check them before pasting.

// How many points to probe the surface at, across and along a new region,
// when measuring how deep it must be.
const ANNOTATE_DEPTH_SAMPLES = 16;
// Extra depth beyond the deepest point found, as a fraction of it.
const ANNOTATE_DEPTH_MARGIN = 0.25;
// Indentation of <link> elements in a page's XML file.
const ANNOTATE_LINK_INDENT = '    ';

function Annotator(controller) {
  this.controller = controller;
  this.selector = controller.selector;
  this.model = controller.model;
  this.modelSize = new THREE.Box3().setFromObject(this.model).getSize(new THREE.Vector3()).length();
  this.points = []; // clicked points, in model coordinates
  this.normals = []; // the direction the surface faces at each point
  this.confirmingDelete = null; // the region whose Delete button was clicked once

  // Markers for the clicked points, drawn on top of the model.
  this.markers = new THREE.Group();
  this.model.add(this.markers);
  this.markerGeometry = new THREE.SphereBufferGeometry(this.modelSize * 0.003, 12, 8);
  this.markerMaterial = new THREE.MeshBasicMaterial({ color: 0x00e5ff, depthTest: false });
  this.lineMaterial = new THREE.LineBasicMaterial({ color: 0x00e5ff, depthTest: false });

  this.buildPanel();
  this.update();
  this.updateRegionList();
}

// Annotator.isRequested returns whether the page was opened in annotate mode.
Annotator.isRequested = function isRequested() {
  return new URLSearchParams(window.location.search).has('annotate');
};

// Annotator.buildPanel adds the annotate mode panel to the page.
Annotator.prototype.buildPanel = function buildPanel() {
  this.panel = document.createElement('div');
  this.panel.id = 'annotator';
  this.panel.innerHTML = `
    <h3 class="title" title="Click to fold the panel away">Annotate ▾</h3>
    <div class="body">
    <label>Region for <select class="ref"></select></label>
    <p class="hint">Option+click around the outline of the inscription, then click Finish.</p>
    <p class="status"></p>
    <div class="buttons">
      <button class="undo">Undo point</button>
      <button class="clear">Start over</button>
      <button class="finish">Finish</button>
    </div>
    <p class="warning" hidden></p>
    <p class="section">Regions on this page</p>
    <ul class="regions"></ul>
    <div class="result" hidden>
      <p class="result-hint">Paste these over the <code>&lt;link&gt;</code> elements in the
        page's <code>&lt;model&gt;</code> element:</p>
      <textarea readonly rows="10"></textarea>
      <button class="copy">Copy</button>
    </div>
    </div>`;
  document.getElementById('left').appendChild(this.panel);

  const $ = (selector) => this.panel.querySelector(selector);
  // Clicking the title folds the panel away, in case it covers the part of
  // the model you want to click.
  const title = $('.title');
  const body = $('.body');
  title.addEventListener('click', () => {
    body.hidden = !body.hidden;
    title.textContent = `Annotate ${body.hidden ? '▸' : '▾'}`;
  });

  this.refSelect = $('.ref');
  this.status = $('.status');
  this.warning = $('.warning');
  this.regionList = $('.regions');
  this.result = $('.result');
  this.output = $('textarea');
  this.undoButton = $('.undo');
  this.clearButton = $('.clear');
  this.finishButton = $('.finish');

  // Offer every text on the page that has a link to the model, labeled with
  // its number on the page.
  this.textLabels = {};
  const textLinks = document.getElementsByClassName('model-link');
  for (let i = 0; i < textLinks.length; i += 1) {
    const ref = textLinks[i].getAttribute('data-text-id');
    this.textLabels[ref] = `${textLinks[i].textContent.trim()} ${ref}`;
    const option = document.createElement('option');
    option.value = ref;
    option.textContent = this.textLabels[ref];
    this.refSelect.appendChild(option);
  }

  this.undoButton.addEventListener('click', () => {
    this.points.pop();
    this.normals.pop();
    this.update();
  });
  this.clearButton.addEventListener('click', () => { this.clear(); });
  this.finishButton.addEventListener('click', () => { this.finish(); });
  $('.copy').addEventListener('click', () => { this.copy(); });
};

// Annotator.updateRegionList lists the page's links and regions in the panel,
// each with buttons to show and delete it.
Annotator.prototype.updateRegionList = function updateRegionList() {
  this.regionList.innerHTML = '';
  const addRow = (link, region, text) => {
    const row = document.createElement('li');
    const label = document.createElement('span');
    label.textContent = `${this.textLabels[link.ref] || link.ref}, ${text}`;
    const show = document.createElement('button');
    show.textContent = 'Show';
    const del = document.createElement('button');
    del.textContent = this.confirmingDelete === (region || link) ? 'Really delete?' : 'Delete';
    row.append(label, ' ', show, ' ', del);
    this.regionList.appendChild(row);

    // Resting the mouse on a row outlines its region, to tell them apart.
    if (region) {
      row.addEventListener('mouseenter', () => { this.selector.highlighter.setLayer('hover', [region]); });
      row.addEventListener('mouseleave', () => { this.selector.highlighter.setLayer('hover', []); });
    }
    show.addEventListener('click', () => { this.showRegion(link, region); });
    del.addEventListener('click', () => {
      if (this.confirmingDelete === (region || link)) {
        this.deleteRegion(link, region);
      } else {
        this.confirmingDelete = region || link;
        this.updateRegionList();
      }
    });
  };

  this.selector.modelLinks.forEach((link) => {
    if (link.name && link.regions.length === 0) {
      addRow(link, null, 'hitbox');
    }
    link.regions.forEach((region, i) => { addRow(link, region, `region ${i + 1}`); });
  });
  if (!this.regionList.firstChild) {
    this.regionList.innerHTML = '<li>None yet.</li>';
  }

  // Mark which texts already have a link in the dropdown.
  [...this.refSelect.options].forEach((option) => {
    const linked = this.selector.findLinkByRef(option.value) !== null;
    option.textContent = `${this.textLabels[option.value]}${linked ? ' (has a link)' : ''}`;
  });
};

// Annotator.showRegion selects the given region (or hitbox link, if region is
// null) and turns the camera to it.
Annotator.prototype.showRegion = function showRegion(link, region) {
  this.selector.select(link);
  if (region) {
    this.selector.highlighter.setLayer('selected', [region]);
    this.controller.moveCameraToRegion(region);
  } else if (link.obj) {
    this.controller.moveCameraToObject(link.obj);
  }
};

// Annotator.deleteRegion removes the given region from its link (or the whole
// link, for a hitbox link, when region is null). A link left with nothing to
// click on is removed too.
Annotator.prototype.deleteRegion = function deleteRegion(link, region) {
  this.confirmingDelete = null;
  if (this.selector.selection === link) {
    this.selector.clearSelection();
  }
  this.selector.hover(null);
  this.selector.highlighter.setLayer('hover', []);
  if (region) {
    link.regions.splice(link.regions.indexOf(region), 1);
  }
  if (!region || (link.regions.length === 0 && !link.obj)) {
    if (link.obj) {
      link.obj.material.opacity = 0.0;
    }
    this.selector.modelLinks.splice(this.selector.modelLinks.indexOf(link), 1);
  }
  this.warning.hidden = true;
  this.status.textContent = 'Deleted.';
  this.updateRegionList();
  this.showLinksXml();
};

// Annotator.addPoint adds a point to the outline at the place where a click
// hit the model, as returned by ModelViewer.intersectObject.
Annotator.prototype.addPoint = function addPoint(hit) {
  if (!hit.point) {
    return;
  }
  this.points.push(this.model.worldToLocal(hit.point.clone()));
  this.normals.push(surfaceNormalAt(hit, this.model));
  this.update();
};

// Annotator.clear removes all the points, to start over.
Annotator.prototype.clear = function clear() {
  this.points = [];
  this.normals = [];
  this.update();
};

// Annotator.fittedNormal returns the direction the outline faces: the normal
// of the plane that best fits the points, turned to face the same way as the
// surface under them.
Annotator.prototype.fittedNormal = function fittedNormal() {
  const surfaceNormal = new THREE.Vector3();
  this.normals.forEach((n) => { surfaceNormal.add(n); });
  const normal = newellNormal(this.points);
  if (normal.lengthSq() === 0) {
    // The points are in a line, so they don't define a plane.
    return surfaceNormal.normalize();
  }
  normal.normalize();
  return normal.dot(surfaceNormal) < 0 ? normal.negate() : normal;
};

// Annotator.draftRegion returns a region from the current points, or null if
// there aren't enough of them yet.
Annotator.prototype.draftRegion = function draftRegion() {
  if (this.points.length < 3) {
    return null;
  }
  return new SurfaceRegion({
    normal: this.fittedNormal().toArray(),
    points: this.points.map((p) => p.toArray()),
  });
};

// Annotator.update redraws the point markers and preview outline, and
// updates the panel to match.
Annotator.prototype.update = function update() {
  while (this.markers.children.length > 0) {
    const child = this.markers.children[0];
    this.markers.remove(child);
    if (child.geometry !== this.markerGeometry) {
      child.geometry.dispose();
    }
  }
  const noRaycast = () => {};
  this.points.forEach((p) => {
    const marker = new THREE.Mesh(this.markerGeometry, this.markerMaterial);
    marker.position.copy(p);
    marker.renderOrder = 10;
    marker.raycast = noRaycast;
    this.markers.add(marker);
  });
  if (this.points.length > 1) {
    const line = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(this.points), this.lineMaterial,
    );
    line.renderOrder = 10;
    line.raycast = noRaycast;
    this.markers.add(line);
  }

  const draft = this.draftRegion();
  this.selector.highlighter.setLayer('draft', draft ? [draft] : []);

  const count = this.points.length;
  this.status.textContent = count === 0 ? 'No points yet.'
    : `${count} point${count === 1 ? '' : 's'}${count < 3 ? ` (at least 3 needed)` : ''}.`;
  this.undoButton.disabled = count === 0;
  this.clearButton.disabled = count === 0;
  this.finishButton.disabled = count < 3;
};

// Annotator.probeSurface finds the model's surface across the given region,
// by casting rays through a grid of points inside its outline, along its
// normal. It returns the surface points found (in model coordinates) and the
// direction the surface faces at each.
Annotator.prototype.probeSurface = function probeSurface(region) {
  const samples = [];
  const size = region.bounds.getSize(new THREE.Vector2());
  // Look far enough either side of the plane to find the surface, however
  // much it curves.
  const reach = Math.max(size.x, size.y);
  const raycaster = new THREE.Raycaster();
  raycaster.far = 2 * reach;
  const direction = region.normal.clone().negate().transformDirection(this.model.matrixWorld);

  for (let i = 0; i < ANNOTATE_DEPTH_SAMPLES; i += 1) {
    for (let j = 0; j < ANNOTATE_DEPTH_SAMPLES; j += 1) {
      const flat = new THREE.Vector2(
        region.bounds.min.x + ((i + 0.5) / ANNOTATE_DEPTH_SAMPLES) * size.x,
        region.bounds.min.y + ((j + 0.5) / ANNOTATE_DEPTH_SAMPLES) * size.y,
      );
      if (pointInPolygon(flat, region.outline)) {
        const start = region.origin.clone()
          .addScaledVector(region.u, flat.x)
          .addScaledVector(region.v, flat.y)
          .addScaledVector(region.normal, reach);
        raycaster.set(this.model.localToWorld(start), direction);

        // Of the surfaces facing the right way along this ray, the one
        // nearest the plane is the one the region is drawn on.
        let best = null;
        raycaster.intersectObjects(this.selector.surfaceMeshes).forEach((hit) => {
          const normal = surfaceNormalAt(hit, this.model);
          if (normal.lengthSq() > 0 && normal.dot(region.normal) < REGION_MIN_FACING) {
            return;
          }
          const point = this.model.worldToLocal(hit.point.clone());
          const distance = Math.abs(point.clone().sub(region.origin).dot(region.normal));
          if (!best || distance < best.distance) {
            best = { point, normal, distance };
          }
        });
        if (best) {
          samples.push(best);
        }
      }
    }
  }
  return samples;
};

// Annotator.finish turns the current points into a region: it measures the
// region's depth, checks it against the other regions, and adds it to the
// viewer.
Annotator.prototype.finish = function finish() {
  const draft = this.draftRegion();
  if (!draft) {
    return;
  }
  const ref = this.refSelect.value;
  const samples = this.probeSurface(draft);

  // The region must reach the clicked points and every surface point found.
  let deepest = 0;
  this.points.forEach((p) => {
    deepest = Math.max(deepest, Math.abs(p.clone().sub(draft.origin).dot(draft.normal)));
  });
  samples.forEach((s) => { deepest = Math.max(deepest, s.distance); });
  const depth = Math.max(deepest * (1 + ANNOTATE_DEPTH_MARGIN), this.modelSize * 0.002);

  // Make the region from the same rounded numbers that go into the XML, so
  // what you see now is what the page will do.
  const round = (x) => parseFloat(x.toPrecision(6));
  const region = new SurfaceRegion({
    normal: draft.normal.toArray().map(round),
    depth: round(depth),
    points: this.points.map((p) => p.toArray().map(round)),
  });

  // Look for other texts' regions that claim any of the same surface.
  const overlaps = new Set();
  samples.forEach((s) => {
    this.selector.modelLinks.forEach((link) => {
      if (link.ref !== ref && link.regions.some((r) => r.distanceTo(s.point, s.normal) !== null)) {
        overlaps.add(link.ref);
      }
    });
  });
  this.warning.hidden = overlaps.size === 0;
  this.warning.textContent = `This region overlaps the region for ${[...overlaps].join(', ')}. `
    + 'Clicks where they overlap may select either text.';

  let link = this.selector.findLinkByRef(ref);
  if (!link) {
    link = { name: null, xmlName: null, ref, regions: [] };
    this.selector.modelLinks.push(link);
  }
  link.regions.push(region);

  this.clear();
  this.status.textContent = 'Region added. Click the text\'s number to see it.';
  this.updateRegionList();
  this.showLinksXml();
};

// Annotator.showLinksXml shows the XML for all of the page's links, as they
// are now.
Annotator.prototype.showLinksXml = function showLinksXml() {
  const lines = [];
  this.selector.modelLinks.forEach((link) => {
    if (link.regions.length === 0) {
      if (link.xmlName) {
        lines.push(`<link name="${link.xmlName}" ref="${link.ref}"/>`);
      }
      return;
    }
    // A link has either a hitbox or regions, so drawing a region for a text
    // with a hitbox replaces the hitbox.
    lines.push(`<link ref="${link.ref}">`);
    link.regions.forEach((region) => {
      const { def } = region;
      let attributes = '';
      if (def.normal) {
        attributes += ` normal="${def.normal.join(' ')}"`;
      }
      if (def.depth !== undefined) {
        attributes += ` depth="${def.depth}"`;
      }
      lines.push(`  <region${attributes}>`);
      def.points.forEach((p) => { lines.push(`    <pt>${p.join(' ')}</pt>`); });
      lines.push('  </region>');
    });
    lines.push('</link>');
  });
  if (lines.length === 0) {
    lines.push('<!-- No links left: remove all the <link> elements from <model>. -->');
  }
  this.output.value = lines.map((line) => ANNOTATE_LINK_INDENT + line).join('\n');
  this.result.hidden = false;
};

// Annotator.copy copies the XML to the clipboard.
Annotator.prototype.copy = function copy() {
  const copied = () => { this.status.textContent = 'Copied.'; };
  const failed = () => {
    this.output.select();
    this.status.textContent = 'Press Cmd+C (Ctrl+C) to copy the selected XML.';
  };
  if (navigator.clipboard) {
    navigator.clipboard.writeText(this.output.value).then(copied, failed);
  } else {
    failed();
  }
};
