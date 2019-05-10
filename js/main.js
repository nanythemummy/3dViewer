
	var gScene;
    var gCamera;
    var gRenderer;
    var gControls;
    var gDirLight;
    var gRayCaster;
    var gClickArray;
    var gSceneObjects=[];
    var gPins=[];
    var gOldPins=[];
    var gLines=[];
    var gMousePos=new THREE.Vector2();
    var gAbDistance=0;
    var MeasureKeyListener = function(keyevt)
    {
        if (keyevt.code==='Escape'){
            keyevt.preventDefault();
            clearLinesAndPins();
        }
        if (keyevt.code==='Space' && gPins.length <2) 
        {
            keyevt.preventDefault();
            gRayCaster.setFromCamera(gMousePos,gCamera);
            var intersects= gRayCaster.intersectObjects(gSceneObjects);
            var intersect=intersects.length>0 ? intersects[0]:null;
            if (intersect)
            {
                    addPin(intersect.point);
            }
            if (gPins.length==2){
                var dist=document.getElementById('dist');
                dist.innerHTML="<p> Distance: "+ Math.round(gPins[0].point.distanceTo(gPins[1].point)*100)+" cm.</p>"
            }
        }
    };

    //end of the keyevent listener function
    //removes the 3d pins.
    var clearLinesAndPins=function(){
        var canvas = document.getElementById('Overlay2d');
        var context=canvas.getContext('2d');
        gPins=[];
        clearOldPins(context);
        while(gLines.length>0){
            line= gLines.pop();
            clearOverlay(context,Math.min(line.pointA.x, line.pointB.x)-context.lineWidth, 
                        Math.min(line.pointA.y, line.pointB.y)-context.lineWidth, 
                        Math.abs(line.pointA.x-line.pointB.x)+context.lineWidth,
                        Math.abs(line.pointA.y-line.pointB.y)+context.lineWidth);
        }
        var dist=document.getElementById('dist');
        dist.innerHTML="Select Points to Measure Distance";
    };
    //get model width, height, as well as the draw distance and projectTo2d code
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

    var projectTo2d = function(point3d, screenwidth,screenheight){
        var p = new THREE.Vector3().copy(point3d);
        p.project(gCamera);
        //project seems to return the coordinates in a system with +y up, and positive x right. 
        //the grid seems to span between -1 and 1 in each direction, with the origin in the center.
        //we need to convert the points to the system used by html5canvas,
        // where 0,0 is in the top left, y=1 is down and x=1 is right.
        //adding/subtracting 1 and dividing by two shifts the point to the new origin and scales the 
        //coordinate system down to 0-1 instead of  -1-1.
        return {x: Math.round((p.x+1)/2*screenwidth),
                y: Math.round(-(p.y-1)/2*screenheight) }
        
    };
    var clearOverlay=function(context,x,y,w,h){
         var canvas = document.getElementById('Overlay2d');
         var context=canvas.getContext('2d');
         context.clearRect(x,y,w,h);
    }
    var addPin=function(point3d){
        gPins.push({point:point3d,radius:5})
    }
    var addLine=function(point1,point2){
        gLines.push({pointA:point1,pointB:point2});
    }
    var clearOldPins=function(context){
        while (gOldPins.length>0){
            var marker=gOldPins.pop();
            //because these drew as circles with the centre x,y, we have to offset them to get the right square to clear.
            var offsetx=marker.w/2+context.lineWidth;
            var offsety=marker.h/2+context.lineWidth;
            clearOverlay(context,marker.x-offsetx,marker.y-offsety,marker.w+offsetx,marker.h+offsety);
        }
    }
    var clearOldLines=function(context){
        while(gLines.length>0){
            var line=gLines.pop();
            var offsetx=context.lineWidth;
            var offsety=context.lineWidth;
            clearOverlay(context,Math.min(line.pointA.x, line.pointB.x)-offsetx, 
                        Math.min(line.pointA.y, line.pointB.y)-offsety, 
                        Math.abs(line.pointA.x-line.pointB.x)+offsetx,
                        Math.abs(line.pointA.y-line.pointB.y)+offsety);
        }
    }
    var drawPins=function(){
        
        var canvas = document.getElementById('Overlay2d');
        var context=canvas.getContext('2d');
        context.strokeSytle="#000000";
        context.fillStyle='green';
        context.lineWidth=2;
        clearOldPins(context);
        for(var i=0; i<gPins.length; ++i){
            var pin = gPins[i];
            var xy=projectTo2d(pin.point,getModelWidth(),getModelHeight());
            context.beginPath();
            context.arc(xy.x,xy.y,5,0,Math.PI*2);
            context.stroke();
            gOldPins.push({x:xy.x,y:xy.y,w:pin.radius*2,h:pin.radius*2});
        }
    }
    var drawLines=function()
    {
        var canvas = document.getElementById('Overlay2d');
        var context=canvas.getContext('2d');
        
        context.fillStyle='black';
        context.lineWidth=2;
        clearOldLines(context);
        if (gPins.length<2){
            return;
        }
        for(var i=0;i<gPins.length-1;++i){
                var pta=projectTo2d(gPins[i].point,getModelWidth(),getModelHeight());
                var ptb=projectTo2d(gPins[i+1].point,getModelWidth(),getModelHeight());
                context.strokeSytle='#FFFFFF';
                context.beginPath();

                context.moveTo(pta.x,pta.y);
                context.lineTo(ptb.x,ptb.y);
                
                context.stroke();
                gLines.push({pointA:pta, pointB:ptb});
               
        }
       
    }
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
                    document.addEventListener('keyup',MeasureKeyListener)
                    document.getElementById('measure_button').innerHTML="Exit";
                },
                exit:function(){
                    clearLinesAndPins();
                    document.removeEventListener('keyup', MeasureKeyListener)
                },
                toViewing:function(){
                    console.log(this.state);
                    this.changeStateTo('viewing');
                },
                update:function(){
                    gControls.update();
                    gDirLight.position.set(gCamera.position.x,gCamera.position.y, gCamera.position.z)                     
                    drawLines();
                    drawPins();
                },
            },
            viewing:{
                entry:function(){
                    //add event listener for measuring buttons
                    document.getElementById('measure_button').innerHTML="Measure";
                    
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
        //adding a directional light which will always shine on the object because it follows the camera.
        light = getAmbientLight(0xffffff,1);
        gDirLight=getDirectionLight(0xffffff);
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
        StateMachine.dispatch('update');
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
        var pin=new THREE.SphereGeometry(0.01,10,10);
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
        if (StateMachine.state==='measuring'){
            StateMachine.dispatch('toViewing',e);
        }
        else if(StateMachine.state==='viewing'){
            StateMachine.dispatch('toMeasure',e);
        }
        
    })
    document.addEventListener('mousemove',function(evt){
            evt.preventDefault();
            gMousePos.x=(evt.clientX / window.innerWidth)*2-1;
            gMousePos.y=-(evt.clientY/window.innerHeight)*2+1;
         }, 
         false
    );
    var resizeListener=function(evt){
        newwidth=getModelWidth();
        newheight=getModelHeight();
        gCamera.aspect=newwidth/newheight;
        gCamera.updateProjectionMatrix();
        gRenderer.setSize(newwidth,newheight);
        var overlay=this.document.getElementById('Overlay2d');
        overlay.width=newwidth;
        overlay.height=newheight;
    }
    window.addEventListener('resize',resizeListener,false);
    resizeListener(null);
    gameLoop();
    