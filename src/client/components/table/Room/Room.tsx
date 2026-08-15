import React from 'react';
import {clamp, each, filter, map} from 'lodash';
import './styles.scss';
import {observer} from "mobx-react-lite";
import {config, useSpring} from 'react-spring/universal';
import {
	badgeAspect,
	isFarSeat,
	playerRoomDiag,
	roomPlayerAngle,
	roomPlayerOrder,
	roomPlayerPoint,
	tableLift,
	tableRadii,
	tableThickness,
} from 'client/helpers/roomHelpers';
import GameController from 'client/controllers/gameController';
import PlayerBadge, {badgeBodyWidth, PlayerShadow} from 'client/components/table/PlayerBadge/PlayerBadge';
import TableSurface from 'client/components/table/Room/TableSurface';
import {EPlayerState} from 'shared/enum/player';
import {ENotificationAction} from 'shared/enum/notifications';
import {AnimatedPixi} from 'client/components/table/pixiInjected';
import {Container} from 'react-pixi-fiber';
import Reticle from 'client/components/pixiPrimitives/Reticle';
import Arrow from 'client/components/pixiPrimitives/Arrow';
import {arrowPath} from 'client/helpers/arrowPath';
import {tableCenterX, tableCenterY} from 'client/helpers/window';
import type {IPlayersMap} from 'client/controllers/socketTypes';
import type Player from 'client/models/Player';

interface IRoomProps {
	controller: GameController;
	// Что лежит НА столе. Приходит ребёнком, потому что стол рисуется слоями по
	// глубине — дальние игроки, столешница, всё лежащее на ней, ближние игроки, —
	// и вставить это надо ровно в середину. Сюда встанет трек миссий (фаза 3).
	children?: React.ReactNode;
}

interface IPoint {
	x: number;
	y: number;
}

// Место за столом: кто сидит, где сидит и по какую сторону столешницы.
interface ISeat {
	playerId: string;
	point: IPoint;
	isFar: boolean;
}

// Место игрока за столом (координаты относительно центра — его подставляет
// контейнер). Сама геометрия круга живёт в roomHelpers.
const getPositionFromPlayerList = ({players, playerId, playerList}: {players: IPlayersMap, playerId: string, playerList: string[]}): IPoint => {
	const player = players[playerId];
	if (!player) return {x: 0, y: 0};
	return roomPlayerPoint(playerId, playerList);
}

// Прицел на том, чей сейчас ход. В «Сопротивлении» это лидер раунда: он один, и
// прицел наводится ровно на него (turnPlayerId).
const reticleColor = 0x00FF00;
// Раствор прицела в долях радиуса бейджа: наведённый и в момент наводки.
const reticleAimedShare = 1.3;
const reticleWideShare = 2.6;
// Плечо уголка — в долях самого раствора, чтобы уголки не смыкались в рамку.
const reticleArmShare = 0.4;
// Скругление угла — в долях плеча.
const reticleCornerShare = 0.5;
// Толщина уголков — в долях радиуса бейджа: на большом экране кружки крупные,
// и линия в пару пикселей на них теряется. Но прицел — рамка, а не обводка:
// толстая линия спорит с самим кружком.
const reticleThicknessShare = 0.03;
const reticleMinThickness = 1;
const reticleMaxThickness = 2.5;
// Сколько прицел сжимается на новой цели. Едет он к ней своей пружиной: как
// быстро — дело расстояния, а сжимается всегда одинаково.
const reticleAimMs = 380;
// Наведённый прицел дышит: чуть разжимается и сжимается обратно. Стоящая на
// столе рамка выглядит забытой, а дыхание показывает, что ход всё ещё тут.
const reticleBreathScale = 1.07;
const reticleBreathMs = 1300;

interface ITurnReticleProps {
	// Место цели: пока прицел до неё едет, она может и уехать сама.
	x: number;
	y: number;
	badgeRadius: number;
	// Цель. Меняется — прицел наводится заново.
	playerId: string;
}

