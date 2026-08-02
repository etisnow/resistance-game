import React from 'react';
import {difference, filter, keys, map, reduce} from 'lodash';
import {observer} from 'mobx-react-lite';
import {useSpring} from 'react-spring/universal';
import {AnimatedPixi} from 'client/components/table/pixiInjected';
import Card from 'client/components/table/Card/Card';
import {handCardScenePoint} from 'client/components/table/Hand/HandComponent';
import {tableCenterX, tableCenterY} from 'client/helpers/window';
import GameController from 'client/controllers/gameController';

// Взятие карты из колоды видно всем, но по-разному. Тому, кто берёт, карта летит
// из колоды лицом вверх и ложится в своё гнездо веера — в конец руки, справа,
// туда же, где она и появляется: сразу понятно, что пришло, ещё до того как
// разберёшь её среди остальных. Остальным та же карта уходит из колоды рубашкой
// и сжимается в кружок взявшего: видно, кто именно тянул. Раньше карта просто
// возникала в руке, а со стороны взятие было заметно только по счётчику колоды.

// Сколько летит карта. Короче, чем передача между игроками (CardFlight): путь
// прямее, а ждать её взявшему — прямо посреди своего хода.
const flightMs = 620;
// Больше стольких карт разом не держим: забывчивость поднимает три, и если за
// это время кто-то ещё успел взять — на столе каша.
const maxFlights = 6;
// Горб дуги в долях длины пути. Своя карта выгибается в другую сторону: она идёт
// в правый край руки, и дуга уводит её наружу, мимо стола, а не поперёк него.
const arcRatio = 0.18;
const ownArcRatio = -0.16;
// Разброс дуг, когда несколько карт летят в один и тот же кружок: иначе три
// карты забывчивости летят одна в одной. Своим он не нужен — у каждой своё гнездо.
const arcSpread = 0.24;
// Насколько карта вырастает в верхней точке дуги, в долях своего текущего
// размера: будто поднялась над столом и легла обратно.
const peakScale = 1.3;
// Крен карты в полёте, градусов: к концу пути он сходит на нет. Не оборот —
// карту летят читать, а вертящаяся карта нечитаема.
const tiltDeg = 14;
// С какой доли пути карта тает. Своя растворяется над рукой, где её место уже
// заняла карта веера; чужая — в кружке игрока.
const fadeFrom = 0.84;
// Каким карта доезжает до кружка игрока, в долях радиуса бейджа.
const badgeShare = 0.32;
// Рубашка события: чужая взятая карта летит только ею.
const cardBack = 'eventBack';

interface IPoint {
	x: number;
	y: number;
}

interface IDrawFlight {
	id: number;
	// Куда летит — колода лежит в центре стола, то есть в начале координат.
	to: IPoint;
	// Сторона и величина выгиба дуги относительно направления полёта.
	arc: number;
	// Наклон, с которым карта ложится: у своей — наклон её гнезда в веере.
	toAngle: number;
	cardId: string;
	toWidth: number;
}

interface ICardDrawsProps {
	controller: GameController;
	getPosition: (playerId: string) => IPoint;
	// Ширина карты в колоде: с неё полёт начинается.
	deckCardWidth: number;
	badgeRadius: number;
}

// Парабола с нулями на концах пути и максимумом посередине — та же, что у
// передачи карт между игроками.
const arcShape = (progress: number): number => 4 * progress * (1 - progress);

const DrawnCard = ({to, arc, toAngle, cardId, toWidth, deckCardWidth}: Omit<IDrawFlight, 'id'> & {deckCardWidth: number}) => {
	const {t} = useSpring<{t: number}>({
		t: 1,
		from: {t: 0},
		config: {duration: flightMs},
	});

	// Нормаль к отрезку «колода — цель»: вдоль неё карта сходит с прямой и к
	// концу пути возвращается на неё.
	const arcX = -to.y * arc;
	const arcY = to.x * arc;
	const alpha = t.interpolate(progress => progress < fadeFrom ? 1 : (1 - progress) / (1 - fadeFrom));

	return (
		// Летящая карта — картинка, а не кнопка: интерактивной она перехватывала бы
		// нажатия по колоде и по руке, над которыми как раз и проходит её путь.
		<AnimatedPixi.Container alpha={alpha} interactiveChildren={false}>
			<Card
				id={cardId}
				style={{
					x: t.interpolate(progress => to.x * progress + arcX * arcShape(progress)),
					y: t.interpolate(progress => to.y * progress + arcY * arcShape(progress)),
					angle: t.interpolate(progress => toAngle * progress + tiltDeg * Math.sign(arc) * arcShape(progress)),
					width: t.interpolate(progress => {
						const size = deckCardWidth + (toWidth - deckCardWidth) * progress;
						return size * (1 + (peakScale - 1) * arcShape(progress));
					}),
				}}
			/>
		</AnimatedPixi.Container>
	);
};

