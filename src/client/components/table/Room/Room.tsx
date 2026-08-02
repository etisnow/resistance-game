import React from 'react';
import {clamp, clone, map} from 'lodash';
import './styles.scss';
import {observer} from "mobx-react-lite";
import {config, useTransition} from 'react-spring/universal';
import {degToRag, playerRoomDiag, roomRadii} from 'client/helpers/roomHelpers';
import GameController from 'client/controllers/gameController';
import PlayerBadge from 'client/components/table/PlayerBadge/PlayerBadge';
import CardFlights from 'client/components/table/Room/CardFlight';
import CardEffects from 'client/components/table/Room/CardEffect';
import {EPlayerState, ETurnState} from 'shared/enum/player';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {ENotificationAction} from 'shared/enum/notifications';
import {AnimatedPixi, getPixiTexture} from 'client/components/table/pixiInjected';
import {cardColor, cardImage, tradeColor} from 'client/helpers/cardVisuals';
import {cardAspectRatio} from 'shared/constant/cards';
import {EPanicID} from 'shared/enum/cards';
import {Container, Sprite} from 'react-pixi-fiber';
import Circle from 'client/components/pixiPrimitives/Circle';
import {emojiTexture} from 'client/helpers/emojiTexture';
import {tableCenterX, tableCenterY} from 'client/helpers/window';
import type {IPlayersMap} from 'client/controllers/socketTypes';
import type {IFormatTradeContext} from 'shared/interfaces/common';
import type Player from 'client/models/Player';

interface IRoomProps {
	controller: GameController
}

interface IPoint {
	x: number;
	y: number;
}

// Размер карты действия на стрелке и радиус значка обмена — в долях радиуса
// бейджа. Карта не должна съедать саму стрелку: соседи по столу сидят близко.
const arrowIconShare = 0.55;
// Значок обмена: радиус кружка в долях радиуса бейджа, цвет подложки и шрифты,
// в которых у эмодзи есть цветной глиф.
const tradeIconShare = 0.42;
const tradeIconBackground = 0x14110c;
const handshakeEmoji = '\u{1F91D}';

interface IArrowShape {
	ax: number;
	ay: number;
	bx: number;
	by: number;
	mid1X: number;
	mid1Y: number;
	mid2X: number;
	mid2Y: number;
	arrowX: number;
	arrowY: number;
	arrowRotation: number;
	arrowHeight: number;
	// Середина стрелки: там показывается карта, которой ходят (или значок обмена).
	midX: number;
	midY: number;
	iconSize: number;
	color: number;
}

const getPlayerDeg = (playerId: string, playerList: string[]): number => {
	const playersCount = playerList.length;
	const degDelta = 360 / playersCount;
	const currentDeg = (degDelta * playerList.indexOf(playerId))  + 90;
	return currentDeg;
}

const getCirclePoint = (radius: number, deg: number, centerX: number, centerY: number): IPoint => {
	const currentRad = degToRag(deg);
	const x = radius*Math.cos(currentRad) + centerX;
	const y = radius*Math.sin(currentRad) + centerY;
	return {x,y};
}

const getPositionFromPlayerList = ({players, playerId, playerList}: {players: IPlayersMap, playerId: string, playerList: string[]}): IPoint => {
	const player = players[playerId];
	if (!player) return {x: 0, y:0};
	const playersCount = playerList.length;
	const currentRad = degToRag(getPlayerDeg(playerId, playerList));
	// Стол — эллипс: угол задаёт место игрока за столом, а полуоси подогнаны
	// под форму свободной области (см. roomRadii). Координаты относительно
	// центра стола, его подставляет контейнер.
	const {rx, ry} = roomRadii(playersCount);
	return {x: rx * Math.cos(currentRad), y: ry * Math.sin(currentRad)};
}


const midpoint = (x1: number, y1: number, x2: number, y2: number): IPoint => {
	return {
		x: (x1+x2) /2,
		y: (y1+y2) /2
	}
}

