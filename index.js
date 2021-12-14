'use strict'

const path 		= require('path')
const fs 		= require('fs')
const SourceMap = require('source-map')

module.exports = function (source, sourceMap)
{
	let query = new URLSearchParams(this.query)

	if (this.cacheable)
		this.cacheable()

    // /foo/bar/file.js
	const srcFilepath = this.resourcePath

    // /foo/bar/file.js -> file
	const srcFilename = path.basename(srcFilepath, path.extname(srcFilepath))

    // /foo/bar/file.js -> /foo/bar
	const srcDirpath = path.dirname(srcFilepath)

    // /foo/bar -> bar
	const srcDirname = srcDirpath.split(path.sep).pop()

	const elementName = srcFilename == 'index' ? srcDirname : srcFilename

	const templateExtension = query.get("templateExt") || query.get("templateExtension") || 'html'
	const styleExtension = query.get("styleExt") || query.get("styleExtension") || 'css'

	const htmlExists = fs.existsSync(
		path.join(srcDirpath, elementName + '.' + templateExtension)
	)
	const cssExists = fs.existsSync(
		path.join(srcDirpath, elementName + '.' + styleExtension)
	)

	let buffer = htmlExists || cssExists ? ['\n/* inject from polymer-loader */\n'] : null
	
	if (buffer != null)
	{
		buffer.push('(function() {')
		buffer.push('\tlet componentTemplate	= "";')
		
		if (cssExists)
		{
			buffer.push(`
				let styleSheet	= require('./${elementName}.${styleExtension}');

				if ("default" in styleSheet)
					styleSheet = styleSheet.default;

				componentTemplate += '<style>' + styleSheet + '</style>\\n';
			`);
		}

		if (htmlExists)
		{
			buffer.push(`
				let htmlStr	= require('./${elementName}.${templateExtension}');

				if ("default" in htmlStr)
					htmlStr = htmlStr.default;

				componentTemplate += htmlStr + '\\n';
			`);
		}

		buffer = buffer.concat([
			'\ttry',
			'\t{',
			'\t\tlet html = require("@polymer/polymer").html;',
			`\t\tlet Component 	= require('./${elementName}');`,
			'\t\tif ("default" in Component)',
			'\t\t\tComponent = Component.default;',
			'\t\tObject.defineProperty(Component, "_template", {value: html([componentTemplate]), writable: false, configurable: false});',
			'\t\tObject.defineProperty(Component, "template", {get: function () { return this._template}, configurable: true, enumerable: false});',
			`\t\tcustomElements.define(Component.is || "${elementName}", Component);`,
			'\t}',
			'\tcatch (error)',
			'\t{',
			'\t\tconsole.error(error);',
			'\t}',
			'})();'
		])

		const inject = buffer.join('\n')

		source += '\n' + inject
	}

    // support existing SourceMap
    // https://github.com/mozilla/source-map#sourcenode
    // https://github.com/webpack/imports-loader/blob/master/index.js#L34-L44
    // https://webpack.github.io/docs/loaders.html#writing-a-loader
    if (sourceMap) {
		const currentRequest 	= this.currentRequest; //loaderUtils.getCurrentRequest(this)
		const SourceNode 		= SourceMap.SourceNode
		const SourceMapConsumer = SourceMap.SourceMapConsumer
		const sourceMapConsumer = new SourceMapConsumer(sourceMap)
		const node = SourceNode.fromStringWithSourceMap(source, sourceMapConsumer)

		//node.prepend(inject)

        const result = node.toStringWithSourceMap({
            file: currentRequest
		})

		this.callback(null, result.code, result.map.toJSON())
		return
    }

    // prepend collected inject at the top of file
	return source
}