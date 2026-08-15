import React from 'react';
import {observer} from 'mobx-react-lite';
import './styles.scss';
import type INotificationAction from 'shared/interfaces/notification';
import GameController from 'client/controllers/gameController';
import {ENotificationAction} from 'shared/enum/notifications';
import * as PIXI from 'pixi.js';
import {Container, Sprite, Text} from 'react-pixi-fiber';
import {getWindowHeight, getWindowWidth, tableCenterY} from 'client/helpers/window';
import Rectangle from 'client/components/pixiPrimitives/Rectangle';

interface INotifierProps {
	controller: GameController;
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

// Окно поверх стола. Сейчас им показывают только текстовые сообщения: вскрытие
// голосов и результат миссии встанут сюда в фазе 3 (см. docs/PLAN.md).
const Notification = observer(({notification, controller}: {notification: INotificationAction, controller: GameController}) => {
	if (notification.type !== ENotificationAction.info) return null;

	return (
		<Container width={getWindowWidth()} height={getWindowHeight()}>
			<Container alpha={0.7} pointerdown={() => {}}>
				<Rectangle xCoord={0} yCoord={0} width={getWindowWidth()} height={getWindowHeight()} color={0}/>
			</Container>
			<Sprite
				texture={PIXI.Texture.WHITE}
				alpha={0}
				interactive={true}
				x={0}
				y={0}
				width={getWindowWidth()}
				height={getWindowHeight()}
				pointerdown={controller.hidENotificationAction}
			/>
			<Container width={getWindowWidth()} height={getWindowHeight()}>
				<Text
					x={getWindowWidth() / 2}
					y={tableCenterY()}
					text={notification.text}
					anchor={0.5}
					style={getFontStyle(18, getWindowWidth() * 0.8)}
				/>
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
