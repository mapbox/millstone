var fs = require('fs');
var path = require('path');
var assert = require('assert');
var millstone = require('../lib/millstone');
var util = require('../lib/util');
var tests = module.exports = {};

// Recursive, synchronous rm.
function rm(filepath) {
    var stat;
    var files;

    try { stat = fs.lstatSync(filepath); } catch(e) { throw e; }

    // File.
    if (stat.isFile() || stat.isSymbolicLink()) {
        return fs.unlinkSync(filepath);
    // Directory.
    } else if (stat.isDirectory()) {
        try { files = fs.readdirSync(filepath); } catch(e) { throw e; }
        files.forEach(function(file) {
            try { rm(path.join(filepath, file)); } catch(e) { throw e; }
        });
        try { fs.rmdirSync(filepath); } catch(e) { throw e; }
    // Other?
    } else {
        throw new Error('Unrecognized file.');
    }
}

it('correctly detects content-disposition from kml', function() {
    // https://github.com/mapbox/millstone/issues/37
    var header = {
       'content-disposition':'attachment; filename="New York City\'s Solidarity Economy.kml"'
    };
    var res = millstone.guessExtension(header)
    assert.equal(res,'.kml');
});

it('correctly detects content-disposition from google docs csv', function() {
    // google docs
    var header = {
       'content-disposition':'attachment; filename="Untitledspreadsheet.csv"'
    };
    var res = millstone.guessExtension(header)
    assert.equal(res,'.csv');
});

it('correctly detects content-disposition from geoserver', function() {
    // https://github.com/mapbox/millstone/issues/27
    // geoserver
    var header = {
       'content-disposition':"attachment; filename=foo.csv"
    };
    var res = millstone.guessExtension(header)
    assert.equal(res,'.csv');
});

it('correctly detects content-disposition from cartodb', function() {
    // cartodb
    var header = {
       'content-disposition':'inline; filename=cartodb-query.geojson; modification-date="Thu, 10 Nov 2011 19:53:40 GMT";'
    };
    var res = millstone.guessExtension(header)
    assert.equal(res,'.geojson');
});

it('correctly detects content-type bin', function() {
    var header = {
       'content-type':'application/octet-stream'
    };
    var res = millstone.guessExtension(header)
    assert.equal(res,'.bin');
});

it('correctly detects geoserver/datacouch csv content-type', function() {
    var header = {
       'content-type':'text/csv; charset=UTF-8'
    };
    var res = millstone.guessExtension(header)
    assert.equal(res,'.csv');
});


describe('isRelative', function() {

    var realPlatform = process.platform; // Store real platform

    afterEach(function() {
        process.platform = realPlatform;
    });


    it('detects C:\\ as an absolute path on Windows', function() {
        process.platform = 'win32';
        var path = 'C:\\some\\path';
        var res = millstone.isRelative(path);
        assert.equal(res, false);
    });

    it('detects C:\\ as relative path on non-Windows', function() {
        process.platform = 'linux';
        var path = 'C:\\some\\path';
        var res = millstone.isRelative(path);
        assert.equal(res, true);
    });

    it('detects paths starting with \\ as absolute on Windows', function() {
        process.platform = 'win32';
        var path = '\\some\\path';
        var res = millstone.isRelative(path);
        assert.equal(res, false);
    });

    it('detects paths starting with \\ as relative on non-Windows', function() {
        process.platform = 'linux';
        var path = '\\some\\path';
        var res = millstone.isRelative(path);
        assert.equal(res, true);
    });

    it('detects paths starting with / as absolute on non-Windows', function() {
        process.platform = 'linux';
        var path = '/some/path';
        var res = millstone.isRelative(path);
        assert.equal(res, false);
    });

    it('detects paths starting with / as absolute on Windows', function() {
        process.platform = 'win32';
        var path = '/some/path';
        var res = millstone.isRelative(path);
        assert.equal(res, true);
    });

});


