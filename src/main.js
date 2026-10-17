/* global THREE */
/* eslint no-param-reassign: "off" */

// LoadingScreen controls the "loading" element on the page, and shows the
// progress in loading a model file.
function LoadingScreen() {
  this.domElement = document.getElementById('loading');
}

LoadingScreen.prototype.setProgress = function setProgress(percent) {
  this.domElement.innerHTML = `<p> Loading.... ${percent}% </p>`;
};

LoadingScreen.prototype.show = function show() {
  this.setProgress(0);
  this.domElement.className = 'inprogress';
};

LoadingScreen.prototype.hide = function hide() {
  this.domElement.className = 'done';
};

LoadingScreen.prototype.setError = function setError() {
  this.domElement.innerHTML = '<p>Error loading model!</p>';
  this.domElement.className = 'error';
};

// ModelViewer controls the "scene" element on the page, and provides a WebGL
// view of that model. It constructs a bare-bones scene with just the model, a
// camera, and a directional light. It supports basic mouse/touch/keyboard
// orbit/zoom/pan controls.
function ModelViewer() {
  this.domElement = document.getElementById('viewer');
  const width = this.getWidth();
  const height = this.getHeight();

  this.scene = new THREE.Scene();
  this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  // The initial coordinates of the camera are at (0,0,0),
  // but that's where we want the model centered. Move the
  // camera in front of the origin so that we can easily
  // see the model.
  this.camera.position.set(0, 0, 3);

  this.renderer = new THREE.WebGLRenderer();
  this.renderer.setSize(width, height);

  // required for gltfloader as per the example page:
  // https://threejs.org/docs/#examples/loaders/GLTFLoader
  this.renderer.gammaOutput = true;
  this.renderer.gammaFactor = 2.2;

  this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
  this.controls.screenSpacePanning = true;

  // A directional light follows the camera and is always
  // pointed at the origin, so we can always see the
  // model.
  this.dirLight = new THREE.DirectionalLight(0xffffff, 2);
  this.scene.add(this.dirLight);
  this.dirLight.position.copy(this.camera.position);

  this.sceneObjects = [];

  this.domElement.appendChild(this.renderer.domElement);
  window.addEventListener('resize', () => { this.resize(); }, false);
  this.resize();
}

// ModelViewer.getWidth returns the current width of the viewer in pixels.
ModelViewer.prototype.getWidth = function getWidth() {
  // This returns fractional pixels due to layout calculations, where
  // clientWidth does not. Not sure if we need the extra precision, but it
  // preserves existing behavior.
  return this.domElement.getBoundingClientRect().width;
};

// ModelViewer.getWidth returns the current height of the viewer in pixels.
ModelViewer.prototype.getHeight = function getHeight() {
  // See getWidth about fractional pixels.
  return this.domElement.getBoundingClientRect().height;
};

// ModelViewer.update handles any state change induced by our controls.
ModelViewer.prototype.update = function update() {
  this.controls.update();
  this.dirLight.position.copy(this.camera.position);
};

// ModelViewer.render draws the scene onto our WebGL display element.
ModelViewer.prototype.render = function render() {
  this.renderer.render(this.scene, this.camera);
};

// centerModel ensures that the given scene, which is assumed to represent a
// single model, is centered around the origin.
function centerModel(scene) {
  // Compute the bounding box of everything in the scene, taking each
  // object's own position into account.
  const bbox = new THREE.Box3().setFromObject(scene);

  // Figure out where the center of the bounding box is, and move the whole
  // scene in the reverse direction, so that the origin will become the center.
  //
  // NOTE: We move the scene as a whole, rather than the individual objects
  // in it, so that coordinates within the scene stay the same as in the GLTF
  // file. Surface regions (see SurfaceRegion) are specified in those
  // coordinates.
  const center = new THREE.Vector3();
  bbox.getCenter(center);
  scene.position.sub(center);
  scene.updateMatrixWorld(true);
}

// ModelViewer.setModel adds the given model, expected as a scene object, to
// the viewer's scene graph. The given scene is added as a child of the
// viewer's scene.
ModelViewer.prototype.setModel = function setModel(modelScene) {
  centerModel(modelScene);
  modelScene.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      this.sceneObjects.push(child);
    }
  });
  this.scene.add(modelScene);
};

