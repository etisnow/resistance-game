import React from 'react';
import {map, range} from 'lodash';
import * as PIXI from 'pixi.js';
import {Container, Sprite, Text} from 'react-pixi-fiber';
import Circle from 'client/components/pixiPrimitives/Circle';
import {resources} from 'client/resources/resources';
import {getPixiTexture} from 'client/components/table/pixiInjected';
import {toggleCardHintFor} from 'client/components/hint/canvasHint';
import {EPlayerMark} from 'shared/enum/playerMarks';
import {EEventID} from 'shared/enum/cards';

interface IPlayerBadgeProps {
	id: string;
	nickname: string | null;
	color: string;
	inTurn: boolean;
	canBeSelected: boolean;
	isDoor: boolean;
	onSelect: ((playerId: string) => void) | null;
	onLongPress: ((playerId: string) => void) | null;
	quarantine: number;
	isYou: boolean;
	isInfected: boolean;
	isThing: boolean;
	isConnected: boolean;
	mark: EPlayerMark | undefined;
	style: {
		width:number;
		height: number;
	}
}


const playerGlowTexture = getPixiTexture(resources.playerbadgeGlow);
/*Marks*/
const playerStatusQuestion = getPixiTexture(resources.playerStatusQuestion);
const playerStatusThing = getPixiTexture(resources.playerStatusThing);
const playerStatusInfected = getPixiTexture(resources.playerStatusInfected);
const playerStatusClear = getPixiTexture(resources.playerStatusClear);

const formatNickname = (nickname: string | null): string | null => {
	if (!nickname) return null;
	return nickname.substring(0,4).toUpperCase()
};

// Точки отсчитывают оставшиеся ходы карантина. Нажатие по ним показывает саму
// карту «Карантин»: по жёлтым точкам не догадаться, что именно на игрока сыграли.
// Сами точки крошечные, поэтому область нажатия растягиваем на всю ширину бейджа
// и делаем не тоньше пальца.
const quarantineHitHeight = 30;

const Quarantine = ({quarantine, badgeRadius, isInteractive}: {quarantine: number; badgeRadius: number; isInteractive: boolean}) => {
	const r = badgeRadius * 0.05;
	const yOffset = badgeRadius * 0.45;
	const xOffset = r * 4;
	if (!quarantine) return null;
	const hitWidth = Math.max(badgeRadius, r * 4 * quarantine);
	const hitArea = new PIXI.Rectangle(-hitWidth / 2, yOffset - quarantineHitHeight / 2, hitWidth, quarantineHitHeight);
	return (
		<Container
			interactive={isInteractive}
			buttonMode={isInteractive}
			hitArea={hitArea}
			pointerdown={(event: PIXI.interaction.InteractionEvent) => isInteractive
				? toggleCardHintFor(EEventID.quarantine, event)
				: null}
		>
			{ map(range(quarantine), (_q, index) => {
				return <Circle key={index} xCoord={(index * r * 4) - xOffset } yCoord={yOffset} color={0xFFFF00} r={r}/>
			})}
		</Container>
	);
}

const playerBadgesByKey: Record<string, string | undefined> = resources.playerBadges;
const colorBadgesCount = 11;

interface IBadgeResourceArgs {
	isDoor: boolean;
	isConnected: boolean;
	color: string;
	isThing: boolean;
	isInfected: boolean;
}

const getBadgeResource = ({isDoor, isConnected, color, isThing, isInfected}: IBadgeResourceArgs): string | undefined => {
	if (isDoor) return playerBadgesByKey['door'];
	if (!isConnected) return playerBadgesByKey['disconnected'];
	// Роль вместо цветного кружка — но только для того, кто её знает: сервер
	// присылает isThing/isInfected нулём всем, кому знать не положено.
	if (isThing) return playerBadgesByKey['thing'];
	if (isInfected) return playerBadgesByKey['infected'];
	// Бейджей всего colorBadgesCount, а цвет — это порядковый номер игрока,
	// поэтому на столе больше 11 человек цвета начинают повторяться, но бейдж есть у всех.
	return playerBadgesByKey[color] ?? playerBadgesByKey[String(Number(color) % colorBadgesCount)];
}