const TurnReticle = ({x, y, badgeRadius, playerId}: ITurnReticleProps) => {
	// Переезд к новой цели: своей пружиной, поэтому прицел догоняет и того, кто
	// сам переехал, а не только смену хода. Поля названы не x/y: react-spring
	// считает такие пружины svg-атрибутами и типизирует их не числами, а долями
	// оборота.
	const move = useSpring<{aimX: number, aimY: number}>({aimX: x, aimY: y, config: config.stiff});
	// Наводка: прицел приходит широко раскрытым и сжимается на цели. Сжимается
	// он масштабом контейнера, а не собственным раствором: animated() гонит в
	// примитив ОДНИ анимируемые пропы, и постоянные толщина с цветом до него бы
	// не доехали — уголки вышли бы нулевой ширины.
	//
	// Сама наводка — императивной пружиной: перезапускать её надо на смене цели,
	// а не на каждом рендере стола.
	const [aim, setAim] = useSpring<{aimScale: number}>(() => ({aimScale: 1, config: {duration: reticleAimMs}}));
	React.useEffect(() => {
		setAim({aimScale: 1, from: {aimScale: reticleWideShare / reticleAimedShare}, reset: true});
	}, [playerId]);
	// Дыхание — своей пружиной и своим контейнером, поверх наводки: они живут
	// независимо, и качание не сбивается всякий раз, как ход уходит дальше.
	// Качает его таймер: зациклить саму пружину в этой версии react-spring
	// нечем — onRest, переданный в set(), не доходит, а бесконечная цепочка
	// через async to есть только в рантайме, в типах её нет.
	const [breath, setBreath] = useSpring<{breathScale: number}>(() => ({breathScale: 1, config: {duration: reticleBreathMs}}));
	React.useEffect(() => {
		let isOut = false;
		const timer = setInterval(() => {
			isOut = !isOut;
			setBreath({breathScale: isOut ? reticleBreathScale : 1});
		}, reticleBreathMs);
		return () => clearInterval(timer);
	}, []);

	const spread = badgeRadius * reticleAimedShare;
	return (
		<AnimatedPixi.Container x={move.aimX} y={move.aimY}>
			<AnimatedPixi.Container scale={aim.aimScale}>
				<AnimatedPixi.Container scale={breath.breathScale}>
					<Reticle
						spread={spread}
						arm={spread * reticleArmShare}
						cornerRadius={spread * reticleArmShare * reticleCornerShare}
						thickness={clamp(badgeRadius * reticleThicknessShare, reticleMinThickness, reticleMaxThickness)}
						color={reticleColor}
					/>
				</AnimatedPixi.Container>
			</AnimatedPixi.Container>
		</AnimatedPixi.Container>
	);
};

// Стрелки от лидера к команде — белые, в цвет кольца команды на кружках: это
// одно и то же высказывание стола, «вот кого он отправляет».
const teamArrowColor = 0xF2F4F7;

// Соседи ли по кругу: между ними никто не сидит. Только таких стрелка может
// обходить дугой — под не соседями промежуток занят третьим игроком.
const isNeighbourSeats = (playerList: string[], a: string, b: string): boolean => {
	const count = playerList.length;
	const from = playerList.indexOf(a);
	const to = playerList.indexOf(b);
	if (from < 0 || to < 0 || from === to || count < 2) return false;
	const step = Math.abs(from - to);
	return step === 1 || step === count - 1;
};

