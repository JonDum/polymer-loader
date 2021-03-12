'use strict'

const path = require('path')
const fs = require('fs')
const loaderUtils = require('loader-utils')
const SourceMap = require('source-map')

module.exports = function (source, sourceMap)
{
	let query = loaderUtils.parseQuery(this.query)

	if (this.cacheable)
		this.cacheable()

    // /foo/bar/file.js
	let srcFilepath = this.resourcePath

    // /foo/bar/file.js -> file
	let srcFilename = path.basename(srcFilepath, path.extname(srcFilepath))

    // /foo/bar/file.js -> /foo/bar
	let srcDirpath = path.dirname(srcFilepath)

    // /foo/bar -> bar
	let srcDirname = srcDirpath.split(path.sep).pop()

	let elementName = srcFilename == 'index' ? srcDirname : srcFilename

	let templateExtension = query.templateExt || query.templateExtension || 'html'
	let styleExtension = query.styleExt || query.styleExtension || 'css'

	let htmlExists = fs.existsSync(
		path.join(srcDirpath, elementName + '.' + templateExtension)
	)
	let cssExists = fs.existsSync(
		path.join(srcDirpath, elementName + '.' + styleExtension)
	)

	let buffer = htmlExists || cssExists ? ['\n/* inject from polymer-loader */\n'] : null
	
	if (buffer != null)
	{
		buffer.push('(function() {')
		buffer.push('\tlet componentTemplate	= "";')
		
		if (cssExists)
			buffer.push(
				"\tcomponentTemplate +='<style>' + require('./" +
					elementName +
					'.' +
					styleExtension +
					"') + '</style>\\n';"
			)

		if (htmlExists)
			buffer.push(
				"\tcomponentTemplate += require('./" +
					elementName +
					'.' +
					templateExtension +
					"') + '\\n';"
			)

		buffer = buffer.concat([
			'\ttry',
			'\t{',
			'\t\tlet html = require("@polymer/polymer").html;',
			"\t\tlet Component 	= require('./" + elementName + ".js');",
			'\t\tif ("default" in Component)',
			'\t\t\tComponent = Component.default;',
			'\t\tObject.defineProperty(Component, "_template", {value: html([componentTemplate]), writable: false, configurable: false});',
			'\t\tObject.defineProperty(Component, "template", {get: function () { return this._template}, configurable: true, enumerable: false});',
			'\t\tcustomElements.define(Component.is || "' +
				elementName +
				'", Component);',
			'\t}',
			'\tcatch (error)',
			'\t{',
			'\t\tconsole.error(error);',
			'\t}',
			'})();'
		])

		let inject = buffer.join('\n')

		source += '\n' + inject
	}

    // support existing SourceMap
    // https://github.com/mozilla/source-map#sourcenode
    // https://github.com/webpack/imports-loader/blob/master/index.js#L34-L44
    // https://webpack.github.io/docs/loaders.html#writing-a-loader
    if (sourceMap) {
		var currentRequest = loaderUtils.getCurrentRequest(this)
		var SourceNode = SourceMap.SourceNode
		var SourceMapConsumer = SourceMap.SourceMapConsumer
		var sourceMapConsumer = new SourceMapConsumer(sourceMap)
		var node = SourceNode.fromStringWithSourceMap(source, sourceMapConsumer)

		//node.prepend(inject)

        var result = node.toStringWithSourceMap({
            file: currentRequest
		})

		this.callback(null, result.code, result.map.toJSON())
		return
    }

    // prepend collected inject at the top of file
	return source
}