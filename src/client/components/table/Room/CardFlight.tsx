import React from 'react';
import {difference, filter, keys, map, some} from 'lodash';
import {observer} from 'mobx-react-lite';
import {useSpring} from 'react-spring/universal';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {EGameLogType} from 'shared/enum/gameLogType';
import Card from 'client/components/table/Card/Card';
import GameController from 'client/controllers/gameController';
import type {IFormatTradeContext} from 'shared/interfaces/common';

// Передачу карты показываем не только стрелкой: карта реально летит по параболе
// от того, кто её отдал, к тому, кто получил. Это относится к любой передаче —
// и к обмену (туда, когда атакующий выбрал карту, и обратно, когда защищающийся
// ответил своей), и к цепной реакции, где все разом отдают карту соседу.
// Чужая карта летит рубашкой вверх, а та, что достаётся тебе, — лицом, чтобы
// сразу было видно, что прилетело.

// Сколько летит одна карта.
const flightMs = 750;
// Больше стольких карт разом в воздухе не держим: цепная реакция за столом на
// восьмерых иначе поднимает в воздух всю колоду.
const maxFlights = 8;
// Насколько карта уходит вбок от прямой между игроками, в долях длины пути:
// это и есть «горб» параболы.
const arcRatio = 0.25;
// Размер карты на концах пути и в верхней точке дуги, в долях от базового:
// карта отрывается маленькой, вырастает в полёте (будто поднялась над столом) и
// снова уменьшается, когда ложится к получателю.
const edgeScale = 0.1;
const peakScale = 1.3;
// Оборот карты за полёт, градусов.
const spinDeg = 360;
// Рубашка карты события: ей летят все карты, кроме той, что достаётся тебе.
const cardBack = 'eventBack';

interface IPoint {
	x: number;
	y: number;
}

interface IFlight {
	id: number;
	from: IPoint;
	to: IPoint;
	// Сторона, в которую выгибается дуга, относительно направления полёта. У
	// встречных карт обмена bend одинаковый — и дуги у них получаются разные, так
	// что карты расходятся; а карта, которую вернули назад, летит с обратным
	// bend — то есть по той же самой дуге, только вспять.
	bend: number;
	// Карта лицом (её id) — только для того, кто её получает. Иначе рубашка.
	cardId: string;
}

interface ICardFlightsProps {
	controller: GameController;
	getPosition: (playerId: string) => IPoint;
	cardWidth: number;
}

// Парабола с нулями на концах пути и максимумом посередине.
const arcShape = (progress: number): number => 4 * progress * (1 - progress);

// Кто кому передаёт карту в контекстах нужного типа: giverId → receiverId.
const routesOf = (tradeContext: IFormatTradeContext[], type: ETurnContextType, onlyPicked: boolean): Map<string, string> => {
	const routes = new Map<string, string>();
	filter(tradeContext, (context) => context.type === type).forEach(({offensePlayerId, defensePlayerId, isCardPicked}) => {
		if (onlyPicked && !isCardPicked) return;
		if (offensePlayerId && defensePlayerId) routes.set(offensePlayerId, defensePlayerId);
	});
	return routes;
};

const routesSignature = (routes: Map<string, string>): string =>
	map([...routes], ([giverId, receiverId]) => `${giverId}>${receiverId}`).join('|');

const FlyingCard = ({from, to, bend, cardId, cardWidth}: Omit<IFlight, 'id'> & {cardWidth: number}) => {
	const {t} = useSpring<{t: number}>({
		t: 1,
		from: {t: 0},
		config: {duration: flightMs},
	});

	const dx = to.x - from.x;
	const dy = to.y - from.y;
	// Нормаль к отрезку (повёрнутый на 90° вектор пути), сразу нужной длины:
	// вдоль неё карта сходит с прямой и к концу пути возвращается на неё.
	const arcX = -dy * arcRatio * bend;
	const arcY = dx * arcRatio * bend;

	return (
		<Card
			id={cardId}
			style={{
				x: t.interpolate(progress => from.x + dx * progress + arcX * arcShape(progress)),
				y: t.interpolate(progress => from.y + dy * progress + arcY * arcShape(progress)),
				angle: t.interpolate(progress => spinDeg * bend * progress),
				width: t.interpolate(progress => cardWidth * (edgeScale + (peakScale - edgeScale) * arcShape(progress))),
			}}
		/>
	);
};

