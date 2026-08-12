import React from 'react';
import {filter, map, reduce} from 'lodash';
import {observer} from 'mobx-react-lite';
import {useSpring} from 'react-spring/universal';
import {AnimatedPixi} from 'client/components/table/pixiInjected';
import Card from 'client/components/table/Card/Card';
import GameController from 'client/controllers/gameController';

// Взятие карты из колоды — со стороны. Карта уходит из колоды рубашкой и
// сжимается в кружок того, кто её взял: видно, кто именно тянул, а не только
// то, что счётчик колоды стал меньше. Себе карту так не показываем: своя и есть
// та карта, что въезжает в руку прямо из колоды, одним движением (см.
// GameController.drawnCardIds и HandComponent).

// Сколько летит карта. Короче, чем передача между игроками (CardFlight): путь
// от центра стола до кружка вдвое ближе.
const flightMs = 620;
// Больше стольких карт разом не держим: забывчивость поднимает три, и если за
// это время кто-то ещё успел взять — на столе каша.
const maxFlights = 6;
// Горб дуги в долях длины пути и разброс дуг, когда карт берут несколько разом:
// иначе три карты забывчивости летят одна в одной.
const arcRatio = 0.18;
const arcSpread = 0.24;
// Насколько карта вырастает в верхней точке дуги, в долях своего текущего
// размера: будто поднялась над столом и легла обратно.
const peakScale = 1.3;
// Крен карты в полёте, градусов: к концу пути он сходит на нет. Не оборот —
// вертящаяся карта на столе только рябит.
const tiltDeg = 14;
// С какой доли пути карта тает — она сжимается в кружок игрока и гаснет в нём.
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
	// Откуда и куда летит: от колоды, лежащей на столе, к кружку игрока.
	from: IPoint;
	to: IPoint;
	// Сторона и величина выгиба дуги относительно направления полёта.
	arc: number;
}

interface ICardDrawsProps {
	controller: GameController;
	getPosition: (playerId: string) => IPoint;
	// Где на столе лежит колода и какой ширины её карта: с этого полёт начинается.
	deckPoint: IPoint;
	deckCardWidth: number;
	badgeRadius: number;
}

// Парабола с нулями на концах пути и максимумом посередине — та же, что у
// передачи карт между игроками.
const arcShape = (progress: number): number => 4 * progress * (1 - progress);

const DrawnCard = ({from, to, arc, deckCardWidth, toWidth}: Omit<IDrawFlight, 'id'> & {deckCardWidth: number, toWidth: number}) => {
	const {t} = useSpring<{t: number}>({
		t: 1,
		from: {t: 0},
		config: {duration: flightMs},
	});

	// Нормаль к отрезку «колода — кружок»: вдоль неё карта сходит с прямой и к
	// концу пути возвращается на неё.
	const path = {x: to.x - from.x, y: to.y - from.y};
	const arcX = -path.y * arc;
	const arcY = path.x * arc;
	const alpha = t.interpolate(progress => progress < fadeFrom ? 1 : (1 - progress) / (1 - fadeFrom));

	return (
		// Летящая карта — картинка, а не кнопка: интерактивной она перехватывала бы
		// нажатия по колоде, над которой начинается её путь.
		<AnimatedPixi.Container alpha={alpha} interactiveChildren={false}>
			<Card
				id={cardBack}
				style={{
					x: t.interpolate(progress => from.x + path.x * progress + arcX * arcShape(progress)),
					y: t.interpolate(progress => from.y + path.y * progress + arcY * arcShape(progress)),
					angle: t.interpolate(progress => tiltDeg * Math.sign(arc) * arcShape(progress)),
					width: t.interpolate(progress => {
						const size = deckCardWidth + (toWidth - deckCardWidth) * progress;
						return size * (1 + (peakScale - 1) * arcShape(progress));
					}),
				}}
			/>
		</AnimatedPixi.Container>
	);
};

const CardDraws = observer(({controller, getPosition, deckPoint, deckCardWidth, badgeRadius}: ICardDrawsProps) => {
	const {cardDraws, currentPlayerId} = controller;

	const [flights, setFlights] = React.useState<IDrawFlight[]>([]);
	const nextFlightId = React.useRef(0);
	// Таймеры уборки долетевших карт — тот же приём, что в CardFlight и
	// CardEffect: снимаем их только при размонтировании, иначе следующее взятие
	// отменяет уборку предыдущего и карта повисает на столе навсегда.
	const cleanupTimers = React.useRef<ReturnType<typeof setTimeout>[]>([]);
	React.useEffect(() => () => cleanupTimers.current.forEach(clearTimeout), []);
	// Последнее показанное взятие: всё, что новее, — свежее событие.
	const lastSeq = React.useRef(0);
	// Первый проход только запоминает номер: пришедшему в середину партии не
	// нужно догонять чужие взятия разом.
	const isFirstRun = React.useRef(true);

	const latestSeq = reduce(cardDraws, (acc: number, {seq}) => Math.max(acc, seq), 0);

	React.useEffect(() => {
		if (isFirstRun.current) {
			isFirstRun.current = false;
			lastSeq.current = latestSeq;
			return;
		}

		// Своё взятие здесь не показываем: своя карта въезжает в руку сама.
		const fresh = filter(cardDraws, ({seq, playerId}) => seq > lastSeq.current && playerId !== currentPlayerId);
		lastSeq.current = latestSeq;
		if (!fresh.length) return;

		const started: IDrawFlight[] = [];
		fresh.forEach(({playerId, count}) => {
			for (let index = 0; index < count; index++) {
				const spread = count > 1 ? (index - (count - 1) / 2) * arcSpread : 0;
				started.push({
					id: nextFlightId.current++,
					from: deckPoint,
					to: getPosition(playerId),
					arc: arcRatio + spread,
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
	}, [latestSeq]);

	return (
		<React.Fragment>
			{map(flights, ({id, ...flight}) => (
				<DrawnCard key={id} {...flight} deckCardWidth={deckCardWidth} toWidth={badgeRadius * badgeShare}/>
			))}
		</React.Fragment>
	);
});

export default CardDraws;
