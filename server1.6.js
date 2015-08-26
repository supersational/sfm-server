/*Define dependencies.*/

var express       = require("express");
var child_process = require('child_process');
var fs            = require('fs');
var path          = require('path');
var util          = require('util');
var qs            = require('querystring');
var app           = express();
var nvm_reader    = require('./nvm_reader.js');
var done          = false;
var folder        = path.join(__dirname, 'uploads\\'); // should be \\?
console.log("INIT : using folder " + folder);
var sfm           = {
	exists:false, 
	active: false, 
	next: function(){
		if (!sfm.exists) {return folder+'1.nvm'} 
		else {return (folder + (parseInt(sfm.exists.split('\\').pop())+1).toString() + '.nvm')}
}};
var jpgs          = []; 
// file_name - canvasimg123.jpg , used - (1:no, 2:pending processing, 3:processed, 4: reduced),
// model_file - (if processed) e.g. "51.nvm", reduced_file: (if state 3) "reducedNVM.txt".
// skipsfm
var jpgs_lookup   = {};
var jpgs_unprocessed = [];
var jpg_needs_camera = false;
var models = [];
var camera_dict = {};
console.log("INIT : started.. reading directory " +  folder);

if (!fs.existsSync(folder)){
    fs.mkdirSync(folder);
}
files = fs.readdirSync(folder);
//console.log("INIT : " + JSON.stringify(files));
for (var i=0; i<files.length; i++) {
	new_file(files[i]);
}
if (sfm.exists) {
	console.log("INIT : highest .nvm = " + sfm.exists);
	read_sfm(function(){
		console.log("INIT :" + JSON.stringify(sfm));
		run_sfm();
		setInterval(run_sfm,1000);
	});
} else {
	console.log("INIT : no .nvm file... creating");
	run_sfm();
	setInterval(run_sfm,1000);

}






function new_file(file) {
	var ext = file.split('.').pop();
	if (ext == 'nvm') {
		if (sfm.exists) {
			prev = parseInt(sfm.exists.split('\\').pop().slice(0,-4));
			candidate = parseInt(file.slice(0,-4));
			//console.log( prev + ' vs ' + candidate);
			if (candidate>prev) {
				//console.log('better .nvm found! : ' + file);
				sfm.exists = folder + file;
			}
		} else {
			sfm.exists = folder + file;
			//console.log('found .nvm ' + file)
		}
	} 
	else if (ext == 'jpg' || ext == 'mat' || ext == 'sift') {
		var name = file.slice(0,-1-ext.length); 
		var jpg = jpgs_lookup[name+".jpg"];
		if (!jpg) {
			jpgs.push({file_name:name+".jpg", sift: false, mat: false, img: false, used: 0});
			jpg = jpgs_lookup[name+".jpg"] = jpgs[jpgs.length-1];
		}
		if (ext == 'jpg') jpg.img = true;
		if (ext == 'mat') jpg.mat = true;
		if (ext == 'sift') jpg.sift = true;
	} else if (ext == 'txt') {}
	else console.log("INIT : unknown filetype found" , file);
}

function read_sfm(callback_when_completed) {
	if (!sfm.exists) {console.log("no .nvm file to read! aborting..."); return;}

	//console.log('RSFM: read ' + i + 'lines, found ' + numCameras +" cameras, " + models.length + " models");	
	var reader_options = {
		file:sfm.exists,
		paused:false,
		callback:function(new_models, options) {
			set_models(new_models, options);
			if (typeof callback_when_completed == "function") callback_when_completed(); // this is so the main thread can wait till files have been processed :D
		}
	};
	nvm_reader.read(reader_options);
	//setTimeout(function() { console.log("pauseing");reader_options.paused = true}, 3000);

}