// ModelViewer.resize handles a resize of the browser window. The WebGL display
// is resized to fill the entire window.
ModelViewer.prototype.resize = function resize() {
  const newwidth = this.getWidth();
  const newheight = this.getHeight();
  this.camera.aspect = newwidth / newheight;
  this.camera.updateProjectionMatrix();
  this.renderer.setSize(newwidth, newheight);
};

// ModelViewer.intersectObject returns the object identified by a mouse
// click, if any, along with the face and the point (in world coordinates)
// where the click hit it.
ModelViewer.prototype.intersectObject = function intersectObject(mouseDownEvent) {
  // Convert mouse event coordinates to coordinates from the top-
  // left corner of our canvas.
  //
  // The event's clientX and clientY give us coords relative to the
  // inner top-left corner of our window, which isn't what we want.
  // Our element's bounding client rect tells us what the top-left
  // corner of our element is relative to that.
  const domRect = this.domElement.getBoundingClientRect();
  const clientX = mouseDownEvent.clientX - domRect.left;
  const clientY = mouseDownEvent.clientY - domRect.top;
  const clientW = domRect.width; // slightly more precise than this.domElement.clientWidth
  const clientH = domRect.height;

  // Convert the canvas coordinates ((0,0) is top left of canvas,
  // (w,h) is bottom right) to normalized device coordinates
  // ((-1,1) is top left, (0,0) is center, (1,-1) is bottom right).
  const mouse = new THREE.Vector2(
    (clientX / clientW) * 2 - 1,
    (-clientY / clientH) * 2 + 1,
  );

  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, this.camera);
  const intersects = raycaster.intersectObject(this.scene, true);
  var firstintersect = {
    "object":null,
    "face":null,
    "point":null
  }
  if (intersects.length > 0) {
    firstintersect["object"] = intersects[0].object;
    firstintersect["face"]= intersects[0].face;
    firstintersect["point"] = intersects[0].point;
  }
  return firstintersect
};

// fixupModelLink munges an incoming model link to make sure that a valid
// reference to a GLTF object becomes a valid reference to the corresponding
// Three.js object. In particular, it attempts to do the same munging of GLTF
// object names that GLTFLoader does. See:
// https://github.com/mrdoob/three.js/blob/master/src/animation/PropertyBinding.js#L105-L122
function fixupModelLink(link) {
  return {
    name: link.name ? THREE.PropertyBinding.sanitizeNodeName(link.name) : null,
    ref: link.ref,
    regions: (link.regions || []).map((def) => new SurfaceRegion(def)),
  };
}

// A surface point only counts as part of a region if the surface there faces
// within 60 degrees of the region's normal. This keeps a region from reaching
// through to the far side of the coffin wall, or around a sharp edge.
const REGION_MIN_FACING = Math.cos(Math.PI / 3);

// newellNormal returns the normal of the plane that best fits the given
// polygon outline (an array of Vector3), using Newell's method.
function newellNormal(points) {
  const normal = new THREE.Vector3();
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    normal.x += (a.y - b.y) * (a.z + b.z);
    normal.y += (a.z - b.z) * (a.x + b.x);
    normal.z += (a.x - b.x) * (a.y + b.y);
  }
  return normal;
}

