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
import GameController, {rejectFlightMaxStagger, rejectFlightMs, rejectFlightStaggerMs} from 'client/controllers/gameController';
import {rejectSlotPoint, rejectSlotSize} from 'client/components/table/MissionTrack/MissionTrack';
import PlayerBadge, {badgeBodyWidth, ETeamRing, PlayerShadow} from 'client/components/table/PlayerBadge/PlayerBadge';
import TableSurface from 'client/components/table/Room/TableSurface';
import {EPlayerState} from 'shared/enum/player';
import {ENotificationAction} from 'shared/enum/notifications';
import {EGamePhase} from 'shared/enum/phase';
import {AnimatedPixi} from 'client/components/table/pixiInjected';
import {Container, Sprite} from 'react-pixi-fiber';
import {getPixiTexture} from 'client/components/table/pixiInjected';
import {resources} from 'client/resources/resources';
import Reticle from 'client/components/pixiPrimitives/Reticle';
import Spinner from 'client/components/pixiPrimitives/Spinner';
import Arrow from 'client/components/pixiPrimitives/Arrow';
import {arrowPath} from 'client/helpers/arrowPath';
import {roleMarkOf} from 'client/helpers/roleMark';
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
const reticleColor = 0x35C8FF;
// Раствор прицела в долях радиуса бейджа: наведённый и в момент наводки.
const reticleAimedShare = 1.3;
// Раскрытый прицел не должен дотягиваться до соседей: в полёте к новой цели он
// проходит над дальними кружками (их рисуют до столешницы, а его — после), и
// широкий раствор перечёркивал их уголками.
const reticleWideShare = 1.9;
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
	controller: GameController;
	// Место цели: пока прицел до неё едет, она может и уехать сама.
	x: number;
	y: number;
	badgeRadius: number;
	// Цель. Меняется — прицел наводится заново.
	playerId: string;
}

const TurnReticle = observer(({controller, x, y, badgeRadius, playerId}: ITurnReticleProps) => {
	// Часы хода — на самом прицеле; полоски таймера сверху экрана больше нет.
	// Отсчёт свой у каждого ожидания (набор команды, голосование, миссия), и
	// заводит его сервер своим уведомлением, поэтому берём отметку у таймера, а
	// не считаем её от смены лидера: круг тянулся бы минутами и стрелка стояла
	// бы красной всё это время, ничего уже не говоря.
	const {isActive, startedAt} = controller.root.timerController;
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
						startedAt={isActive ? startedAt : 0}
					/>
				</AnimatedPixi.Container>
			</AnimatedPixi.Container>
		</AnimatedPixi.Container>
	);
});

// Стрелки от лидера к команде — белые, в цвет кольца команды на кружках: это
// одно и то же высказывание стола, «вот кого он отправляет».
const teamArrowColor = 0xF2F4F7;

// «Ждём ответа»: спиннер на месте будущего жетона. Пока стол голосует, а
// команда сдаёт карты, сами ответы — тайна, а вот КОГО ждут, знать можно и
// нужно: иначе непонятно, стол думает или кто-то отошёл от компьютера.
const pendingColor = 0xBFD4E4;
// Размеры — в долях ширины кружка, чтобы спиннер занимал ровно то место, куда
// потом ляжет жетон голоса (см. voteTokenShare).
const pendingRadiusShare = 0.14;
const pendingThicknessShare = 0.035;

// Жетон вскрытого голоса: доля ширины кружка и насколько он опущен под него.
const voteTokenShare = 0.36;
const voteTokenLift = 0.62;
// У дальних мест — сбоку, в долях ширины кружка.
const voteTokenSide = 0.62;
// Палец вверх и вниз, а не галочка с крестиком: теми же знаками игрок помечает
// соседей от себя (см. PlayerBadge), и на одном кружке два разных «крестика»
// спорили бы — этот про голос, тот про догадку.
const voteApproveTexture = getPixiTexture(resources.voteApprove);
const voteRejectTexture = getPixiTexture(resources.voteReject);

