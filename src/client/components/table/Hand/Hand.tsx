import React from 'react';
import {observer} from "mobx-react-lite";
import * as PIXI from 'pixi.js';
import {Container, Sprite} from 'react-pixi-fiber';
import GameController from 'client/controllers/gameController';
import HandComponent from 'client/components/table/Hand/HandComponent';
import {getWindowHeight, getWindowWidth, playerHandHeight, tableCenterX, tableCenterY} from 'client/helpers/window';
import {playerRoomDiag} from 'client/helpers/roomHelpers';
import {EPlayerActionType} from 'shared/enum/playerActions';
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

	// Откуда прилетает взятая карта: колода лежит в центре стола и рисуется
	// картой шириной с бейдж игрока (см. Deck). Контейнер руки опущен к низу
	// экрана и сдвинут пивотом на полширины — на это и поправка.
	const drawnFrom = {
		x: tableCenterX() - getWindowWidth() / 2,
		y: tableCenterY() - (getWindowHeight() - playerHandHeight()),
		angle: 0,
		width: playerRoomDiag(controller.playersList.length),
	};


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
				drawnCardIds={controller.drawnCardIds}
				drawnFrom={drawnFrom}
			/>
		</Container>
	)
});

export default Hand;