// pointInPolygon returns whether the 2D point p lies inside the polygon given
// by the array of Vector2 outline.
function pointInPolygon(p, outline) {
  let inside = false;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i, i += 1) {
    const a = outline[i];
    const b = outline[j];
    if ((a.y > p.y) !== (b.y > p.y)
        && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

// SurfaceRegion is an area on the surface of the model, as described by a
// region element in the page XML. It is an outline flattened onto a plane:
// any point on the model's surface that is within depth of the plane, inside
// the outline, and facing roughly the same way as the plane belongs to the
// region. All coordinates are in the model's own coordinate system.
function SurfaceRegion(def) {
  const points = def.points.map((p) => new THREE.Vector3().fromArray(p));
  if (points.length < 3) {
    console.warn('Region outline needs at least three points: ', def);
  }

  this.points = points;
  // A normal computed from the outline points faces one way or the other
  // depending on whether they are listed clockwise or counterclockwise, so it
  // may need to be reversed once we can look at the model (see orientRegion).
  this.normalIsComputed = !def.normal;
  this.normal = def.normal ? new THREE.Vector3().fromArray(def.normal) : newellNormal(points);
  this.normal.normalize();

  this.origin = new THREE.Vector3();
  points.forEach((p) => { this.origin.add(p); });
  this.origin.divideScalar(points.length);

  // Pick two axes within the plane, u and v. u runs from the first point of
  // the outline towards the second.
  this.u = points[1].clone().sub(points[0]);
  this.u.addScaledVector(this.normal, -this.u.dot(this.normal)).normalize();
  this.v = new THREE.Vector3().crossVectors(this.normal, this.u);

  this.outline = points.map((p) => this.flatten(p));
  this.bounds = new THREE.Box2().setFromPoints(this.outline);
  // The outline points lie on the surface, so the depth must at least reach
  // the one farthest from the plane, with some margin for the surface between
  // them.
  const size = this.bounds.getSize(new THREE.Vector2());
  const farthest = Math.max(...points.map((p) => Math.abs(p.clone().sub(this.origin).dot(this.normal))));
  this.depth = def.depth !== undefined ? def.depth : Math.max(Math.min(size.x, size.y) / 2, farthest * 1.25);
}

// SurfaceRegion.reverse turns the region to face the opposite way.
SurfaceRegion.prototype.reverse = function reverse() {
  this.normal.negate();
  this.v.negate();
  this.outline.forEach((p) => { p.y = -p.y; });
  this.bounds.setFromPoints(this.outline);
};

// orientRegion makes sure a region with a computed normal faces the same way
// as the model's surface under it. It checks the surface at each outline
// point, all of which lie on the surface, by casting short rays through them
// in both directions along the normal. meshes are the model's surface meshes.
function orientRegion(region, meshes, model) {
  const reach = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3()).length() * 0.01;
  const normal = region.normal.clone().transformDirection(model.matrixWorld);
  const raycaster = new THREE.Raycaster();
  raycaster.far = 2 * reach;
  let facing = 0;
  region.points.forEach((p) => {
    const point = model.localToWorld(p.clone());
    [normal, normal.clone().negate()].forEach((direction) => {
      raycaster.set(point.clone().addScaledVector(direction, -reach), direction);
      raycaster.intersectObjects(meshes).forEach((hit) => {
        if (hit.face) {
          facing += hit.face.normal.clone().transformDirection(hit.object.matrixWorld).dot(normal);
        }
      });
    });
  });
  if (facing < 0) {
    region.reverse();
  }
}

// SurfaceRegion.flatten returns the 2D position of the given point after it is
// flattened onto the region's plane.
SurfaceRegion.prototype.flatten = function flatten(point) {
  const d = point.clone().sub(this.origin);
  return new THREE.Vector2(d.dot(this.u), d.dot(this.v));
};

// SurfaceRegion.distanceTo checks whether the given surface point, whose
// surface faces in the direction normal, belongs to this region. If it does,
// it returns the point's distance from the region's plane; otherwise null.
// If normal is a zero vector, the direction the surface faces is not checked.
SurfaceRegion.prototype.distanceTo = function distanceTo(point, normal) {
  const distance = Math.abs(point.clone().sub(this.origin).dot(this.normal));
  if (distance > this.depth) {
    return null;
  }
  if (normal.lengthSq() > 0 && normal.dot(this.normal) < REGION_MIN_FACING) {
    return null;
  }
  const flat = this.flatten(point);
  if (!this.bounds.containsPoint(flat) || !pointInPolygon(flat, this.outline)) {
    return null;
  }
  return distance;
};

// surfaceNormalAt returns the direction the surface faces at the point where
// a click hit the model, in the coordinates of the given model. Where the
// model has vertex normals, they are blended so the result is smooth across
// the bumpy triangles of a photogrammetry mesh.
function surfaceNormalAt(hit, model) {
  const normal = new THREE.Vector3();
  if (!hit.face) {
    return normal;
  }
  const { geometry } = hit.object;
  const normals = geometry.attributes && geometry.attributes.normal;
  if (normals) {
    const positions = geometry.attributes.position;
    const a = new THREE.Vector3().fromBufferAttribute(positions, hit.face.a);
    const b = new THREE.Vector3().fromBufferAttribute(positions, hit.face.b);
    const c = new THREE.Vector3().fromBufferAttribute(positions, hit.face.c);
    const local = hit.object.worldToLocal(hit.point.clone());
    const weights = THREE.Triangle.getBarycoord(local, a, b, c, new THREE.Vector3());
    normal.addScaledVector(new THREE.Vector3().fromBufferAttribute(normals, hit.face.a), weights.x);
    normal.addScaledVector(new THREE.Vector3().fromBufferAttribute(normals, hit.face.b), weights.y);
    normal.addScaledVector(new THREE.Vector3().fromBufferAttribute(normals, hit.face.c), weights.z);
  } else {
    normal.copy(hit.face.normal);
  }
  normal.transformDirection(hit.object.matrixWorld);
  return normal.transformDirection(new THREE.Matrix4().getInverse(model.matrixWorld));
}

// The most regions a single link can highlight at once, and the size of the
// image each region's outline is drawn into for highlighting.
const MAX_HIGHLIGHT_REGIONS = 4;
const REGION_MASK_SIZE = 512;
const REGION_MASK_PAD = 2;
const REGION_HIGHLIGHT_COLOR = 0xffff00;
const REGION_HIGHLIGHT_STRENGTH = 0.9;
// The width of a highlighted region's outline, as a fraction of the size of
// the model (the diagonal of its bounding box).
const REGION_OUTLINE_WIDTH = 0.003;

const REGION_VERTEX_DECLS = `
uniform mat4 uWorldToRegion;
varying vec3 vRegionPos;
varying vec3 vRegionNormal;
`;

const REGION_VERTEX_MAIN = `
#include <begin_vertex>
vRegionPos = (uWorldToRegion * modelMatrix * vec4(transformed, 1.0)).xyz;
vRegionNormal = (uWorldToRegion * modelMatrix * vec4(normal, 0.0)).xyz;
`;

const REGION_FRAGMENT_DECLS = `
#define MAX_HIGHLIGHT_REGIONS ${MAX_HIGHLIGHT_REGIONS}
#define REGION_MASK_SIZE ${REGION_MASK_SIZE.toFixed(1)}
#define REGION_MASK_PAD ${REGION_MASK_PAD.toFixed(1)}
#define REGION_MIN_FACING ${REGION_MIN_FACING.toFixed(6)}
#define REGION_HIGHLIGHT_STRENGTH ${REGION_HIGHLIGHT_STRENGTH.toFixed(6)}
uniform int uRegionCount;
uniform sampler2D uRegionMask;
uniform vec4 uRegionU[MAX_HIGHLIGHT_REGIONS];
uniform vec4 uRegionV[MAX_HIGHLIGHT_REGIONS];
uniform vec4 uRegionN[MAX_HIGHLIGHT_REGIONS];
uniform float uRegionDepth[MAX_HIGHLIGHT_REGIONS];
uniform vec3 uRegionColor;
varying vec3 vRegionPos;
varying vec3 vRegionNormal;

// regionMask returns how strongly this fragment is on the outline of one of
// the highlighted regions, from 0.0 (off it) to 1.0 (on it). It mirrors the
// depth and facing tests of SurfaceRegion.distanceTo, and looks the outline
// up in the mask image.
float regionMask() {
  float mask = 0.0;
  vec4 p = vec4(vRegionPos, 1.0);
  vec3 n = vRegionNormal;
  bool checkFacing = dot(n, n) > 0.0;
  if (checkFacing) {
    n = normalize(n);
  }
  for (int i = 0; i < MAX_HIGHLIGHT_REGIONS; i++) {
    if (i >= uRegionCount) {
      break;
    }
    if (abs(dot(p, uRegionN[i])) > uRegionDepth[i]) {
      continue;
    }
    if (checkFacing && dot(n, uRegionN[i].xyz) < REGION_MIN_FACING) {
      continue;
    }
    vec2 st = vec2(dot(p, uRegionU[i]), dot(p, uRegionV[i]));
    if (any(lessThan(st, vec2(0.0))) || any(greaterThan(st, vec2(1.0)))) {
      continue;
    }
    vec2 tile = (REGION_MASK_PAD + st * (REGION_MASK_SIZE - 2.0 * REGION_MASK_PAD)) / REGION_MASK_SIZE;
    tile.x = (tile.x + float(i)) / float(MAX_HIGHLIGHT_REGIONS);
    mask = max(mask, texture2D(uRegionMask, tile).r);
  }
  return mask;
}
`;

const REGION_FRAGMENT_MAIN = `
#include <map_fragment>
diffuseColor.rgb = mix(diffuseColor.rgb, uRegionColor, REGION_HIGHLIGHT_STRENGTH * regionMask());
`;

// RegionHighlighter highlights surface regions by drawing their outlines on
// the model's own surface. Each highlighted region's outline is drawn into its
// own tile of a mask image, which the model's material shader uses to decide
// which pixels to tint.
function RegionHighlighter() {
  this.lineWidth = null; // outline width in model units, set from the model's size
  this.canvas = document.createElement('canvas');
  this.canvas.width = REGION_MASK_SIZE * MAX_HIGHLIGHT_REGIONS;
  this.canvas.height = REGION_MASK_SIZE;
  this.texture = new THREE.CanvasTexture(this.canvas);
  this.texture.flipY = false;
  this.texture.generateMipmaps = false;
  this.texture.minFilter = THREE.LinearFilter;

  const vectors = () => Array.from({ length: MAX_HIGHLIGHT_REGIONS }, () => new THREE.Vector4());
  this.uniforms = {
    uWorldToRegion: { value: new THREE.Matrix4() },
    uRegionCount: { value: 0 },
    uRegionMask: { value: this.texture },
    uRegionU: { value: vectors() },
    uRegionV: { value: vectors() },
    uRegionN: { value: vectors() },
    uRegionDepth: { value: new Array(MAX_HIGHLIGHT_REGIONS).fill(0) },
    uRegionColor: { value: new THREE.Color(REGION_HIGHLIGHT_COLOR) },
  };
}

// RegionHighlighter.attach adds region highlighting to the given material.
RegionHighlighter.prototype.attach = function attach(material) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, this.uniforms);
    shader.vertexShader = REGION_VERTEX_DECLS
      + shader.vertexShader.replace('#include <begin_vertex>', REGION_VERTEX_MAIN);
    shader.fragmentShader = REGION_FRAGMENT_DECLS
      + shader.fragmentShader.replace('#include <map_fragment>', REGION_FRAGMENT_MAIN);
  };
  material.needsUpdate = true;
};