// Отклонённый состав улетает в счётчик: пальцы тех, кто голосовал против,
// снимаются со своих мест и слетаются в деление, которое от этого и загорается
// (см. syncRejectFlight и MissionTrack). Без этого счётчик просто прибавлял
// единицу где-то сбоку, и связи между «стол сказал нет» и делением не было.
//
// Летят по дуге, а не по прямой: прямая через полстола читается перечёркиванием,
// а горка — броском.
const rejectFlightArc = 0.22;
// Жетон в полёте уменьшается до размера деления, в которое летит.
const rejectFlightFadeShare = 0.12;

const FlyingReject = ({from, to, size, endScale, delay}: {
	from: IPoint,
	to: IPoint,
	size: number,
	endScale: number,
	delay: number,
}) => {
	// Пружина заводится один раз, при появлении жетона: он и живёт ровно свой
	// полёт — Room пересобирает их на каждый новый отказ (см. key полёта).
	const fly = useSpring<{flyAt: number}>({
		flyAt: 1,
		from: {flyAt: 0},
		config: {duration: rejectFlightMs},
		delay,
	});
	const span = Math.hypot(to.x - from.x, to.y - from.y);
	const at = fly.flyAt as unknown as {interpolate: (fn: (value: number) => number) => number};
	return (
		<AnimatedPixi.Container
			x={at.interpolate((value) => from.x + (to.x - from.x) * value)}
			y={at.interpolate((value) => from.y + (to.y - from.y) * value - Math.sin(Math.PI * value) * span * rejectFlightArc)}
			scale={at.interpolate((value) => 1 + (endScale - 1) * value)}
			alpha={at.interpolate((value) => Math.min(1, (1 - value) / rejectFlightFadeShare))}
		>
			<Sprite texture={voteRejectTexture} anchor={0.5} width={size} height={size}/>
		</AnimatedPixi.Container>
	);
};

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

	// Место жетона у кружка. Рисует его стол, а не бейдж: у дальних мест всё ниже
	// середины кружка срезает столешница, а идёт она поверх них.
	//
	// У ближних мест жетон висит под кружком, у дальних — сбоку: под ними лежит
	// трек миссий, а над ними — подпись действия. Вбок он уходит НАРУЖУ от
	// середины стола: у левой половины — влево, у правой — вправо, иначе жетон
	// ложится на тот самый трек.
	const tokenPoint = ({point, isFar}: ISeat): IPoint => ({
		x: point.x + (isFar ? badgeWidth * voteTokenSide * (point.x < 0 ? -1 : 1) : 0),
		y: point.y + (isFar ? 0 : badgeHeight * voteTokenLift),
	});

	// От кого стол ждёт голоса. На миссии ждут тоже, но там это показывает не
	// спиннер, а бегущий пунктир на кольце команды (см. teamRingOf): у кружка и
	// без того тесно, а команда уже обведена.
	const pendingIds = (): string[] => {
		if (!round || round.phase !== EGamePhase.voting) return [];
		return filter(newPlayerList, (id) => !round.answeredIds.includes(id));
	};

	// Каким кольцом обвести игрока. На миссии кольцо пунктирное у всей команды, а
	// бежит пунктир только у того, чьей карты ещё ждут: сам ответ — тайна (FR-9),
	// а вот кого ждут, знать можно и нужно.
	const teamRingOf = (playerId: string): ETeamRing => {
		if (!round) return ETeamRing.none;
		// Выстрел Убийцы обводит названного — и остаётся на нём до последнего кадра
		// стола: партия на этом кончается, и кого назвали, должно быть видно.
		if (round.assassinTargetId === playerId) return ETeamRing.target;
		if (!round.team.includes(playerId)) return ETeamRing.none;
		if (round.phase !== EGamePhase.mission) return ETeamRing.solid;
		return round.answeredIds.includes(playerId) ? ETeamRing.mission : ETeamRing.waiting;
	};

	// Ждём ответа — спиннер ровно там, где потом ляжет жетон. Сам ответ тайна, а
	// вот кого ждут — нет.
	const pendingTokens = () => {
		const waiting = pendingIds();
		if (!waiting.length) return null;
		return map(seats, (seat) => {
			if (!waiting.includes(seat.playerId) || !players[seat.playerId]) return null;
			const {x, y} = tokenPoint(seat);
			return (
				<Spinner
					key={seat.playerId}
					x={x}
					y={y}
					r={badgeWidth * pendingRadiusShare}
					thickness={badgeWidth * pendingThicknessShare}
					color={pendingColor}
				/>
			);
		});
	};

	// Отклонённый состав: пальцы снимаются с кружков и летят в деление счётчика.
	// Стартуют они ровно оттуда, где висели жетоны голосов, — полёт продолжает их,
	// а не появляется ниоткуда.
	const rejectFlight = () => {
		const flight = controller.rejectFlight;
		if (!flight) return null;
		const isLast = flight.slot === (round ? round.maxRejects - 1 : 0);
		const target = rejectSlotPoint(playersCount, flight.slot, round ? round.maxRejects : 0);
		const size = badgeWidth * voteTokenShare;
		const endScale = rejectSlotSize(playersCount, isLast) / size;
		return map(seats, (seat, index) => {
			if (!flight.voterIds.includes(seat.playerId)) return null;
			return (
				<FlyingReject
					key={`${flight.key}-${seat.playerId}`}
					from={tokenPoint(seat)}
					to={target}
					size={size}
					endScale={endScale}
					delay={Math.min(index, rejectFlightMaxStagger) * rejectFlightStaggerMs}
				/>
			);
		});
	};

	// Вскрытые голоса — жетонами у кружков. Живут они одну паузу вскрытия (см.
	// revealPause на сервере), так что со спиннерами ожидания за место не спорят:
	// когда стол смотрит на голоса, ждать уже некого.
	const voteTokens = () => {
		if (!round || !round.revealedVotes) return null;
		const votes = round.revealedVotes;
		return map(seats, (seat) => {
			const {playerId} = seat;
			const vote = votes[playerId];
			if (vote === undefined || !players[playerId]) return null;
			const {x, y} = tokenPoint(seat);
			const size = badgeWidth * voteTokenShare;
			return (
				<Sprite
					key={playerId}
					texture={vote ? voteApproveTexture : voteRejectTexture}
					anchor={0.5}
					x={x}
					y={y}
					width={size}
					height={size}
				/>
			);
		});
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
				teamRing={teamRingOf(player.id)}
				isSpy={player.isSpy}
				roleMark={roleMarkOf(player, !!round && round.isRolesRevealed)}
				isAimed={!!round && round.assassinAimId === player.id}
				isShot={!!round && round.assassinTargetId === player.id}
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
				{/* Прицел ходящего — на столешнице, под всем остальным: уголки уходят
				    далеко за кружок и, нарисованные поверх, перечёркивали соседей и трек
				    миссий. Пока ход ни за кем не числится (партия ещё не началась или
				    уже кончилась), наводить его не на кого. */}
				{turnPlayerId && players[turnPlayerId] && (
					<TurnReticle
						controller={controller}
						{...positionOf(turnPlayerId)}
						badgeRadius={badgeRadius}
						playerId={turnPlayerId}
					/>
				)}
				{/* Стрелки — там же и поверх прицела: по пути от лидера к команде они
				    пересекают полстола, и нарисованные выше перечёркивали бы всё то же
				    самое, а прицел они пересекают в одной точке. */}
				{teamArrows()}
			</Container>
			{/* Всё, что лежит на столешнице. Уже в координатах экрана, поэтому идёт
			    без сдвига к центру. */}
			{children}
			<Container x={tableCenterX()} y={tableCenterY()}>
				{map(nearSeats, renderShadow)}
				{map(nearSeats, renderBadge)}
				{voteTokens()}
				{pendingTokens()}
				{/* Летящие отказы — поверх всего: они пересекают полстола и должны быть
				    видны над кружками, иначе бросок теряется за ближним рядом. */}
				{rejectFlight()}
			</Container>
		</Container>
	)
});

export default Room;
