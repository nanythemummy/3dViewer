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
  // Compute the bounding box of the scene.
  // Unfortunately, arbitrary Object3D objects don't
  // know their bounding box, but anything with geometry
  // (i.e. a Mesh) can compute one.
  const bbox = new THREE.Box3();
  scene.traverse((child) => {
    if (child.geometry) {
      child.geometry.computeBoundingBox();
      bbox.union(child.geometry.boundingBox);
    }
  });

  // Figure out where the center of the bounding box is,
  // and translate everything in the reverse direction,
  // so that the origin will become the center.
  const center = new THREE.Vector3();
  bbox.getCenter(center);
  const axis = center.clone().negate().normalize();
  const distance = center.length();

  // NOTE: It so happens that our model has a single node
  // and mesh, which are transformed to a single Scene
  // and Group in the three.js scene graph. In theory,
  // then, it should suffice to translate the group, or
  // maybe even the scene. I choose instead to translate
  // the individual objects I measured above, so as to
  // minimize my assumptions of the structure of the
  // scene graph.
  scene.traverse((child) => {
    if (child.geometry) {
      child.translateOnAxis(axis, distance);
    }
  });
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
// click, if any.
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
  if (intersects.length < 1) {
    return null;
  }
  return intersects[0].object;
};

// fixupModelLink munges an incoming model link to make sure that a valid
// reference to a GLTF object becomes a valid reference to the corresponding
// Three.js object. In particular, it attempts to do the same munging of GLTF
// object names that GLTFLoader does. See:
// https://github.com/mrdoob/three.js/blob/master/src/animation/PropertyBinding.js#L105-L122
function fixupModelLink(link) {
  return {
    name: THREE.PropertyBinding.sanitizeNodeName(link.name),
    ref: link.ref,
  };
}

// ModelLinkSelector manages regions on the model that link to other resources,
// and handles their selection and deselection. viewer handles model display
// and interaction, and modelLinks is an array of link definitions associated
// with our model.
function ModelLinkSelector(modelLinks) {
  this.modelLinks = modelLinks.map(fixupModelLink);
  this.selection = null; // the currently-selected object
  this.selectedDiv = null; // the currently-selected annotation
}

// ModelLinkSelector.clearSelection clears the currently-selected object,
// removing its highlight in the scene.
ModelLinkSelector.prototype.clearSelection = function clearSelection() {
  if (this.selection) {
    this.selection.material.opacity = 0.0;
    this.selection = null;
  }
  if (this.selectedDiv) {
    this.selectedDiv.classList.remove('selected');
    this.selectedDiv = null;
  }
};

// ModelLinkSelector.select checks to see if the given object has a link
// associated with it. If it does, we highlight it (by adjusting its
// transparency) and select it.
ModelLinkSelector.prototype.select = function select(link) {
  this.clearSelection();
  this.selection = link.obj;
  this.selection.material.opacity = 0.5;
  this.selectedDiv = document.getElementById(link.ref);
  if (this.selectedDiv) {
    this.selectedDiv.classList.add('selected');
    this.selectedDiv.scrollIntoView();
  }
};

// ModelLinkSelector.initLinks makes transparent and hides all of the regions
// in the model that have links associated with them, so that their initial
// state is deselected.
ModelLinkSelector.prototype.initLinks = function initLinks(modelScene) {
  const foundLinks = {};
  modelScene.traverse((child) => {
    for (let i = 0; i < this.modelLinks.length; i += 1) {
      if (this.modelLinks[i].name === child.name) {
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
  });
  for (let i = 0; i < this.modelLinks.length; i += 1) {
    if (!Object.prototype.hasOwnProperty.call(foundLinks, this.modelLinks[i].name)) {
      console.warn('Broken link: ', this.modelLinks[i]);
    }
  }
};

ModelLinkSelector.prototype.findLinkByModelObj = function findLinkByModelObj(obj) {
  if (!obj) {
    return null;
  }
  for (let i = 0; i < this.modelLinks.length; i += 1) {
    if (this.modelLinks[i].obj.name === obj.name) {
      return this.modelLinks[i];
    }
  }
  return null;
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
  this.loadModel(modelName).then((modelScene) => {
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
ModelController.prototype.moveCamera = function moveCamera(selection){
  var boundingbox = new THREE.Box3();
  boundingbox.setFromObject(selection);
  //gets the center of the bounding box and puts it in the controls target
  boundingbox.getCenter(this.viewer.controls.target);
  this.viewer.camera.lookAt(this.viewer.controls.target)
  //I don'tthink this object persists in the scene because I don't ever attach it.
}
ModelController.prototype.onViewerClick = function onViewerClick(e) {
  const obj = this.viewer.intersectObject(e);
  // FIXME: we only want to clear the selection if we're not
  // repositioning the camera (i.e. dragging), which means
  // this ought to be moved to mouseUp and combined with some
  // more sophisticated mouse logic to detect dragging.
  const link = this.selector.findLinkByModelObj(obj);
  if (link) {
    this.selector.select(link);
    this.moveCamera(obj)
  } else {
    this.selector.clearSelection();
  }
};

ModelController.prototype.onTextLinkClick = function onTextLinkClick(e) {
  e.preventDefault();
  const textId = e.target.getAttribute('data-text-id');
  const link = this.selector.findLinkByRef(textId);
  if (!link) {
    console.error('Error: no model link corresponding to text ID: ', textId);
    return;
  }
  this.moveCamera(link.obj)
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