// RegionHighlighter.show highlights the given regions, which belong to the
// given model.
RegionHighlighter.prototype.show = function show(regions, model) {
  if (regions.length > MAX_HIGHLIGHT_REGIONS) {
    console.warn(`Only the first ${MAX_HIGHLIGHT_REGIONS} regions of a link can be highlighted.`);
  }
  const count = Math.min(regions.length, MAX_HIGHLIGHT_REGIONS);
  if (this.lineWidth === null) {
    const modelSize = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3()).length();
    this.lineWidth = modelSize * REGION_OUTLINE_WIDTH;
  }
  const ctx = this.canvas.getContext('2d');
  ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  ctx.strokeStyle = '#fff';
  ctx.lineJoin = 'round';
  const inner = REGION_MASK_SIZE - 2 * REGION_MASK_PAD;

  for (let i = 0; i < count; i += 1) {
    const region = regions[i];
    // Leave room around the outline for the line's thickness.
    const box = region.bounds.clone().expandByScalar(this.lineWidth);
    const { min } = box;
    const size = box.getSize(new THREE.Vector2());
    const width = Math.max(size.x, 1e-9);
    const height = Math.max(size.y, 1e-9);

    // Draw the outline into this region's tile, scaled to fill it. The tile
    // is stretched differently across and along the region, so we draw in the
    // region's own units, which keeps the line the same width on the model.
    ctx.save();
    ctx.translate(i * REGION_MASK_SIZE + REGION_MASK_PAD, REGION_MASK_PAD);
    ctx.scale(inner / width, inner / height);
    ctx.translate(-min.x, -min.y);
    ctx.beginPath();
    region.outline.forEach((p) => { ctx.lineTo(p.x, p.y); });
    ctx.closePath();
    ctx.lineWidth = this.lineWidth;
    ctx.stroke();
    ctx.restore();

    // The shader computes dot(vec4(point, 1.0), U) to get the point's
    // position across the outline's bounds, from 0.0 to 1.0, and likewise
    // for V. dot(vec4(point, 1.0), N) gives its distance from the plane.
    const origin = region.origin;
    this.uniforms.uRegionU.value[i].set(
      region.u.x / width, region.u.y / width, region.u.z / width,
      -(origin.dot(region.u) + min.x) / width,
    );
    this.uniforms.uRegionV.value[i].set(
      region.v.x / height, region.v.y / height, region.v.z / height,
      -(origin.dot(region.v) + min.y) / height,
    );
    this.uniforms.uRegionN.value[i].set(
      region.normal.x, region.normal.y, region.normal.z,
      -origin.dot(region.normal),
    );
    this.uniforms.uRegionDepth.value[i] = region.depth;
  }

  this.texture.needsUpdate = true;
  this.uniforms.uWorldToRegion.value.getInverse(model.matrixWorld);
  this.uniforms.uRegionCount.value = count;
};