it('correctly caches files', function(done) {
    var mml = JSON.parse(fs.readFileSync(path.join(__dirname, 'cache/cache.mml')));

    // Set absolute paths dynamically at test time.
    mml.Layer[2].Datasource.file = path.join(__dirname, 'data/absolute.json');
    mml.Layer[3].Datasource.file = path.join(__dirname, 'data/absolute/absolute.shp');

    var options = {
        mml: mml,
        base: path.join(__dirname, 'cache'),
        cache: path.join(__dirname, 'tmp')
    };

    // Copy "cached" files to mock request headers
    try {
        fs.mkdirSync(options.cache);
        fs.mkdirSync(path.join(options.cache, '9368bdd9-zip_no_ext'));
    } catch(e) {}
    var files = ['9368bdd9-zip_no_ext/9368bdd9-zip_no_ext', '9368bdd9-zip_no_ext/.9368bdd9-zip_no_ext'];
    for (var i = 0; i < files.length; i++) {
        var newFile = fs.createWriteStream(path.join(options.cache, files[i]));
        var oldFile = fs.createReadStream(path.join(__dirname, 'data', files[i]));
        oldFile.pipe(newFile);
    }

    millstone.resolve(options, function(err, resolved) {
        assert.equal(err.message, "Unable to determine SRS for layer \"sqlite-attach\" at " + path.join(__dirname, "cache/layers/countries.sqlite"));
        assert.deepEqual(resolved.Stylesheet, [
            { id:'cache-inline.mss', data:'Map { backgroound-color:#fff }' },
            { id:'cache-local.mss', data: '#world { polygon-fill: #fff }\n' },
            { id:'cache-url.mss', data:'#world { line-width:1; }\n' }
        ]);
        assert.deepEqual(resolved.Layer, [
            {
                "name": "local-json",
                "Datasource": {
                    "file": path.join(__dirname, 'cache/layers/local.json'),
                    "type": "ogr",
                    "layer_by_index": 0
                },
                "srs": "+proj=longlat +ellps=WGS84 +towgs84=0,0,0,0,0,0,0 +no_defs"
            },
            {
                "name": "local-shp",
                "Datasource": {
                    "file": path.join(__dirname, 'cache/layers/local/local.shp'),
                    "type": "shape"
                },
                "srs": "+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0.0 +k=1.0 +units=m +nadgrids=@null +wktext +no_defs +over"
            },
            {
                "name": "absolute-json",
                "Datasource": {
                    "file": path.join(__dirname, 'cache/layers/absolute-json.json'),
                    "type": "ogr",
                    "layer_by_index": 0
                },
                "srs": "+proj=longlat +ellps=WGS84 +towgs84=0,0,0,0,0,0,0 +no_defs"
            },
            {
                "name": "absolute-shp",
                "Datasource": {
                    "file": path.join(__dirname, 'cache/layers/absolute-shp/absolute.shp'),
                    "type": "shape"
                },
                "srs": "+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0.0 +k=1.0 +units=m +nadgrids=@null +wktext +no_defs +over"
            },
            {
                "name": "polygons",
                "Datasource": {
                    "file": path.join(__dirname, 'cache/layers/polygons.json'),
                    "type": "ogr",
                    "layer_by_index": 0
                },
                "srs": "+proj=longlat +ellps=WGS84 +towgs84=0,0,0,0,0,0,0 +no_defs"
            },
            {
                "name": "stations",
                "Datasource": {
                    "file": path.join(__dirname, 'cache/layers/stations/87c0c757-stations.shp'),
                    "type": "shape"
                },
                "srs": "+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0.0 +k=1.0 +units=m +nadgrids=@null +wktext +no_defs +over"
            },
            {
                "name": "csv",
                "Datasource": {
                    "file": path.join(__dirname, 'cache/layers/csv'),
                    "quiet": true,
                    "type": "csv"
                },
                "srs": "+proj=longlat +ellps=WGS84 +datum=WGS84 +no_defs"
            },
            {
                "name": 'sqlite',
                "Datasource": {
                    "file": path.join(__dirname, 'cache/layers/countries.sqlite'),
                    "type": 'sqlite',
                    "table": 'countries',
                }
            },
            {
                "name": 'sqlite-attach',
                "Datasource": {
                    "file": path.join(__dirname, 'cache/layers/countries.sqlite'),
                    "type": 'sqlite',
                    "table": 'countries',
                    "attachdb": 'data@' + path.join(__dirname, 'cache/layers/data.sqlite'),
                }
            },
            {
                "name": 'zip-no-ext',
                "Datasource": {
                    "file": path.join(__dirname, 'cache/layers/zip-no-ext/9368bdd9-zip_no_ext.shp'),
                    "type": 'shape'
                },
                "srs": '+proj=longlat +ellps=WGS84 +no_defs'
            }
        ]);

        // Check that URLs are downloaded and symlinked.
        assert.ok(path.existsSync(path.join(__dirname, 'tmp/5c505ff4-polygons.json')));
        assert.ok(path.existsSync(path.join(__dirname, 'tmp/87c0c757-stations/87c0c757-stations.shp')));
        assert.ok(fs.lstatSync(path.join(__dirname, 'cache/layers/polygons.json')).isSymbolicLink());
        assert.ok(fs.lstatSync(path.join(__dirname, 'cache/layers/stations')).isDirectory());
        assert.equal(
            fs.readFileSync(path.join(__dirname, 'tmp/5c505ff4-polygons.json'), 'utf8'),
            fs.readFileSync(path.join(__dirname, 'cache/layers/polygons.json'), 'utf8')
        );
        assert.equal(
            fs.readFileSync(path.join(__dirname, 'tmp/87c0c757-stations/87c0c757-stations.shp'), 'utf8'),
            fs.readFileSync(path.join(__dirname, 'cache/layers/stations/87c0c757-stations.shp'), 'utf8')
        );

        // Check that absolute paths are symlinked correctly.
        assert.ok(fs.lstatSync(path.join(__dirname, 'cache/layers/absolute-json.json')).isSymbolicLink());
        assert.ok(fs.lstatSync(path.join(__dirname, 'cache/layers/absolute-shp')).isDirectory());
        assert.equal(
            fs.readFileSync(path.join(__dirname, 'cache/layers/absolute-json.json'), 'utf8'),
            fs.readFileSync(path.join(__dirname, 'data/absolute.json'), 'utf8')
        );
        assert.equal(
            fs.readFileSync(path.join(__dirname, 'cache/layers/absolute-shp/absolute.shp'), 'utf8'),
            fs.readFileSync(path.join(__dirname, 'data/absolute/absolute.shp'), 'utf8')
        );

        millstone.flush({
            layer: 'stations',
            url: 'http://mapbox.github.com/millstone/test/stations.zip',
            base: options.base,
            cache: options.cache
        }, function(err) {
            assert.equal(err, undefined);

            // Polygons layer and cache should still exist.
            assert.ok(path.existsSync(path.join(__dirname, 'cache/layers/polygons.json')));
            assert.ok(path.existsSync(path.join(__dirname, 'tmp/5c505ff4-polygons.json')));

            // Stations layer and cache should be gone.
            assert.ok(!path.existsSync(path.join(__dirname, 'layers/stations')));
            assert.ok(!path.existsSync(path.join(__dirname, 'tmp/87c0c757-stations')));

            // Cleanup.
            rm(path.join(__dirname, 'tmp'));
            fs.unlinkSync(path.join(__dirname, 'cache/layers/absolute-json.json'));
            rm(path.join(__dirname, 'cache/layers/absolute-shp'));
            fs.unlinkSync(path.join(__dirname, 'cache/layers/polygons.json'));
            fs.unlinkSync(path.join(__dirname, 'cache/layers/csv'));
            done();
        });
    });
});


