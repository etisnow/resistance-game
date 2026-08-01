import React from 'react';
import './styles.scss';
import GameController from 'client/controllers/gameController';
import {observer} from 'mobx-react-lite';
import {getZIndex} from 'client/components/gameLog/GameLog';


interface IActionInteracterProps {
	controller:  GameController;
}

function getColor(value: number){
	if (value > 1) value = 1;
    var hue=((1-value)*40).toString(10);
    return ["hsl(",hue,",100%,50%)"].join("");
}

const ActionTimer = observer(({controller}: IActionInteracterProps) => {
	if  (!controller.root.timerController.isActive) return null;
	const {currentSeconds, initSeconds, text, seconds: textSeconds} = controller.root.timerController;
	const currentPercentage = currentSeconds / initSeconds
	return <div className={"action-timer-wrapper"} style={{zIndex: getZIndex(controller)}}>
		<div className={'timer-indicator'} style={{width: currentPercentage * 100 +'%', background: getColor(currentPercentage)}}>
			<div className={'inner-text'}>{text} - {textSeconds} сек</div>
		</div>
	</div>
});


export default ActionTimer;