// RegionHighlighter.clear removes any highlight.
RegionHighlighter.prototype.clear = function clear() {
  this.uniforms.uRegionCount.value = 0;
};

// ModelLinkSelector manages regions on the model that link to other resources,
// and handles their selection and deselection. viewer handles model display
// and interaction, and modelLinks is an array of link definitions associated
// with our model.
function ModelLinkSelector(modelLinks) {
  this.modelLinks = modelLinks.map(fixupModelLink);
  this.highlighter = new RegionHighlighter();
  this.model = null; // the model the links belong to
  this.selection = null; // the currently-selected link
  this.selectedDiv = null; // the currently-selected annotation
}

// ModelLinkSelector.clearSelection clears the currently-selected link,
// removing its highlight in the scene.
ModelLinkSelector.prototype.clearSelection = function clearSelection() {
  if (this.selection) {
    if (this.selection.obj) {
      this.selection.obj.material.opacity = 0.0;
    }
    this.highlighter.clear();
    this.selection = null;
  }
  if (this.selectedDiv) {
    this.selectedDiv.classList.remove('selected');
    this.selectedDiv = null;
  }
};

// ModelLinkSelector.select highlights the given link and selects it. Hitboxes
// are highlighted by adjusting their transparency, and surface regions by
// tinting the model's surface.
ModelLinkSelector.prototype.select = function select(link) {
  this.clearSelection();
  this.selection = link;
  if (link.obj) {
    link.obj.material.opacity = 0.20;
  }
  if (link.regions.length > 0) {
    this.highlighter.show(link.regions, this.model);
  }
  this.selectedDiv = document.getElementById(link.ref);
  if (this.selectedDiv) {
    this.selectedDiv.classList.add('selected');
    this.selectedDiv.scrollIntoView();
  }
};

