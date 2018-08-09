/** @format */

/**
 * External dependencies
 */
import React, { Component } from 'react';
import { connect } from 'react-redux';

/**
 * Internal dependencies
 */
import { isOffline } from 'state/application/selectors';

class Offline extends Component {
	static getDerivedStateFromProps( props ) {
		return {
			isOffline: props.isOffline,
		};
	}

	componentDidUpdate( prevProps, prevState ) {
		if ( prevState.isOffline && ! this.state.isOffline ) {
			if ( typeof window !== 'undefined' ) {
				window.location.reload();
			}
		}
	}

	render() {
		return (
			<div>
				<h2>No Internet</h2>
				<div>
					Try:
					<ul>
						<li>Checking the network cables, modem and router</li>
						<li>Reconnecting to Wi-Fi</li>
					</ul>
				</div>
			</div>
		);
	}
}

export default connect( state => ( {
	isOffline: isOffline( state ),
} ) )( Offline );
