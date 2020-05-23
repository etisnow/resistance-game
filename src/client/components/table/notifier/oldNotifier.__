import React from 'react';
import {observer} from 'mobx-react-lite';
import './styles.scss';
import {map} from 'lodash';
import INotificationAction from 'shared/interfaces/notification';
import GameController from 'client/controllers/gameController';
import {ICardAny} from 'shared/interfaces/cards';
//import Card from 'client/components/table/Card/___Card';
import {ENotificationAction} from 'shared/enum/notifications';
import Card from 'client/components/table/Card/Card';

interface INotifierProps {
	controller:  GameController;
}


const generateCardMenuByNotificationType = (controller: GameController, notification: INotificationAction, cardUniqueId?: string) => {
	return (<div className={'notificationMenuWrapper'}>
		<div
			className={'notificationMenuItem'}
			onClick={() => controller.selectCard(notification, cardUniqueId)}
		>
			Выбрать
		</div>
	</div>)
};

const CardsViewer = ({cards, menu}: {cards: ICardAny[], menu: (a?:any) => React.ReactNode}) => {
	return <div className={'cardsViewer'}>
		{map(cards, (card: ICardAny, index) => {
			return null
			//return <Card key={index} {...card} menu={menu(card.uniqueId)}/>
		})}
	</div>
};

const Notification = ({notification, controller}: {notification: INotificationAction, controller: GameController}) => {
	let notificationContent: React.ReactNode = null;
	switch (notification.type) {
		case ENotificationAction.okayCard:
			notificationContent = (
				<React.Fragment>
					<CardsViewer
						cards={notification.cards}
						menu={() => null}
					/>
					<div className={"centeredNotificationRow"}>
						<div
							className={'okayNotificationButton'}
							onClick={() => controller.activatePlayerSelectMode(notification)}
						>
							Okay
						</div>
					</div>
				</React.Fragment>
			);
			break;
		case ENotificationAction.selectCard:
			const menu = (cardUniqueId) => generateCardMenuByNotificationType(controller, notification, cardUniqueId);
			notificationContent = (<CardsViewer
				cards={notification.cards ? notification.cards : []}
				menu={menu}/>);
			break;
	}
	if (!notificationContent) return null;
	return (
		<div className={'notificationWrapper'}>
			<span className={'notificationText'}>{notification.text}</span>
			<div className={'notificationRow'}>
				{notificationContent}
			</div>
		</div>
	)
};

const Notifier = observer(({controller}: INotifierProps) => {
	const notifications = controller.notifications;
	if (notifications.length === 0) return null;
	const notification = notifications[0];
	return <Notification notification={notification} controller={controller}/>;
});

export default Notifier;