// ModelLinkSelector.initLinks makes transparent and hides all of the hitboxes
// in the model that have links associated with them, so that their initial
// state is deselected. Hitboxes without links are hidden entirely, so they
// don't get in the way of clicks on surface regions. Everything else in the
// model gets ready to highlight surface regions.
ModelLinkSelector.prototype.initLinks = function initLinks(modelScene) {
  this.model = modelScene;
  const foundLinks = {};
  const surfaceMeshes = [];
  modelScene.traverse((child) => {
    let isLinked = false;
    for (let i = 0; i < this.modelLinks.length; i += 1) {
      if (this.modelLinks[i].name === child.name) {
        isLinked = true;
        foundLinks[child.name] = this.modelLinks[i];
        // Remember this model object so we can quickly select it
        // if someone clicks on a link in the text section.
        this.modelLinks[i].obj = child;
        // Clone the material to ensure each hitbox has its own
        // independently-controllable opacity. Otherwise, multiple
        // hitboxes may get highlighted when one gets selected.
        child.material = child.material.clone();
        child.material.transparent = true;
        child.material.opacity = 0.0;
      }
    }
    if (isLinked || !(child instanceof THREE.Mesh)) {
      return;
    }
    if (/hitbox/i.test(child.name)) {
      child.visible = false;
      child.raycast = () => {};
      return;
    }
    surfaceMeshes.push(child);
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => { this.highlighter.attach(material); });
  });
  this.modelLinks.forEach((link) => {
    link.regions.forEach((region) => {
      if (region.normalIsComputed) {
        orientRegion(region, surfaceMeshes, modelScene);
      }
    });
  });
  for (let i = 0; i < this.modelLinks.length; i += 1) {
    const link = this.modelLinks[i];
    if (link.name && !Object.prototype.hasOwnProperty.call(foundLinks, link.name)) {
      console.warn('Broken link: ', link);
    }
  }
};

