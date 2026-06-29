import React from 'react';
import './styles.scss';
import GameController from 'client/controllers/gameController';
import {observer} from 'mobx-react-lite';
import type INotificationAction from 'shared/interfaces/notification';
import {ENotificationAction} from 'shared/enum/notifications';
import { map } from 'lodash';
import {getZIndex} from 'client/components/gameLog/GameLog';


interface IActionInteracterProps {
	controller:  GameController;
}

const renderAction = (action: INotificationAction, controller: GameController) => {
	if (action.type !== ENotificationAction.actionDecision) return null;
	return (
		<div className={"menu-wrapper"}>
			<div className={"centeredNotificationRow column"}>
				{map(action.menu, ({text, action}) => {
					return (<div
						className={'okayNotificationButton'}
						onClick={() => controller.actionDecision(action)}
					>
						{text}
					</div>)
				})}
			</div>
		</div>
	);
}

function getColor(value){
	if (value > 1) value = 1;
    var hue=((1-value)*40).toString(10);
    return ["hsl(",hue,",100%,50%)"].join("");
}

const ActionTimer = observer(({controller}: IActionInteracterProps) => {
	if  (!controller.root.timerController.isActive) return null;
	const {currentSeconds, initSeconds, text} = controller.root.timerController;
	const textSeconds = currentSeconds < 0 ? Math.abs(currentSeconds) + initSeconds : currentSeconds;
	const currentPercentage = currentSeconds / initSeconds
	return <div className={"action-timer-wrapper"} style={{zIndex: getZIndex(controller)}}>
		<div className={'timer-indicator'} style={{width: currentPercentage * 100 +'%', background: getColor(currentPercentage)}}>
			<div className={'inner-text'}>{text} - {textSeconds} сек</div>
		</div>
	</div>
});


export default ActionTimer;
