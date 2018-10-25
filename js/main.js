
	var gScene;
    var gCamera;
    var gRenderer;
    var gControls;
    var gDirLight;
    var gRayCaster;
    var gClickArray;
    var gSceneObjects=[];
    var gPins=[];
    var gMousePos=new THREE.Vector2();
    var gMeasure_clicks=function(array){
        //display the measurement between two points
    };
    const StateMachine={
        //figure out what state we are in and what the current action does to it.
        //default state
        state:'viewing',
        dispatch(actionName,params){
            const possibleactions = this.transitions[this.state];
            const action=this.transitions[this.state][actionName];
            if(action){
                action.apply(StateMachine,params);
            }
        },
        changeStateTo(newstate){
            this.dispatch('exit');
            this.state = newstate;
            this.dispatch('entry');
        },
        transitions:{
            measuring:{
                entry:function(){
                    document.addEventListener('keyup',function(keyevt)
                    {
                        
                        if (keyevt.code==='Space' && gPins.length <2) 
                        {
                            keyevt.preventDefault();
                            gRayCaster.setFromCamera(gMousePos,gCamera);
                            var intersects= gRayCaster.intersectObjects(gSceneObjects);
                            var intersect=intersects.length>0 ? intersects[0]:null;
                            if (intersect)
                            {
                                 getPin(intersect.point,'rgb(255,0,0)');  
                            }
                        }
                       

                    });//end of the keyevent listener function
                },
                exit:function(){
                    
                },
                toViewing:function(){
                    console.log(this.state);
                },
                update:function(){
                    gControls.update();
                    gDirLight.position.set(gCamera.position.x,gCamera.position.y, gCamera.position.z) 
                },
            },
            viewing:{
                entry:function(){
                    //add event listener for measuring buttons

                    
                },
                exit:function(){
                    
                },
                update:function(){
                    gControls.update();
                    gDirLight.position.set(gCamera.position.x,gCamera.position.y, gCamera.position.z)            
                },
                toMeasure:function(param){
                    console.log(this.state);
                    this.changeStateTo('measuring');
                    //exit viewing state set measuring state.

                },
                toText:function(){
                    console.log(this.state);
                },
            },
            reading:{
                entry:function(){

                },
                exit:function(){
                    
                },
                update:function(){
                    
                },
                toReading:function(){
                    console.log(this.state);
                },

            },
        },

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
       // gCamera.lookAt(0,0,0);
        
        gRenderer=new THREE.WebGLRenderer();
        gRenderer.setSize(window.innerWidth,window.innerHeight);
        //required for gltfloader as per the example page https://threejs.org/docs/#examples/loaders/GLTFLoader
        gRenderer.gammaOutput=true;
        gRayCaster=new THREE.Raycaster();
        gRayCaster.params.Points.threshold = 0.1;
      //  gRenderer.gammaFactor=2.2;
        //adding the orbit controls, which allow the camera to rotate around the centre of the scene.
        gControls=new THREE.OrbitControls(gCamera,gRenderer.domElement);
        gControls.screenSpacePanning=true;
        light = getAmbientLight(0xffffff,1);
        gDirLight=getDirectionLight(0xffffff);
        gScene.add(gDirLight);
       // gScene.add(light);
        gDirLight.position.set(gCamera.position.x,gCamera.position.y, gCamera.position.z);
        document.getElementById('3dScene').appendChild(gRenderer.domElement);

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
        StateMachine.dispatch('update');
        //update();
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
    
    //other useful functions for my own reference.

    function getPointLight(intensity){
        var light=new THREE.PointLight(0xffffff, intensity);
        light.add(getSphere(0.1));
        return light;
    }
    function getAmbientLight(color,intensity){
        var light=new THREE.AmbientLight(color,intensity)
        return light;
    }
    function getDirectionLight(color){
        var light=new THREE.DirectionalLight(0xffffff,2);
        light.add(getSphere(0.1));
        
       
        return light;
    }
    function getBox(w,h,d){
        var geometry = new THREE.BoxGeometry(w,h,d);
        var material = new THREE.MeshBasicMaterial({color:0x00ff00});
        var mesh = new THREE.Mesh(geometry,material);

        return mesh;
    }
    function getSphere(r){
        var geometry=new THREE.SphereGeometry(r,24,24);
        var material=new THREE.MeshBasicMaterial({color:'rgb(255,255,255)'});
        var mesh=new THREE.Mesh(geometry,material);
        return mesh;

    }
    function getPin(position,color){
        var pin=new THREE.SphereGeometry(0.1,10,10);
        var material=new THREE.MeshBasicMaterial({color:color});
        var mesh=new THREE.Mesh(pin,material);
        gScene.add(mesh);
        mesh.position.copy(position);
        gPins.push(mesh);

        
    }
    //instantiation
    setup();
    loadModel("models/iwefaa-centre.gltf")
    //setup initial viewer state event listeners
    StateMachine.changeStateTo('viewing');
    document.getElementById('measure_button').addEventListener('click', function(e){
        StateMachine.dispatch('toMeasure',e);
    })
    document.addEventListener('mousemove',function(evt){
            evt.preventDefault();
            gMousePos.x=(evt.clientX / window.innerWidth)*2-1;
            gMousePos.y=-(evt.clientY/window.innerHeight)*2+1;
         }, 
         false
    );
    gameLoop();
    