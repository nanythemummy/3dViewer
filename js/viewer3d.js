//////////////////////////////////////////////////////////////////
// Elements of page.

function leftElem() {
	return document.getElementById('left');
}
function rightElem() {
	return document.getElementById('right');
}

function modelElem() {
	return document.getElementById('model');
}
function modelStyle() {
	return window.getComputedStyle(modelElem(), null);
}
function modelWidth() {
	return modelStyle().getPropertyValue('width').replace('px', '');
}
function modelHeight() {
	return modelStyle().getPropertyValue('height').replace('px', '');
}
function modelRatio() {
	return 1.0 * modelWidth() / modelHeight();
}

function overlayElem() {
	return document.getElementById('overlay');
}

function infoElem() {
	return document.getElementById('control_info_button');
}
function consoleElem() {
	return document.getElementById('console');
}

//////////////////////////////////////////////////////////////////
// Main.

////
// Camera.

var camera;
var raycaster;

function initCamera() {
	var near = 0.001;
	var far = 2000;
	camera = new THREE.PerspectiveCamera(cameraVerticalField, modelRatio(), near, far);
	camera.position.set(cameraX, cameraY, cameraZ);
	raycaster = new THREE.Raycaster();
}
function resizeCamera() {
	camera.aspect = modelRatio();
	camera.updateProjectionMatrix();
}
function zoomIn(e) {
	e.preventDefault();
	camera.zoom *= 1.2;
	camera.updateProjectionMatrix();
}
function zoomOut(e) {
	e.preventDefault();
	camera.zoom /= 1.2;
	camera.updateProjectionMatrix();
}

function to2D(p) {
	p = new THREE.Vector3().copy(p);
	p.project(camera);
	return { x: Math.round((p.x + 1) / 2 * modelWidth()),
				y: Math.round(-(p.y - 1) / 2 * modelHeight()) };
}

////
// Scene.

var scene;

function initScene() {
	var ambColor = 0xffffff;
	var ambStrength = 1.0;
	var ambient = new THREE.AmbientLight(ambColor, ambStrength);
	scene = new THREE.Scene();
	scene.add(ambient);
}

////
// Rendering.

var renderer;
var controls;

function initRenderer() {
	renderer = Detector.webgl ?
		new THREE.WebGLRenderer(window.devicePixelRatio) :
		new THREE.CanvasRenderer();
	modelElem().appendChild(renderer.domElement);
	controls = new THREE.OrbitControls(camera, renderer.domElement);
	controls.keyPanSpeed = 2.0;
	controls.enableZoom = true;
	controls.maxPolarAngle = cameraMaxAngle * 2 * Math.PI;
	resizeRenderer();
}
function resizeRenderer() {
	renderer.setSize(modelWidth(), modelHeight());
	overlayElem().width = modelWidth();
	overlayElem().height = modelHeight();
}
function resetControls() {
	controls.reset();
}
function render() {
	renderer.render(scene, camera);
}

//// 
// Animation.

var oldWidth;
var oldHeight;
var oldZoom;
var oldCameraPos;
var overlayUsed;

