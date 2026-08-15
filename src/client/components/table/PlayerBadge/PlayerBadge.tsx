import React from 'react';
import {map} from 'lodash';
import * as PIXI from 'pixi.js';
import {Container, Sprite, Text} from 'react-pixi-fiber';
import Ellipse from 'client/components/pixiPrimitives/Ellipse';
import EllipseTexture from 'client/components/pixiPrimitives/EllipseTexture';
import Plate from 'client/components/pixiPrimitives/Plate';
import {tableSquash} from 'client/helpers/roomHelpers';
import {sphereShadeTexture} from 'client/helpers/sphereShade';
import {resources} from 'client/resources/resources';
import {getPixiTexture} from 'client/components/table/pixiInjected';
import Ring from 'client/components/pixiPrimitives/Ring';
import {emojiTexture} from 'client/helpers/emojiTexture';
import {EPlayerMark} from 'shared/enum/playerMarks';
import {cardAspectRatio} from 'shared/constant/layout';

// Золото своего ника. Тот же цвет, что и у «своего» действия на столе: по тёмной
// подложке он выделяется, не споря с зелёным прицелом ходящего.
const youColor = 0xE8C33F;

interface IPlayerBadgeProps {
	id: string;
	nickname: string | null;
	color: string;
	avatar: string;
	canBeSelected: boolean;
	isDoor: boolean;
	onSelect: ((playerId: string) => void) | null;
	onLongPress: ((playerId: string) => void) | null;
	isYou: boolean;
	isConnected: boolean;
	// Лидер этого раунда: он набирает команду.
	isLeader: boolean;
	// Он в команде, которую сейчас обсуждают или которая ушла на дело.
	isOnTeam: boolean;
	// Его роль, если смотрящему её положено знать. null — не положено.
	isSpy: boolean | null;
	mark: EPlayerMark | undefined;
	style: {
		width:number;
		height: number;
	}
}


const playerGlowTexture = getPixiTexture(resources.playerbadgeGlow);
// Пустое место за столом. В «Сопротивлении» таких не бывает — плашка осталась
// от «Нечто» и ждёт, найдётся ли ей применение (см. EPlayerState.door).
const doorCardTexture = getPixiTexture(resources.playerBadges['door']);
const disconnectedTexture = getPixiTexture(resources.playerBadges['disconnected']);
/*Marks*/
const playerStatusQuestion = getPixiTexture(resources.playerStatusQuestion);
const playerStatusThing = getPixiTexture(resources.playerStatusThing);
const playerStatusInfected = getPixiTexture(resources.playerStatusInfected);
const playerStatusClear = getPixiTexture(resources.playerStatusClear);

export const formatNickname = (nickname: string | null): string | null => {
	if (!nickname) return null;
	return nickname.substring(0,4).toUpperCase()
};

// Подпись на кружке. У всех она белая по тёмной подложке, а свой ник — жирный и
// золотой: за абсолютным столом (см. roomPlayerOrder) сидишь ты где угодно, а не
// всегда внизу, и себя надо находить взглядом. Одним только ником себя не найти —
// он такой же, как у соседей.
const nicknameStyle = new PIXI.TextStyle({fontFamily: 'Arial', fontSize: 14, fill: 0xFFFFFF, align: 'center'});
const youNicknameStyle = new PIXI.TextStyle({fontFamily: 'Arial', fontSize: 14, fontWeight: 'bold', fill: youColor, align: 'center'});
const youPlateColor = 0x14110C;
// Поля подложки вокруг букв и её скругление в долях высоты: половина — и края
// выходят полукруглыми.
const youPlatePadX = 7;
const youPlatePadY = 3;
const youPlateRadiusShare = 0.5;

// Ник на подложке. Подложку меряем по самим буквам, а не по кружку: ники бывают
// от одной буквы до четырёх (см. formatNickname), и подложка на глаз то жала бы
// длинный, то болталась вокруг короткого.
const PlatedNickname = ({text, style}: {text: string, style: PIXI.TextStyle}) => {
	const {width, height} = PIXI.TextMetrics.measureText(text, style);
	const plateHeight = height + youPlatePadY * 2;
	return (
		<Container>
			<Plate
				plateWidth={width + youPlatePadX * 2}
				plateHeight={plateHeight}
				borderRadius={plateHeight * youPlateRadiusShare}
				color={youPlateColor}
			/>
			<Text text={text} anchor={0.5} style={style}/>
		</Container>
	);
};

