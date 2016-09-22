var fs = require('fs');
var path = require('path');
var assert = require('assert');

// switch to 'development' for more verbose logging
process.env.NODE_ENV = 'production'
var millstone = require('../');
var tests = module.exports = {};
var rm = require('./support.js').rm;
var platformPath = require('./support.js').platformPath;
var newline = require('./support.js').newline;

var existsSync = require('fs').existsSync || require('path').existsSync;
var cachePath = '/tmp/millstone-test';

before(function(){
  rm(cachePath);
});


it('correctly localizes remote image/svg files', function(done) {
    var mml = JSON.parse(fs.readFileSync(path.join(__dirname, 'markers/project.mml')));

    var options = {
        mml: mml,
        base: path.join(__dirname, 'markers'),
        cache: cachePath
    };



    millstone.resolve(options, function(err, resolved) {
		var path1 = platformPath('/tmp/millstone-test/e33af80e-Cup_of_coffee.svg');
		var path2 = platformPath('/tmp/millstone-test/c953e0d1-pin-m-fast-food+AA0000.png');
		var path3 = platformPath('/tmp/millstone-test/7b9b9979-fff&text=x/7b9b9979-fff&text=x.png');
    
        assert.equal(err,undefined,err);
        assert.equal(resolved.Stylesheet[0].id, 'style.mss');
        assert.equal(resolved.Stylesheet[0].data, '// a url like https:example.com in the comments'+newline+'#points { one/marker-file: url(\''+path1+'\'); two/marker-file: url(\''+path1+'\'); four/marker-file: url("'+path2+'"); five/marker-file:url("'+path3+'"); }'+newline);
        assert.deepEqual(resolved.Layer, [
            {
                "name": "points",
                "Datasource": {
                    "file": path.join(__dirname, 'markers/layers/points.csv'),
                    "type": "csv"
                },
                "srs": "+proj=longlat +ellps=WGS84 +datum=WGS84 +no_defs"
            }
        ]);
        done();
    });
});

it('correctly localizes zipped json', function(done) {
    return done(); //skipped because zip handling is removed
    var mml = JSON.parse(fs.readFileSync(path.join(__dirname, 'zipped-json/project.mml')));

    var options = {
        mml: mml,
        base: path.join(__dirname, 'zipped-json'),
        cache: cachePath
    };

    millstone.resolve(options, function(err, resolved) {
		var pathStr = platformPath(cachePath + '/7e482cc8-polygons.json/7e482cc8-polygons.json.json');
		
        assert.equal(err,undefined,err);
        assert.equal(resolved.Stylesheet[0].id, 'style.mss');
        assert.equal(resolved.Stylesheet[0].data, '#polygon { }');
        var expected = [
            {
                "name": "polygons-zipped",
                "Datasource": {
                    "file": pathStr,
                    "type": "ogr",
                    "layer_by_index":0
                },
                "srs": '+proj=longlat +ellps=WGS84 +datum=WGS84 +no_defs'
            }
        ];
        assert.deepEqual(resolved.Layer, expected);
        done();
    });
});
