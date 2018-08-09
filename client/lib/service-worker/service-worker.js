/**
 * /* eslint-disable no-console
 *
 * @format
 */

/**
 * WARNING: DO NOT USE ES2015+ OR COMMONJS. This file is served as-is and isn't
 * transpiled by Babel or bundled by Webpack.
 */

/* eslint-disable */
'use strict';
var currentAssetsHash;
/* eslint-enable */

const queuedMessages = [];
const CACHE_VERSION = 'v1';
const OFFLINE_CALYPSO_PAGE = '/offline';

/**
 *  We want to make sure that if the service worker gets updated that we
 *  immediately claim it, to ensure we're not running stale versions of the worker
 *	See: https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope/skipWaiting
 **/

self.addEventListener( 'install', function( event ) {
	// The promise that skipWaiting() returns can be safely ignored.
	self.skipWaiting();

	event.waitUntil(
		Promise.all( [ fetchAssets().then( cacheUrls ), cacheUrls( [ OFFLINE_CALYPSO_PAGE ] ) ] )
	);
} );

self.addEventListener( 'activate', function( event ) {
	event.waitUntil(
		Promise.all( [
			// https://developers.google.com/web/updates/2017/02/navigation-preload
			self.registration.navigationPreload && self.registration.navigationPreload.enable(),
			// Calling clients.claim() here sets the Service Worker as the controller of the client pages.
			// This allows the pages to start using the Service Worker immediately without reloading.
			// https://developer.mozilla.org/en-US/docs/Web/API/Clients/claim
			self.clients.claim(),
			clearOldCaches(),
		] )
	);
} );

self.addEventListener( 'push', function( event ) {
	let notification;

	if ( typeof event.data !== 'object' && typeof event.data.json !== 'function' ) {
		return;
	}

	notification = event.data.json();

	event.waitUntil(
		self.registration
			.showNotification( notification.msg, {
				tag: 'note_' + notification.note_id,
				icon: notification.icon,
				timestamp: notification.note_timestamp,
				data: notification,
			} )
			.then( function() {
				if ( notification.note_opened_pixel ) {
					fetch( notification.note_opened_pixel, { mode: 'no-cors' } ).catch( function() {
						console.log( 'Could not load the pixel %s', notification.note_opened_pixel ); //eslint-disable-line no-console
					} );
				}
			} )
	);
} );

self.addEventListener( 'notificationclick', function( event ) {
	const notification = event.notification;
	notification.close();

	event.waitUntil(
		self.clients.matchAll().then( function( clientList ) {
			if ( clientList.length > 0 ) {
				clientList[ 0 ].postMessage( { action: 'openPanel' } );
				clientList[ 0 ].postMessage( { action: 'trackClick', notification: notification.data } );
				try {
					clientList[ 0 ].focus();
				} catch ( err ) {
					// Client didn't need focus
				}
			} else {
				queuedMessages.push( { action: 'openPanel' } );
				queuedMessages.push( { action: 'trackClick', notification: notification.data } );
				self.clients.openWindow( '/' );
			}
		} )
	);
} );

self.addEventListener( 'message', function( event ) {
	if ( ! ( 'action' in event.data ) ) {
		return;
	}

	switch ( event.data.action ) {
		case 'sendQueuedMessages':
			self.clients.matchAll().then( function( clientList ) {
				let queuedMessage;

				if ( clientList.length > 0 ) {
					queuedMessage = queuedMessages.shift();
					while ( queuedMessage ) {
						clientList[ 0 ].postMessage( queuedMessage );
						queuedMessage = queuedMessages.shift();
					}
				}
			} );
			break;
	}
} );

self.addEventListener( 'fetch', function( event ) {
	const request = event.request;

	if ( request.method !== 'GET' ) {
		return;
	}

	// HTML Pages, fetch from the server and fallback to the Offline page
	if ( request.mode === 'navigate' ) {
		// But first check that assets have not changed
		// Fetching assets.json on each page load should be relatively lightweight as
		// the server will return a 304 response if it hasn't changed
		const previousHash = currentAssetsHash;
		event.respondWith(
			fetchAssets()
				.then( function( assets ) {
					if ( previousHash !== currentAssetsHash ) {
						return Promise.all( [
							cacheUrls( assets ),
							// if assets have changed the offline page might have as well, refresh it
							cacheUrls( [ OFFLINE_CALYPSO_PAGE ] ),
						] );
					}
				} )
				.then( function() {
					return fetchNetworkFirst( request, OFFLINE_CALYPSO_PAGE );
				} )
		);
		return;
	}

	if ( isCacheable( request.url ) ) {
		event.respondWith( fetchCacheFirst( request ) );
	}
} );

/* eslint-disable */
function isCacheable( url ) {
	var urlObject;

	if ( ! url ) {
		return false;
	}

	if ( url[ 0 ] === '/' ) {
		url = location.origin + url;
	}

	try {
		urlObject = new URL( url );
	} catch ( err ) {
		// malformed url
		return false;
	}

	return (
		urlObject.origin === location.origin &&
		urlObject.pathname.match( /\.(json|js|css|svg|gif|png|woff2?|ttf|eot|wav)$/ ) &&
		! urlObject.pathname.match(
			/assets\.json$|__webpack_hmr$|^\/socket\.io\/|^\/version$|\/flags\/[a-z]+\.svg$/
		)
	);
}
/* eslint-enable */

function fetchCacheFirst( request ) {
	return caches.open( CACHE_VERSION ).then( function( cache ) {
		return caches.match( request ).then( function( cachedResponse ) {
			if ( cachedResponse ) {
				return cachedResponse;
			}

			return fetch( request )
				.then( function( networkResponse ) {
					if ( isCacheable( request.url ) ) {
						cache.put( request, networkResponse.clone() );
					}
					return networkResponse;
				} )
				.catch( function() {
					// if cache and network failed, try cache one more time without query parameters
					return caches.match( request, { ignoreSearch: true } );
				} );
		} );
	} );
}

function fetchNetworkFirst( request, fallback /* = null */ ) {
	return caches.open( CACHE_VERSION ).then( function( cache ) {
		return fetch( request )
			.then( function( networkResponse ) {
				if ( isCacheable( request.url ) ) {
					cache.put( request, networkResponse.clone() );
				}
				return networkResponse;
			} )
			.catch( function() {
				return cache.match( request ).then( function( cachedResponse ) {
					if ( cachedResponse ) {
						return cachedResponse;
					}
					if ( fallback ) {
						return caches.match( fallback );
					}
					return Promise.reject();
				} );
			} );
	} );
}

function fetchAssets() {
	return fetch( '/assets.json' ).then( function( response ) {
		return response.json().then( function( json ) {
			currentAssetsHash = json.hash;
			return json.assets;
		} );
	} );
}

function cacheUrls( urls ) {
	return caches.open( CACHE_VERSION ).then( function( cache ) {
		// resolve all assets
		return cache.addAll( urls.filter( isCacheable ) );
	} );
}

function clearOldCaches() {
	return self.caches.keys().then( function( cacheNames ) {
		return Promise.all(
			cacheNames.map( function( cacheName ) {
				if ( CACHE_VERSION !== cacheName ) {
					return self.caches.delete( cacheName );
				}
			} )
		);
	} );
}
