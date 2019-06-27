
	var gScene;
    var gCamera;
    var gRenderer;
    var gControls;
    var gDirLight;
    var gSceneObjects=[];

    //get model width, height
    //--borrowed from Mark-jan's viewer at https://mjn.host.cs.st-andrews.ac.uk/egyptian/coffins/viewer3d.js
    var getModelWidth=function(){
        var style=window.getComputedStyle(document.getElementById('Scene3d'),null);
        var width=style.getPropertyValue('width').replace('px','');
        return width;
    };
    var getModelHeight=function(){
        var style=window.getComputedStyle(document.getElementById('Scene3d'),null);
        var height=style.getPropertyValue('height').replace('px','');
        return height;
    };

    var LoadingScreen=function(){
        var setProgress=function(percent){
            var loadingscreen=document.getElementById('loadingScreen');
            loadingscreen.innerHTML='<p> Loading....'+percent+'% </p>';
        };
        var show=function(){
            var loadingscreen=document.getElementById('loadingScreen');
            setProgress(0);
            loadingscreen.className= 'inprogress';
        };
        var hide= function(){
            var loadingscreen=document.getElementById('loadingScreen');
            loadingscreen.className= 'done';
        };
        return {setProgress:setProgress, show:show, hide:hide};
    };

    var gLoadingScreen=LoadingScreen();
    var setup = function(){

        //basic setup of scene, renderer, etc.
        gScene = new THREE.Scene();
        gCamera=new THREE.PerspectiveCamera(45,window.innerWidth/window.innerHeight,0.1,100);
        gCamera.position.set(0,0,3); //so I can see stuff at 0,0 since the camera also initializes at 0,0
        
        gRenderer=new THREE.WebGLRenderer();
        gRenderer.setSize(window.innerWidth,window.innerHeight);
        //required for gltfloader as per the example page https://threejs.org/docs/#examples/loaders/GLTFLoader
        gRenderer.gammaOutput=true;
      //  gRenderer.gammaFactor=2.2;
        //adding the orbit controls, which allow the camera to rotate around the centre of the scene.
        gControls=new THREE.OrbitControls(gCamera,gRenderer.domElement);
        gControls.screenSpacePanning=true;
        //adding a directional light which will always shine on the object because it follows the camera.
        gDirLight = new THREE.DirectionalLight(0xffffff, 2);
        gScene.add(gDirLight);
        gDirLight.position.set(gCamera.position.x,gCamera.position.y, gCamera.position.z);
        document.getElementById('Scene3d').appendChild(gRenderer.domElement);

    }
    var update = function(){
        gControls.update();
        gDirLight.position.set(gCamera.position.x,gCamera.position.y, gCamera.position.z)
    };
    var render = function(){
        gRenderer.render(gScene,gCamera);
    };
    var gameLoop=function(){
        requestAnimationFrame(gameLoop);
        update();
        render();
    };
    function loadModel(modelname){
        var loader = new THREE.GLTFLoader();
        gLoadingScreen.show();
        loader.load(modelname,
            //on loaded callback
            function(object){
                gLoadingScreen.hide();
                object.scene.traverse(function(child)
                {
                    if(child instanceof THREE.Mesh)
                    {
                        gSceneObjects.push(child);
                    }
                });
                gScene.add(object.scene);
            },
            //progress percent callback.
            function(xhr){
                var loaded = Math.round(xhr.loaded/xhr.total* 100);
                gLoadingScreen.setProgress(loaded);

            },
            //callback for loading errors
            function(error){
                console.log("An Error Happened:"+ error);
            })
    };

    //instantiation
    setup();
    
    loadModel("models/iwefaa-centre.gltf")

    var resizeListener=function(evt){
        newwidth=getModelWidth();
        newheight=getModelHeight();
        gCamera.aspect=newwidth/newheight;
        gCamera.updateProjectionMatrix();
        gRenderer.setSize(newwidth,newheight);
    }
    window.addEventListener('resize',resizeListener,false);
    resizeListener(null);
    gameLoop();
    