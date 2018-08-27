/** @format */

/**
 * External dependencies
 */
import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { localize } from 'i18n-calypso';
import { connect } from 'react-redux';
import { flowRight } from 'lodash';

/**
 * Internal dependencies
 */
import SummaryChart from '../stats-summary';
import SectionNav from 'components/section-nav';
import SimplifiedSegmentedControl from 'components/segmented-control/simplified';
import QueryPostStats from 'components/data/query-post-stats';
import { getPostStats, isRequestingPostStats } from 'state/stats/posts/selectors';
import {
	generateDayChartData,
	generateWeekChartData,
	generateMonthChartData,
	generateYearChartData,
} from './utility';

class StatsPostSummary extends Component {
	static propTypes = {
		postId: PropTypes.number,
		siteId: PropTypes.number,
		translate: PropTypes.func,
	};

	constructor( props ) {
		super( props );

		this.periods = [
			{ value: 'day', label: this.props.translate( 'Days' ) },
			{ value: 'week', label: this.props.translate( 'Weeks' ) },
			{ value: 'month', label: this.props.translate( 'Months' ) },
			{ value: 'year', label: this.props.translate( 'Years' ) },
		];

		this.state = { period: 'day' };
	}

	selectPeriod = ( { value: period } ) => this.setState( { selectedRecord: undefined, period } );
	selectRecord = selectedRecord => this.setState( { selectedRecord } );

	getChartData() {
		const { moment, stats } = this.props;
		if ( ! stats ) {
			return [];
		}

		switch ( this.state.period ) {
			case 'day':
				return generateDayChartData( stats.data, moment );
			case 'week':
				return generateWeekChartData( stats.weeks, moment );
			case 'month':
				return generateMonthChartData( stats.years, moment );
			case 'year':
				return generateYearChartData( stats.years );
			default:
				return [];
		}
	}

	render() {
		const { isRequesting, postId, siteId, translate } = this.props;
		const chartData = this.getChartData();
		const selectedRecord =
			! this.state.selectedRecord && chartData.length
				? chartData[ chartData.length - 1 ]
				: this.state.selectedRecord;

		return (
			<div className="stats-post-summary">
				<QueryPostStats siteId={ siteId } postId={ postId } />
				<SectionNav>
					<SimplifiedSegmentedControl
						compact
						initialSelected={ this.state.period }
						onSelect={ this.selectPeriod }
						options={ this.periods }
					/>
				</SectionNav>

				<SummaryChart
					isLoading={ isRequesting && ! chartData.length }
					data={ chartData }
					selected={ selectedRecord }
					activeKey="period"
					dataKey="value"
					labelKey="periodLabel"
					labelClass="visible"
					sectionClass="is-views"
					tabLabel={ translate( 'Views' ) }
					onClick={ this.selectRecord }
				/>
			</div>
		);
	}
}

const connectComponent = connect( ( state, { siteId, postId } ) => {
	return {
		stats: getPostStats( state, siteId, postId ),
		isRequesting: isRequestingPostStats( state, siteId, postId ),
	};
} );

export default flowRight(
	connectComponent,
	localize
)( StatsPostSummary );
