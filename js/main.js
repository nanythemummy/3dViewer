/* global THREE */
let gScene;
let gCamera;
let gRenderer;
let gControls;
let gDirLight;
const gSceneObjects = [];

// get model width, height
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

function LoadingScreen() {
  function setProgress(percent) {
    const loadingscreen = document.getElementById('loading');
    loadingscreen.innerHTML = `<p> Loading.... ${percent}% </p>`;
  }
  function show() {
    const loadingscreen = document.getElementById('loading');
    setProgress(0);
    loadingscreen.className = 'inprogress';
  }
  function hide() {
    const loadingscreen = document.getElementById('loading');
    loadingscreen.className = 'done';
  }
  return { setProgress, show, hide };
}

const gLoadingScreen = LoadingScreen();

function setup() {
  // basic setup of scene, renderer, etc.
  gScene = new THREE.Scene();
  gCamera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  // so I can see stuff at 0,0 since the camera also initializes at 0,0
  gCamera.position.set(0, 0, 3);

  gRenderer = new THREE.WebGLRenderer();
  gRenderer.setSize(window.innerWidth, window.innerHeight);
  // required for gltfloader as per the example page https://threejs.org/docs/#examples/loaders/GLTFLoader
  gRenderer.gammaOutput = true;
  //  gRenderer.gammaFactor=2.2;

  // adding the orbit controls, which allow the camera to rotate around the centre of the scene.
  gControls = new THREE.OrbitControls(gCamera, gRenderer.domElement);
  gControls.screenSpacePanning = true;

  // adding a directional light which will always shine on the object because it follows the camera.
  gDirLight = new THREE.DirectionalLight(0xffffff, 2);
  gScene.add(gDirLight);
  gDirLight.position.set(gCamera.position.x, gCamera.position.y, gCamera.position.z);

  document.getElementById('viewer').appendChild(gRenderer.domElement);
}

function update() {
  gControls.update();
  gDirLight.position.set(gCamera.position.x, gCamera.position.y, gCamera.position.z);
}

function render() {
  gRenderer.render(gScene, gCamera);
}

function gameLoop() {
  requestAnimationFrame(gameLoop);
  update();
  render();
}

function loadModel(modelname) {
  const loader = new THREE.GLTFLoader();
  gLoadingScreen.show();
  loader.load(modelname,
    // on loaded callback
    (object) => {
      gLoadingScreen.hide();
      object.scene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          gSceneObjects.push(child);
        }
      });
      gScene.add(object.scene);
    },
    // progress percent callback.
    (xhr) => {
      const loaded = Math.round(xhr.loaded / xhr.total * 100);
      gLoadingScreen.setProgress(loaded);
    },
    // callback for loading errors
    (error) => {
      console.log(`An Error Happened: ${error}`);
    });
}

// instantiation
setup();

loadModel('models/iwefaa-centre.gltf');

function resizeListener() {
  const newwidth = getModelWidth();
  const newheight = getModelHeight();
  gCamera.aspect = newwidth / newheight;
  gCamera.updateProjectionMatrix();
  gRenderer.setSize(newwidth, newheight);
}

window.addEventListener('resize', resizeListener, false);
resizeListener(null);

gameLoop();
