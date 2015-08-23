exports.read = read;
var fs = require('fs');
var path = require('path');
/*
options = { 
file: "51.nvm"
reduce : make reduction file REDUCED0.txt ect..
callback : call when complete, function(models, options)
paused : false, set to true to pause midway
read_pointcloud : set to true to extract pointcloud info (slow!)
camera_dict : probably no longer needed
}
*/
function read (options) {
	// LOGGING HELPERS
	tag = "NVM_READ : ";
	function log(text) {console.log(tag + text)}

	options.file = path.resolve(options.file)

	if (!fs.existsSync(options.file)) {
		log("file " + options.file +" does not exist! aborting..");
		return;
	}

	var s_index = 0;
	file = {
		name:path.resolve("reducedNVM" + s_index + ".txt"),
		next: function() {
			s_index++;
			file.name = path.resolve("reducedNVM" + s_index + ".txt");
		}
	};

	if (options.reduce) {
		log("reducing nvm to " + file.name)
		var s = fs.createWriteStream(file.name);
		s.on('error', function(e) {log(e);});
	}
	var state = -2;
	var state_hist = {};

	var models = [];
	// {cameras: , numpoints, file: }
	var camera_num = 0;
	var cameras = [];
	camera_dict = {};
 	var pointcloud_num = 0;
 	var pointcloud = [];
 	var max_point_len = (16*3) + (4*3) - 1; // = 59 truncate string to save processing extraneous data
 	// e.g. -0.807662521109 -0.211445693976 -0.211445693976 128 255 240 ... (extra data here)

	var everyThingWentAsExpected = true;
	
	fs.readFile(options.file, {encoding: 'utf-8'}, function(err, data) {
		if (err) {log("ERROR: " + err); return;}
		var lines = data.split('\n');
		log("starting... " + options.file +", " + lines.length + " lines found");
		readLine(0, lines);

	});


	function finishedReading() {
		log("finished reading: now invoking callback with " + models.length + " models");
		if (typeof options.callback == "function") options.callback(models, options);
		else log("no valid callback...");
	}

	function readLine(line_num, lines) {
			
		var line = lines[line_num];
		if (!line) {finishedReading();return;}
 		if (options.paused) {log("read_nvm was paused!"); finishedReading();return;}
		if (line_num+1 % 100 == 0) {
			console.log("lineNum : " + line_num)
			console.log("state_hist: "+ JSON.stringify(state_hist));
		}
		//console.log(line);
		var autoNext = true;
		var p = parseFloat;
		var pi = parseInt;    // pause emitting of lines...
		    // lr.pause();
		    //console.log("state : " + state + ", " + line.slice(0,40));

	    if (state!=10 && line.slice(0,1)=="#") {
	    	// finish off the last model
	    	log( "done with reading " + file.name);
	    	//console.log(line)
	    	var model = {cameras:cameras, pointcloud:pointcloud, file: file.name, reduced: options.reduce}
	    	models.push(model);
	    	if (options.camera_dict) {
	    		for (var i = 0; i < cameras.length ; i++) {
		    		//if (cam.file_name)
		    		var cam = cameras[i];
		    		//console.log(cam.file_name + " = " + (models.length-1));
		    		options.camera_dict[cam.file_name] = models[models.length - 1];
	    		}
	    	}
	    	cameras = [];
	    	pointcloud = [];
	    	// s.end();

	    	state = 10;
	    	log( "ending file read due to '#'");
	    	if (everyThingWentAsExpected) log( "everyThingWentAsExpected=true :)");
	    	else log( "everything DID NOT GoAsExpected! :(");

	    	log( "finished processing, state = " + state);
	    	autoNext= false;
	    	finishedReading();
	    	return;
	    } else switch (state) {
		    case -2:  // start of file
			    if (options.reduce) s.write(line + "\r\n");

		    	if (line.slice(0,6)=="NVM_V3") {
		    		log( "is valid NVM");
		    		state = -1;
		    	}
		    	break;
		   	case -1: // skip empty lines and search for camera_num
			   	if (options.reduce) s.write(line + "\r\n");

		   		if (line.split(" ").length<2) {
		   			if (!isNaN(parseInt(line))) {
		   				camera_num = parseInt(line);
		   				log( "expecting " + camera_num + " cameras");
		   				if (camera_num==0) {
		   					state = 1;
		   				} else {
			   				state = 0;
	   					}
		   			}
		   		}
		   		break;
		   	case 0: // adding cameras to list
		   		if (options.reduce) s.write(line + "\r\n");

		   		if (line.length<2) {
		   			state = 1;
		   			log( cameras.length + " cameras found, " + camera_num + " expected");
		   			if (!(cameras.length == camera_num)) {everyThingWentAsExpected = false;}

		   		} else {
		   			var cam = line.split(/[ \t]+/);
		   			// cam[10] == "0"
		   			if (cam.length>9) {
		                var newCam = {
		                	file_name: cam[0] , focal_length: p(cam[1]) , 
		                	q: {x:-p(cam[3]), y:-p(cam[4]), z:-p(cam[5]), w:p(cam[2])} , 
		                	pos: { x: p(cam[6]), y:p(cam[7]), z:p(cam[8])}, 
		                	radial_distortion: p(cam[9])
		                	};

		                cameras.push(newCam);
		            }
		   		}
			   	
		   		break;
		   	case 1: // search for pointcloud num
		   		if (options.reduce) s.write(line + "\r\n");

		   		if (!(line.length<2)) {
		   			if (!isNaN(parseInt(line))) {
			   		 	pointcloud_num = parseInt(line);
			   		 	if (!options.read_pointcloud && !options.reduce) {
			   		 		state = 3;
			   		 		if (pointcloud_num==0) {
			   		 			// line can stay the same
			   		 		} else {
			   		 			line_num += pointcloud_num;
			   		 		}
			   		 		console.log(lines[line_num]);
			   		 		console.log(lines[line_num+1]);
			   		 	} else if (pointcloud_num==0) {
			   				state = 3;
			   			} else {
				   			state = 2;
				   		}
			   			log( pointcloud_num + " pointcloud expected, now on line " + line_num);
		   			}
		   		}
		   		break;
		   	case 2: // find points
		   		if (line.length<2) {
		   			
		   			state = 3;
		   			log( pointcloud.length + " points found, " + pointcloud_num )
		   			console.log(line)
		   			if (!(pointcloud.length == pointcloud_num)) {everyThingWentAsExpected = false;}
		   		
		   		} else {
		   			var pt = line.slice(0,max_point_len).split(/[ \t]+/);
		   			if (pt.length>=6) {
		   				if (options.reduce) s.write(pt[0] + " " + pt[1] + " " + pt[2] + " " + pt[3] + " " + pt[4] + " " + pt[5] + "\r\n");

			   			pointcloud.push({
			   				p:{ x:p(pt[0]) , y:p(pt[1]) , z:p(pt[2]) } ,
			   				col : { r:pi(pt[3]) , g:pi(pt[4]) , b:pi(pt[5]) }
			   			});

			   		} else {
			   			console.log( tag + " point has not enough variables : " + pt.length);
			   		}
		   		}
		   		break;
		   	case 3:
		   		log( "done with reading " + file.name);
		   		console.log(line)
		   		models.push({cameras:cameras, pointcloud:pointcloud, file: file.name});
		   		for (var i = 0; i < cameras.length ; i++) {
		   			//if (cam.file_name)
		   			var cam = cameras[i];
		   			//console.log(cam.file_name + " = " + (models.length-1));
		   			camera_dict[cam.file_name] = models[models.length - 1];
		   		}
		   		cameras = [];
		   		pointcloud = [];
		   		state=-1;


	   			if (options.reduce) {
		   			file.next();
		   			log( "creating new file:" +file.name);
	   				s = fs.createWriteStream(file.name);

		   			s.on('error', function(e) {log( e);});
		   			s.on('open', function() {
		   				s.write("NVM_V3\r\n");
		   				readLine(line_num+1, lines);
		   			});
	   				return;
	   			}
		   		break;
		   	case 10:
		   		finishedReading();
		   		return;
		   		break;
	   	}
	   	if (state_hist[state]) state_hist[state]++;
	   	else state_hist[state] = 1;
	    // ...and continue emitting lines.
	    setTimeout(function() {readLine(line_num+1, lines)}, 0);
	}
}