const CardDraws = observer(({controller, getPosition, deckCardWidth, badgeRadius}: ICardDrawsProps) => {
	const {cardDraws, currentPlayerId, hand} = controller;

	const [flights, setFlights] = React.useState<IDrawFlight[]>([]);
	const nextFlightId = React.useRef(0);
	// Таймеры уборки долетевших карт — тот же приём, что в CardFlight и
	// CardEffect: снимаем их только при размонтировании, иначе следующее взятие
	// отменяет уборку предыдущего и карта повисает на столе навсегда.
	const cleanupTimers = React.useRef<ReturnType<typeof setTimeout>[]>([]);
	React.useEffect(() => () => cleanupTimers.current.forEach(clearTimeout), []);
	// Последнее показанное взятие: всё, что новее, — свежее событие.
	const lastSeq = React.useRef(0);
	// Рука на прошлом обновлении: по ней видно, какие карты пришли ко мне.
	const handBefore = React.useRef<string[]>([]);
	// Первый проход только запоминает состояние: пришедшему в середину партии не
	// нужно догонять чужие взятия разом.
	const isFirstRun = React.useRef(true);

	const latestSeq = reduce(cardDraws, (acc: number, {seq}) => Math.max(acc, seq), 0);
	// Эффект сверяет руку с прошлым разом, поэтому просыпаться должен и на её
	// изменения тоже: иначе карта, пришедшая обменом, осталась бы «новой» и
	// следующее взятие приняло бы её за свою.
	const handSignature = keys(hand).join('|');

	React.useEffect(() => {
		const handNow = keys(hand);
		const arrived = difference(handNow, handBefore.current);
		handBefore.current = handNow;

		if (isFirstRun.current) {
			isFirstRun.current = false;
			lastSeq.current = latestSeq;
			return;
		}

		const fresh = filter(cardDraws, ({seq}) => seq > lastSeq.current);
		lastSeq.current = latestSeq;
		if (!fresh.length) return;

		// Свои карты показываем лицом, только если пришло ровно столько, сколько
		// взято: иначе непонятно, какая из них чья, и честнее рубашка.
		const ownCount = reduce(fresh, (acc: number, {playerId, count}) => acc + (playerId === currentPlayerId ? count : 0), 0);
		const showFaces = ownCount > 0 && arrived.length === ownCount;
		// Взятые карты встают в конец веера, поэтому и гнёзда у них последние.
		let ownSlot = Math.max(handNow.length - ownCount, 0);

		const started: IDrawFlight[] = [];
		let arrivedIndex = 0;
		fresh.forEach(({playerId, count}) => {
			const isMine = playerId === currentPlayerId;
			for (let index = 0; index < count; index++) {
				if (isMine) {
					const slot = handCardScenePoint(ownSlot++, handNow.length);
					const own = showFaces ? hand[arrived[arrivedIndex++] ?? ''] : undefined;
					started.push({
						id: nextFlightId.current++,
						to: {x: slot.x - tableCenterX(), y: slot.y - tableCenterY()},
						arc: ownArcRatio,
						toAngle: slot.angle,
						cardId: own ? own.id : cardBack,
						toWidth: slot.width,
					});
					continue;
				}
				const spread = count > 1 ? (index - (count - 1) / 2) * arcSpread : 0;
				started.push({
					id: nextFlightId.current++,
					to: getPosition(playerId),
					arc: arcRatio + spread,
					toAngle: 0,
					cardId: cardBack,
					toWidth: badgeRadius * badgeShare,
				});
			}
		});

		setFlights(current => [...current, ...started].slice(-maxFlights));
		const startedIds = map(started, ({id}) => id);
		const timer = setTimeout(() => {
			setFlights(current => filter(current, ({id}) => !startedIds.includes(id)));
			cleanupTimers.current = filter(cleanupTimers.current, item => item !== timer);
		}, flightMs);
		cleanupTimers.current.push(timer);
	}, [latestSeq, handSignature]);

	return (
		<React.Fragment>
			{map(flights, ({id, ...flight}) => (
				<DrawnCard key={id} {...flight} deckCardWidth={deckCardWidth}/>
			))}
		</React.Fragment>
	);
});

export default CardDraws;
