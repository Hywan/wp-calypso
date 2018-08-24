/** @format */

/**
 * External dependencies
 */
import { some, isEmpty, get } from 'lodash';
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { connect } from 'react-redux';
import { UserAgent } from 'express-useragent';

/**
 * Internal dependencies
 */
import { localize, translate } from 'i18n-calypso';
import notices from 'notices';
import { isWpComBusinessPlan } from 'lib/plans';
import cartValues, { paymentMethodClassName, getLocationOrigin } from 'lib/cart-values';
import { validatePaymentDetails } from 'lib/checkout';
import CartCoupon from 'my-sites/checkout/cart/cart-coupon';
import { Input } from 'my-sites/domains/components/form';
import CartToggle from './cart-toggle';
import PaymentChatButton from './payment-chat-button';
import SubscriptionText from './subscription-text';
import TermsOfService from './terms-of-service';
import WeChatPaymentQRcode from './wechat-payment-qrcode';
import { getHttpData, requestHttpData } from 'state/data-layer/http-data';
import { http } from 'state/data-layer/wpcom-http/actions';
import { recordGoogleEvent, recordTracksEvent } from 'state/analytics/actions';

export class WechatPaymentBox extends Component {
	static propTypes = {
		cart: PropTypes.object.isRequired,
		transaction: PropTypes.object.isRequired,
		redirectTo: PropTypes.func.isRequired, // on success
		selectedSite: PropTypes.object,
		fetchWeChatOrder: PropTypes.func,
		resetWeChatOrder: PropTypes.func,
	};

	state = {
		name: '',
		errorMessage: '',
	};

	componentWillUnmount() {
		this.props.resetWeChatOrder();
	}

	handleSubmit = event => {
		event.preventDefault();
		const validation = validatePaymentDetails( { name: this.state.name }, 'wechat' );
		if ( ! isEmpty( validation.errors ) ) {
			return this.setState( { errorMessage: validation.errors[ 0 ] } );
		}
		this.props.fetchWeChatOrder( this.state.name );
	};

	componentDidUpdate( prevProps ) {
		const {
			resetWeChatOrder,
			cart,
			isMobile,
			weChatOrderData: { redirectUrl },
		} = this.props;

		// The Wechat payment type should only redirect when on mobile as redirect urls
		// are Wechat Pay mobile application urls: e.g. weixin://wxpay/bizpayurl?pr=RaXzhu4
		if ( isMobile && redirectUrl ) {
			notices.info(
				translate( 'We are now redirecting you to the WeChat Pay mobile app to finalize payment.' )
			);
			return location.assign( redirectUrl );
		}

		if (
			prevProps.cart.total_cost !== cart.total_cost ||
			prevProps.cart.products.length !== cart.products.length
		) {
			resetWeChatOrder();
		}

		if ( redirectUrl && ! isMobile ) {
			// Display on desktop
			notices.info(
				translate( 'Please scan the WeChat Payment barcode.', {
					comment: 'Instruction to scan the on screen barcode.',
				} )
			);
		}
	}

