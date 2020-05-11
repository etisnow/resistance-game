import React from 'react';
import {observer} from 'mobx-react-lite';
import './styles.scss';
import {map} from 'lodash';
import INotificationAction from 'shared/interfaces/notification';
import GameController from 'client/controllers/gameController';
import {ICardAny} from 'shared/interfaces/cards';
import {ENotificationAction} from 'shared/enum/notifications';
import {Container, Text, Sprite} from 'react-pixi-fiber'
import HandComponent from 'client/components/table/Hand/HandComponent';
import {
	autoWidthCard,
	getWindowHeight,
	getWindowWidth,
	playerCardWidthPix,
	playerHandHeight,
} from 'client/helpers/window';
import {getPixiTexture} from 'client/components/table/pixiInjected';
import {resources} from 'client/resources/resources';
import Rectangle from 'client/components/pixiPrimitives/Rectangle';
import {cardAspectRatio} from 'shared/constant/cards';

interface INotifierProps {
	controller:  GameController;
}

/*
const generateCardMenuByNotificationType = (controller: GameController, notification: INotificationAction, cardUniqueId?: string) => {
	return (<div className={'notificationMenuWrapper'}>

		<div
			className={'notificationMenuItem'}
			onClick={() => controller.selectCard(notification, cardUniqueId)}
		>
			Выбрать
		</div>
	</div>)
};*/

const Notification = ({notification, controller}: {notification: INotificationAction, controller: GameController}) => {
	let notificationContent: React.ReactNode = null;
	const okayTexture = getPixiTexture(resources.okay)
	const pivotAtCenter = {x:-getWindowWidth() / 2 , y: getWindowHeight()/2}
	switch (notification.type) {
		case ENotificationAction.okayCard:
			const cardHeight = autoWidthCard(Object.keys(notification.cards).length) * cardAspectRatio;
			notificationContent = (
				<Container width={getWindowWidth()} height={getWindowHeight()}>
					<HandComponent
						cards={notification.cards}
						selectedCardIndex={null}
						autoWidth={true}
						cardActions={{}}
						onSelectCard={() => {}}
						onCardAction={() => {}}
						y={getWindowHeight()/2 - playerHandHeight() /2}
					/>
					<Sprite
						texture={okayTexture}
						interactive={true}
						buttonMode={true}
						pointerdown={() => controller.activatePlayerSelectMode(notification)}
						width={playerCardWidthPix() * 1.5}
						height={playerCardWidthPix() * 1.5}
						anchor={0.5}
						x={getWindowWidth() / 2}
						y={getWindowHeight()/2 +  cardHeight / 2}
					/>
				</Container>
			);
			break;
		case ENotificationAction.selectCard:
			//const menu = (cardUniqueId) => generateCardMenuByNotificationType(controller, notification, cardUniqueId);
			notificationContent = (
				<HandComponent
					cards={notification.cards}
					selectedCardIndex={null}
					autoWidth={true}
					cardActions={{}}
					onSelectCard={() => {}}
					onCardAction={() => {}}
					y={getWindowHeight()/2 - playerHandHeight() /2}
				/>
			);
			break;
	}
	if (!notificationContent) return null;

	return (
		<Container width={getWindowWidth()} height={getWindowHeight()}>
			<Container alpha={0.7}>
				<Rectangle xCoord={0} yCoord={0} width={getWindowWidth()} height={getWindowHeight()}/>
			</Container>
			<Text text={notification.text} />
			{notificationContent}
		</Container>
	)
};

const Notifier = observer(({controller}: INotifierProps) => {
	const notifications = controller.notifications;
	if (notifications.length === 0) return null;
	const notification = notifications[0];
	return <Notification notification={notification} controller={controller}/>;
});

export default Notifier;
