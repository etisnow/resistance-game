import React from 'react';
import {filter, includes, map, reduce} from 'lodash';
import {useSpring} from 'react-spring/universal';
import {AnimatedPixi} from 'client/components/table/pixiInjected';
import {EEventID} from 'shared/enum/cards';
import GameController from 'client/controllers/gameController';

// «Никакого шашлыка». Огнемёт всё-таки выстрелил — струя долетает до жертвы, но
// упирается в карту и уходит рикошетом наружу, мимо стола. Тот же шейдер огня,
// что и у сожжения (см. Fire и Burn), только струи здесь две: короткая к цели и
// отражённая от неё.
//
// Саму карту над бейджем показывает общий поток применений (см. CardEffect):
// она висит ровно в точке попадания и читается как то самое зеркало, от
// которого отбило пламя.

// Сколько идёт весь рикошет. Огнемёт хлещет не переставая, так что дают на это
// время — успеть разглядеть и саму струю, и то, как её отбивает.
const deflectMs = 2800;
// Доли этого времени. Обе струи горят вместе: пламя всё это время идёт в цель и
// всё это время уходит от неё рикошетом — иначе вместо одного потока выйдут два
// выстрела подряд. Отражённая только занимается чуть позже (пламени надо
// долететь) и гаснет вместе с прилетевшей. Вспышка в точке попадания живёт ровно
// столько, сколько нужно ударной волне.
const burstFrom = 0.03;
const burstTo = 0.28;
const reflectFrom = 0.07;
// Во сколько раз струя длиннее пути до цели. Чуть длиннее: сама она гаснет к
// концу своего квада (см. jet в шейдере), и с запасом это затухание приходится
// как раз на жертву — пламя доходит до неё в полную силу и там же обрывается.
const jetOvershoot = 1.4;
// Насколько дальше улетает отражённая: ей уходить со стола, а не биться о
// соседа.
const reflectOvershoot = 2.2;
// Где на отражённой струе кончается прицельная часть и начинается разлёт (в
// долях её длины). Отбитому пламени целить некуда — оно расходится веером почти
// сразу.
const reflectOrigin = 0.25;
// Ширина квада струи к её длине. Разлёт искр считается в долях длины, и в узкий
// квад он бы не поместился — края обрезали бы поток прямой линией.
const jetAspect = 1.15;
// Насколько отражённую струю доворачивает наружу поверх честного отражения. У
// соседей по столу пламя приходит вскользь, и зеркальный луч уходил бы вдоль
// самого стола, мимо всех кружков по очереди. Доворот отправляет его прочь.
const outwardBias = 0.5;
// Вспышка в точке попадания — в долях радиуса бейджа. Квад квадратный и заведомо
// больше кружка: ударной волне надо куда расходиться.
const burstShare = 5.6;
// Насколько блик от струи сдвинут от центра кружка к огню — в долях габарита
// кружка (сам кружок в этих долях имеет радиус 0.5).
const glintPull = 0.3;
// Своё зерно у отражённой струи и у пепла: с общим они повторяли бы прилетевшую
// струю искра в искру.
const reflectSeedShift = 0.29;
const ashSeedShift = 0.61;

// Доли жизни струи, на которых шейдер разжигает и гасит её (см. power в jet).
// Повторены здесь, чтобы пройти их быстро: гаснет струя не остывая, а просто
// тускнея, и её добела раскалённая сердцевина по дороге в ноль надолго
// повисает серой. У костра это незаметно — там гаснущую струю перебивает сам
// пожар, — а здесь, кроме неё, на столе ничего и нет.
const shaderLit = 0.12;
const shaderFade = 0.78;
// За какую долю своего времени струя разгорается и гаснет.
const flareIn = 0.05;
const flareOut = 0.12;

// Расписание одной струи: доля её времени (0..1) в ту самую «жизнь», которой
// живёт шейдер. Разгон и затухание проскакиваем, в полную силу горим долго.
const jetPower = (share: number): number => {
	if (share <= 0) return 0;
	if (share <= flareIn) return shaderLit * (share / flareIn);
	if (share >= 1 - flareOut) return shaderFade + (1 - shaderFade) * (share - (1 - flareOut)) / flareOut;
	return shaderLit + (shaderFade - shaderLit) * (share - flareIn) / (1 - flareOut - flareIn);
};

