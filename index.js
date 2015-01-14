
'use strict';

var path = require('path');
var fs = require('fs');
var loaderUtils = require('loader-utils');
var SourceMap = require('source-map');

module.exports = function(source, sourceMap) {

    var query = loaderUtils.parseQuery(this.query);

    if(this.cacheable) {
        this.cacheable();
    }

    // /foo/bar/file.js
    var srcFilepath = this.resourcePath;
    // /foo/bar/file.js -> file
    var srcFilename = path.basename(srcFilepath, path.extname(srcFilepath));
    // /foo/bar/file.js -> /foo/bar
    var srcDirpath  = path.dirname(srcFilepath);
    // /foo/bar -> bar
    var srcDirname  = srcDirpath.split(path.sep).pop();

    var elementName = srcFilename == 'index' ? srcDirname : srcFilename;

    var templateExtension = query.templateExt || query.templateExtension || 'html';
    var styleExtension    = query.styleExt || query.styleExtension || 'css';

    var htmlExists = fs.existsSync(path.join(srcDirpath, elementName+'.'+templateExtension));
    var cssExists  = fs.existsSync(path.join(srcDirpath, elementName+'.'+styleExtension));

    var inject = (htmlExists || cssExists) ? '\n/* inject from polymer-loader */\n' : '';

    if(htmlExists & cssExists) {
        inject += [
            "(function(document) {",
                "var template = require('./"+elementName+"."+templateExtension+"');",
                "var styles = require('./"+elementName+"."+styleExtension+"');",
                "var el = document.createElement('div');",
                "el.innerHTML = template.replace(/(<template>)([^]*<\\/template>)/img, function(m, $1, $2) { return $1 + '<style>'+styles+'</style>' + $2});",
                "document.body.appendChild(el);",
            "})(document);"
        ].join('\n');
    }
    else
    if(htmlExists && !cssExists) {
        inject += [
            "(function(document) {",
                "var template = require('./"+elementName+"."+templateExtension+"');",
                "var el = document.createElement('div');",
                "el.innerHTML = template;",
                "document.body.appendChild(el);",
            "})(document);"
        ].join('\n');
    }
    else
    if(!htmlExists && cssExists) {
        inject += [
            "(function(document) {",
                "var styles = require('./"+elementName+"."+styleExtension+"');",
                "var el = document.createElement('div');",
                "el.innerHTML = '<polymer-element name=\""+elementName+"\"><template><style>'+styles+'</style></template></polymer-element>';",
                "document.body.appendChild(el);",
            "})(document);"
        ].join('\n');
    }

    // support existing SourceMap
    // https://github.com/mozilla/source-map#sourcenode
    // https://github.com/webpack/imports-loader/blob/master/index.js#L34-L44
    // https://webpack.github.io/docs/loaders.html#writing-a-loader
    if (sourceMap) {
        var currentRequest = loaderUtils.getCurrentRequest(this);
        var SourceNode = SourceMap.SourceNode;
        var SourceMapConsumer = SourceMap.SourceMapConsumer;
        var sourceMapConsumer = new SourceMapConsumer(sourceMap);
        var node = SourceNode.fromStringWithSourceMap(source, sourceMapConsumer);

        node.prepend(inject);

        var result = node.toStringWithSourceMap({
            file: currentRequest
        });

        this.callback(null, result.code, result.map.toJSON());

        return;
    }

    // prepend collected inject at the top of file
    return source +'\n'+ inject;


    // return the original source and sourceMap
    if (sourceMap) {
        this.callback(null, source, sourceMap);
        return;
    }

    // return the original source
    return source;
};