ModelLinkSelector.prototype.findLinkByModelObj = function findLinkByModelObj(obj) {
  if (!obj) {
    return null;
  }
  for (let i = 0; i < this.modelLinks.length; i += 1) {
    if (this.modelLinks[i].obj && this.modelLinks[i].obj.name === obj.name) {
      return this.modelLinks[i];
    }
  }
  return null;
};

// ModelLinkSelector.findLinkByHit returns the link at the place where a click
// hit the model, as returned by ModelViewer.intersectObject, or null if there
// is none. The result has the link, and the surface region that was hit (or
// null if the link is a hitbox).
ModelLinkSelector.prototype.findLinkByHit = function findLinkByHit(hit) {
  if (!hit.object) {
    return null;
  }
  const hitboxLink = this.findLinkByModelObj(hit.object);
  if (hitboxLink) {
    return { link: hitboxLink, region: null };
  }

  // If the click lands in more than one region, the one whose plane is
  // closest to the clicked point wins.
  const point = this.model.worldToLocal(hit.point.clone());
  const normal = surfaceNormalAt(hit, this.model);
  let best = null;
  let bestDistance = Infinity;
  this.modelLinks.forEach((link) => {
    link.regions.forEach((region) => {
      const distance = region.distanceTo(point, normal);
      if (distance !== null && distance < bestDistance) {
        best = { link, region };
        bestDistance = distance;
      }
    });
  });
  return best;
};

ModelLinkSelector.prototype.findLinkByRef = function findLinkByRef(textId) {
  for (let i = 0; i < this.modelLinks.length; i += 1) {
    if (this.modelLinks[i].ref === textId) {
      return this.modelLinks[i];
    }
  }
  return null;
};

// ModelController manages a model and its viewer.
function ModelController(modelName, modelLinks) {

  this.loadingScreen = new LoadingScreen();
  this.viewer = new ModelViewer();
  this.selector = new ModelLinkSelector(modelLinks);
  this.viewer.domElement.addEventListener('click', (e) => { this.onViewerClick(e); }, false);
  this.model = null;
  this.loadModel(modelName).then((modelScene) => {
    this.model = modelScene;
    this.selector.initLinks(modelScene);
  }).catch((error) => {
    console.error('Error loading model: ', error);
  });
  const textToModelLinks = document.getElementsByClassName('model-link');
  for (let i = 0; i < textToModelLinks.length; i += 1) {
    textToModelLinks[i].addEventListener('click', (e) => { this.onTextLinkClick(e); }, false);
  }
}

