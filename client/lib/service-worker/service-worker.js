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
/* eslint-enable */

const queuedMessages = [];
const CACHE_VERSION = 'v1';

/**
 *  We want to make sure that if the service worker gets updated that we
 *  immediately claim it, to ensure we're not running stale versions of the worker
 *	See: https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope/skipWaiting
 **/

self.addEventListener( 'install', function( event ) {
	self.skipWaiting();

	event.waitUntil( precache() );
} );

self.addEventListener( 'activate', function( event ) {
	// https://developers.google.com/web/updates/2017/02/navigation-preload
	if ( self.registration.navigationPreload ) {
		event.waitUntil( self.registration.navigationPreload.enable() );
	}

	event.waitUntil( self.clients.claim() );
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

	if ( request.method !== 'GET' || ! isCacheable( request.url ) ) {
		return;
	}

	if ( request.mode === 'navigate' ) {
		event.respondWith( fetchNetworkFirst( request, '/' ) );
		return;
	}

	event.respondWith( fetchCacheFirst( request ) );
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
		! urlObject.pathname.match( /service-worker\.js$|__webpack_hmr$|^\/socket\.io\/|\/version/ )
	);
}
/* eslint-enable */

function fetchCacheFirst( request ) {
	return caches.match( request ).then( cachedResponse => cachedResponse || fetch( request ) );
}

function fetchNetworkFirst( request, fallback /* = null */ ) {
	return caches.open( CACHE_VERSION ).then( cache => {
		return fetch( request )
			.then( networkResponse => {
				if ( isCacheable( request.url ) ) {
					cache.put( request, networkResponse.clone() );
				}
				return networkResponse;
			} )
			.catch( () => {
				return cache.match( request ).then( cachedResponse => {
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

function precache() {
	// Load configuration from server
	return Promise.all( [
		fetch( '/assets.json' ).then( function( response ) {
			return response.json().then( function( assets ) {
				// prefetch assets
				return caches.open( CACHE_VERSION ).then( function( cache ) {
					// resolve all assets
					return cache.addAll( assets.filter( isCacheable ) );
				} );
			} );
		} ),
		caches.open( CACHE_VERSION ).then( function( cache ) {
			return cache.add( '/' );
		} ),
	] );
}