function set_models(new_models, options) {
	models = new_models;
	console.log("importing new model list (" + models.length + " models)");
	for (var mod_idx=0; mod_idx<models.length; mod_idx++) {
		var camList = models[mod_idx].cameras;
		for( var cam_idx = 0; cam_idx < camList.length ; cam_idx++) {
			//console.log(camList[cam_idx]);
			var jpg = jpgs_lookup[camList[cam_idx].file_name];
			if (jpg) {
				jpg.model_index = {mod_idx:mod_idx, cam_idx:cam_idx};
				if (options.file) jpg.model_file = options.file; // e.g. 51.nvm
				if (jpg.used<3) {
					jpg.used = 3;
					console.log(jpg.file_name + " found! (set used to 3)");
				} else {
					//console.log(jpg.file_name + " already found");
				}
				if (models[mod_idx].reduced) {
						console.log(jpg.file_name + " reduced! setting reduced_file to " + models[mod_idx].file)
						jpg.used = 4; // show has been reduced too!
						jpg.reduced_file = models[mod_idx].file;
				} 
			} else {
				console.log(camList[cam_idx].file_name + " not found..");
			}
		}
	} 
}

// gets called every second
function run_sfm(options) {
	if (sfm.active) {console.log("sfm already running!"); return false;}
	sfm.active = true;
	var sfm_filename = sfm.next();
	var jpgs_unused = [];

	if (typeof options==='undefined') {
		if (!sfm.exists) { 
			console.log("PRESFM : first run of sfm so loading all images")
			// sfm_filename = sfm.next();
			options = ['sfm',folder,sfm_filename];
		}
		else {
			// check for unprocessed jpgs
			var jpgs_unused_string = "";
			for (var i = 0; i < jpgs.length; i++) {
				if (jpgs[i].used == 0) {
					console.log(jpgs[i]);
					if (jpgs[i].skipsfm) { // asking for priority processing
						jpg_needs_camera = jpgs[i];
					} else {
						jpgs_unused.push(jpgs[i]);
						jpgs_unused_string = jpgs_unused_string  + jpgs[i].file_name + "\r\n";
					}
				}
			}
			// check for if we need to do a camera lookup (and ignore any other pending shizzle)
			if (jpg_needs_camera && jpg_needs_camera.used < 2) { // if there is pending camera which has not been processed (added in 1.6)
				console.log("jpg_needs_camera!! " + jpg_needs_camera.file_name)
				fs.writeFileSync(sfm.exists + ".txt", jpg_needs_camera.file_name + "\r\n");
				if (jpg_needs_camera.recentNum) { // only match with most recent N camaeras to save time
					var d = new Date();
			        var name = folder + 'pairs' + d.valueOf() +  '.txt';
			        var good_cameras=[];
			        var bad_cameras =[];
			        var i = 0;
	       			while ((good_cameras.length<jpg_needs_camera.recentNum) && i <= jpgs.length-1) { // find most recent cameras
	       				var j = jpgs[jpgs.length-1-i]; // get most recent jpg 
	       				if (j && j.file_name && j.file_name !== jpg_needs_camera.file_name) { // if not same jpg as before
	       					if (j.used > 2 
		       					&& j.model_index.mod_idx in models 
		       					&& models[j.model_index.mod_idx].pointcloud_num > 0
		       				    && j.model_index.cam_idx in models[j.model_index.mod_idx].cameras) { 
	       				    	// check distance to other cameras
	       						var cam = models[j.model_index.mod_idx].cameras[j.model_index.cam_idx];
	       						console.log("position is " + cam.pos.x + ", " + cam.pos.y + ", " + cam.pos.z);
	       						var minDist = 999999999999;
	       						good_cameras.forEach(function(c) { // find minimum distance to all cameras we already have
	       							if (c.pos) minDist = Math.min(minDist, Math.pow( Math.pow(c.pos.x-cam.pos.x,2) + Math.pow(c.pos.y-cam.pos.y,2) + Math.pow(c.pos.z-cam.pos.z,2), 0.5)); 
	       						});
	       						bad_cameras.forEach(function(c) { // find minimum distance to all cameras we already have
	       							if (c.pos) minDist = Math.min(minDist, Math.pow( Math.pow(c.pos.x-cam.pos.x,2) + Math.pow(c.pos.y-cam.pos.y,2) + Math.pow(c.pos.z-cam.pos.z,2), 0.5)); 
	       						});
	       						console.log("minDist is " + minDist);
	       						if (minDist > 1) { // TODO : adapt dist to different scenarios, include rotations? 
	       							console.log("> 2 so adding to list");
	       							good_cameras.push(cam);
	       						} else {
	       							console.log("< 2 so adding to list BUT as a 'bad camera'");
	       							bad_cameras.push(cam);
	       						}
	       					} else {
	       						console.log("camera wasn't used in the model so not even adding to 'bad cameras'")
	       						console.log(JSON.stringify(j));
	       					}
	       				}
	       				i++;
	       			}
	       			console.log("finished search with " + good_cameras.length + " good_cameras and "+ bad_cameras.length + " bad_cameras");
	       			var numAdded = 0;
			        var contents = "";
			        good_cameras.forEach(function(c) {
			        	if (c.file_name) {
			        		contents += jpg_needs_camera.file_name + " " + c.file_name + "\r\n";
			        		numAdded++
			        	}
			        });
			        console.log(contents);
			        if (numAdded<jpg_needs_camera.recentNum) { // if we still dont have enough
			        	good_cameras.forEach(function(c) {
				        	if (c.file_name && numAdded<jpg_needs_camera.recentNum) {
				        		contents += jpg_needs_camera.file_name + " " + c.file_name + "\r\n";
				        		numAdded++
				        	}
				        });
			        }
	       			console.log("PRESFM : " + numAdded + " pairs on list, writing to " + name);
					fs.writeFileSync(name, contents);
					options = ['sfm+pairs+resume',sfm.exists, sfm_filename, name]; // +subset could work here? 1.6
				} else {
					options = ['sfm+resume',sfm.exists, sfm_filename]; // +subset could work here? 1.6
				}
				jpgs_unused = [];
			}
			// create file and run sfm
			else if (jpgs_unused.length>0) {

				console.log("PRESFM : new jpgs for processing!");
				console.log(jpgs_unused_string);
				fs.writeFileSync(sfm.exists + ".txt", jpgs_unused_string);	
				options = ['sfm+resume',sfm.exists, sfm_filename];
				for (var i = 0; i < jpgs_unused.length; i++) {
					jpgs_unused[i].used = 1; // "on the processing list"
				}
			}
			else {
				//console.log("SFM : no new jpgs to process..");
				sfm.active = false;
				return false;
			}
		}
	}
	//console.log("SFM : SFM STARTED...");

	console.log('PRESFM : spawing sfm with options ' + options);
	var spawn = child_process.spawn;
	var child = spawn('VisualSFM',options); // options go in ,[,]);
	child.stdout.setEncoding('utf8');

	child.stdout.on('data',function(data) {
		var logAllData = true;
		var strout = data.toString();
		//console.log(" data : " + strout.split(0,5));
		var lines = strout.split('\n');
		var i = 0;
		//console.log("length " + lines.length)
		while (i<lines.length) {
			var l = lines[i].toLowerCase();

			if(logAllData || l.indexOf("finished")>-1 || l.indexOf("model(s)")>-1|| l.indexOf("load ")>-1 || l.indexOf("enter to continue")>-1 || l.indexOf("error")>-1){
				lines[i].replace(/\r?\n|\r/,"")
				console.log("SFM: " + lines[i]);
			}
			i++;
		}
		if (strout.indexOf('Press ENTER to continue...')!==-1) {
			//var msg = '\n';
			//console.log("sending " + msg);
			//child.stdin.write(msg);
		}
	});
	child.stderr.on('data', function (data) {
		console.log('SFM: stderr: ' + data);
	});
	child.on('close', function (code) {
		console.log('SFM: child process exited with code ' + code);

		for (var i = 0; i < jpgs_unused.length; i++) {
			if (jpgs_unused[i].used == 1) { // if jpg was on processing list
				jpgs_unused[i].used = 2; // "has been processed" (but not definitely in model)
			}
		}
		if (jpg_needs_camera) {
			jpg_needs_camera.used = 2; // TODO handle errors
		}

		if (fs.existsSync(sfm_filename)) {
			sfm.exists = sfm_filename;
			var reader_options = {file:sfm.exists, callback:set_models, paused:false};
			nvm_reader.read(reader_options);
		} else {
			console.log("sfm_filename " + sfm_filename + " not found!")
		}
		sfm.active = false;
	});
}