const getMarkTexture = (mark: EPlayerMark | undefined): PIXI.Texture | undefined => {
	switch (mark) {
		case EPlayerMark.question:
			return playerStatusQuestion;
		case EPlayerMark.infected:
			return playerStatusInfected;
		case EPlayerMark.thing:
			return playerStatusThing;
		case EPlayerMark.clear:
			return playerStatusClear;
		default:
			return undefined;
	}
}

const PlayerBadge = ({
		nickname,
		color,
		inTurn = false,
		canBeSelected = false,
		onSelect = null,
		id,
		isDoor,
		quarantine,
		isYou,
		isInfected,
		isThing,
		isConnected,
		style,
		onLongPress = null,
		mark,
	}: IPlayerBadgeProps) => {
/*	const longPress = useLongPress(() => {
	});*/
	// Роль видна по самому бейджу — своей пометкой такого игрока помечать нечего.
	const isRoleKnown = !isDoor && isConnected && (isThing || isInfected);
	const markPlayer = () => {
		if (canBeSelected || isYou || isRoleKnown) return;
		onLongPress && onLongPress(id);
	}

	// Дверь — это не игрок, а лежащая на столе карта «Заколоченная дверь»:
	// нажатие по ней показывает саму карту. Пока дверь можно выбрать целью
	// (топор), выбор важнее подсказки.
	const onBadgePointerDown = (event: PIXI.interaction.InteractionEvent) => {
		if (canBeSelected) {
			onSelect && onSelect(id);
			return;
		}
		if (isDoor) toggleCardHintFor(EEventID.barricade, event);
	};

	// NOTE: цвет приходит только после gameStarter (до старта он ''), поэтому
	// проверка обязана быть ДО поиска текстуры: getPixiTexture кидает исключение,
	// а бросок из рендера роняет весь <Stage> целиком (error boundary тут нет).
	if (!color && !isDoor) return null;
	const badgeResource = getBadgeResource({isDoor, isConnected, color, isThing, isInfected});
	if (!badgeResource) return null;
	const playerBadgeTexture = getPixiTexture(badgeResource);
	// Пустая строка, а не undefined: prop со значением undefined react-pixi-fiber
	// не применяет, а печатает «ignoring prop» на каждый рендер бейджа.
	const nick = isYou ? 'ТЫ' : (formatNickname(nickname) ?? '')
	return (
		<Container pointerdown={markPlayer} buttonMode={true} interactive={true}>
			{canBeSelected && (
				<Sprite
					texture={playerGlowTexture}
					anchor={0.5}
					width={style.height * 1.35}
					height={style.height * 1.35}
				/>
			)}

			<Sprite
				texture={playerBadgeTexture}
				anchor={0.5}
				width={style.height}
				height={style.height}
				alpha={quarantine>0 ? 0.4 : 1}
				interactive={canBeSelected || isDoor}
				buttonMode={canBeSelected || isDoor}
				pointerdown={onBadgePointerDown}
			/>
			{!isDoor && (
				<React.Fragment>
					<Text text={nick} anchor={0.5} style={{fontFamily : 'Arial', fontSize: 14, fill : 0xFFFFFF, align : 'center'}}/>
					<Quarantine quarantine={quarantine} badgeRadius={style.height/2} isInteractive={!canBeSelected} />
					{inTurn && (
						<Circle xCoord={0} yCoord={-style.height/2} color={0x00FF00} r={style.height * 0.07}/>
					)}
					{/* Роль игрока — это сам бейдж: отдельных значков нечто/заражения нет. */}
					{(mark && mark !==EPlayerMark.none && !isRoleKnown) && (
						<Sprite
							texture={getMarkTexture(mark)}
							anchor={0.5}
							y={-style.height/4}
							width={style.height * 0.3}
							height={style.height * 0.3}
						/>
					)}
				</React.Fragment>
			)}
		</Container>
	)
};

export default PlayerBadge;
