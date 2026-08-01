import './style.scss';
import React from 'react';
import {observer} from 'mobx-react-lite';

interface ILoadingScreenProps {
	// Доля загруженного, 0..1.
	progress: number;
}

// Экран стартовой загрузки ассетов — показывается до лобби.
export const LoadingScreen = observer(({progress}: ILoadingScreenProps) => {
	const percent = Math.min(100, Math.max(0, Math.round(progress * 100)));
	return (
		<div className={'loading-screen'}>
			<h1>Нечто</h1>
			<div className={'loading-bar'}>
				<div className={'loading-bar-fill'} style={{width: `${percent}%`}}/>
			</div>
			<span className={'loading-label'}>Загрузка… {percent}%</span>
		</div>
	);
});