// ModelController.loadModel loads a GLTF model file with the given URL, and
// updates the global model viewer and loading screen accordingly. The loaded
// scene is added as a child to the viewer's scene graph. loadModel returns
// a Promise that resolves to the loaded scene, or if the loading results in
// an error, it rejects the promise with an error.
ModelController.prototype.loadModel = function loadModel(modelname) {
  const loader = new THREE.GLTFLoader();
  this.loadingScreen.show();
  return new Promise((resolve, reject) => {
    loader.load(modelname,
      (object) => {
        this.loadingScreen.hide();
        this.viewer.setModel(object.scene);
        resolve(object.scene);
      },
      (xhr) => {
        const loaded = Math.round(xhr.loaded / xhr.total * 100);
        this.loadingScreen.setProgress(loaded);
      },
      (error) => {
        this.loadingScreen.setError();
        reject(error);
      });
  });
};
ModelController.prototype.moveCameraToFace = function moveCamera(selectedface,selection){
  var cameralookatpoint =  new THREE.Vector3();
  var boundingbox =  new THREE.Box3();
  boundingbox.setFromObject(selection);
  boundingbox.getCenter(cameralookatpoint);
  var cam_altitude = this.viewer.camera.position.distanceTo(this.viewer.controls.target)
  var newnormal = (selectedface.normal.clone().multiplyScalar(cam_altitude))
  var cameramovepoint = this.viewer.controls.target.clone().add(newnormal)
  this.viewer.camera.position.copy(cameramovepoint)
  this.viewer.camera.lookAt(cameralookatpoint)
  this.viewer.controls.update()
}
ModelController.prototype.moveCameraToObject = function moveCamera(selection){
  var boundingbox = new THREE.Box3();
  boundingbox.setFromObject(selection);
  var projection_vector = new THREE.Vector3();
  var camera_pos = new THREE.Vector3();
  camera_pos.copy(this.viewer.camera.position);
  //get the vector between the centerpoint of the clicked object 
  //and the center of the camera's orbit.
  //and normalize it.
  boundingbox.getCenter(projection_vector);

  //get the radius of the sphere made by the center of the 
  //main model and the camera position.
  //makes the assumption that the selection box's parent is the main coffin model.
  var center_object = new THREE.Vector3();
  if (selection.parent) {
    boundingbox.setFromObject(selection.parent);
    boundingbox.getCenter(center_object);
  }
  else{
    center_object.copy(this.viewer.controls.target);
  }
  projection_vector.sub(center_object);
  projection_vector.normalize();
  var radius_sphere = camera_pos.distanceTo(center_object);
  //multiply the radius by the normalized vector to set the new camera position.
  projection_vector.multiplyScalar(radius_sphere);
  this.viewer.camera.position.copy(projection_vector);
  this.viewer.controls.update();

}

// ModelController.moveCameraToRegion orbits the camera so that it looks
// straight at the given surface region, keeping its distance from the center
// of orbit.
ModelController.prototype.moveCameraToRegion = function moveCameraToRegion(region) {
  const normal = region.normal.clone().transformDirection(this.model.matrixWorld);
  const distance = this.viewer.camera.position.distanceTo(this.viewer.controls.target);
  this.viewer.camera.position.copy(this.viewer.controls.target).addScaledVector(normal, distance);
  this.viewer.controls.update();
};

// ModelController.logSurfacePoint prints the point where a click hit the
// model, in the model's own coordinates, in the form used by region outlines
// in the page XML. This helps with writing regions by hand.
ModelController.prototype.logSurfacePoint = function logSurfacePoint(hit) {
  if (!hit.point) {
    return;
  }
  const point = this.model.worldToLocal(hit.point.clone());
  const coords = point.toArray().map((x) => parseFloat(x.toPrecision(6)));
  console.log(`<pt>${coords.join(' ')}</pt>`);
};

ModelController.prototype.onViewerClick = function onViewerClick(e) {

  // FIXME: we only want to clear the selection if we're not
  // repositioning the camera (i.e. dragging), which means
  // this ought to be moved to mouseUp and combined with some
  // more sophisticated mouse logic to detect dragging.
  if(e.altKey){
    const intersectedObject = this.viewer.intersectObject(e);
    if (e.shiftKey) {
      this.logSurfacePoint(intersectedObject);
      return;
    }
    this.selector.clearSelection();
    const found = this.selector.findLinkByHit(intersectedObject);
    if (found) {
      this.selector.select(found.link);
      if (found.region) {
        this.moveCameraToRegion(found.region);
      } else {
        this.moveCameraToFace(intersectedObject["face"], intersectedObject["object"]);
      }
    }
  }
};

ModelController.prototype.onTextLinkClick = function onTextLinkClick(e) {
  e.preventDefault();
  if (!this.model) {
    return; // still loading
  }
  const textId = e.target.getAttribute('data-text-id');
  const link = this.selector.findLinkByRef(textId);
  if (!link) {
    console.error('Error: no model link corresponding to text ID: ', textId);
    return;
  }
  if (link.obj) {
    this.moveCameraToObject(link.obj)
  } else if (link.regions.length > 0) {
    this.moveCameraToRegion(link.regions[0]);
  }
  this.selector.select(link);
};

// ModelController.run starts the update/render loop for the model
// and viewer.
ModelController.prototype.run = function run() {
  const self = this;
  (function gameLoop() {
    requestAnimationFrame(gameLoop);
    self.viewer.update();
    self.viewer.render();
  }());
};
