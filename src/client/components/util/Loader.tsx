import React from 'react';
import './Loader.scss';

export function Loader() {
	return (
		<div className={'loaderWrapper'}>
			<div className={"lds-hourglass"}></div>
		</div>
	)
}