interface IPoint {
	x: number;
	y: number;
}

export interface IDeflect {
	seq: number;
	// Где отбило — место того, кто отмахнулся «Никаким шашлыком».
	x: number;
	y: number;
	// Откуда било — место того, кто взялся за огнемёт.
	fromX: number;
	fromY: number;
}

// Свой рисунок пламени у каждого рикошета — как и у костра, из номера события, а
// не из случайного числа: иначе искры перерисовывались бы на каждом кадре пружины.
const seedOf = (seq: number): number => (seq * 0.6180339887) % 1;

interface IDeflectionProps {
	deflect: IDeflect;
	badgeRadius: number;
}

const Deflection = ({deflect: {seq, x, y, fromX, fromY}, badgeRadius}: IDeflectionProps) => {
	const {t} = useSpring<{t: number}>({
		t: 1,
		from: {t: 0},
		config: {duration: deflectMs},
	});

	const seed = seedOf(seq);

	// Путь до цели: по нему ставим прилетевшую струю.
	const dx = x - fromX;
	const dy = y - fromY;
	const distance = Math.hypot(dx, dy) || 1;
	const jetAngle = Math.atan2(dy, dx);
	const jetLength = distance * jetOvershoot;

	// Куда уходит отражённая. Зеркало держат ребром к центру стола: пламя
	// приходит вскользь и уходит под тем же углом, но в другую сторону — то есть
	// у направления меняется знак вдоль стола, а «наружу» остаётся как было.
	// Стол стоит в начале координат, поэтому наружу — это просто путь от нуля.
	const outward = Math.hypot(x, y) || 1;
	const nx = x / outward;
	const ny = y / outward;
	// Касательная к столу в точке отражения — та самая ось, по которой луч
	// переворачивают.
	const tx = -ny;
	const ty = nx;
	const inX = dx / distance;
	const inY = dy / distance;
	const along = inX * tx + inY * ty;
	// Чистое отражение всегда смотрит хоть немного наружу (стол выпуклый, и любая
	// хорда идёт от центра), а доворот доводит его до внятного угла.
	const outX = inX - 2 * along * tx + outwardBias * nx;
	const outY = inY - 2 * along * ty + outwardBias * ny;
	const reflectAngle = Math.atan2(outY, outX);
	const reflectLength = distance * reflectOvershoot;

	// Секунды с начала рикошета: ими живёт турбулентность в шейдере.
	const time = t.interpolate(progress => progress * deflectMs / 1000);
	const jetLife = t.interpolate(progress => jetPower(progress));
	const reflectLife = t.interpolate(progress =>
		jetPower(Math.max(0, (progress - reflectFrom) / (1 - reflectFrom))));
	const burstLife = t.interpolate(progress =>
		Math.min(1, Math.max(0, (progress - burstFrom) / (burstTo - burstFrom))));

	// Блик на том, в кого бьют: свет ложится на тот его бок, что обращён к огню.
	// Ось y у квада смотрит вверх, у стола — вниз, отсюда минус.
	const glintX = -inX * glintPull;
	const glintY = inY * glintPull;

	return (
		<AnimatedPixi.Container x={x} y={y} interactiveChildren={false}>
			{/* Отсвет струи на том, кто закрылся картой: он приглушённый, но живой —
			    сразу видно, что пламя всё-таки дошло. */}
			<AnimatedPixi.Fire
				y={badgeRadius}
				fireWidth={badgeRadius * 2}
				fireHeight={badgeRadius * 2}
				glintX={glintX}
				glintY={glintY}
				originUp={0.5}
				time={time}
				life={jetLife}
				seed={seed}
				mode={'glint'}
			/>
			{/* Прилетевшая струя. Рисуем в координатах точки отражения: она стоит на
			    месте защищавшегося, поэтому поджигатель — это смещение до него. */}
			<AnimatedPixi.Fire
				x={fromX - x}
				y={fromY - y}
				rotation={jetAngle + Math.PI / 2}
				fireWidth={jetLength * jetAspect}
				fireHeight={jetLength}
				originUp={1 / jetOvershoot}
				time={time}
				life={jetLife}
				seed={seed}
				mode={'jet'}
			/>
			{/* Отражённая — из той же точки, куда пришла первая, и прочь от стола. */}
			<AnimatedPixi.Fire
				rotation={reflectAngle + Math.PI / 2}
				fireWidth={reflectLength * jetAspect}
				fireHeight={reflectLength}
				originUp={reflectOrigin}
				time={time}
				life={reflectLife}
				seed={seed + reflectSeedShift}
				mode={'jet'}
			/>
			{/* Вспышка в точке удара — на своём просторном кваде, по центру кружка. */}
			<AnimatedPixi.Fire
				y={badgeRadius * burstShare / 2}
				fireWidth={badgeRadius * burstShare}
				fireHeight={badgeRadius * burstShare}
				originUp={0.5}
				time={time}
				life={burstLife}
				seed={seed}
				mode={'burst'}
			/>
			{/* Пепел летит с отбитым пламенем. Слой отдельный — он темнит, а огонь
			    светится. */}
			<AnimatedPixi.Fire
				rotation={reflectAngle + Math.PI / 2}
				fireWidth={reflectLength * jetAspect}
				fireHeight={reflectLength}
				originUp={reflectOrigin}
				time={time}
				life={reflectLife}
				seed={seed + ashSeedShift}
				mode={'ash'}
			/>
		</AnimatedPixi.Container>
	);
};