/*Handling routes.*/

app.get('/',function(req,res){
	console.log("index.html");
    res.sendFile(__dirname + "/static/index.html");
});

app.get('/latestNVM.nvm',function(req,res){
	console.log("GET  : /latestNVM, serving " + sfm.exists );
	if (sfm.exists) {
		res.sendFile(sfm.exists);
	} else {
		res.end('<!doctype html><html><head><title>Unlucky mate!</title></head><body>No SFM exists yet</body></html>');
	}
});

app.get('/model*', function(req, res) {
	console.log("REQ : serving " + req.url);
	var cam = req.query.cam;
	if (cam) {
		if (jpgs_lookup[cam]) { // TODO : this file should be model_file or reduced_file
			var jpg = jpgs_lookup[cam];
			var fileName = null;
			if (jpg.used >= 3 && jpg.model_file) {
				fileName = path.resolve(jpg.model_file);
			}
			if ( jpg.used >= 4 && jpg.reduced_file) { // reduced file is more efficient so use that if possible
				fileName = path.resolve(jpg.reduced_file);
			}
			console.log("fileName = " + fileName);
			if (fileName) {
				if (fs.existsSync(fileName)) {
					res.sendFile(fileName);
					var stats = fs.statSync(fileName);
					var fileSizeInBytes = stats["size"];
					//Convert the file size to megabytes 
					var fileSizeInMegabytes = fileSizeInBytes / 1000000.0;
					console.log("REQ : " + "sent " + fileSizeInMegabytes + "MB, " + fileName);
				} else {
					console.log("REQ : file " + fileName + " was not found");
					res.send("OK, recieved camera <br>" + cam + " and the jpg " + jpg.file_name + "<br> used = " + jpg.used + " .... but <br>" + fileName + " doesn't exist :(");
				}
			} else {
				console.log("REQ : cam has no associated file. (used = " + jpg.used + ")");
				res.send("OK, recieved camera <br>" + cam + " and the jpg " + jpg.file_name + "<br> used = " + jpg.used + " .... but no associated file :(");
			}
			// if (jpgs_lookup[cam].file) {
			// 	var fileName = path.join(__dirname , jpgs_lookup[cam].file);
			// 	if (fs.existsSync(fileName)) {
			// 		res.sendFile(fileName);
			// 		var stats = fs.statSync(fileName);
			// 		var fileSizeInBytes = stats["size"];
			// 		//Convert the file size to megabytes 
			// 		var fileSizeInMegabytes = fileSizeInBytes / 1000000.0;
			// 		console.log("REQ : " + "sent " + fileSizeInMegabytes + "MB, " + fileName);
			// 	} else {
			// 	}
			// } else {
			// }
		} else {
			res.send("NO, jpgs_lookup[" + cam + "] not found");
		}
	} else if (req.query.index) {
		var fileName = path.join(__dirname , jpgs_lookup[cam].file);
		if (fs.existsSync(fileName)) {
			res.sendFile(fileName);
			var stats = fs.statSync(fileName);
			var fileSizeInBytes = stats["size"];
			//Convert the file size to megabytes 
			var fileSizeInMegabytes = fileSizeInBytes / 1000000.0;
			console.log("REQ : " + "sent " + fileSizeInMegabytes + "MB, " + fileName);
		} else {
			res.send("OK, found camera <br>" + cam + " and the file <br>" + jpgs_lookup[cam].file + " .... but <br>" + fileName + " doesn't exist :(");
		}
	} else {
		console.log("REQ : no valid query");
		res.send("NO valid query" +  util.inspect(req.query));
	}

//	res.send(util.inspect(req.params) + "<br>" + util.inspect(req));
});

