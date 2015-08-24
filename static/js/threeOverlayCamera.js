// standard global variables
var scene, camera, renderer;

var arrows, model;

var cameraOffset = {
    x: 0,
    y: 150,
    z: 400
};


// container
var container = document.createElement('div');
container.style.width = '100%';
container.style.height = '100%';
container.style.zIndex = -2;

container.style.backgroundColor = '#D6FFEB';
document.body.appendChild(container);


var btn = document.createElement( 'button');
btn.innerHTML = "GET";
btn.style.position = 'absolute';
btn.style.marginLeft = "10px";
btn.style.marginTop = "30px";
btn.style.padding = "20px";
btn.style.zIndex = 10;
container.appendChild( btn );
btn.addEventListener( "click" , function() {getNVM(false, false);} );

var btn2 = document.createElement( 'button');
btn2.innerHTML = "TAKE";
btn2.style.position = 'absolute';
btn2.style.marginLeft = "10px";
btn2.style.marginTop = "90px";
btn2.style.padding = "20px";
btn2.style.zIndex = 10;
container.appendChild( btn2 );
btn2.addEventListener( "click" ,takeScreenShot );

var info = document.createElement('p');
info.id = "info";
info.style.position = 'absolute';
info.style.marginLeft = "90px";
container.appendChild(info);

var video = document.createElement("video");
video.style.visibility = 'hidden';
video.style.position = 'absolute';
container.appendChild(video);

var canvas = document.createElement("canvas");
canvas.style.position = 'absolute';
canvas.style.zIndex = 5;
container.appendChild(canvas);
var ctx = canvas.getContext('2d');

var screenshot_canvas = document.createElement("canvas");
screenshot_canvas.style.visibility = 'hidden';
screenshot_canvas.style.position = 'absolute';
container.appendChild(screenshot_canvas);
var screenshot_ctx = screenshot_canvas.getContext( '2d' );

var btn3 = document.createElement( 'button');
btn3.innerHTML = "FS";
btn3.style.position = 'absolute';
btn3.style.marginLeft = "10px";
btn3.style.marginTop = "150px";
btn3.style.padding = "20px";
btn3.style.zIndex = 10;
container.appendChild( btn3 );
btn3.addEventListener( "click" , function(){requestFullscreen(container);});

document.fullscreenEnabled = document.fullscreenEnabled || document.mozFullScreenEnabled || document.documentElement.webkitRequestFullScreen;

function requestFullscreen(element) {
    if (document.fullscreenEnabled) {
        if (element.requestFullscreen) {
            element.requestFullscreen();
        } else if (element.mozRequestFullScreen) {
            element.mozRequestFullScreen();
        } else if (element.webkitRequestFullScreen) {
            element.webkitRequestFullScreen(Element.ALLOW_KEYBOARD_INPUT);
        }
    } else {
        info.innerHTML = "not supported";
    }
}