const getDistanceBetweenPoints = (x1: number, y1: number, x2: number, y2: number): number => {
	return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

// Цвет стрелки — цвет карты, которой ходят. Обмен идёт без открытой карты, у
// цепной реакции карта своя — паника, с которой всё началось.
const getArrowColor = ({type, cardId}: IFormatTradeContext): number => {
	if (cardId) return cardColor(cardId);
	if (type === ETurnContextType.chainReaction) return cardColor(EPanicID.chainReaction);
	return tradeColor;
}

interface ILineAnimationArgs {
	context: IFormatTradeContext;
	newPlayerList: string[];
	badgeRadius: number;
	players: IPlayersMap;
}

const lineAnimation = ({context, newPlayerList, badgeRadius, players}: ILineAnimationArgs): IArrowShape => {
	const {offensePlayerId, defensePlayerId} = context;
	const biggerBadgeRad = badgeRadius + 5;

	const {x:ax,y:ay} = getPositionFromPlayerList({players, playerId: offensePlayerId ?? '', playerList: newPlayerList});
	const {x:bx,y:by} = getPositionFromPlayerList({players, playerId: defensePlayerId ?? '', playerList: newPlayerList});

	var angleBetweenPointsDeg = Math.atan2(by - ay, bx - ax) * 180 / Math.PI;


	const APlayerDegree = angleBetweenPointsDeg;
	const BPlayerDegree = angleBetweenPointsDeg - 180;

	const {y:newAY,x:newAX} = getCirclePoint(biggerBadgeRad, APlayerDegree, ax, ay);
	const {y:arrowY,x:arrowX} = getCirclePoint(biggerBadgeRad, BPlayerDegree, bx, by);
	const distanceBetweenArrow = getDistanceBetweenPoints(newAX,newAY,arrowX,arrowY);
	const arrowHeight = clamp(distanceBetweenArrow * 0.35, 3, 15);
	const {y:newBY,x:newBX} = getCirclePoint(biggerBadgeRad + arrowHeight, BPlayerDegree, bx, by);

	const {x: midX, y:midY} = midpoint(newAX, newAY, newBX, newBY);

	const {x: offsettedMid1X, y: offsettedMid1Y} = getCirclePoint(biggerBadgeRad/4, angleBetweenPointsDeg - 90, midX, midY);
	const {x: offsettedMid2X, y: offsettedMid2Y} = getCirclePoint(biggerBadgeRad/4, angleBetweenPointsDeg + 90, midX, midY);


	return {
		ax:newAX,
		ay:newAY,
		bx: newBX,
		by: newBY,
		mid1X: offsettedMid1X,
		mid1Y: offsettedMid1Y,
		mid2X: offsettedMid2X,
		mid2Y: offsettedMid2Y,
		arrowX: arrowX,
		arrowY: arrowY,
		arrowRotation: angleBetweenPointsDeg + 90,
		arrowHeight: arrowHeight,
		midX: midX,
		midY: midY,
		iconSize: badgeRadius * arrowIconShare,
		color: getArrowColor(context),
	}
}


const Room = observer(({controller} : IRoomProps) => {

	const { currentPlayer, currentPlayerId } = controller;
	const { playersList, players } = controller;
	if (!currentPlayer || !currentPlayerId || !playersList) return null;
	const {marks} = currentPlayer;
	const tradeContext: IFormatTradeContext[] = controller.tradeContext || [];
	let newPlayerList = clone(playersList);
	if (controller.isLayoutSequential && currentPlayer.turnState !== ETurnState.dead) {
		const indexOfCurrentPlayer = playersList.indexOf(currentPlayerId);
		let beforeCurrentPlayer = newPlayerList.slice(0, indexOfCurrentPlayer);
		newPlayerList.splice(0, indexOfCurrentPlayer);
		newPlayerList = newPlayerList.concat(beforeCurrentPlayer);
	}


	const playersCount = newPlayerList.length;

	const transitions = useTransition<string, IPoint>(newPlayerList, playerId => playerId, {
		x: 0,
		y: 0,
		from: {
			x: 0, y: 0
		},
		enter: playerId => {
			return getPositionFromPlayerList({players, playerId, playerList: newPlayerList});
		},
		update: playerId => {
			return getPositionFromPlayerList({players, playerId, playerList: newPlayerList});
		},
		leave: () => {
			return {
				x: 0, y: 0
			}
		},
	});

	const badgeDiagonal = playerRoomDiag(playersCount);
	const badgeRadius = badgeDiagonal/2;
	const arrows = useTransition<IFormatTradeContext, IArrowShape>(tradeContext, ({offensePlayerId}) => offensePlayerId ?? '', {
		ax: 0,
		ay: 0,
		bx: 0,
		by: 0,
		mid1X: 0,
		mid1Y: 0,
		mid2X: 0,
		mid2Y: 0,
		arrowX: 0,
		arrowY: 0,
		arrowRotation: 0,
		arrowHeight: 0,
		midX: 0,
		midY: 0,
		iconSize: 0,
		color: 0,
		from: (context) => {
			const {ax, ay, arrowRotation, color} = lineAnimation({context, newPlayerList, badgeRadius, players});
			return {
				ax,
				ay,
				bx: ax,
				by: ay,
				mid1X: ax,
				mid1Y: ay,
				mid2X: ax,
				mid2Y: ay,
				arrowX: ax,
				arrowY: ay,
				arrowRotation,
				arrowHeight: 0,
						midX: ax,
				midY: ay,
				iconSize: 0,
				color,
			}
		},
		enter: (context) => {
			return lineAnimation({context, newPlayerList, badgeRadius, players});
		},
		update: (context) => {
			return lineAnimation({context, newPlayerList, badgeRadius, players});
		},
		leave: (context) => {
			const {bx, by, arrowRotation, color} = lineAnimation({context, newPlayerList, badgeRadius, players});
			return {
				ax: bx,
				ay: by,
				bx: bx,
				by: by,
				mid1X: bx,
				mid1Y: by,
				mid2X: bx,
				mid2Y: by,
				arrowX: bx,
				arrowY: by,
				arrowRotation,
				arrowHeight: 0,
						midX: bx,
				midY: by,
				iconSize: 0,
				color,
			}
		},
		config: config.stiff
	});



	const canPlayerBeSelected = (player: Player): boolean => {
		if (controller.currentAction && controller.currentAction.type === ENotificationAction.playerSelect) {
			return controller.currentAction.playersToSelect.includes(player.id)
		}
		return false;
	}

	return (
		<Container x={tableCenterX()} y={tableCenterY()}>
			{map(transitions, ({item: playerId, key, props:{x, y} }) => {
				const player = players[playerId];
				if (!player || !player.id) return null;
				const {nickname, color, state} = player;
				const inTurn = player.turnState !== ETurnState.idle;
				const canBeSelected = canPlayerBeSelected(player);
				return (
					<AnimatedPixi.Container
						key={key}
						x={x}
						y={y}
					>
						<PlayerBadge
							style={{width:badgeDiagonal, height:badgeDiagonal}}
							nickname={nickname}
							color={color}
							inTurn={inTurn}
							canBeSelected={canBeSelected}
							id={player.id}
							isConnected={player.isConnected}
							isYou={player.isYou}
							isInfected={player.isInfected}
							isThing={player.isThing}
							quarantine={player.quarantine}
							isDoor={state === EPlayerState.door}
							onSelect={controller.selectPlayer}
							onLongPress={controller.changePlayerMark}
							mark={marks[player.id]}
						/>
					</AnimatedPixi.Container>
				)
			})}
			{map(arrows, ({key, item, props }) => {
				if (!props.bx || !props.by) return null
				const {midX, midY, iconSize, color, ...arrowProps} = props;
				const actionImage = cardImage(item.cardId);
				// Вся стрелка проявляется и гаснет по размеру своего значка. Это не
				// только красиво: отживший элемент перехода react-spring со стола не
				// убирает, и без затухания от него остаётся видимый огрызок.
				const fade = iconSize.interpolate(size => clamp(size / (badgeRadius * arrowIconShare), 0, 1));
				return (
					<AnimatedPixi.Container key={key} alpha={fade}>
						<AnimatedPixi.Arrow
							{...arrowProps}
							color={color}
						/>
						{actionImage ? (
							// Карта, которой ходят, — прямо на стрелке: видно, что применили.
							<AnimatedPixi.Sprite
								texture={getPixiTexture(actionImage)}
								anchor={0.5}
								x={midX}
								y={midY}
								width={iconSize}
								height={iconSize.interpolate(size => size * cardAspectRatio)}
							/>
						) : (
							// У обмена карта скрыта — вместо неё «по рукам» на кружке цвета
							// стрелки: на тёмном столе один эмодзи без подложки теряется.
							// Двигается контейнер, а его содержимое статично — так стол не
							// перерисовывает круги и эмодзи покадрово.
							<AnimatedPixi.Container x={midX} y={midY}>
								<Circle r={badgeRadius * tradeIconShare} color={getArrowColor(item)}/>
								<Circle r={badgeRadius * tradeIconShare * 0.84} color={tradeIconBackground}/>
								<Sprite
									texture={emojiTexture(handshakeEmoji)}
									anchor={0.5}
									width={badgeRadius * tradeIconShare * 1.15}
									height={badgeRadius * tradeIconShare * 1.15}
								/>
							</AnimatedPixi.Container>
						)}
					</AnimatedPixi.Container>
				)
			})}
			<CardFlights
				controller={controller}
				getPosition={playerId => getPositionFromPlayerList({players, playerId, playerList: newPlayerList})}
				cardWidth={badgeDiagonal * 0.42}
			/>
			<CardEffects
				controller={controller}
				getPosition={playerId => getPositionFromPlayerList({players, playerId, playerList: newPlayerList})}
				badgeRadius={badgeRadius}
			/>
		</Container>
	)
});

export default Room;
