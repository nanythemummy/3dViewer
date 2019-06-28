/* global THREE */

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

// ModelController manages a model and its viewer.
function ModelController(modelname) {
  this.loadingScreen = new LoadingScreen();
  this.viewer = new ModelViewer();
  this.loadModel(modelname);
}

// ModelController.loadModel loads a GLTF model file with the given URL, and
// updates the global model viewer and loading screen accordingly.
ModelController.prototype.loadModel = function loadModel(modelname) {
  const loader = new THREE.GLTFLoader();
  this.loadingScreen.show();
  loader.load(modelname,
    (object) => {
      this.loadingScreen.hide();
      this.viewer.setModel(object.scene);
    },
    (xhr) => {
      const loaded = Math.round(xhr.loaded / xhr.total * 100);
      this.loadingScreen.setProgress(loaded);
    },
    (error) => {
      console.error('Error loading model: ', error);
      this.loadingScreen.setError();
    });
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