const Room = observer(({controller, children}: IRoomProps) => {

	const { currentPlayer, currentPlayerId } = controller;
	const { playersList, players, turnPlayerId, round } = controller;
	if (!currentPlayer || !currentPlayerId || !playersList) return null;
	const {marks} = currentPlayer;

	// Обычно рассадка — сам playersList, как он пришёл с сервера: стол один и тот
	// же у всех, кто на него смотрит. «От первого лица» его разворачивают так,
	// чтобы смотрящий сидел первым.
	const newPlayerList = roomPlayerOrder(playersList, currentPlayerId, controller.isFirstPersonTable);
	const playersCount = newPlayerList.length;

	// Место игрока за столом. Последнее известное запоминаем: цель может не
	// дожить до конца анимации.
	const lastPositions = React.useRef<Record<string, IPoint>>({});
	lastPositions.current = {...lastPositions.current};
	each(newPlayerList, (playerId) => {
		lastPositions.current[playerId] = getPositionFromPlayerList({players, playerId, playerList: newPlayerList});
	});
	const positionOf = (playerId: string): IPoint =>
		lastPositions.current[playerId] ?? getPositionFromPlayerList({players, playerId, playerList: newPlayerList});

	const angleOf = (playerId: string): number => roomPlayerAngle(playerId, newPlayerList);

	// Места считаются прямо, без пружин. В «Сопротивлении» за партию никто не
	// пересаживается, не выбывает и не приходит: рассадка получается на старте и
	// живёт до конца — анимировать в ней нечего.
	//
	// Раньше здесь стоял useTransition, который «выращивал» кружки из середины
	// стола. Он же и ломал стол: анимация входа не запускалась на самом
	// монтировании (только на каком-то следующем рендере), и до первого чужого
	// хода все кружки лежали стопкой в центре.
	const seats: ISeat[] = newPlayerList.map((playerId) => ({
		playerId,
		point: positionOf(playerId),
		isFar: isFarSeat(angleOf(playerId)),
	}));

	const badgeWidth = playerRoomDiag(playersCount);
	const badgeRadius = badgeWidth / 2;
	// Столешница. Меняется только вместе с окном — на него стол пересчитывается
	// целиком (см. viewport).
	const surface = tableRadii(playersCount);

	const canPlayerBeSelected = (player: Player): boolean => {
		if (controller.currentAction && controller.currentAction.type === ENotificationAction.playerSelect) {
			return controller.currentAction.playersToSelect.includes(player.id)
		}
		return false;
	}

	const badgeHeight = badgeWidth * badgeAspect;

	const seatPlace = ({playerId, point}: ISeat, children: React.ReactNode) => (
		<Container key={playerId} x={point.x} y={point.y}>
			{children}
		</Container>
	);

	const renderShadow = (seat: ISeat) => {
		const player = players[seat.playerId];
		if (!player) return null;
		return seatPlace(seat, (
			<PlayerShadow
				badgeWidth={badgeBodyWidth(player.state === EPlayerState.door, badgeWidth, badgeHeight)}
				badgeHeight={badgeHeight}
			/>
		));
	};

	const renderBadge = (seat: ISeat) => {
		const player = players[seat.playerId];
		if (!player || !player.id) return null;
		const {nickname, color, avatar, state} = player;
		return seatPlace(seat, (
			<PlayerBadge
				style={{width: badgeWidth, height: badgeHeight}}
				nickname={nickname}
				color={color}
				avatar={avatar}
				canBeSelected={canPlayerBeSelected(player)}
				id={player.id}
				isConnected={player.isConnected}
				isYou={player.isYou}
				isDoor={state === EPlayerState.door}
				isLeader={round ? round.leaderId === player.id : false}
				isOnTeam={round ? round.team.includes(player.id) : false}
				vote={round && round.revealedVotes ? round.revealedVotes[player.id] ?? null : null}
				isSpy={player.isSpy}
				onSelect={controller.selectPlayer}
				onLongPress={controller.changePlayerMark}
				mark={marks[player.id]}
			/>
		));
	};

	// Стрелки от лидера к набранной команде: состав виден вживую, ещё до того как
	// лидер нажмёт «Готово». Себя лидер тоже может взять — стрелки в себя нет.
	const teamArrows = () => {
		if (!round) return null;
		const from = positionOf(round.leaderId);
		return map(round.team, (memberId) => {
			if (memberId === round.leaderId) return null;
			if (!players[memberId]) return null;
			const path = arrowPath({
				from,
				to: positionOf(memberId),
				isNeighbours: isNeighbourSeats(newPlayerList, round.leaderId, memberId),
				badgeRadius,
				iconRadius: 0,
			});
			return <Arrow key={memberId} {...path} arrowColor={teamArrowColor}/>;
		});
	};

	// Дальняя половина стола — та, что уходит за столешницу: её жильцов рисуют
	// ДО стола, и он подрезает их по грудь. Ближних — после, они стоят перед
	// столом. На этом (вместе со сплюснутой проекцией) и держится объём.
	//
	const seatsOf = (isFar: boolean): ISeat[] =>
		filter(seats, (seat) => !!players[seat.playerId] && seat.isFar === isFar);
	const farSeats = seatsOf(true);
	const nearSeats = seatsOf(false);

	return (
		<Container>
			<Container x={tableCenterX()} y={tableCenterY()}>
				{/* Тени всех — до кружков всех: по кругу соседи стоят вплотную и порой
				    наезжают друг на друга, и тень, нарисованная вместе со своим
				    хозяином, ложилась бы на соседа. */}
				{map(farSeats, renderShadow)}
				{map(farSeats, renderBadge)}
				{/* Стол стоит в середине комнаты — там же, где круг на полу задника
				    (см. RoomBackdrop). Свою высоту он отмеряет сам: столешницу
				    поднимает, тень оставляет на полу. */}
				<TableSurface
					rx={surface.rx}
					ry={surface.ry}
					thickness={tableThickness(playersCount)}
					lift={tableLift(playersCount)}
				/>
			</Container>
			{/* Всё, что лежит на столешнице. Уже в координатах экрана, поэтому идёт
			    без сдвига к центру. */}
			{children}
			<Container x={tableCenterX()} y={tableCenterY()}>
				{teamArrows()}
				{map(nearSeats, renderShadow)}
				{map(nearSeats, renderBadge)}
				{/* Прицел — поверх кружков: он обводит цель, а не лежит под ней.
				    Пока ход ни за кем не числится (партия ещё не началась или уже
				    кончилась), наводить его не на кого. */}
				{turnPlayerId && players[turnPlayerId] && (
					<TurnReticle
						{...positionOf(turnPlayerId)}
						badgeRadius={badgeRadius}
						playerId={turnPlayerId}
					/>
				)}
			</Container>
		</Container>
	)
});

export default Room;
