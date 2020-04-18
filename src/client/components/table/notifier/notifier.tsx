import React from 'react';
import {observer} from 'mobx-react-lite';
import './styles.scss';
import {map} from 'lodash';
import INotification from 'shared/interfaces/notification';
import GameController from 'client/controllers/gameController';
import {ICardAny} from 'shared/interfaces/cards';
import Card from 'client/components/table/Card/Card';
import {ENotification} from 'shared/enum/notifications';

interface INotifierProps {
	controller:  GameController;
}


const generateCardMenuByNotificationType = (controller: GameController, notification: INotification, cardUniqueId?: string) => {
	let menu :any = null;
	switch (notification.type) {
		case ENotification.info:
			menu = (<div
				className={'notificationMenuItem'}
				onClick={() => controller.hideNotification(notification)}
			>
				Okay
			</div>);
			break;
		case ENotification.okayCard:
			if (!notification.cards) return null;
			menu = (<div
				className={'notificationMenuItem'}
				onClick={() => controller.hideNotification(notification)}
			>
				Ок, понял
			</div>);
			break;
		case ENotification.selectCard:
			menu = (<div
				className={'notificationMenuItem'}
				onClick={() => controller.selectCard(notification, cardUniqueId)}
			>
				Выбрать
			</div>);
			break;
	}
	return (<div className={'notificationMenuWrapper'}>
		{menu}
	</div>)
};

const CardsViewer = ({cards, menu}: {cards: ICardAny[], menu: (a?:any) => React.ReactNode}) => {
	return <div className={'cardsViewer'}>
		{map(cards, (card: ICardAny, index) => {
			return <Card key={index} {...card} menu={menu(card.uniqueId)}/>
		})}
	</div>
};

const Notification = ({notification, controller}: {notification: INotification, controller: GameController}) => {
	let notificationContent: React.ReactNode = null;
	switch (notification.type) {
		case ENotification.info:
			notificationContent = <div></div>;
			break;
		case ENotification.okayCard:
			if (!notification.cards) return null;
			notificationContent = (
				<React.Fragment>
					<CardsViewer
						cards={notification.cards}
						menu={() => null}/>
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
		case ENotification.selectCard:
			const menu = (cardUniqueId) => generateCardMenuByNotificationType(controller, notification, cardUniqueId);
			notificationContent = (<CardsViewer
				cards={notification.cards ? notification.cards : []}
				menu={menu}/>);
			break;
		case ENotification.playerSelect:
			notificationContent = (
				<div className={"centeredNotificationRow"}>
					<div
						className={'okayNotificationButton'}
						onClick={() => controller.activatePlayerSelectMode(notification)}
					>
						Okay
					</div>
				</div>
			);
			break;
	}
	return (
		<div className={'notificationWrapper'}>
			<h3>{notification.text}</h3>
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
