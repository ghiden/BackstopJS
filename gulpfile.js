var gulp = require('gulp');
var del = require('del');
var open = require("gulp-open");
var spawn = require('child_process').spawn;
var exec = require('child_process').exec;
var fs = require('fs');

var serverPidFile = __dirname+'/server.pid';
var bitmaps_reference = __dirname+'/bitmaps_reference';
var bitmaps_test = 'bitmaps_test';
var compareConfigFileName = __dirname+'/compare/config.json'
var compareReportURL = 'http://localhost:3000/compare/'

//Default config for report (compare) app
var configDefault = {
	"testPairs": []
};

var genDefaultConfig = function genDefaultConfig(){fs.writeFileSync(compareConfigFileName, JSON.stringify(configDefault,null,2));}


if(!fs.existsSync(compareConfigFileName)){
	console.log('No config.json file exists. Creating default file.')
	genDefaultConfig();
}

var config = JSON.parse(fs.readFileSync(compareConfigFileName, 'utf8'));

if(!config.testPairs||config.testPairs.length==0){
	console.log('No config data found.');
	config=configDefault;
}

var watcher = null;



//FIRST CLEAN REFERENCE DIR.  THEN TEST
gulp.task('reference', ['clean','test'], function() {
	console.log('reference has run.')
});



//CLEAN THE bitmaps_reference DIRECTORY
gulp.task('clean', function (cb) {
	del([
		bitmaps_reference + '/**'
	], cb);
	genDefaultConfig();
	console.log('bitmaps_reference was cleaned.');
});



//This task will generate a date-named directory with DOM screenshot files as specified in `./capture/config.json` followed by running a report.
//NOTE: If there is no bitmaps_reference directory or if the bitmaps_reference directory is empty then a new batch of reference files will be generated in the bitmaps_reference directory.  Reporting will be skipped in this case.
gulp.task('test', function () {

	var genReferenceMode = false;

	if(!fs.existsSync(bitmaps_reference)){
		console.log('\n*** No bitmaps_reference directory found. Now generating reference files.***\n')
		genReferenceMode = true;
	}

	var tests = ['capture/genBitmaps.js'];
	
	// var args = ['test'].concat(tests); //this is required if using casperjs test option
	
	var casperChild = spawn('casperjs', tests);//use args here to add test option to casperjs execute stmt

	casperChild.stdout.on('data', function (data) {
		console.log('CasperJS:', data.toString().slice(0, -1)); // Remove \n
	});


	casperChild.on('close', function (code) {
		var success = code === 0; // Will be 1 in the event of failure
		var result = (success)?'test file generation completed':'testing script failed with code: '+code;
	
		console.log('\n'+result);

		//exit if there was some kind of failure in the casperChild process
		if(code!=0)return false;
		

		var resultConfig = JSON.parse(fs.readFileSync(compareConfigFileName, 'utf8'));
		if(genReferenceMode || !resultConfig.testPairs||resultConfig.testPairs.length==0){
			console.log('\nRun `$ gulp test` to generate diff report.\n')
		}else{
			gulp.run('report');
		}
	
	});


});



gulp.task('report',['startServer'],function(){
	setTimeout(function(){gulp.run('openReport')},100)
	setTimeout(function(){gulp.run('stopServer')},5000)
})



gulp.task("openReport", function(){
	
	console.log('\nOpening report -> ',compareReportURL);

	var options = {
		url: compareReportURL
		,app: "Google Chrome"
	};

	gulp.src(compareConfigFileName)
		.pipe(open("",options)); 

});



gulp.task("startServer",function(){


	fs.readFile(serverPidFile, function(err,data){

		if(data){
			exec('kill -0 '+data,function(error, stdout, stderr){
				if(/no such process/i.test(stderr))
					start();
			});

		}else{
			start();
		}
		
	});


	function start(){
		var serverHook = spawn('node', ['server.js'],  {detached: true, stdio:'ignore'});
		serverHook.unref();
		fs.writeFileSync(serverPidFile,serverHook.pid);
		console.log('Server launched with PID: '+serverHook.pid)
	}

	
});



gulp.task("stopServer",function(){

	fs.readFile(serverPidFile, function(err,pid){
		if(pid){
			exec('kill '+pid,function(error, stdout, stderr){
				console.log('Stopped PID:'+pid)
				fs.unlinkSync(serverPidFile);
			});
		}
	});

});

