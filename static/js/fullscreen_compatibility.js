/**
* this code is from all around the web :)
* if u want to put some credits u are welcome!
*/
var fullscreen_compatibility = (function() {
    var lastTime = 0;

    var URL = window.URL || window.webkitURL;

    var requestAnimationFrameCompatability =
        window.requestAnimationFrame        || 
        window.webkitRequestAnimationFrame  || 
        window.mozRequestAnimationFrame     || 
        window.oRequestAnimationFrame       ||
        window.msRequestAnimationFrame      ||
        function(callback, element) {
            var currTime = new Date().getTime();
            var timeToCall = Math.max(0, 16 - (currTime - lastTime));
            var id = window.setTimeout(function() {
                callback(currTime + timeToCall);
            }, timeToCall);
            lastTime = currTime + timeToCall;
            return id;
        };

    var requestAnimationFrame = function(callback, element) {
        return requestAnimationFrameCompatability.call(window, callback, element);
    }

    var cancelAnimationFrame = function(id) {
        var cancelAnimationFrame = window.cancelAnimationFrame ||
            function(id) {
                clearTimeout(id);
            };
        return cancelAnimationFrame.call(window, id);
    }

    var getUserMedia = function(options, success, error) {
        var getUserMedia =
            window.navigator.getUserMedia ||
            window.navigator.mozGetUserMedia ||
            window.navigator.webkitGetUserMedia ||
            window.navigator.msGetUserMedia ||
            function(options, success, error) {
                error();
            };

        return getUserMedia.call(window.navigator, options, success, error);
    }
    var container, video, canvas, s_canvas, ctx, s_ctx, canvas_size, resizecallback;
    
    var createVideoCanvas = function( options ) {
        if (options.camera_direction && (options.camera_direction!="user" && options.camera_direction!="environment" )) {
            alert("incorrect camera_direction : " + options.camera_direction);
            return;
        }
        // create containing elements
        container = document.createElement('div');
        container.style.cssText = "height:100%; width:100%; overflow:hidden; z-index:1; background-color:#D6FFEB; ";
        document.body.appendChild(container);

        video = document.createElement("video");
        video.style.cssText = "visibility:hidden; position:absolute";
        container.appendChild(video);

        canvas = document.createElement("canvas");
        canvas.style.cssText = "position:absolute; z-index:5;";
        container.appendChild(canvas);
        ctx = canvas.getContext('2d');

        s_canvas = document.createElement("canvas");
        // backing canvas doesn't need to be added to document
        //s_canvas.style.cssText = "visibility:hidden; position:absolute";
        //container.appendChild(s_canvas);
        s_ctx = s_canvas.getContext( '2d' );
        


        canvas_size = {
            w:window.innerWidth,
            h:window.innerHeight,
            offsetW:0,
            offsetH:0,
            vw:0,
            vh:0,
            video_prevh: 0,
            video_prevw: 0
        };
        var isStreaming = false;
        var videoSource = null;

        navigator.getUserMedia = (navigator.getUserMedia||navigator.webkitGetUserMedia||navigator.mozGetUserMedia||navigator.msGetUserMedia);

        var id;
        if (MediaStreamTrack.getSources) MediaStreamTrack.getSources(doThingsWithSources); // allows us to list different video cameras (on smartphones)
        else doThingsWithSources(null); // only supported in chrome as of 24/8/2015

        function doThingsWithSources (media_sources) {
            console.log("doingthingswithsources")
            var vid_options = [
                            {minWidth: 320}, // for maximum resolution (chrome)
                            {minWidth: 640},
                            {minWidth: 1024},
                            {minWidth: 1280},
                            {minWidth: 1920},
                            {minWidth: 2560}
                          ]

            if (options.camera_direction && media_sources) {
                for (var i = 0; i < media_sources.length; i++) {
                    var m_s = media_sources[i];
                    if (m_s.kind=="video") {
                        console.log(m_s);
                        if (m_s.facing==options.camera_direction) id = m_s.id;
                    }
                }
            
                
                if (id!==null) {
                    vid_options.push({sourceId:id});
                }
                else {
                    vid_options.push({facing:options.camera_direction});
                }
            }
            if (navigator.getUserMedia) {
                console.log("getUserMedia")
                // Request access to video only
                navigator.getUserMedia({
                        video: {
                            optional: vid_options
                        },
                        audio: false
                    },
                    function(stream) {
                        // Cross browser checks
                        video.src = URL.createObjectURL(stream);
                        // Set the video to play
                        video.play();

                        // Every 33 milliseconds copy the video image to the canvas
                        //setInterval(drawStep, 33);
                        console.log(stream);
                    },
                    function(error) {
                        alert('Something went wrong. (error code ' + error + ')');
                        return;
                    }
                );
            } else {
                alert('Sorry, the browser you are using doesn\'t support getUserMedia');
                return;
            }
        }

        var resizeScreen = function() {
            var cw = window.innerWidth,
                ch = window.innerHeight,
                vw = video.videoWidth,
                vh = video.videoHeight;
            if (vw != canvas_size.video_prevw || vh != canvas_size.video_prevh) alert("video size changed to w/h " + vw + ", " + vh + "(prev: " + canvas_size.video_prevw +", "+ canvas_size.video_prevh + ")");
            canvas.setAttribute('width', cw);
            canvas.setAttribute('height', ch);

            var videoAspect = vw / vh;

                
            if (videoAspect > cw / ch) {
                canvas_size.w = Math.round(ch * videoAspect);
                canvas_size.h = Math.round(ch);
                canvas_size.offsetW = (cw - canvas_size.w) / 2;
                canvas_size.offsetH = 0;
            } else { // side boxes
                canvas_size.w = Math.round(ch * videoAspect);
                canvas_size.h = Math.round(ch);
                canvas_size.offsetW = (cw - canvas_size.w) / 2;
                canvas_size.offsetH = 0;
            }

            // one canvas to match video size exactly so we can send full resolution
            // update: we no longer want to change this as it SHOULD remain invariant
            //s_canvas.width = vw;
            //s_canvas.height = vh;
            // canvas_size.vw = vw;
            // canvas_size.vh = vh;

            if (resizecallback) {resizecallback();}
        }


        // Wait until the video stream can play
        video.addEventListener('canplay', function(e) {
            if (!isStreaming) {
                // videoWidth isn't always set correctly in all browsers
                if (video.videoWidth > 0) {
                    console.log("video started with w/h : "+video.videoWidth+", "+video.videoHeight);
                    if (options.sc || (options.maxWidth && options.maxWidth<video.videoWidth)) {
                        if (options.maxWidth) {
                            s_canvas.width = options.maxWidth;
                            s_canvas.height = (options.maxWidth/video.videoWidth) * video.videoHeight;
                        } else { // options.sc
                            s_canvas.width = video.videoWidth*options.sc;
                            s_canvas.height = video.videoHeight*options.sc;
                        }
                        console.log("video canvas scaled to w/h : "+ s_canvas.width + ", " + s_canvas.height);
                    } else {
                        s_canvas.width = video.videoWidth;
                        s_canvas.height = video.videoHeight;
                    }
                    s_canvas.width = Math.round(s_canvas.width);
                    s_canvas.height = Math.round(s_canvas.height);
                    canvas_size.video_prevw = video.videoWidth;
                    canvas_size.video_prevh = video.videoHeight;
                    canvas_size.vw = s_canvas.width;
                    canvas_size.vh = s_canvas.height;
                } else {
                    alert( "videoWidth not set correctly" );
                    s_canvas.width = 640;
                    s_canvas.height = 480;
                    canvas_size.video_prevw = 640;
                    canvas_size.video_prevh = 480;
                    canvas_size.vw = 640;
                    canvas_size.vh = 480;
                }
                resizeScreen();
                isStreaming = true;
                if (typeof options.callback == "function") options.callback();

            }
        }, false);

        window.addEventListener('resize', resizeScreen, false);

        window.addEventListener("orientationchange", function() {
            // info.innerHTML = "orientation change<br>"+window.orientation+ "<br>"+video.videoWidth + ", " + video.videoHeight;
            resizeScreen();
            drawStep();
        }, false);
    }
        
    var drawStep = function() {
        if (video.paused || video.ended) {
            console.log("video paused for some reason...");
            video.play();
            return;
        }
        //ctx.fillStyle = '#'
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(video, canvas_size.offsetW, canvas_size.offsetH, canvas_size.w, canvas_size.h);
    }

    var s_drawStep = function() {
        s_ctx.clearRect(0, 0, s_canvas.width, s_canvas.height);
        s_ctx.drawImage(video, 0,0, s_canvas.width, s_canvas.height);
    }

    var requestFullscreen = function(element) {
        if (document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement) {
            if (document.exitFullscreen) {
              document.exitFullscreen();
            } else if (document.msExitFullscreen) {
              document.msExitFullscreen();
            } else if (document.mozCancelFullScreen) {
              document.mozCancelFullScreen();
            } else if (document.webkitExitFullscreen) {
              document.webkitExitFullscreen();
            }
        } else {
            if (document.fullscreenEnabled || document.mozFullScreenEnabled || document.documentElement.webkitRequestFullScreen) {
                if (element.requestFullscreen) {
                    element.requestFullscreen();
                } else if (element.mozRequestFullScreen) {
                    element.mozRequestFullScreen();
                } else if (element.webkitRequestFullScreen) {
                    element.webkitRequestFullScreen(Element.ALLOW_KEYBOARD_INPUT);
                } else if (document.documentElement.msRequestFullscreen) {
                    document.documentElement.msRequestFullscreen();
                }
            } else {
                alert("fullscreen not supported");
            }
        }
    }

    var get_elements = function() {
        return {
            container:container,
            canvas:canvas,
            s_canvas:s_canvas,
            video:video,
            ctx:ctx,
            s_ctx:s_ctx
        };
    }    
    var get_size = function() {
        return canvas_size;
    }
    var set_resizecallback = function(callback) {
        resizecallback = callback;
    }
    return {
        URL: URL,
        requestAnimationFrame: requestAnimationFrame,
        cancelAnimationFrame: cancelAnimationFrame,
        getUserMedia: getUserMedia,
        createVideoCanvas:createVideoCanvas,
        drawStep:drawStep,
        s_drawStep:s_drawStep,
        requestFullscreen:requestFullscreen,
        get_elements:get_elements,
        get_size:get_size,
        set_resizecallback:set_resizecallback
    };
})();