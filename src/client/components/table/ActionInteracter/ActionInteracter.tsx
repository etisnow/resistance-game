import React from 'react';
import './styles.scss';
import GameController from 'client/controllers/gameController';
import {observer} from 'mobx-react-lite';
import INotificationAction from 'shared/interfaces/notification';
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

const ActionInteracter = observer(({controller}: IActionInteracterProps) => {
	if  (!controller.currentAction) return null;
	return <div className={"interaction-badge-wrapper"} style={{zIndex: getZIndex(controller)}}>
		<div className={"interaction-badge"}>
			{controller.currentAction.text}
		</div>
		{ renderAction(controller.currentAction, controller) }
	</div>
});


export default ActionInteracter;
