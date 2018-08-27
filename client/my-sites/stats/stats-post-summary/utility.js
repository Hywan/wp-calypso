/** @format */
/**
 * External dependencies
 */
import { findIndex, findLastIndex, flatten, get, range } from 'lodash';

export function generateDayChartData( data, moment ) {
	if ( ! data ) {
		return [];
	}

	return data.slice( Math.max( data.length - 10, 1 ) ).map( ( [ date, value ] ) => {
		const momentDate = moment( date );
		return {
			period: momentDate.format( 'MMM D' ),
			periodLabel: momentDate.format( 'LL' ),
			value,
		};
	} );
}

export function generateWeekChartData( weeks, moment ) {
	if ( ! weeks ) {
		return [];
	}

	return weeks.map( week => {
		const firstDay = moment( week.days[ 0 ].day );
		return {
			period: firstDay.format( 'MMM D' ),
			periodLabel: firstDay.format( 'L' ) + ' - ' + firstDay.add( 6, 'days' ).format( 'L' ),
			value: week.total,
		};
	} );
}

export function generateMonthChartData( years, moment ) {
	if ( ! years ) {
		return [];
	}

	const months = flatten(
		Object.keys( years ).map( year => {
			return range( 1, 13 ).map( month => {
				const firstDayOfMonth = moment( `1/${ month }/${ year }`, 'DD/MM/YYYY' );
				return {
					period: firstDayOfMonth.format( 'MMM YYYY' ),
					periodLabel: firstDayOfMonth.format( 'MMMM YYYY' ),
					value: get( years, [ year, 'months', month ], 0 ),
				};
			} );
		} )
	);
	const firstNotEmpty = findIndex( months, item => item.value !== 0 );
	const lastNotEmpty = findLastIndex( months, item => item.value !== 0 );

	return months.slice( firstNotEmpty, lastNotEmpty + 1 );
}

export function generateYearChartData( years ) {
	if ( ! years ) {
		return [];
	}

	return Object.keys( years ).map( year => {
		return {
			period: year,
			periodLabel: year,
			value: years[ year ].total,
		};
	} );
}
