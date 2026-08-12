import React from 'react';
import {map, range} from 'lodash';
import * as PIXI from 'pixi.js';
import {Container, Sprite, Text} from 'react-pixi-fiber';
import Circle from 'client/components/pixiPrimitives/Circle';
import Ellipse from 'client/components/pixiPrimitives/Ellipse';
import Plate from 'client/components/pixiPrimitives/Plate';
import {tableSquash} from 'client/helpers/roomHelpers';
import {resources} from 'client/resources/resources';
import {getPixiTexture} from 'client/components/table/pixiInjected';
import {toggleCardHintFor} from 'client/components/hint/canvasHint';
import {EPlayerMark} from 'shared/enum/playerMarks';
import {EEventID} from 'shared/enum/cards';
import {cardAspectRatio} from 'shared/constant/cards';

interface IPlayerBadgeProps {
	id: string;
	nickname: string | null;
	color: string;
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
// Дверь на месте игрока — это сама карта «Заколоченная дверь» (см. ниже).
const doorCardTexture = getPixiTexture(resources.barricade);
/*Marks*/
const playerStatusQuestion = getPixiTexture(resources.playerStatusQuestion);
const playerStatusThing = getPixiTexture(resources.playerStatusThing);
const playerStatusInfected = getPixiTexture(resources.playerStatusInfected);
const playerStatusClear = getPixiTexture(resources.playerStatusClear);

export const formatNickname = (nickname: string | null): string | null => {
	if (!nickname) return null;
	return nickname.substring(0,4).toUpperCase()
};

// Точки отсчитывают оставшиеся ходы карантина. Нажатие по ним показывает саму
// карту «Карантин»: по жёлтым точкам не догадаться, что именно на игрока сыграли.
// Сами точки крошечные, поэтому область нажатия растягиваем на всю ширину бейджа
// и делаем не тоньше пальца.
const quarantineHitHeight = 30;

interface IQuarantineProps {
	quarantine: number;
	// Габариты кружка: он вытянут по вертикали (см. badgeAspect), поэтому точки
	// разложены по его ширине, а опущены — по его высоте.
	badgeWidth: number;
	badgeHeight: number;
	isInteractive: boolean;
}

const Quarantine = ({quarantine, badgeWidth, badgeHeight, isInteractive}: IQuarantineProps) => {
	const r = (badgeWidth / 2) * 0.05;
	const yOffset = (badgeHeight / 2) * 0.45;
	const xOffset = r * 4;
	if (!quarantine) return null;
	const hitWidth = Math.max(badgeWidth / 2, r * 4 * quarantine);
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

// Подпись на кружке. У всех она белая прямо по кружку, а свой ник — белым по
// тёмной подложке: за абсолютным столом (см. roomPlayerOrder) сидишь ты где
// угодно, а не всегда внизу, и себя надо находить взглядом. Одним только ником
// себя не найти — он такой же, как у соседей.
const nicknameStyle = new PIXI.TextStyle({fontFamily: 'Arial', fontSize: 14, fill: 0xFFFFFF, align: 'center'});
const youNicknameStyle = new PIXI.TextStyle({fontFamily: 'Arial', fontSize: 14, fontWeight: 'bold', fill: 0xFFFFFF, align: 'center'});
const youPlateColor = 0x14110C;
// Поля подложки вокруг букв и её скругление в долях высоты: половина — и края
// выходят полукруглыми.
const youPlatePadX = 7;
const youPlatePadY = 3;
const youPlateRadiusShare = 0.5;

// Ник на подложке. Подложку меряем по самим буквам, а не по кружку: ники бывают
// от одной буквы до четырёх (см. formatNickname), и подложка на глаз то жала бы
// длинный, то болталась вокруг короткого.
const YouNickname = ({text}: {text: string}) => {
	const {width, height} = PIXI.TextMetrics.measureText(text, youNicknameStyle);
	const plateHeight = height + youPlatePadY * 2;
	return (
		<Container>
			<Plate
				plateWidth={width + youPlatePadX * 2}
				plateHeight={plateHeight}
				borderRadius={plateHeight * youPlateRadiusShare}
				color={youPlateColor}
			/>
			<Text text={text} anchor={0.5} style={youNicknameStyle}/>
		</Container>
	);
};

// Тень под игроком. Без неё кружок висит над столом, а не стоит у него: пол
// (и столешница, на которую тень заходит у ближних мест) — это та же плоскость,
// что и стол, поэтому и тень лежит в его проекции, сплюснутым эллипсом.
//
// Двумя кольцами: снаружи пожиже, внутри плотнее — у одного сплошного эллипса
// слишком резкий край, и он читается лужей, а не тенью.
const badgeShadows = [
	{spread: 0.66, alpha: 0.3},
	{spread: 0.46, alpha: 0.35},
];
// Насколько тень приплюснута сверх проекции стола (она лежит, а не стоит) и где
// она начинается — в долях высоты кружка от его середины.
const shadowFlatten = 0.42;
const shadowDrop = 0.44;

const PlayerShadow = ({badgeWidth, badgeHeight}: {badgeWidth: number, badgeHeight: number}) => (
	<Container interactiveChildren={false}>
		{map(badgeShadows, ({spread, alpha}) => (
			<Ellipse
				key={spread}
				yCoord={badgeHeight * shadowDrop}
				rx={badgeWidth * spread}
				ry={badgeWidth * spread * tableSquash * shadowFlatten}
				color={0x000000}
				alpha={alpha}
			/>
		))}
	</Container>
);

const playerBadgesByKey: Record<string, string | undefined> = resources.playerBadges;
const colorBadgesCount = 11;

interface IBadgeResourceArgs {
	isDoor: boolean;
	isConnected: boolean;
	color: string;
	isThing: boolean;
	isInfected: boolean;
}

export const getBadgeResource = ({isDoor, isConnected, color, isThing, isInfected}: IBadgeResourceArgs): string | undefined => {
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
	// Дверь — не игрок, а сыгранная между соседями карта «Заколоченная дверь»:
	// её и рисуем — самой картой, прямоугольником и в карточных пропорциях, а не
	// кружком в чужой шкуре. Высоту ей оставляем ту же, что у кружков, чтобы
	// место за столом выглядело занятым ровно так же.
	const bodyTexture = isDoor ? doorCardTexture : getPixiTexture(badgeResource);
	const bodyWidth = isDoor ? style.height / cardAspectRatio : style.width;
	// На кружке у всех ник, включая свой: что кружок твой, говорит этикетка над
	// ним (см. YouTag), а раньше вместо ника там стояло «ТЫ» — и собственное имя
	// за столом было не найти.
	//
	// Пустая строка, а не undefined: prop со значением undefined react-pixi-fiber
	// не применяет, а печатает «ignoring prop» на каждый рендер бейджа.
	const nick = formatNickname(nickname) ?? ''
	return (
		<Container pointerdown={markPlayer} buttonMode={true} interactive={true}>
			<PlayerShadow badgeWidth={bodyWidth} badgeHeight={style.height}/>
			{canBeSelected && (
				<Sprite
					texture={playerGlowTexture}
					anchor={0.5}
					width={bodyWidth * 1.35}
					height={style.height * 1.35}
				/>
			)}

			{/* Кружок игрока — эллипс, а не круг: он стоит за столом, который мы
			    видим из-за его края, и вытянут по вертикали (см. badgeAspect).
			    Картинка бейджа круглая, растягивает её сам спрайт. */}
			<Sprite
				texture={bodyTexture}
				anchor={0.5}
				width={bodyWidth}
				height={style.height}
				alpha={quarantine>0 ? 0.4 : 1}
				interactive={canBeSelected || isDoor}
				buttonMode={canBeSelected || isDoor}
				pointerdown={onBadgePointerDown}
			/>
			{!isDoor && (
				<React.Fragment>
					{isYou
						? <YouNickname text={nick}/>
						: <Text text={nick} anchor={0.5} style={nicknameStyle}/>}
					<Quarantine
						quarantine={quarantine}
						badgeWidth={style.width}
						badgeHeight={style.height}
						isInteractive={!canBeSelected}
					/>
					{/* Роль игрока — это сам бейдж: отдельных значков нечто/заражения нет. */}
					{(mark && mark !==EPlayerMark.none && !isRoleKnown) && (
						<Sprite
							texture={getMarkTexture(mark)}
							anchor={0.5}
							y={-style.height/4}
							width={style.width * 0.3}
							height={style.width * 0.3}
						/>
					)}
				</React.Fragment>
			)}
		</Container>
	)
};

export default PlayerBadge;