function initConfig() {
	resetConfig(false);
}
function resetConfig(b) {
	oldWidth = Number.MAX_VALUE;
	oldHeight = Number.MAX_VALUE;
	oldZoom = Number.MAX_VALUE;
	oldCameraPos = new THREE.Vector3(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
	overlayUsed = b;
}
function saveConfig() {
	oldWidth = modelWidth();
	oldHeight = modelHeight();
	oldZoom = camera.zoom;
	oldCameraPos.copy(camera.position);
}
function configChanged() {
	return oldWidth != modelWidth() || oldHeight != modelHeight() ||
		oldZoom != camera.zoom || !oldCameraPos.equals(camera.position);
}

function animate() {
	requestAnimationFrame(animate);
	render();
	if (overlayUsed && configChanged()) {
		addDistance();
		saveConfig();
	}
}

////
// Object.

var object;
var objectSizeX;
var objectSizeY;
var objectSizeZ;

function initObject() {
	var mtlLoader = new THREE.MTLLoader();
	mtlLoader.setPath(objectDataPath);
	mtlLoader.load(objectFileName + '.mtl', mtlLoad, mtlProgress, mtlError);
}
function mtlLoad(materials) {
	materials.preload();
	var objLoader = new THREE.OBJLoader();
	objLoader.setMaterials(materials);
	objLoader.load(objectDataPath + objectFileName + '.obj', objLoad, objProgress, objError);
}
function objLoad(obj) {
	consoleElem().className = 'done';
	object = obj;
	scene.add(object);
	adjustPosition();
	var bbox = boundingBox();
	objectSizeX = bbox.xlen;
	objectSizeY = bbox.ylen;
	objectSizeZ = bbox.zlen;
	initTilt();
}
function objProgress(xhr) {
	consoleElem().innerHTML = '<p>Object ' + Math.round(xhr.loaded / xhr.total * 100) + '% loaded</p>';
}
function objError(xhr) {
	consoleElem().innerHTML = '<p>Object load error</p>';
}
function mtlProgress(xhr) {
	consoleElem().innerHTML = '<p>Material ' + Math.round(xhr.loaded / xhr.total * 100) + '% loaded</p>';
}
function mtlError(xhr) {
	consoleElem().innerHTML = '<p>Material load error</p>';
}

function adjustPosition() {
	object.position.set(0, 0, 0);
	object.rotation.set(0, 0, 0);
	object.updateMatrix();
	object.applyMatrix(objectMatrix());
}

function objectMatrix() {
	var mT = new THREE.Matrix4().makeTranslation(objectMovX, objectMovY, objectMovZ);
	var mX = new THREE.Matrix4().makeRotationX(objectRotX * 2 * Math.PI);
	var mY = new THREE.Matrix4().makeRotationY(objectRotY * 2 * Math.PI);
	var mZ = new THREE.Matrix4().makeRotationZ(objectRotZ * 2 * Math.PI);
	var m = mT.multiply(mX.multiply(mY.multiply(mZ)));
	var tilting = new THREE.Matrix4().makeRotationX(tilt * 2 * Math.PI);
	return tilting.multiply(m);
}

function boundingBox() {
	if (!object)
		return null;
	var bbox = new THREE.Box3().setFromObject(object);
	var min = bbox.min;
	var max = bbox.max;
	var xlen = bbox.max.x - bbox.min.x;
	var ylen = bbox.max.y - bbox.min.y;
	var zlen = bbox.max.z - bbox.min.z;
	var xpos = -(bbox.min.x + xlen / 2);
	var ypos = -(bbox.min.y + ylen / 2);
	var zpos = -(bbox.min.z + zlen / 2);
	return { xlen: xlen, ylen: ylen, zlen: zlen,
				xpos: xpos, ypos: ypos, zpos: zpos };
}

////
// Tilt.

var floor;
var tilt = 0;
var tiltIncr = 0.25 / 3;
var tiltEpsilon = tiltIncr / 2;

function initTilt() {
	var color = 0xddccbb;
	var nSegments = 10;
	var geometry = new THREE.PlaneBufferGeometry(objectSizeX, objectSizeZ, nSegments, nSegments);
	var material = new THREE.MeshBasicMaterial( {color: color, side: THREE.BackSide} );
	floor = new THREE.Mesh(geometry, material);
	floor.rotation.x = 0.5 * Math.PI;
	scene.add(floor);
	placeFloor();
}

function tiltObject(e, isDown) {
	e.preventDefault();
	if (!object || 
			isDown && tilt - tiltIncr < objectMinTilt - tiltEpsilon ||
			!isDown && tilt + tiltIncr > objectMaxTilt + tiltEpsilon)
		return;
	tilt += (isDown ? -1 : 1) * tiltIncr;
	removeDistance();
	adjustPosition();
	placeFloor();
}
function resetTilt() {
	if (!object)
		return;
	tilt = 0;
	removeDistance();
	adjustPosition();
	placeFloor();
}

function placeFloor() {
	if (Math.abs(tilt) < tiltEpsilon) {
		tilt = 0;
		floor.visible = false;
	} else {
		var bbox = boundingBox();
		if (!bbox)
			return;
		var descent = - bbox.ypos + - 0.5 * bbox.ylen;
		floor.position.y = descent - 0.1 * Math.min(objectSizeX, Math.min(objectSizeY, objectSizeZ));
		floor.visible = true;
	}
}

////
// Ruler.

var fromPoint;
var toPoint;

function measureDistance(e) {
	e.preventDefault();
	if (!object)
		return;
	raycaster.setFromCamera(mouse, camera);
	var intersects = raycaster.intersectObjects([object], true);
	if (intersects.length == 0) {
		removeDistance();
		return;
	}
	var hit = intersects[0];
	if (!fromPoint) {
		fromPoint = new THREE.Vector3();
		fromPoint.copy(hit.point);
		resetConfig(true);
	} else if (!toPoint) {
		toPoint = new THREE.Vector3();
		toPoint.copy(hit.point);
		resetConfig(true);
	} else {
		removeDistance();
	}
}

function addDistance() {
	var context = overlayElem().getContext('2d');
	context.clearRect(0, 0, modelWidth(), modelHeight());
	context.strokeStyle = 'blue';
	context.fillStyle = 'blue';
	context.font = '16px Arial';
	var p1 = to2D(fromPoint);
	if (!toPoint) {
		makeCircle(context, p1);
	} else {
		var distCm = 100 * fromPoint.distanceTo(toPoint);
		var distFt = distCm * 0.032808;
		var text = distCm.toFixed(2) + 'cm/' + distFt.toFixed(2) + 'ft';
		var p2 = to2D(toPoint);
		makeLine(context, p1, p2, text);
	}
}
function removeDistance() {
	if (overlayUsed) {
		var context = overlayElem().getContext('2d');
		context.clearRect(0, 0, modelWidth(), modelHeight());
	}
	fromPoint = null;
	toPoint = null;
	resetConfig(false);
}

function makeCircle(context, p) {
	context.beginPath();
	context.arc(p.x, p.y, 10, 0, Math.PI*2); 
	context.stroke();
}

function makeLine(context, p1, p2, text) {
	var endLen = 10;
	var dx = p2.y - p1.y;
	var dy = p1.x - p2.x;
	if (Math.abs(dx) < 1) {
		var endXLen = 0;
		var endYLen = endLen;
	} else {
		var endSlope = 1.0 * dy / dx;
		// Pythagoras: endXLen^2 + endYLen^2 = endLen^2, with endYlen / endXlen = endSlope
		// Hence: endXLen^2 + endSlope^2 * endXLen^2 = (1 + endSlope^2) * endXLen^2 = endLen^2
		var endXLen = Math.sqrt(1.0 * endLen * endLen / (1 + endSlope * endSlope)); 
		var endYLen = endXLen * endSlope;
		endXLen = Math.round(endXLen);
		endYLen = Math.round(endYLen);
	}
	if (p1.x == p2.x) {
		var tx = p1.x + 10;
		var ty = Math.round((p1.y + p2.y) * 0.5);
	} else {
		var slope = 1.0 * (p2.y-p1.y) / (p2.x-p1.x);
		if (Math.abs(slope) > 0.5) {
			var tx = Math.round((p1.x + p2.x) * 0.5) + 10;
			if (slope > 0) 
				var ty = Math.round((p1.y + p2.y) * 0.5);
			else
				var ty = Math.round((p1.y + p2.y) * 0.5) + 15;
		} else if (slope > 0) {
			var tx = Math.min(p1.x, p2.x);
			var ty = Math.min(p1.y, p2.y) - 20;
		} else {
			var tx = Math.min(p1.x, p2.x);
			var ty = Math.max(p1.y, p2.y) + 30;
		}
	}
	context.lineWidth = 2;
	context.beginPath();
	context.moveTo(p1.x, p1.y);
	context.lineTo(p2.x, p2.y);
	context.moveTo(p1.x - endXLen, p1.y - endYLen);
	context.lineTo(p1.x + endXLen, p1.y + endYLen);
	context.moveTo(p2.x - endXLen, p2.y - endYLen);
	context.lineTo(p2.x + endXLen, p2.y + endYLen);
	context.stroke();
	context.fillText(text, tx, ty);
}

////
// Information.

var infoButtonTimer;

function startInfoButton() {
	if (infoButtonTimer)
		clearTimeout(infoButtonTimer);
	makeInfoButton(true);
	infoButtonTimer = setTimeout(function(){ makeInfoButton(false); }, 1500);
}

function makeInfoButton(b) {
	if (b)
		infoElem().className = 'shown';
	else
		infoElem().className = 'hidden';
}

function toggleInfo(e) {
	e.preventDefault();
	if (rightElem().className == 'shown') {
		leftElem().className = 'noshare';
		rightElem().className = 'hidden';
	} else {
		leftElem().className = 'share';
		rightElem().className = 'shown';
	}
	resize();
}

//////////////////////////////////////////////////////////////////
// Peripherals.

var mouse;

function initPeripherals() {
	mouse = new THREE.Vector3();
	document.addEventListener('keydown', processKey);
	modelElem().addEventListener('mousewheel', doMousewheel);
	modelElem().addEventListener('mousemove', doMousemove);
	infoElem().addEventListener('click', toggleInfo);
}

function processKey(e) {
	e.preventDefault();
	switch (e.keyCode) {
		case 68: measureDistance(e); return; // d
		case 73: toggleInfo(e); return; // i
		case 82: reset(e); return; // r
		case 84: tiltObject(e, e.shiftKey); return; // t or T
		case 188: zoomOut(e); return; // <
		case 190: zoomIn(e); return; // >
	}
}

function doMousewheel(e) {
	e.preventDefault();
	var delta = Math.max(-1, Math.min(1, (e.wheelDelta || -e.detail)));
	if (delta > 0)
		zoomIn(e);
	else
		zoomOut(e);
}

function doMousemove(e) {
	e.preventDefault();
	startInfoButton();
	mouse = new THREE.Vector3(
		(e.clientX / modelWidth() ) * 2 - 1,
		- ( e.clientY / modelHeight() ) * 2 + 1,
		1);
}

function reset(e) {
	e.preventDefault();
	resetControls();
	resetTilt();
}

//////////////////////////////////////////////////////////////////
// Initialization.

function init() {
	initCamera();
	initScene();
	initRenderer();
	initConfig();
	initObject();
	initPeripherals();
	animate();
}

function resize() {
	resizeCamera();
	resizeRenderer();
}

window.addEventListener('DOMContentLoaded', init);
window.addEventListener('resize', resize);