/**
 * Светотень поверх кружка — одна на всех: и на цветных бейджах, и на картах
 * статусов. Свет у всех идёт с одной стороны (сверху слева), и край у всех
 * одинаково уходит в темноту, а не режется по столу яркой границей.
 * Накладывается последней из картинок: ник, точки карантина и пометка ложатся
 * уже поверх неё.
 */
export const BadgeShade = ({badgeWidth, badgeHeight}: {badgeWidth: number, badgeHeight: number}) => (
	<Sprite
		texture={sphereShadeTexture()}
		anchor={0.5}
		width={badgeWidth}
		height={badgeHeight}
	/>
);

// Тень под игроком. Без неё кружок висит над столом, а не стоит у него: пол
// (и столешница, на которую тень заходит у ближних мест) — это та же плоскость,
// что и стол, поэтому и тень лежит в его проекции, сплюснутым эллипсом.
//
// Двумя кольцами: снаружи пожиже, внутри плотнее — у одного сплошного эллипса
// слишком резкий край, и он читается лужей, а не тенью.
//
// Шире самого кружка тень не растекается: за столом соседи стоят вплотную, и
// лишний её край наползал бы на соседнее «яйцо». По той же причине Room рисует
// все тени до всех кружков (см. renderShadow).
const badgeShadows = [
	{spread: 0.5, alpha: 0.3},
	{spread: 0.35, alpha: 0.35},
];
// Насколько тень приплюснута сверх проекции стола (она лежит, а не стоит) и где
// она начинается — в долях высоты кружка от его середины.
const shadowFlatten = 0.42;
const shadowDrop = 0.44;

