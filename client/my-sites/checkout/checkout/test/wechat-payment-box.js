/**
 * @format
 * @jest-environment jsdom
 */

/**
 * External dependencies
 */
import React from 'react';
import { shallow } from 'enzyme';
import { identity } from 'lodash';

/**
 * Internal dependencies
 */
import { WechatPaymentBox } from '../wechat-payment-box';
import {
	PLAN_BUSINESS,
	PLAN_BUSINESS_2_YEARS,
	PLAN_PREMIUM,
	PLAN_PREMIUM_2_YEARS,
	PLAN_PERSONAL,
	PLAN_PERSONAL_2_YEARS,
	PLAN_FREE,
	PLAN_JETPACK_FREE,
	PLAN_JETPACK_PERSONAL,
	PLAN_JETPACK_PERSONAL_MONTHLY,
	PLAN_JETPACK_PREMIUM,
	PLAN_JETPACK_PREMIUM_MONTHLY,
	PLAN_JETPACK_BUSINESS,
	PLAN_JETPACK_BUSINESS_MONTHLY,
} from 'lib/plans/constants';

jest.mock( 'lib/cart-values', () => ( {
	isPaymentMethodEnabled: jest.fn( false ),
	paymentMethodName: jest.fn( false ),
	cartItems: {
		hasRenewableSubscription: jest.fn( false ),
		hasRenewalItem: jest.fn( false ),
	},
} ) );

jest.mock( 'i18n-calypso', () => ( {
	localize: x => x,
	translate: x => x,
} ) );

jest.mock( '../terms-of-service', () => {
	const react = require( 'react' );
	return class TermsOfService extends react.Component {};
} );

import TermsOfService from '../terms-of-service';

jest.mock( '../payment-chat-button', () => {
	const react = require( 'react' );
	return class PaymentChatButton extends react.Component {};
} );

import PaymentChatButton from '../payment-chat-button';

jest.mock( '../wechat-payment-qrcode', () => {
	const react = require( 'react' );
	return class WechatPaymentQRCode extends react.Component {};
} );

import WechatPaymentQRCode from '../wechat-payment-qrcode';

const defaultProps = {
	cart: {},
	translate: identity,
	countriesList: [
		{
			code: 'US',
			name: 'United States',
		},
		{
			code: 'CN',
			name: 'China',
		},
	],
	paymentType: 'default',
	transaction: {},
	redirectTo: identity,
	selectedSite: {slug: 'example.com' },
	showErrorNotice: identity,
};

describe( 'WechatPaymentBox', () => {
	test( 'has correct components and css', () => {
		const wrapper = shallow( <WechatPaymentBox { ...defaultProps } /> );
		expect( wrapper.find( '.checkout__payment-box-section' ) ).toHaveLength( 1 );
		expect( wrapper.find( '.checkout__payment-box-actions' ) ).toHaveLength( 1 );
		expect( wrapper.find( '[name="name"]' ) ).toHaveLength( 1 );
		expect( wrapper.contains( <TermsOfService /> ) );
	} );

	const businessPlans = [ PLAN_BUSINESS, PLAN_BUSINESS_2_YEARS ];

	businessPlans.forEach( product_slug => {
		test( 'should render PaymentChatButton if any WP.com business plan is in the cart', () => {
			const props = {
				...defaultProps,
				presaleChatAvailable: true,
				cart: {
					products: [ { product_slug } ],
				},
			};
			const wrapper = shallow( <WechatPaymentBox { ...props } /> );
			expect( wrapper.contains( <PaymentChatButton /> ) );
		} );
	} );

	businessPlans.forEach( product_slug => {
		test( 'should not render PaymentChatButton if presaleChatAvailable is false', () => {
			const props = {
				...defaultProps,
				presaleChatAvailable: false,
				cart: {
					products: [ { product_slug } ],
				},
			};
			const wrapper = shallow( <WechatPaymentBox { ...props } /> );
			expect( ! wrapper.contains( <PaymentChatButton /> ) );
		} );
	} );

	const otherPlans = [
		PLAN_PREMIUM,
		PLAN_PREMIUM_2_YEARS,
		PLAN_PERSONAL,
		PLAN_PERSONAL_2_YEARS,
		PLAN_FREE,
		PLAN_JETPACK_FREE,
		PLAN_JETPACK_PERSONAL,
		PLAN_JETPACK_PERSONAL_MONTHLY,
		PLAN_JETPACK_PREMIUM,
		PLAN_JETPACK_PREMIUM_MONTHLY,
		PLAN_JETPACK_BUSINESS,
		PLAN_JETPACK_BUSINESS_MONTHLY,
	];

	otherPlans.forEach( product_slug => {
		test( 'should not render PaymentChatButton if only non-business plan products are in the cart', () => {
			const props = {
				...defaultProps,
				cart: {
					products: [ { product_slug } ],
				},
			};
			const wrapper = shallow( <WechatPaymentBox { ...props } /> );
			expect( ! wrapper.contains( <PaymentChatButton /> ) );
		} );
	} );

	test( 'handleSourceSetupResponse redirects on mobile', () => {
		Object.defineProperty( navigator, "userAgent", {	value: "ios", writable: true } );
		location.assign = jest.fn(); // https://github.com/facebook/jest/issues/890#issuecomment-295939071

		const wrapper = shallow( <WechatPaymentBox { ...defaultProps } /> );
		const instance = wrapper.instance();

		const response = {  redirect_url: 'https://redirect', order_id: 1 };

		instance.handleSourceSetupResponse( null, response );

		expect( location.assign ).toHaveBeenCalledWith( response.redirect_url );
	} );

	test( 'handleSourceSetupResponse sets state on desktop', () => {
		Object.defineProperty( navigator, "userAgent", {	value: "windows", writable: true } );
		location.assign = jest.fn();

		const wrapper = shallow( <WechatPaymentBox { ...defaultProps } /> );
		const instance = wrapper.instance();

		const response = {  redirect_url: 'https://redirect', order_id: 1 };


		instance.handleSourceSetupResponse( null, response );

		expect( location.assign ).not.toHaveBeenCalledWith( response.redirect_url );
		expect( instance.state.redirectUrl ).toEqual( response.redirect_url );
		expect( instance.state.orderId ).toEqual( response.order_id );

	} );

	test( 'displays a qr code on desktop', () => {
		Object.defineProperty( navigator, "userAgent", {	value: "windows", writable: true } );

		const wrapper = shallow( <WechatPaymentBox { ...defaultProps } /> );
		const instance = wrapper.instance();

		const response = {  redirect_url: 'https://redirect', order_id: 1 };

		instance.handleSourceSetupResponse( null, response );

		expect( wrapper.contains( <WechatPaymentQRCode /> ) );
	} );

});