	render() {
		const {
			weChatOrderData: { redirectUrl, orderId },
			selectedSite,
			presaleChatAvailable,
			cart,
			paymentType,
			children,
			isMobile,
			isWeChatOrderDataError,
			isRequestingWeChatOrderData,
		} = this.props;

		// Only show if chat is available and we have a business plan in the cart.
		const showPaymentChatButton =
			presaleChatAvailable && some( cart.products, isWpComBusinessPlan );

		if ( isWeChatOrderDataError ) {
			notices.error( translate( "We've encountered a problem. Please try again later." ) );
		}

		// Wechat qr codes get set on desktop instead of redirecting
		if ( redirectUrl && ! isMobile ) {
			return (
				<WeChatPaymentQRcode
					orderId={ orderId }
					cart={ cart }
					redirectUrl={ redirectUrl }
					slug={ selectedSite.slug }
				/>
			);
		}

		const formClasses = classNames( {
			'is-loading': isRequestingWeChatOrderData,
		} );

		return (
			<React.Fragment>
				<form onSubmit={ this.handleSubmit } className={ formClasses }>
					<div className="checkout__payment-box-sections">
						<div className="checkout__payment-box-section">
							<Input
								additionalClasses="checkout__checkout-field"
								label={ translate( 'Your Name' ) }
								isError={ ! isEmpty( this.state.errorMessage ) }
								errorMessage={ this.state.errorMessage }
								name="name"
								onBlur={ event => this.setState( { name: event.target.value } ) }
								onChange={ event => this.setState( { name: event.target.value } ) }
								value={ this.state.name }
							/>
						</div>
					</div>

					{ children }

					<TermsOfService
						hasRenewableSubscription={ cartValues.cartItems.hasRenewableSubscription( cart ) }
					/>

					<div className="checkout__payment-box-actions">
						<div className="checkout__pay-button">
							<button
								type="submit"
								className="checkout__button-pay button is-primary "
								disabled={ this.state.createFetching }
							>
								{ translate( 'Pay %(price)s with WeChat Pay', {
									args: { price: cart.total_cost_display },
								} ) }
							</button>
							<SubscriptionText cart={ cart } />
						</div>

						{ showPaymentChatButton && (
							<PaymentChatButton paymentType={ paymentType } cart={ cart } />
						) }
					</div>
				</form>

				<CartCoupon cart={ cart } />

				<CartToggle />
			</React.Fragment>
		);
	}
}

export const getWeChatTransactionOrderDetails = ( { cart, domainDetails, payment } ) => {
	const id = `transaction-payment-method-wechat-${ cart.client_metadata }`;
	return requestHttpData(
		id,
		http( {
			path: '/me/transactions',
			apiVersion: '1.1',
			method: 'POST',
			body: { cart, domain_details: domainDetails, payment },
		} ),
		{
			fromApi: () => ( { order_id, redirect_url } ) => [
				[ id, { orderId: order_id, redirectUrl: redirect_url } ],
			],
			freshness: -Infinity,
		}
	);
};

export default connect(
	( state, { cart } ) => {
		const wechatOrder =
			getHttpData( `transaction-payment-method-wechat-${ cart.client_metadata }` ) || {};
		return {
			weChatOrderData: get( wechatOrder, 'data', {} ),
			isRequestingWeChatOrderData: 'pending' === wechatOrder.state,
			isWeChatOrderDataError: 'failure' === wechatOrder.state,
			configAge: Date.now() - wechatOrder.lastUpdated,
			isMobile: get( window, 'navigator.userAgent', false )
				? new UserAgent().parse( navigator.userAgent ).isMobile
				: false,
		};
	},
	( dispatch, { cart, transaction, selectedSite, redirectTo } ) => ( {
		fetchWeChatOrder: name => {
			const origin = getLocationOrigin( location );
			const slug = get( selectedSite, 'slug', 'no-site' );
			const payment = {
				name,
				payment_method: paymentMethodClassName( 'wechat' ),
				success_url: origin + redirectTo(),
				cancel_url: `${ origin }/checkout/${ slug }`,
			};
			notices.info( translate( 'Setting up your WeChat Pay payment' ) );
			dispatch( recordTracksEvent( 'calypso_checkout_with_redirect_wechat' ) );
			dispatch( recordGoogleEvent( 'Upgrades', 'Clicked Checkout With Wechat Payment Button' ) );
			getWeChatTransactionOrderDetails( {
				cart,
				domainDetails: transaction.domainDetails,
				payment,
			} );
		},
		// We should probably extend `update()` in client/state/data-layer/http-data.js
		// to set state back to 'uninitialized'
		resetWeChatOrder: () =>
			window.httpData.set( `transaction-payment-method-wechat-${ cart.client_metadata }`, {
				state: 'uninitialized',
				data: {},
				error: undefined,
			} ),
	} )
)( localize( WechatPaymentBox ) );
