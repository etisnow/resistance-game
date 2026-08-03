import React from 'react';
import {observer} from "mobx-react-lite";
import * as PIXI from 'pixi.js';
import {Container, Sprite} from 'react-pixi-fiber';
import GameController from 'client/controllers/gameController';
import HandComponent from 'client/components/table/Hand/HandComponent';
import {getWindowHeight, getWindowWidth, playerHandHeight, tableCenterX, tableCenterY} from 'client/helpers/window';
import {playerRoomDiag, roomPlayerOrder, roomPlayerPoint} from 'client/helpers/roomHelpers';
import {EPlayerActionType} from 'shared/enum/playerActions';
import {ETurnState} from 'shared/enum/player';

// Каким размером карта отрывается от чужого кружка, в долях его диаметра: не
// точкой (её не разглядеть), но и не картой во всю руку — на столе она лежит
// далеко.
const badgeCardShare = 0.28;
interface IHandProps {
	controller: GameController
}

const Hand = observer(({controller} : IHandProps) => {

	const selectedCardIndex = controller.cardInPreview;
	const {currentPlayer:player, hand} = controller;
	if (!player || !hand) return null;

	const cardSelection = (index: string) => {
		if (selectedCardIndex === index) {
			controller.cardInPreview = null;
		} else {
			controller.cardInPreview = index;
		}
	};

	const handleCardAction = (cardUniqueId: string, cardAction: EPlayerActionType) => {
		controller.cardInPreview = null;
		controller.cardAction(cardAction, cardUniqueId)
	};

	// Точки стола в координатах контейнера руки: он опущен к низу экрана и сдвинут
	// пивотом на полширины — на это и поправка.
	const badgeDiagonal = playerRoomDiag(controller.playersList.length);
	const toHandCoords = ({x, y}: {x: number, y: number}) => ({
		x: tableCenterX() + x - getWindowWidth() / 2,
		y: tableCenterY() + y - (getWindowHeight() - playerHandHeight()),
	});
	// Круг игроков — тот же, что рисует стол (см. Room): обычно это просто
	// playersList, а «от первого лица» он прокручен так, что ты сидишь внизу.
	const playerOrder = roomPlayerOrder(
		controller.playersList,
		controller.currentPlayerId ?? '',
		controller.isFirstPersonTable && player.turnState !== ETurnState.dead,
	);
	// Колода лежит в центре стола и рисуется картой шириной с бейдж (см. Deck).
	const deckStyle = {...toHandCoords({x: 0, y: 0}), angle: 0, width: badgeDiagonal};
	// Карта у чужого кружка: маленькая и без наклона. Приходящая вырастает из
	// него, будто её оттуда достали, уходящая — сжимается в него до нуля, будто
	// он её вобрал.
	const badgeStyle = (playerId: string, width: number) =>
		({...toHandCoords(roomPlayerPoint(playerId, playerOrder)), angle: 0, width});

	const {arriving, leaving} = controller;
	const enterFrom = arriving && {
		cardIds: arriving.cardIds,
		style: arriving.playerId ? badgeStyle(arriving.playerId, badgeDiagonal * badgeCardShare) : deckStyle,
	};
	const exitTo = leaving && leaving.playerId
		? {cardIds: leaving.cardIds, style: badgeStyle(leaving.playerId, 0)}
		: null;


	return (
		<Container>
			{/* Пока карта вытащена на просмотр, весь остальной экран — область
			    «положить обратно в руку». Прозрачный спрайт лежит ПОД картами:
			    pixi проверяет попадания с конца списка детей, поэтому сами карты и
			    их меню перехватывают клик первыми, а промах гасит просмотр. */}
			{selectedCardIndex && (
				<Sprite
					texture={PIXI.Texture.WHITE}
					alpha={0}
					interactive={true}
					x={0}
					y={0}
					width={getWindowWidth()}
					height={getWindowHeight()}
					pointerdown={() => {controller.cardInPreview = null}}
				/>
			)}
			<HandComponent
				y={getWindowHeight() - playerHandHeight()}
				cards={hand}
				selectedCardIndex={selectedCardIndex}
				onSelectCard={cardSelection}
				cardActions={controller.handActions}
				onCardAction={handleCardAction}
				enterFrom={enterFrom}
				exitTo={exitTo}
			/>
		</Container>
	)
});

export default Hand;
