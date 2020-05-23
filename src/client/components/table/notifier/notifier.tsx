import React from 'react';
import {observer} from 'mobx-react-lite';
import './styles.scss';
import {reduce} from 'lodash';
import INotificationAction from 'shared/interfaces/notification';
import GameController from 'client/controllers/gameController';
import {ENotificationAction} from 'shared/enum/notifications';
import {Container, Sprite, Text} from 'react-pixi-fiber';
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
import {EPlayerActionType} from 'shared/enum/playerActions';

interface INotifierProps {
	controller:  GameController;
}

const getFontStyle = (fontSize, maxWidth) => ({
    align: "center",
    dropShadow: true,
    dropShadowAngle: 90,
    dropShadowBlur: 4,
    dropShadowColor: "#63fe6a",
    dropShadowDistance: 1,
    fill: "white",
    letterSpacing: 1,
    lineHeight: 26,
    lineJoin: "round",
    stroke: "#91ff88",
    textBaseline: "bottom",
    wordWrap: true,
    fontSize: fontSize,
    wordWrapWidth: maxWidth
})

const Notification = observer(({notification, controller}: {notification: INotificationAction, controller: GameController}) => {
	let notificationContent: React.ReactNode = null;
	const okayTexture = getPixiTexture(resources.okay)
	const {cardInNotificationPreview} = controller;

	const notificationFontSize = 22;
	let cardHeight = 0;
	switch (notification.type) {
		case ENotificationAction.okayCard:
			cardHeight = autoWidthCard(Object.keys(notification.cards).length) * cardAspectRatio;
			notificationContent = (
				<React.Fragment>
					<Sprite
						texture={okayTexture}
						interactive={true}
						buttonMode={true}
						pointerdown={() => controller.activatePlayerSelectMode(notification)}
						width={playerCardWidthPix() * 1.5}
						height={playerCardWidthPix() * 1.5}
						anchor={0.5}
						x={getWindowWidth() / 2}
						y={getWindowHeight()/2 +  cardHeight / 2 + ((playerCardWidthPix() * 1.5) / 2)}
					/>
					<Text
						x={getWindowWidth() / 2}
						y={getWindowHeight()/2 -  cardHeight / 2 - notificationFontSize * 2}
						text={notification.text}
						anchor={0.5}
						style={getFontStyle(18, getWindowWidth() * 0.8)}
					/>
					<HandComponent
						cards={notification.cards}
						selectedCardIndex={cardInNotificationPreview}
						autoWidth={true}
						cardActions={{}}
						onSelectCard={controller.selectNotificationCardPreview}
						onCardAction={() => {}}
						y={getWindowHeight()/2 - playerHandHeight() /2}
					/>
				</React.Fragment>
			);
			break;
		case ENotificationAction.selectCard:
			//const menu = (cardUniqueId) => generateCardMenuByNotificationType(controller, notification, cardUniqueId);
			cardHeight = autoWidthCard(Object.keys(notification.cards).length) * cardAspectRatio;
			const menu = reduce(notification.cards, (acc, card) => {
				acc[card.uniqueId] = [{menuType: 'select'}]
				return acc;
			}, {});

			const handleCardSelect = (cardUniqueId, actionType) => {
				controller.cardAction(EPlayerActionType.cardSelect, cardUniqueId)
				controller.hidENotificationAction();
			}

			notificationContent = (
				<React.Fragment>
					<Text
						x={getWindowWidth() / 2}
						y={getWindowHeight()/2 -  cardHeight / 2 - notificationFontSize * 3}
						text={notification.text}
						anchor={0.5}
						style={getFontStyle(18, getWindowWidth() * 0.8)}
					/>
					<HandComponent
						cards={notification.cards}
						selectedCardIndex={cardInNotificationPreview}
						autoWidth={true}
						cardActions={menu}
						onSelectCard={controller.selectNotificationCardPreview}
						onCardAction={handleCardSelect}
						y={getWindowHeight()/2 - playerHandHeight() /2}
					/>
				</React.Fragment>
			);
			break;
		case ENotificationAction.info:
			notificationContent = (
				<Text
					x={getWindowWidth() / 2}
					y={getWindowHeight()/2}
					text={notification.text}
					anchor={0.5}
					style={getFontStyle(18, getWindowWidth() * 0.8)}
				/>
			);
			break;
	}
	if (!notificationContent) return null;

	return (
		<Container width={getWindowWidth()} height={getWindowHeight()}>
			<Container alpha={0.7} pointerdown={() => {}}>
				<Rectangle xCoord={0} yCoord={0} width={getWindowWidth()} height={getWindowHeight()}/>
			</Container>
			<Container width={getWindowWidth()} height={getWindowHeight()}>
				{notificationContent}
			</Container>
		</Container>
	)
});

const Notifier = observer(({controller}: INotifierProps) => {
	const notifications = controller.notifications;
	if (notifications.length === 0) return null;
	const notification = notifications[0];
	return <Notification notification={notification} controller={controller}/>;
});

export default Notifier;