/**
 * Рикошеты, которые сейчас видно на столе. Событие приходит тем же потоком
 * применённых карт, что и всё остальное (cardEffects): «Никакого шашлыка»
 * применяет тот, кого жгли, а целью в нём записан сам поджигатель — от него и
 * бьёт струя.
 */
export const useDeflects = (
	controller: GameController,
	getPosition: (playerId: string) => IPoint,
): IDeflect[] => {
	const {cardEffects} = controller;
	const [deflects, setDeflects] = React.useState<IDeflect[]>([]);
	// Таймеры уборки — тот же приём, что в Burn и CardEffect: чистить их из
	// cleanup эффекта нельзя, иначе следующий рикошет отменяет уборку предыдущего
	// и струя остаётся на столе до конца партии.
	const cleanupTimers = React.useRef<ReturnType<typeof setTimeout>[]>([]);
	React.useEffect(() => () => cleanupTimers.current.forEach(clearTimeout), []);
	const lastSeq = React.useRef(0);
	// Первый проход только запоминает номер: пришедшему в середину партии не нужно
	// догонять чужие ходы разом.
	const isFirstRun = React.useRef(true);

	const latestSeq = reduce(cardEffects, (acc: number, {seq}) => Math.max(acc, seq), 0);

	React.useEffect(() => {
		if (isFirstRun.current) {
			isFirstRun.current = false;
			lastSeq.current = latestSeq;
			return;
		}

		const fresh = filter(cardEffects, ({seq, cardId, targetPlayerId}) =>
			seq > lastSeq.current && cardId === EEventID.noFire && !!targetPlayerId);
		lastSeq.current = latestSeq;
		if (!fresh.length) return;

		const started = map(fresh, ({seq, playerId, targetPlayerId}): IDeflect => {
			const {x, y} = getPosition(playerId);
			const {x: fromX, y: fromY} = getPosition(targetPlayerId ?? '');
			return {seq, x, y, fromX, fromY};
		});

		setDeflects(current => [...current, ...started]);
		const startedSeqs = map(started, ({seq}) => seq);
		const timer = setTimeout(() => {
			setDeflects(current => filter(current, ({seq}) => !includes(startedSeqs, seq)));
			cleanupTimers.current = filter(cleanupTimers.current, item => item !== timer);
		}, deflectMs);
		cleanupTimers.current.push(timer);
	}, [latestSeq]);

	return deflects;
};

interface IDeflectionsProps {
	deflects: IDeflect[];
	badgeRadius: number;
}

const Deflections = ({deflects, badgeRadius}: IDeflectionsProps) => (
	<React.Fragment>
		{map(deflects, deflect => (
			<Deflection key={deflect.seq} deflect={deflect} badgeRadius={badgeRadius}/>
		))}
	</React.Fragment>
);

export default Deflections;