describe('util', function() {

    var copypath = path.join(__dirname, 'copypath');

    beforeEach(function() {
        if (!path.existsSync(copypath)) fs.mkdirSync(copypath);
    });

    afterEach(function() {
        rm(copypath);
    });

    it('copies all files from shapefiles (and no extras)', function(done) {

        util.processSHP(path.join(__dirname, 'data/absolute/absolute.shp'), path.join(copypath, 'absolute/absolute.shp'), util.copy, function(err) {
            assert.ok(!err);

            assert.ok(path.existsSync(path.join(copypath, 'absolute/absolute.shp')));
            assert.ok(path.existsSync(path.join(copypath, 'absolute/absolute.dbf')));
            assert.ok(path.existsSync(path.join(copypath, 'absolute/absolute.shx')));
            assert.ok(path.existsSync(path.join(copypath, 'absolute/absolute.prj')));
            assert.ok(path.existsSync(path.join(copypath, 'absolute/absolute.index')));
            assert.ok(!path.existsSync(path.join(copypath, 'absolute/othername.shp')));

            done();
        });

    });

    it('copies single files correctly', function(done) {
        util.copy(path.join(__dirname, 'data/absolute.json'), path.join(copypath, 'absolute.json'), function(err) {
            assert.equal(err, undefined);
            assert.ok(path.existsSync(path.join(copypath, 'absolute.json')));
            done();
        });
    });

});