var time_from_last_request = new Date().valueOf();
app.get('/jpgs_lookup*', function(req, res) {
	
	if (time_from_last_request<new Date().valueOf()-2000) {
		time_from_last_request = new Date().valueOf();
		console.log("REQ : serving " + req.url);
	}
	var jpg = req.query.jpg;
	if (jpg) {
		//console.log(jpg)
		//console.log(jpgs_lookup)
		if ( jpgs_lookup[jpg]) {
			res.json({success:true, found:true , result: jpgs_lookup[jpg]});
		} else {
			res.json({success:true, found:false, result: jpgs_lookup[jpg]});
		}
	} else {
		res.json({success:false});
	}

});
app.use('/static', express.static('static'));

app.post('/dataURL', function(req,res) {
	console.log("/dataURL")
	if (req.url === "/dataURL") {
      var requestBody = '';
      req.on('data', function(data) {
        requestBody += data;
        if(requestBody.length > 1e7) { // approx 10MB
          res.writeHead(413, 'Request Entity Too Large', {'Content-Type': 'text/html'});
          res.end('<!doctype html><html><head><title>413</title></head><body>413: Resquest Entity Too Large</body></html>');
        }
      });
      req.on('end', function() {
      	console.log("recieved a " + requestBody.length + "long dataURL");
      	var old = false;
        var formData = qs.parse(requestBody);
        var beginString = 'data:image/jpeg;base64';
        // data is the first key of requestBody
        //console.log(JSON.stringify(formData));
        var data = Object.keys(formData)[0].split(',');
      	var data_start = data.shift();//data.slice(0, beginString.length);
      	var data_end = data.pop();
      	//console.log(data);
      	//if (data.length>2) console.log('data has ' + data.length + ' length! should be 2!')
        //console.log(formData)
        //var formData = req.split(",");
        var dataUrl =  '';
        if (old) res.writeHead(200, {'Content-Type': 'text/html'});
        if (old) res.write('<!doctype html><html><head><title>Response</title></head><body>');
        // if (old) res.write('Thanks for the data!<br />data: '+util.inspect(req));
        if (old) res.write('Thanks for the data!<br /> ' + data_start + '<br /> length : ' + data_end.length +'<br /> <input type="submit" value="btn" onclick="toggle();"></input>  <div id="toggle" style="display:none">'+ requestBody + "</div>");
        if (data_start==beginString) {
        	if (old) res.write('<br /> correct start.. now decoding data');
	        var buffer = new Buffer(data_end, 'base64');

	        function decodeBase64Image(dataString) {
	          var matches = dataString.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/),
	            res = {};

	          if (matches.length !== 3) {
	            return new Error('Invalid input string');
	          }

	          res.type = matches[1];
	          res.data = new Buffer(matches[2], 'base64');

	          return res;
	        }

	        var imageBuffer = decodeBase64Image(requestBody);
	        
	        var d = new Date();
	        var name = 'canvasimg' + d.valueOf() +  '.jpg';
	        console.log('writing file ' + name);
	        res.json({success:true, name: name})
	        var callback = function() {
	        	console.log("file " + name + " finished uploading");
	        	new_file(name);
	        	var jpg = jpgs_lookup[name];
	        	jpg.skipsfm = true;
	        	jpg.recentNum = 1;
	        };

	        fs.writeFile('uploads/' + name, imageBuffer.data, function(err) {console.log(err);}, callback);
	        // fs.writeFile(name, data_end, 'base64', function(err) {console.log(err);}, callback);
	    } else {
	    	if (old) res.write('<br /> incorrect start of string!' + data_start.length + ", " + beginString.length);
	    	res.json({success:false, name:null})
	    }
        if (old) res.end('</body></html>');
      });
    } else {
      res.writeHead(404, 'Resource Not Found', {'Content-Type': 'text/html'});
      res.end('<!doctype html><html><head><title>404</title></head><body>404: Resource Not Found</body></html>');
    }
});



/*Run the server.*/
app.listen(3000,function(){
    console.log("Working on port 3000");
});