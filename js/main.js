/* global THREE */

// Get model width, height
// --borrowed from Mark-jan's viewer at https://mjn.host.cs.st-andrews.ac.uk/egyptian/coffins/viewer3d.js
function getModelWidth() {
  const style = window.getComputedStyle(document.getElementById('viewer'), null);
  const width = style.getPropertyValue('width').replace('px', '');
  return width;
}

function getModelHeight() {
  const style = window.getComputedStyle(document.getElementById('viewer'), null);
  const height = style.getPropertyValue('height').replace('px', '');
  return height;
}

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
  this.loadingScreen = new LoadingScreen();

  this.scene = new THREE.Scene();
  this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  // The initial coordinates of the camera are at (0,0,0),
  // but that's where we want the model centered. Move the
  // camera in front of the origin so that we can easily
  // see the model.
  this.camera.position.set(0, 0, 3);

  this.renderer = new THREE.WebGLRenderer();
  this.renderer.setSize(window.innerWidth, window.innerHeight);

  // required for gltfloader as per the example page:
  // https://threejs.org/docs/#examples/loaders/GLTFLoader
  this.renderer.gammaOutput = true;
  //  this.renderer.gammaFactor = 2.2;

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

// ModelViewer.update handles any state change induced by our controls.
ModelViewer.prototype.update = function update() {
  this.controls.update();
  this.dirLight.position.copy(this.camera.position);
};

// ModelViewer.render draws the scene onto our WebGL display element.
ModelViewer.prototype.render = function render() {
  this.renderer.render(this.scene, this.camera);
};

// ModelViewer.setModel adds the given model, expected as a scene object, to
// the viewer's scene graph. The given scene is added as a child of the
// viewer's scene.
ModelViewer.prototype.setModel = function setModel(modelScene) {
  modelScene.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      this.sceneObjects.push(child);
    }
  });
  this.scene.add(modelScene);
};

// ModelViewer.loadModel loads a GLTF model file with the given URL, and
// updates the global model viewer and loading screen accordingly.
ModelViewer.prototype.loadModel = function loadModel(modelname) {
  const loader = new THREE.GLTFLoader();
  this.loadingScreen.show();
  loader.load(modelname,
    (object) => {
      this.loadingScreen.hide();
      this.setModel(object.scene);
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

// ModelViewer.resize handles a resize of the browser window. The WebGL display
// is resized to fill the entire window.
ModelViewer.prototype.resize = function resize() {
  const newwidth = getModelWidth();
  const newheight = getModelHeight();
  this.camera.aspect = newwidth / newheight;
  this.camera.updateProjectionMatrix();
  this.renderer.setSize(newwidth, newheight);
};

const gViewer = new ModelViewer();
gViewer.loadModel('models/iwefaa-centre.gltf');

function gameLoop() {
  requestAnimationFrame(gameLoop);
  gViewer.update();
  gViewer.render();
}
gameLoop();
