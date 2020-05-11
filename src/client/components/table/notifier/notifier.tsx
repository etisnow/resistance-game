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

const Notification = ({notification, controller}: {notification: INotificationAction, controller: GameController}) => {
	let notificationContent: React.ReactNode = null;
	const okayTexture = getPixiTexture(resources.okay)
	//const pivotAtCenter = {x:-getWindowWidth() / 2 , y: getWindowHeight()/2}
	const notificationFontSize = 22;
	switch (notification.type) {
		case ENotificationAction.okayCard:
			const cardHeight = autoWidthCard(Object.keys(notification.cards).length) * cardAspectRatio;
			notificationContent = (
				<React.Fragment>
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
					<Text
						x={getWindowWidth() / 2}
						y={getWindowHeight()/2 -  cardHeight / 2 - notificationFontSize * 2}
						text={notification.text}
						anchor={0.5}
						style={getFontStyle(18, getWindowWidth() * 0.8)}
					/>
				</React.Fragment>
			);
			break;
		case ENotificationAction.selectCard:
			//const menu = (cardUniqueId) => generateCardMenuByNotificationType(controller, notification, cardUniqueId);
			notificationContent = (
				<React.Fragment>
					<HandComponent
						cards={notification.cards}
						selectedCardIndex={null}
						autoWidth={true}
						cardActions={{}}
						onSelectCard={() => {}}
						onCardAction={() => {}}
						y={getWindowHeight()/2 - playerHandHeight() /2}
					/>
					<Text
						x={getWindowWidth() / 2}
						y={getWindowHeight()/2 -  cardHeight / 2 - notificationFontSize * 2}
						text={notification.text}
						anchor={0.5}
						style={getFontStyle(18, getWindowWidth() * 0.8)}
					/>
				</React.Fragment>
			);
			break;
		case ENotificationAction.info:
			//const menu = (cardUniqueId) => generateCardMenuByNotificationType(controller, notification, cardUniqueId);
			notificationContent = (
				<Text
					x={getWindowWidth() / 2}
					y={getWindowHeight()/2 -  cardHeight / 2 - notificationFontSize * 2}
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
			<Container alpha={0.7}>
				<Rectangle xCoord={0} yCoord={0} width={getWindowWidth()} height={getWindowHeight()}/>
			</Container>
			<Container width={getWindowWidth()} height={getWindowHeight()}>
				{notificationContent}
			</Container>
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
