/**
 * @format
 * @jest-environment jsdom
 */

/**
 * External dependencies
 */
import React from 'react';
import { shallow } from 'enzyme';
import QRCode from 'qrcode.react';

/**
 * Internal dependencies
 */
import { WechatPaymentQRCode } from '../wechat-payment-qrcode';
import { ORDER_TRANSACTION_STATUS } from 'state/order-transactions/constants';

jest.mock( 'i18n-calypso', () => ( {
	localize: x => x,
	translate: x => x,
} ) );

jest.mock( 'page', () => jest.fn() );

import page from 'page';

jest.mock( 'components/data/query-order-transaction', () => {
	const react = require( 'react' );
	return class QueryOrderTransaction extends react.Component {};
} );

import QueryOrderTransaction from 'components/data/query-order-transaction';

const defaultProps = {
	orderId: 1,
	redirectUrl: "wexin://redirect",
	cart: {},
	slug: 'example.com',

	// Redux
	showErrorNotice: jest.fn(),
	transactionReceiptId: null,
	transactionStatus: null,
	transactionError: null,
};

describe( 'WechatPaymentQRCode', () => {
	test( 'has correct components and css', () => {
		const wrapper = shallow( <WechatPaymentQRCode { ...defaultProps } /> );
		expect( wrapper.find( '.checkout__wechat-qrcode-instruction' ) ).toHaveLength( 1 );
		expect( wrapper.find( '.checkout__wechat-qrcode-spinner' ) ).toHaveLength( 1 );
		expect( wrapper.find( '.checkout__wechat-qrcode-redirect' ) ).toHaveLength( 1 );
		expect( wrapper.find( '.checkout__wechat-qrcode' ) ).toHaveLength( 1 );
		expect( wrapper.contains( <QRCode value={ defaultProps.redirect_url } /> ) );
		expect( wrapper.contains( <QueryOrderTransaction /> ) );
	} );

	test( 'transaction success triggers page change', () => {
		const slug = defaultProps.slug;

		const instance = shallow(
			<WechatPaymentQRCode { ...defaultProps }
				transactionStatus={ ORDER_TRANSACTION_STATUS.SUCCESS }
				transactionReceiptId={ 1 }
			/>
		).instance();

		instance.componentDidUpdate();

		expect( page ).toHaveBeenCalledWith( `/checkout/thank-you/${ slug }/1` );
	} );

	test( 'transaction failure triggers page change', () => {
		const slug = defaultProps.slug;

		const instance = shallow(
			<WechatPaymentQRCode { ...defaultProps } transactionStatus={ ORDER_TRANSACTION_STATUS.FAILURE } />
		).instance();

		instance.componentDidUpdate();

		expect( page ).toHaveBeenCalledWith( `/checkout/${ slug }` );
	} );

	test( 'transaction unknown triggers page change', () => {
		const slug = defaultProps.slug;

		const instance = shallow(
			<WechatPaymentQRCode { ...defaultProps } transactionError={ new Error( "Example" ) } />
		).instance();

		instance.componentDidUpdate();

		expect( page ).toHaveBeenCalledWith( `/checkout/${ slug }` );
	} );
});