// video.style.visibility = 'hidden';
var landscape = false;
var canvas_inner; // resolution container
(function() {

    window.addEventListener('DOMContentLoaded', function() {
        canvas_inner = {w:window.innerWidth,
                        h:window.innerHeight,
                        offsetW:0,
                        offsetH:0};
        var isStreaming = false;
        var videoSource = null;
        info.innerHTML = "started";

            navigator.getUserMedia = (navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia);
            if (navigator.getUserMedia) {
                // Request access to video only
                navigator.getUserMedia({
                        video: {
                            optional: [
                                //{sourceId: videoSource.id},
                                {facingMode: "environment"},
                                {minWidth: 320}, // for maximum resolution (chrome)
                                {minWidth: 640},
                                {minWidth: 1024},
                                {minWidth: 1280},
                                {minWidth: 1920},
                                {minWidth: 2560}
                            ]
                        },
                        audio: false
                    },
                    function(stream) {
                        // Cross browser checks
                        var url = window.url || window.URL || window.webkitURL;
                        video.src = url.createObjectURL(stream);
                        // Set the video to play
                        video.play();

                        // Every 33 milliseconds copy the video image to the canvas
                        setInterval(drawStep, 33);

                    },
                    function(error) {
                        alert('Something went wrong. (error code ' + error.code + ')');
                        return;
                    }
                );
            } else {
                alert('Sorry, the browser you are using doesn\'t support getUserMedia');
                return;
            }
        // });

        var drawStep = function() {
            if (video.paused || video.ended) {
                console.log("video paused for some reason...");
                video.play();
                return;
            }
            //ctx.fillStyle = '#'
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(video, canvas_inner.offsetW, canvas_inner.offsetH, canvas_inner.w, canvas_inner.h);
        }

        var resizeScreen = function() {
            var cw = window.innerWidth,
                ch = window.innerHeight,
                vw = video.videoWidth,
                vh = video.videoHeight;

            canvas.setAttribute('width', cw);
            canvas.setAttribute('height', ch);

            var videoAspect = vw / vh;

                
            if (videoAspect > cw / ch) {
                // w = cw;
                // h = cw / videoAspect;
                canvas_inner.w = ch * videoAspect;
                canvas_inner.h = ch;
                // offsetW = 0;
                // offsetH = (ch - h) / 2;
                canvas_inner.offsetW = (cw - canvas_inner.w) / 2;
                canvas_inner.offsetH = 0;
            } else { // side boxes
                canvas_inner.w = ch * videoAspect;
                canvas_inner.h = ch;
                canvas_inner.offsetW = (cw - canvas_inner.w) / 2;
                canvas_inner.offsetH = 0;
            }

            // one canvas to match video size exactly so we can send full resolution
            screenshot_canvas.width = vw;
            screenshot_canvas.height = vh;
            console.log("resize", cw,ch)
            console.log(canvas_inner.w,canvas_inner.h,canvas_inner.offsetW, canvas_inner.offsetH)
        }


        // Wait until the video stream can play
        video.addEventListener('canplay', function(e) {
            info.innerHTML += "CANPLAY";
            if (!isStreaming) {
                // videoWidth isn't always set correctly in all browsers
                if (video.videoWidth > 0) {
                    screenshot_canvas.width = video.videoWidth;
                    screenshot_canvas.height = video.videoHeight;
                } else {
                    alert( "videoWidth not set correctly" );
                }
                resizeScreen();
                isStreaming = true;
            }
        }, false);

        window.addEventListener('resize', resizeScreen, false);

        window.addEventListener("orientationchange", function() {
            info.innerHTML = "orientation change<br>"+window.orientation+ "<br>"+video.videoWidth + ", " + video.videoHeight;
            // var wo = window.orientation;
            // if (!((wo + 90) % 180)) {
            //     // var tempw = w;
            //     // w = h;
            //     // h = tempw;
            //     landscape = true;
            //     canvas.setAttribute('width', canvas_inner.h);
            //     canvas.setAttribute('height', canvas_inner.w);
            // } else {
            //     landscape = false;
            //     canvas.setAttribute('width', canvas_inner.w);
            //     canvas.setAttribute('height', canvas_inner.h);
            // }
            drawStep();
        }, false);

            /*var sw, sh;

            var cw = canvas.width,
                ch = canvas.height;

            var vw = video.videoWidth,
                vh = video.videoHeight;

            if (cw < vw || ch < vh) {

                // downsample and redraw
                var videoAspect = vw / vh;
                if (videoAspect > cw / ch) { // boxes at top and bottom
                    sw = vw;
                    sh = vw / videoAspect;
                } else {                     // boxes at sides
                    sw = vh * videoAspect;
                    sh = vh;
                }

            } else {
                sw = vw;
                sh = vh;
            }
        */
        
    })
})();

// THREE JS
// FUNCTIONS        
function init() {
    // SCENE
    scene = new THREE.Scene();
    arrows = new THREE.Object3D();
    scene.add(arrows);
    model = new THREE.Object3D();
    scene.add(model);
    // CAMERA
    var SCREEN_WIDTH = window.innerWidth,
        SCREEN_HEIGHT = window.innerHeight;
    var VIEW_ANGLE = 45,
        ASPECT = SCREEN_WIDTH / SCREEN_HEIGHT,
        NEAR = 0.1,
        FAR = 2000000;

    camera = new THREE.PerspectiveCamera(VIEW_ANGLE, ASPECT, NEAR, FAR);
    scene.add(camera);

    camera.position.set(cameraOffset.x, cameraOffset.y, cameraOffset.z);
    camera.lookAt(scene.position);
    var check_webgl = function() {
            try {
                return !!window.WebGLRenderingContext && !!document.createElement('canvas').getContext('experimental-webgl');
            } catch (e) {
                return false;
            }
        }
    // RENDERER
    if (check_webgl())
        renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true
        });
    else
        renderer = new THREE.CanvasRenderer({
            transparent: true
        });

    renderer.setSize(SCREEN_WIDTH, SCREEN_HEIGHT);
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.zIndex = 6;

    //renderer.setClearColor( 0xffffff, 1 );

    container.appendChild(renderer.domElement);

    // EVENTS

    controls = new THREE.OrbitControls( camera, renderer.domElement );

    var callback = function() {
            var w = window.innerWidth,
                h = window.innerHeight;
            // video.videoWidth = w;
            // video.videoHeight = h;
            renderer.setSize(w, h);

            // update the camera
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
        }

    window.addEventListener('resize', callback, false);

    // LIGHT
    var light = new THREE.PointLight(0xffffff);
    light.position.set(100, 250, 100);
    scene.add(light);

    ///////////////////
    // AXES & ARROWS //
    ///////////////////
    axes = new THREE.Object3D();
    var dir = new THREE.Vector3(10, 0, 0);
    var origin = new THREE.Vector3(0, 0, 0);
    var length = 100;
    var hex = 0xff0000;
    var arrowHelper = new THREE.ArrowHelper(dir, origin, length, hex);
    axes.add(arrowHelper);

    var dir = new THREE.Vector3(0, 10, 0);
    var hex = 0x00ff00;
    var arrowHelper = new THREE.ArrowHelper(dir, origin, length, hex);
    axes.add(arrowHelper);

    var dir = new THREE.Vector3(0, 0, 10);
    var hex = 0x0000ff;
    var arrowHelper = new THREE.ArrowHelper(dir, origin, length, hex);
    axes.add(arrowHelper);
    scene.add(axes);

    // CAMERA


}

