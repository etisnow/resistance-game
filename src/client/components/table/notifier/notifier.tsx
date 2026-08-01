import React from 'react';
import {observer} from 'mobx-react-lite';
import './styles.scss';
import {reduce} from 'lodash';
import type INotificationAction from 'shared/interfaces/notification';
import type {IHandActionsMap} from 'client/controllers/socketTypes';
import GameController from 'client/controllers/gameController';
import {ENotificationAction} from 'shared/enum/notifications';
import * as PIXI from 'pixi.js';
import {Container, Sprite, Text} from 'react-pixi-fiber';
import HandComponent from 'client/components/table/Hand/HandComponent';
import {
	autoWidthCard,
	getWindowHeight,
	getWindowWidth,
	playerCardWidthPix,
	playerHandHeight,
	selectedNotificationCardScale,
} from 'client/helpers/window';
import {getPixiTexture} from 'client/components/table/pixiInjected';
import {resources} from 'client/resources/resources';
import Rectangle from 'client/components/pixiPrimitives/Rectangle';
import {cardAspectRatio} from 'shared/constant/cards';
import {EPlayerActionType} from 'shared/enum/playerActions';

interface INotifierProps {
	controller:  GameController;
}

const getFontStyle = (fontSize: number, maxWidth: number) => ({
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
	// Центр ряда карт и его высота С УЧЁТОМ увеличения выбранной карты. Подпись и
	// кнопку вешаем ПОД ряд: сверху висит бейдж действия (DOM) с тем же текстом, и
	// раньше надписи налезали друг на друга.
	const cardsRowCenterY = getWindowHeight() / 2 - playerHandHeight() / 2;
	const rowHeight = (cardsCount: number) =>
		autoWidthCard(cardsCount) * cardAspectRatio * selectedNotificationCardScale;
	const textY = (rowCardHeight: number) => cardsRowCenterY + rowCardHeight / 2 + notificationFontSize * 1.2;
	let cardHeight = 0;
	switch (notification.type) {
		case ENotificationAction.okayCard:
			cardHeight = rowHeight(Object.keys(notification.cards).length);
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
						y={textY(cardHeight) + notificationFontSize + ((playerCardWidthPix() * 1.5) / 2)}
					/>
					<Text
						x={getWindowWidth() / 2}
						y={textY(cardHeight)}
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
			cardHeight = rowHeight(Object.keys(notification.cards).length);
			const menuAccumulator: IHandActionsMap = {};
			const menu = reduce(notification.cards, (acc, card) => {
				const uniqueId = card.uniqueId;
				if (uniqueId) {
					acc[uniqueId] = [{type: EPlayerActionType.cardSelect, menuType: EPlayerActionType.cardSelect}]
				}
				return acc;
			}, menuAccumulator);

			const handleCardSelect = (cardUniqueId: string, _actionType: EPlayerActionType) => {
				controller.cardAction(EPlayerActionType.cardSelect, cardUniqueId)
				controller.hidENotificationAction();
			}

			notificationContent = (
				<React.Fragment>
					<Text
						x={getWindowWidth() / 2}
						y={textY(cardHeight)}
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
				<Rectangle xCoord={0} yCoord={0} width={getWindowWidth()} height={getWindowHeight()} color={0}/>
			</Container>
			{/* Клик мимо карт снимает увеличение выбранной карты (карты лежат выше и
			    перехватывают клик первыми — pixi ищет попадание с конца списка). */}
			<Sprite
				texture={PIXI.Texture.WHITE}
				alpha={0}
				interactive={true}
				x={0}
				y={0}
				width={getWindowWidth()}
				height={getWindowHeight()}
				pointerdown={() => {controller.cardInNotificationPreview = null}}
			/>
			<Container width={getWindowWidth()} height={getWindowHeight()}>
				{notificationContent}
			</Container>
		</Container>
	)
});

const Notifier = observer(({controller}: INotifierProps) => {
	const notifications = controller.notifications;
	// length проверяем первым: чтение индекса за границей observable-массива
	// печатает варнинг mobx на каждый рендер.
	const notification = notifications.length ? notifications[0] : undefined;
	if (!notification) return null;
	return <Notification notification={notification} controller={controller}/>;
});

export default Notifier;
