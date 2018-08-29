/** @format */
/**
 * External Dependencies
 */
const fs = require( 'fs' ); // eslint-disable-line  import/no-nodejs-modules
const path = require( 'path' );
const _ = require( 'lodash' );

function AssetsWriter( options ) {
	this.options = Object.assign(
		{
			path: './build',
			filename: 'assets.json',
			assetNamesOnly: false,
		},
		options
	);
	this.outputPath = path.join( this.options.path, this.options.filename );
}

Object.assign( AssetsWriter.prototype, {
	apply: function( compiler ) {
		compiler.hooks.afterEmit.tap( 'AssetsWriter', compilation => {
			const stats = compilation.getStats().toJson( {
				hash: true,
				publicPath: true,
				assets: true,
				children: false,
				chunks: true,
				chunkModules: false,
				chunkOrigins: false,
				entrypoints: true,
				modules: false,
				source: false,
				errorDetails: true,
				timings: false,
				reasons: false,
			} );

			function fixupPath( f ) {
				return path.join( stats.publicPath, f );
			}

			let statsToOutput;

			if ( this.options.assetNamesOnly ) {
				statsToOutput = _.flatten( stats.assets.map( asset => fixupPath( asset.name ) ) );
			} else {
				statsToOutput = {};

				statsToOutput.publicPath = stats.publicPath;
				statsToOutput.manifests = {};

				for ( const name in stats.assetsByChunkName ) {
					// make the manifest inlineable
					if ( String( name ).startsWith( 'manifest' ) ) {
						// Usually there's only one asset per chunk, but when we build with sourcemaps, we'll have two.
						// Remove the sourcemap from the list and just take the js asset
						// This may not hold true for all chunks, but it does for the manifest.
						const jsAsset = _.head(
							_.reject( _.castArray( stats.assetsByChunkName[ name ] ), asset =>
								_.endsWith( asset, '.map' )
							)
						);
						statsToOutput.manifests[ name ] = compilation.assets[ jsAsset ].source();
					}
				}

				statsToOutput.entrypoints = _.mapValues( stats.entrypoints, entry => ( {
					chunks: _.reject( entry.chunks, chunk => {
						String( chunk ).startsWith( 'manifest' );
					} ),
					assets: _.reject( entry.assets, asset => asset.startsWith( 'manifest' ) ).map(
						fixupPath
					),
				} ) );

				statsToOutput.assetsByChunkName = _.mapValues( stats.assetsByChunkName, asset =>
					_.castArray( asset ).map( fixupPath )
				);

				statsToOutput.chunks = stats.chunks.map( chunk =>
					Object.assign( {}, chunk, {
						files: chunk.files.map( fixupPath ),
						siblings: _.reject( chunk.siblings, sibling =>
							String( sibling ).startsWith( 'manifest' )
						),
					} )
				);
			}

			// Write the whole file synchronously as we want to be able to read and parse the file at any time
			fs.writeFileSync( this.outputPath, JSON.stringify( statsToOutput, null, '\t' ) );
		} );
	},
} );

module.exports = AssetsWriter;