const CardFlights = observer(({controller, getPosition, cardWidth}: ICardFlightsProps) => {
	const {currentPlayerId, hand, gameLog} = controller;
	const tradeContext = controller.tradeContext || [];

	const [flights, setFlights] = React.useState<IFlight[]>([]);
	const nextFlightId = React.useRef(0);
	// Таймеры уборки долетевших карт. Держим их отдельно и снимаем только при
	// размонтировании: если чистить их из cleanup самого эффекта, то передача,
	// случившаяся раньше, чем долетела предыдущая, отменяла бы её уборку — и
	// карта оставалась на столе навсегда.
	const cleanupTimers = React.useRef<ReturnType<typeof setTimeout>[]>([]);
	React.useEffect(() => () => cleanupTimers.current.forEach(clearTimeout), []);
	// Обмены, в которых карта атакующего уже улетела: giverId → receiverId.
	const cardsInTrade = React.useRef<Map<string, string>>(new Map());
	// Цепная реакция: кто ещё не выбрал карту (пропал из списка — значит отдал),
	// и все пары «кто кому» этой цепочки — по ним видно, от кого карта пришла мне.
	const chainToPick = React.useRef<Map<string, string>>(new Map());
	const chainRoutes = React.useRef<Map<string, string>>(new Map());
	// Рука и длина лога на момент прошлого шага: по ним видно, какая карта пришла
	// ко мне и состоялся ли обмен вообще.
	const handBefore = React.useRef<string[]>([]);
	const logLengthBefore = React.useRef(0);
	// Первый проход только запоминает состояние: иначе игрок, открывший стол
	// посреди чужой передачи, увидит полёт карты, который давно случился.
	const isFirstRun = React.useRef(true);

	const trades = routesOf(tradeContext, ETurnContextType.trade, true);
	const chain = routesOf(tradeContext, ETurnContextType.chainReaction, false);
	// Контекст приходит новым массивом на каждое обновление игры, поэтому эффект
	// сравнивает не ссылку, а сам смысл: кто кому передаёт карту прямо сейчас.
	const signature = `${routesSignature(trades)}#${routesSignature(chain)}`;

	React.useEffect(() => {
		const remember = () => {
			cardsInTrade.current = trades;
			chainToPick.current = chain;
			handBefore.current = keys(hand);
			logLengthBefore.current = gameLog.length;
		};

		if (isFirstRun.current) {
			isFirstRun.current = false;
			chainRoutes.current = chain;
			remember();
			return;
		}

		// Карта, которая только что появилась у меня на руке, — это и есть
		// прилетевшая. Если новых карт не одна, честнее показать рубашку.
		const arrived = difference(keys(hand), handBefore.current);
		const arrivedCard = arrived.length === 1 ? hand[arrived[0] ?? ''] : undefined;
		// Отказ от обмена (страх, «нет уж спасибо») тоже убирает контекст обмена,
		// но обменом не считается: у него строка лога другого типа.
		const isTradeDone = some(gameLog.slice(logLengthBefore.current), ({type}) => type === EGameLogType.trade);

		const started: IFlight[] = [];
		const addFlight = (giverId: string, receiverId: string, bend: number, cardId?: string) => {
			// Свой конец пути рисует не стол, а рука: карта, которая достаётся мне,
			// въезжает прямо в веер, а отданная вылетает из своего гнезда — одним
			// движением, без дубля от кружка (см. GameController.markCardMoves).
			// Сверяем и второй конец пути: так отметка обмена, за который рука уже
			// взялась, не погасит чужой полёт. Если рука за движение не взялась
			// (непонятно, какая карта чья), стол рисует полёт как раньше.
			if (receiverId === currentPlayerId && controller.arriving?.playerId === giverId) return;
			if (giverId === currentPlayerId && controller.leaving?.playerId === receiverId) return;
			started.push({
				id: nextFlightId.current++,
				from: getPosition(giverId),
				to: getPosition(receiverId),
				bend,
				cardId: cardId || cardBack,
			});
		};

		trades.forEach((receiverId, giverId) => {
			const previousReceiverId = cardsInTrade.current.get(giverId);
			// Атакующий только что выбрал карту — она летит к защищающемуся.
			if (!previousReceiverId) addFlight(giverId, receiverId, 1);
			// «Мимо»: защищающийся перевёл обмен на следующего, карта летит дальше.
			else if (previousReceiverId !== receiverId) addFlight(previousReceiverId, receiverId, 1);
		});

		cardsInTrade.current.forEach((receiverId, giverId) => {
			if (trades.has(giverId)) return;
			// Отказ (страх, «нет уж спасибо») тоже убирает контекст обмена, только
			// своей карты защищающийся не отдавал: к атакующему по той же дуге
			// возвращается его собственная карта.
			if (!isTradeDone) {
				addFlight(receiverId, giverId, -1, currentPlayerId === giverId ? arrivedCard?.id : undefined);
				return;
			}
			// Обмен состоялся: карта защищающегося летит навстречу, другой дугой.
			addFlight(receiverId, giverId, 1, currentPlayerId === giverId ? arrivedCard?.id : undefined);
			// Защищающийся свою карту уже видел улетающей рубашкой вверх — теперь к
			// нему прилетает ответная, и ему она показывается открытой.
			if (currentPlayerId === receiverId) addFlight(giverId, receiverId, 1, arrivedCard?.id);
		});

		// Цепная реакция раздаёт карты всем разом, только когда выбрали все, но
		// каждый отдаёт свою в момент выбора — тогда её и отправляем в полёт.
		chain.forEach((receiverId, giverId) => chainRoutes.current.set(giverId, receiverId));
		const isChainOver = chainToPick.current.size > 0 && chain.size === 0;
		chainToPick.current.forEach((receiverId, giverId) => {
			if (chain.has(giverId)) return;
			// Карту, которая в конце цепочки достаётся мне, показываем открытой —
			// её полёт добавляется ниже, дублировать рубашкой не нужно.
			if (isChainOver && currentPlayerId === receiverId) return;
			addFlight(giverId, receiverId, 1);
		});
		if (isChainOver) {
			chainRoutes.current.forEach((receiverId, giverId) => {
				if (currentPlayerId === receiverId) addFlight(giverId, receiverId, 1, arrivedCard?.id);
			});
			chainRoutes.current = new Map();
		}

		remember();

		if (!started.length) return;
		setFlights(current => [...current, ...started].slice(-maxFlights));
		const startedIds = map(started, ({id}) => id);
		const timer = setTimeout(() => {
			setFlights(current => filter(current, ({id}) => !startedIds.includes(id)));
			cleanupTimers.current = filter(cleanupTimers.current, item => item !== timer);
		}, flightMs);
		cleanupTimers.current.push(timer);
	}, [signature]);

	return (
		<React.Fragment>
			{map(flights, ({id, from, to, bend, cardId}) => (
				<FlyingCard key={id} from={from} to={to} bend={bend} cardId={cardId} cardWidth={cardWidth}/>
			))}
		</React.Fragment>
	);
});

export default CardFlights;