function animate() {
    requestAnimationFrame(animate);
    render();
    update();
}

var latestCamera = false;
document.addEventListener("keypress", function(e) {
    if (e.which == 67 || e.which == 99)  {
        if (latestCamera) setCamera(latestCamera);
        else console.log("no latestCamera");
    } else {
        console.log(e.which + " pressed");
    }
});
function update() {
    // camera.position.set(cameraOffset.x, cameraOffset.y, cameraOffset.z);
    // camera.lookAt(scene.position);
}


function render() {
    renderer.render(scene, camera);
}




var uploads = [];

function sendImage(dataURL) {
     
    console.log(uploads);

    if (window.XMLHttpRequest) {
        xmlhttp = new XMLHttpRequest();
    }

    var uploadid = uploads.length;
    uploads[uploadid] = {
        req: xmlhttp,
        percent: 0,
        size: dataURL.length,
        done: false
    };

    var readyState = function(uploadid, xmlhttp) {
        return function() {
            if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
                info.innerHTML = "xmlhttp.readyState = " + xmlhttp.readyState + ", xmlhttp.status = " + xmlhttp.status + ", responseText = " + xmlhttp.responseText;
                var res = JSON.parse(xmlhttp.responseText);
                if (res.success) {
                    info.innerHTML += "<br> SUCCESS!";
                    if (res.name) {
                        info.innerHTML += "<br> name : " + res.name;

                        var callback = function(success, found, result) {
                            // console.log("name : " + name + " = res.name? : " + res.name);
                            if (success && found && result.used == 3) {
                                console.log("success!!!!" + result);
                                getNVM(res.name, res.name);
                            } else {
                                setTimeout(function() {
                                    getJPG(res.name, callback);
                                }, 250); // poll the server until the JPG has been processed
                            }
                        
                        } 
                        
                        getJPG(res.name, callback(res.name));
                    }

                }
                else {info.innerHTML += "<br> NO SUCCESS :(";}
                uploads[uploadid].done = true;
            }
        }
    }
    xmlhttp.onreadystatechange = readyState(uploadid, xmlhttp); // curry the functions so they access the correct upload[uploadid]'s'
    var progress = function(uploadid) {
        return function(evt) {
            if (evt.loaded) {
                var percentComplete = Math.min(100, (evt.loaded / evt.total) * 100);
                uploads[uploadid].percent = percentComplete;
                //console.log(percentComplete);
            }
        }
    }
    xmlhttp.onprogress = progress(uploadid); 
    xmlhttp.open("POST", "../dataURL", true);
    xmlhttp.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    xmlhttp.send(dataURL);
}

function takeScreenShot() {
    screenshot_ctx.drawImage(video,0,0);
    var dataURL = screenshot_canvas.toDataURL("image/jpeg",1.0);
    sendImage(dataURL);
}


function getNVM(name, camera_name) {
    if (window.XMLHttpRequest) {
        xmlhttp = new XMLHttpRequest();
    }
    var ready = function(name, camera_name) {
        console.log("getNVM, function,  name = " + name + ", camera_name = " + camera_name)

        return function() {
            if (xmlhttp.readyState==4 && xmlhttp.status==200) {
                //info.innerHTML=xmlhttp.responseText;
                if (xmlhttp.responseText.slice(0,6)=="NVM_V3") {
                    console.log("getNVM, name = " + name + ", camera_name = " + camera_name)
                    console.log("recieved (valid) NVM with camera! ");
                    arrows.children = [];
                    model.children = [];
                    readFile(xmlhttp.responseText, camera_name);
                } else {
                    console.log("getNVM sent " + name);
                    console.log("NVM    server responded " + xmlhttp.responseText);
                }

            }
        }
    }
    xmlhttp.onreadystatechange = ready(name, camera_name);

    var path = "../latestNVM.nvm";
    if (name) {
        path = "../model?cam=" + name;
    } 
    console.log(path);
    xmlhttp.open("GET",path,true);
    xmlhttp.send();
}

function getJPG(name, callback) {
    if (window.XMLHttpRequest) {
        xmlhttp = new XMLHttpRequest();
    }
    xmlhttp.onreadystatechange=ready(name);
    function ready(name) {
        return function() {
            if (xmlhttp.readyState==4 && xmlhttp.status==200) {
                //info.innerHTML=xmlhttp.responseText;
                var res = JSON.parse(xmlhttp.responseText);
                if (callback) {
                    callback(res.success, res.found, res.result);
                }
                if (res.success) {
                    if (res.found) {
                        //console.log("getJPG returned " + JSON.stringify(res.result));
                        //console.log("getJPG " + name + " has used  = " + res.result.used );
                    } else {
                        console.log("getJPG " + name + " was not found ");
                    }
                } else {
                    console.log("getJPG failed " + res);
                }

            }
        }
    }
    var path = "../jpgs_lookup?jpg=" + name;
    
    xmlhttp.open("GET",path,true);
    xmlhttp.send();
}

init();
animate();