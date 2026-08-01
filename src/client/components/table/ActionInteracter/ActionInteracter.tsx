import React from 'react';
import './styles.scss';
import GameController from 'client/controllers/gameController';
import {observer} from 'mobx-react-lite';
import type INotificationAction from 'shared/interfaces/notification';
import {ENotificationAction} from 'shared/enum/notifications';
import {map} from 'lodash';
import cn from 'classnames';
import {getZIndex} from 'client/components/gameLog/GameLog';


interface IActionInteracterProps {
	controller:  GameController;
}

const renderAction = (action: INotificationAction, controller: GameController) => {
	if (action.type !== ENotificationAction.actionDecision && action.type !== ENotificationAction.gameEnd) return null;
	return (
		<div className={"menu-wrapper"}>
			<div className={"centeredNotificationRow column"}>
				{map(action.menu, ({text, action}) => {
					return (<div
						key={action}
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
	const notifications = controller.notifications;
	const firstNotification = notifications.length ? notifications[0] : undefined;
	const endGameNotification = (firstNotification && firstNotification.type === ENotificationAction.gameEnd) ? firstNotification : null;
	const action = endGameNotification ? endGameNotification : controller.currentAction
	if  (!action) return null;
	// Со свёрнутым логом бейдж — единственный источник "что от меня хотят",
	// поэтому он крупнее и пульсирует.
	const isBig = !controller.isGameLogOpen;
	return <div className={"interaction-badge-wrapper"} style={{zIndex: getZIndex(controller)}}>
		<div className={cn("interaction-badge", {big: isBig})}>
			{action.text}
		</div>
		{ renderAction(action, controller) }
	</div>
});


export default ActionInteracter;