export const PlayerShadow = ({badgeWidth, badgeHeight}: {badgeWidth: number, badgeHeight: number}) => (
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

/**
 * Ширина того, чем занято место за столом. Дверь — не игрок, а сыгранная между
 * соседями карта «Заколоченная дверь»: её и рисуем самой картой, прямоугольником
 * и в карточных пропорциях, а не кружком в чужой шкуре. Высота у неё та же, что
 * у кружков, — место за столом выглядит занятым ровно так же.
 *
 * Наружу — потому что тени рисует стол, отдельным проходом (см. Room), а ему
 * тоже надо знать, чему он их подкладывает.
 */
export const badgeBodyWidth = (isDoor: boolean, width: number, height: number): number =>
	isDoor ? height / cardAspectRatio : width;

/**
 * Цвет кружка — на случай, когда лица ещё нет: аватарку раздаёт сервер на старте
 * партии (см. gameStarter), а до того игрок за столом уже сидит.
 *
 * Раньше цвет был картинкой с запечённым в неё градиентом — свет в ней был
 * нарисован заранее и спорил со светом сферы, которая ложится сверху (см.
 * sphereShadeTexture). Сами цвета — средние тона тех самых картинок.
 *
 * Цвет — это порядковый номер игрока, поэтому на столе больше badgeColors
 * человек цвета начинают повторяться, но цвет есть у всех.
 */
const firstBadgeColor = 0x99693E;
const badgeColors = [
	firstBadgeColor, 0x998E3E, 0x99AD3E, 0x7DB13E, 0x51B14F, 0x51B185,
	0x518C86, 0x586986, 0x7D6986, 0x996979, 0x996963,
];
// Отключившийся сидит серым камнем: цвет ему больше не нужен — важно, что
// человека за столом нет.
const disconnectedColor = 0x3B3833;
// Во сколько раз значок оборванного провода меньше самого кружка.
const disconnectedIconShare = 0.62;

// Цвет приходит числом в строке, но приходит он с сервера: на мусор в нём
// отвечаем первым цветом, а не чёрной дырой на месте игрока.
export const badgeColorOf = (color: string): number =>
	badgeColors[Number(color) % badgeColors.length] ?? firstBadgeColor;

// Лица игроков. Кадрированы под пропорции кружка (см. badgeAspect), поэтому в
// него вписываются целиком — кадрировать их ещё и здесь, как карты статусов, не
// приходится.
const avatarTextures = map(resources.avatars, getPixiTexture);

// Лицо игрока по номеру, присланному сервером. Пока номера нет (до старта партии)
// или он не из этого списка — лица нет, и кружок остаётся цветным.
const avatarTextureOf = (avatar: string): PIXI.Texture | undefined =>
	avatar === '' ? undefined : avatarTextures[Number(avatar) % avatarTextures.length];

interface IBadgeBodyProps {
	isDoor: boolean;
	isConnected: boolean;
	color: string;
	avatar: string;
	badgeWidth: number;
	badgeHeight: number;
	// Нажатие по самому кружку: выбор цели или показ карты двери. Всегда
	// определённое — prop со значением undefined react-pixi-fiber не применяет, а
	// печатает «ignoring prop» на каждый рендер (см. Card).
	isInteractive?: boolean;
	pointerdown?: (event: PIXI.interaction.InteractionEvent) => void;
}

const noop = () => {};

/**
 * Само тело кружка — то, на что ложатся карта статуса и сфера. Роли здесь нет:
 * нечто и заражённого показывает натянутая карта (см. StatusSkin) — та же, что
 * игрок держит в руке, а не отдельно нарисованный круглый бейдж, живущий своей
 * жизнью.
 *
 * Наружу — потому что горящий игрок (см. Burn) сгорает ровно тем же кружком,
 * каким сидел за столом.
 */
export const BadgeBody = ({
	isDoor,
	isConnected,
	color,
	avatar,
	badgeWidth,
	badgeHeight,
	isInteractive = false,
	pointerdown = noop,
}: IBadgeBodyProps) => {
	// Дверь — не игрок, а лежащая на месте соседей карта: она и рисуется картой.
	if (isDoor) {
		return (
			<Sprite
				texture={doorCardTexture}
				anchor={0.5}
				width={badgeWidth}
				height={badgeHeight}
				interactive={isInteractive}
				buttonMode={isInteractive}
				pointerdown={pointerdown}
			/>
		);
	}
	// Живой игрок сидит за столом своим лицом. Отключившийся — серым камнем со
	// значком оборванного провода: то, что человека за столом нет, важнее того,
	// как он выглядел.
	const face = isConnected ? avatarTextureOf(avatar) : undefined;
	return (
		<React.Fragment>
			{face ? (
				<EllipseTexture
					rx={badgeWidth / 2}
					ry={badgeHeight / 2}
					texture={face}
					interactive={isInteractive}
					buttonMode={isInteractive}
					pointerdown={pointerdown}
				/>
			) : (
				<Ellipse
					rx={badgeWidth / 2}
					ry={badgeHeight / 2}
					color={isConnected ? badgeColorOf(color) : disconnectedColor}
					interactive={isInteractive}
					buttonMode={isInteractive}
					pointerdown={pointerdown}
				/>
			)}
			{!isConnected && (
				<Sprite
					texture={disconnectedTexture}
					anchor={0.5}
					width={badgeWidth * disconnectedIconShare}
					height={badgeWidth * disconnectedIconShare}
				/>
			)}
		</React.Fragment>
	);
};

// Картинки пометок пока «нечтовские»: свой набор значков придёт вместе с
// визуальным стилем (см. открытые вопросы в docs/PLAN.md).
const getMarkTexture = (mark: EPlayerMark | undefined): PIXI.Texture | undefined => {
	switch (mark) {
		case EPlayerMark.question:
			return playerStatusQuestion;
		case EPlayerMark.suspect:
			return playerStatusInfected;
		case EPlayerMark.spy:
			return playerStatusThing;
		case EPlayerMark.clear:
			return playerStatusClear;
		default:
			return undefined;
	}
}

// Роль на кружке: шпион в красном кольце, сопротивление в зелёном. Кольцо видно
// не всегда — только тому, кому эту роль положено знать (см. formatPlayer).
const spyRingColor = 0xDD6A5D;
const cleanRingColor = 0x5CA98D;
// Кольцо команды: этих лидер отправляет на дело прямо сейчас.
const teamRingColor = 0xF2F4F7;
// Насколько кольца шире самого кружка.
const roleRingShare = 1.04;
const teamRingShare = 1.16;
// Корона лидера сидит над кружком, наполовину заходя на него.
const leaderEmoji = '\u{1F451}';
const leaderIconShare = 0.42;
// Жетоны вскрытых голосов рисует стол, а не бейдж: у дальних мест всё, что ниже
// середины кружка, срезает столешница — она нарисована поверх них (см. Room).

const PlayerBadge = ({
		nickname,
		color,
		avatar,
		canBeSelected = false,
		onSelect = null,
		id,
		isDoor,
		isYou,
		isConnected,
		isLeader,
		isOnTeam,
		isSpy,
		style,
		onLongPress = null,
		mark,
	}: IPlayerBadgeProps) => {
	const markPlayer = () => {
		if (canBeSelected || isYou) return;
		onLongPress && onLongPress(id);
	}

	const onBadgePointerDown = () => {
		if (canBeSelected) {
			onSelect && onSelect(id);
		}
	};

	// NOTE: цвет приходит только после gameStarter (до старта он ''), а без него
	// кружок нечем залить.
	if (!color && !isDoor) return null;
	const bodyWidth = badgeBodyWidth(isDoor, style.width, style.height);
	// На кружке у всех ник, включая свой: что кружок твой, говорит этикетка над
	// ним (см. YouTag), а раньше вместо ника там стояло «ТЫ» — и собственное имя
	// за столом было не найти.
	//
	// Пустая строка, а не undefined: prop со значением undefined react-pixi-fiber
	// не применяет, а печатает «ignoring prop» на каждый рендер бейджа.
	const nick = formatNickname(nickname) ?? ''
	return (
		<Container pointerdown={markPlayer} buttonMode={true} interactive={true}>
			{canBeSelected && (
				<Sprite
					texture={playerGlowTexture}
					anchor={0.5}
					width={bodyWidth * 1.35}
					height={style.height * 1.35}
				/>
			)}

			{/* Кружок игрока — эллипс, а не круг: он стоит за столом, который мы
			    видим из-за его края, и вытянут по вертикали (см. badgeAspect). */}
			<BadgeBody
				isDoor={isDoor}
				isConnected={isConnected}
				color={color}
				avatar={avatar}
				badgeWidth={bodyWidth}
				badgeHeight={style.height}
				isInteractive={canBeSelected || isDoor}
				pointerdown={onBadgePointerDown}
			/>
			{!isDoor && (
				<React.Fragment>
					<BadgeShade badgeWidth={bodyWidth} badgeHeight={style.height}/>
					{/* Роль — тонким кольцом по краю кружка. Видно её не всем: сопротивление
					    чужих ролей не знает, и кольца у него нет ни у кого, кроме себя. */}
					{isSpy !== null && (
						<Ring
							r={bodyWidth * roleRingShare / 2}
							thickness={Math.max(bodyWidth * 0.035, 2)}
							color={isSpy ? spyRingColor : cleanRingColor}
						/>
					)}
					{/* Кольцо команды — снаружи ролевого и толще: состав обсуждают
					    прямо сейчас, и он должен читаться первым. */}
					{isOnTeam && (
						<Ring
							r={bodyWidth * teamRingShare / 2}
							thickness={Math.max(bodyWidth * 0.05, 3)}
							color={teamRingColor}
						/>
					)}
					{/* Ник — на подложке у всех: под ним теперь лицо игрока (а у кого-то
					    ещё и карта статуса поверх), и по картинке белые буквы теряются.
					    Ровного кружка, по которому они читались сами по себе, больше нет.
					    Свой при этом жирный и золотой: за абсолютным столом себя надо
					    находить взглядом. */}
					<PlatedNickname text={nick} style={isYou ? youNicknameStyle : nicknameStyle}/>
					{/* Своя пометка сидит на макушке кружка и наполовину торчит за него:
					    внутри её не отличить от рисунка на бейдже, да и разглядывать
					    чужие пометки приходится по всему столу разом — по верхнему краю
					    они читаются одним взглядом. */}
					{(mark && mark !== EPlayerMark.none) && (
						<Sprite
							texture={getMarkTexture(mark)}
							anchor={0.5}
							y={-style.height/2}
							width={style.width * 0.3}
							height={style.width * 0.3}
						/>
					)}
					{/* Корона лидера — над кружком, сбоку от пометки: они делят макушку,
					    но не садятся друг на друга. */}
					{isLeader && (
						<Sprite
							texture={emojiTexture(leaderEmoji)}
							anchor={0.5}
							x={style.width * 0.3}
							y={-style.height / 2}
							width={style.width * leaderIconShare}
							height={style.width * leaderIconShare}
						/>
					)}
				</React.Fragment>
			)}
		</Container>
	)
};

export default PlayerBadge;
