var sc = 200;

function readFile(file, camera_name) {
    console.log("ok.. reading now , camera_name = " + camera_name);
    /*if (camera_name.split(".").length>1) {
        camera_name = camera_name.split(".")[0];
    }*/

    var allLines = file.split('\n');
    var len = allLines.length;
    //console.log(allLines)
    console.log("data lines = ", len);
    var pointcloud;   
    var num_cameras = false;
    var num_pointcloud = -1;
    var num_predicted = -1;
    var pointcloud_enabled = true;
    var positions, colors;
    var pointcloud_geometry = new THREE.Geometry();
    cameras = [];

    var p = parseFloat;
    var rainbow;
    var i = 0;
    while(i < len) {

        if (num_cameras && (num_pointcloud==-1)) {
            var cam = allLines[i].split(/[ \t]+/);
            if (cam.length!=12 || cam[10]!="0") {
                if (pointcloud_enabled) num_pointcloud = 0;
                else break;
            }
            else {
                var pos = new THREE.Vector3(p(cam[6])*sc,p(cam[7])*sc,p(cam[8])*sc);
                var q = new THREE.Quaternion(-p(cam[3]),-p(cam[4]),-p(cam[5]),p(cam[2])).normalize();
                var timestamp = -1;
                if (cam[0].slice(0,"canvasimg".length)=="canvasimg") {timestamp = parseInt(cam[0].slice("canvasimg".length, -4)); //console.log(timestamp)
                } else console.log("no timestamp" , cam[0]);
                //console.log(pos.x,pos.y,pos.z)
                var newCam = {file_name:cam[0],focal_length:p(cam[1]),q:q,pos:pos,radial_distortion:p(cam[9]),timestamp:timestamp};
                var file_name = cam[0];
                var col = rainbow.colourAt(cameras.length);
                console.log("file_name = " + file_name + ", camera_name = " + camera_name);
                if (file_name == camera_name) {
                    console.log("setting camera : " + camera_name)
                    setCamera(newCam);
                    latestCamera = newCam;
                    camera_name = false; // for not setting to avgpos later..
                    col = "FF99CC";
                }
                newCam.arrow = createArrow( newCam.pos, newCam.q, col);

                cameras.push(newCam);
            }
        } else if(parseInt(allLines[i]) && num_pointcloud==-1) {  // first line
            num_cameras = parseInt(allLines[i]);
            rainbow = new Rainbow(); 
            rainbow.setNumberRange(1, num_cameras);
        }

        if (num_pointcloud!=-1 && pointcloud_enabled) {
            var line = allLines[i].split(/[ \t]+/);
            if (num_predicted==-1) {
                if (line.length==1 && parseInt(line[0])>0) {
                    num_predicted = parseInt(line[0]);
                    console.log(num_predicted + " points");
                    positions = [];
                    colors = [];
                } 
            } else {
                if (line.length<6) {
                    console.log("reached end of pointcloud " + ((num_pointcloud==num_predicted) ? "as expected" : "unexpectedly after " + num_pointcloud + " points"));
                    break;
                }
                if (num_pointcloud>num_predicted) console.log("warning, more points than expected!!");
                else {
                    pointcloud_geometry.vertices.push(new THREE.Vector3(p(line[0])*sc,p(line[1])*sc, p(line[2])*sc));
                    colors.push( new THREE.Color( p(line[3])/255, p(line[4])/255, p(line[5])/255));
                    num_pointcloud++;
                }
            }
        }
        i++;
    }
    cameras.sort(function(a,b) { return a.timestamp - b.timestamp;});
    //console.log(cameras)

    if (pointcloud_enabled && num_pointcloud>0) {
        pointcloud_geometry.colors = colors;
        pointcloud_geometry.computeBoundingSphere();
        console.log(pointcloud_geometry.boundingSphere)
        var pointSize = 4;
        var material = new THREE.PointCloudMaterial( { size: pointSize, vertexColors: THREE.VertexColors }  );
        pointcloud = new THREE.PointCloud( pointcloud_geometry, material );
        model.add(pointcloud);
        //pointcloud.visible = false;
    }

    if (!(camera_name===false)) {
        i = 0;
        var avgpos = new THREE.Vector3(0,0,0);
        while (i<cameras.length) {
            avgpos.add(cameras[i].pos);
            i++;
        }
        avgpos.multiplyScalar(1/num_cameras);
        //controls.target.set(avgpos.x,avgpos.y,avgpos.z);
        camera.lookAt(avgpos);
        controls.target.copy(avgpos);
    }
}

function createArrow(p, q, col) {
    var dir = new THREE.Vector3(0, 0, 1);
    dir = dir.applyQuaternion(q);
    var origin = new THREE.Vector3(p.x, p.y, p.z);
    var length = 0.1*sc;
    var hex = 0x0000ff;
    if (col) { //console.log(col)
        hex = parseInt(col, 16);
    }

    var arrowHelper = new THREE.ArrowHelper(dir, origin, length, hex);
    arrows.add(arrowHelper);
    return arrowHelper;
}

function setCamera(cam) {
    var p = cam.pos, q = new THREE.Quaternion();
    q.copy(cam.q);
    //console.log("xyzw:" + q.x + ", " + q.y + ", " + q.z + ", " + q.w + " + p :" + p.x + ", " + p.y + ", " + p.z);

    //p = p.add(new THREE.Vector3(0,0,1000).applyQuaternion(q));
    camera.position.set(p.x,p.y,p.z);
    var v = new THREE.Vector3(0,0,1000).applyQuaternion(q);
    v.add(cam.pos);
    controls.target = v;
    controls.enableLook = false;
    controls.autoRotate = false;

    controls.update();
    
    var xq = new THREE.Quaternion(1,0,0,0);

    q.multiply(xq);
    camera.quaternion.copy(q);
    camera.updateMatrixWorld();
    var scr = renderer.domElement;
    // if (canvas_inner) {
    //     if (scr.width/scr.height<canvas_inner.w/canvas_inner.h) {
    //         camera.setLens(scr.width*cam.focal_length/canvas_inner.w,scr.width); 
    //     } else {
    //         camera.setLens(scr.height*cam.focal_length/canvas_inner.h,scr.height); 
    //     }
    // }
    console.log("scr   : " + scr.width + ", " + scr.height);
    console.log("canvas: " + size.vw + ", " + size.vh);
    camera.setLens(cam.focal_length,size.vh); 
    //camera.setLens(scr.height*cam.focal_length/canvas_inner.h,canvas_inner.h); 
    //camera.setLens(scr.width*cam.focal_length/canvas_inner.w,scr.width); 

}