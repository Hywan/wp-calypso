/** @format */

/**
 * External dependencies
 */
import { some, isEmpty, get } from 'lodash';
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { UserAgent } from 'express-useragent';

/**
 * Internal dependencies
 */
import { localize, translate } from 'i18n-calypso';
import notices from 'notices';
import analytics from 'lib/analytics';
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
import { createTransaction } from 'state/transactions/actions';

export class WechatPaymentBox extends Component {
	static propTypes = {
		cart: PropTypes.object.isRequired,
		transaction: PropTypes.object.isRequired,
		redirectTo: PropTypes.func.isRequired, // on success
		selectedSite: PropTypes.object,

		// connect
		createFetching: PropTypes.bool.isRequired,
		createSuccess: PropTypes.object,
		createError: PropTypes.object,
	};

	constructor( props ) {
		super( props );
		this.state = {
			name: '',
			errorMessage: '',
		};
	}

	handleSubmit = event => {
		event.preventDefault();

		const validation = validatePaymentDetails( { name: this.state.name }, 'wechat' );

		if ( ! isEmpty( validation.errors ) ) {
			this.setState( { errorMessage: validation.errors[0] } );

			return;
		}

		notices.info( translate( 'Setting up your WeChat Pay payment' ) );

		const origin = getLocationOrigin( location );

		const slug = get(this.props, 'selectedSite.slug', 'no-site');

		analytics.ga.recordEvent( 'Upgrades', 'Clicked Checkout With Wechat Payment Button' );
		analytics.tracks.recordEvent( 'calypso_checkout_with_redirect_wechat' );

		// Dispatch
		this.props.createTransaction( {
			payment: {
				name: this.state.name,
				payment_method: paymentMethodClassName( 'wechat' ),
				success_url: origin + this.props.redirectTo(),
				cancel_url: `${origin}/checkout/${slug}`,
			},
			cart: this.props.cart,
			domain_details: this.props.transaction.domainDetails,
		} );
	}

	shouldComponentUpdate(nextProps) {
		const {
			createResponse,
			createError,
		} = nextProps;

		if ( createResponse && createResponse.redirectUrl ) {
			if ( ! createResponse.redirectUrl ) {
				notices.error( translate( "We've encountered a problem. Please try again later." ) );

				return true;
			}
			// The Wechat payment type should only redirect when on mobile as redirect urls
			// are Wechat Pay mobile application urls: e.g. weixin://wxpay/bizpayurl?pr=RaXzhu4
			const userAgent = new UserAgent().parse( navigator.userAgent );

			if ( userAgent.isMobile ) {
				notices.info( translate( 'We are now redirecting you to the WeChat Pay mobile app to finalize payment.' ) );

				location.assign( createResponse.redirectUrl );

				// Redirect on mobile
				return false;
			}

			// Display on desktop
			notices.info( translate( 'Please scan the WeChat Payment barcode.', {
				comment: 'Instruction to scan the on screen barcode.'
			} ) );

			return true;
		}

		if ( createError ) {
			notices.error( translate( "We've encountered a problem. Please try again later." ) );

			return true;
		}

		return true;
	}

	render() {
		// Only show if chat is available and we have a business plan in the cart
		const showPaymentChatButton = this.props.presaleChatAvailable && some( this.props.cart.products, isWpComBusinessPlan );
		const siteSlug = get( this.props, 'selectedSite.slug', null );
		const redirectUrl = get( this.props, 'createResponse.redirectUrl', null );
		const orderId = get( this.props, 'createResponse.orderId', null );

		// Wechat qr codes get set on desktop instead of redirecting
		if ( redirectUrl ) {
			return <WeChatPaymentQRcode orderId={ orderId } cart={ this.props.cart } redirectUrl={ redirectUrl } slug={ siteSlug } />
		}

		return <React.Fragment>
			<form onSubmit={ this.handleSubmit }>
				<div className="checkout__payment-box-sections">
					<div className="checkout__payment-box-section">
						<Input additionalClasses='checkout__checkout-field'
							label={ translate( 'Your Name' ) }
							isError={ ! isEmpty( this.state.errorMessage ) }
							errorMessage={ this.state.errorMessage }
							name='name'
							onBlur={ event => this.setState( { 'name': event.target.value } ) }
							onChange={ event => this.setState( { 'name': event.target.value } ) }
							value={ this.state.name }
						/>
					</div>
				</div>

				{ this.props.children }


				<TermsOfService hasRenewableSubscription={ cartValues.cartItems.hasRenewableSubscription( this.props.cart ) } />

				<div className="checkout__payment-box-actions">
					<div className="checkout__pay-button">
						<button type="submit"
							className="checkout__button-pay button is-primary "
							disabled={ this.state.createFetching }
						>
							{ translate( 'Pay %(price)s with WeChat Pay', {	args: { price: this.props.cart.total_cost_display }	} ) }
						</button>
						<SubscriptionText cart={ this.props.cart } />
					</div>

					{ showPaymentChatButton && (
						<PaymentChatButton paymentType={ this.props.paymentType } cart={ this.props.cart } />
					) }
				</div>
			</form>

			<CartCoupon cart={ this.props.cart } />

			<CartToggle />

		</React.Fragment>;
	}
}

export default connect(
	( { transactions } ) =>  ( {
		createFetching: transactions.create.fetching,
		createResponse: transactions.create.response,
		createError: transactions.create.error,
	} ),
	{ createTransaction }
)( localize ( WechatPaymentBox ) );
