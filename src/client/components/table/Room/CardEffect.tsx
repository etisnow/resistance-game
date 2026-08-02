import React from 'react';
import {filter, map, reduce} from 'lodash';
import {observer} from 'mobx-react-lite';
import {useSpring} from 'react-spring/universal';
import {cardAspectRatio} from 'shared/constant/cards';
import {Sprite} from 'react-pixi-fiber';
import {AnimatedPixi, getPixiTexture} from 'client/components/table/pixiInjected';
import {cardImage} from 'client/helpers/cardVisuals';
import * as PIXI from 'pixi.js';
import {cardHintStore} from 'client/components/hint/cardHintStore';
import {displayObjectAnchor} from 'client/components/hint/canvasHint';
import GameController from 'client/controllers/gameController';

// Разовые применения карт — подсмотр «Подозрением», отказ «Нет уж спасибо»,
// «Никакого шашлыка» и прочее — не оставляют на столе стрелки. Их показываем
// самой картой поверх бейджа того, кто её применил, со сдвигом в сторону того,
// на кого применили: сразу видно и что сделали, и против кого.

// Сколько карта висит над бейджем. Долго: по ней ещё и подсказку смотрят.
const effectMs = 3400;
// Доли времени показа: проявление и начало растворения. Тает карта медленно —
// так понятнее, что она уходит, и успеваешь навести на неё курсор.
const fadeInPart = 0.07;
const fadeOutFrom = 0.55;
// Больше стольких значков разом на столе не держим: в быстрой игре они копятся
// и превращаются в кашу (а на слабом железе ещё и тормозят).
const maxShown = 4;
// Доли радиуса бейджа: размер карты, сдвиг в сторону цели и подъём за время показа.
const cardShare = 1.7;
const riseShare = 0.35;
const offsetShare = 0.6;

interface IPoint {
	x: number;
	y: number;
}

interface IEffect {
	seq: number;
	cardId: string;
	x: number;
	y: number;
}

interface ICardEffectsProps {
	controller: GameController;
	getPosition: (playerId: string) => IPoint;
	badgeRadius: number;
}

const AppliedCard = ({cardId, x, y, badgeRadius}: Omit<IEffect, 'seq'> & {badgeRadius: number}) => {
	const {t} = useSpring<{t: number}>({
		t: 1,
		from: {t: 0},
		config: {duration: effectMs},
	});
	// Наведение показывает саму карту крупно — тем же окошком, что и названия
	// карт в логе. Прячем только своё: чужую (прикнопленную) подсказку не трогаем.
	// Хранилище подсказки трогаем вне обработчика канваса: у стола свой
	// реконсилятор, и начатое внутри него обновление до DOM-дерева не доезжает —
	// хранилище меняется, а окошко не перерисовывается.
	const showHint = (event: PIXI.interaction.InteractionEvent) => {
		const anchor = displayObjectAnchor(event.currentTarget);
		// Подсказка по наведению — не прикнопленная: у прикнопленной есть подложка
		// во весь экран, она перехватывала бы у стола движения курсора, стол терял
		// бы наведение, и окошко мигало бы.
		setTimeout(() => cardHintStore.show(cardId, anchor, false), 0);
	};
	const hideHint = React.useCallback(() => {
		setTimeout(() => {
			// Чужую подсказку (например, прикнопленную по двери) не закрываем.
			if (cardHintStore.cardId === cardId) cardHintStore.hide();
		}, 0);
	}, [cardId]);
	// Карта растаяла, пока на ней держали курсор — окошко забирать некому.
	React.useEffect(() => hideHint, [hideHint]);
	const image = cardImage(cardId);
	if (!image) return null;

	const size = badgeRadius * cardShare;
	const rise = badgeRadius * riseShare;
	// Карта успевает проявиться, повисеть и растаять; заодно всплывает вверх.
	const alpha = t.interpolate(progress => {
		if (progress < fadeInPart) return progress / fadeInPart;
		if (progress > fadeOutFrom) return (1 - progress) / (1 - fadeOutFrom);
		return 1;
	});
	const riseY = t.interpolate(progress => y - rise * progress);
	return (
		<React.Fragment>
			<AnimatedPixi.Container x={x} y={riseY} alpha={alpha}>
				<Sprite
					texture={getPixiTexture(image)}
					anchor={0.5}
					width={size}
					height={size * cardAspectRatio}
				/>
			</AnimatedPixi.Container>
			{/* Ловушка наведения: невидимый спрайт на весь путь карты. Наведение на
			    саму карту срывалось бы — она всплывает и уходит из-под курсора, а
			    каждый такой уход закрывал бы подсказку. */}
			<Sprite
				texture={PIXI.Texture.WHITE}
				alpha={0}
				anchor={0.5}
				x={x}
				y={y - rise / 2}
				width={size}
				height={size * cardAspectRatio + rise}
				interactive={true}
				pointerover={showHint}
				pointerout={hideHint}
			/>
		</React.Fragment>
	);
};

const CardEffects = observer(({controller, getPosition, badgeRadius}: ICardEffectsProps) => {
	const {cardEffects} = controller;
	const [shown, setShown] = React.useState<IEffect[]>([]);
	// Таймеры уборки показанных карт — см. тот же приём в CardFlight: чистить их
	// из cleanup эффекта нельзя, иначе следующее применение отменяет уборку
	// предыдущего и карта повисает над бейджем навсегда.
	const cleanupTimers = React.useRef<ReturnType<typeof setTimeout>[]>([]);
	React.useEffect(() => () => cleanupTimers.current.forEach(clearTimeout), []);
	// Последнее показанное применение: всё, что новее, — свежее событие.
	const lastSeq = React.useRef(0);
	// Первый проход только запоминает номер: пришедшему в середину партии не
	// нужно догонять все чужие ходы разом.
	const isFirstRun = React.useRef(true);

	const latestSeq = reduce(cardEffects, (acc: number, {seq}) => Math.max(acc, seq), 0);

	React.useEffect(() => {
		if (isFirstRun.current) {
			isFirstRun.current = false;
			lastSeq.current = latestSeq;
			return;
		}

		const fresh = filter(cardEffects, ({seq}) => seq > lastSeq.current);
		lastSeq.current = latestSeq;
		if (!fresh.length) return;

		const started = map(fresh, ({seq, cardId, playerId, targetPlayerId}): IEffect => {
			const from = getPosition(playerId);
			const to = targetPlayerId ? getPosition(targetPlayerId) : null;
			const dx = to ? to.x - from.x : 0;
			// Без цели карта просто приподнимается над бейджем.
			const dy = to ? to.y - from.y : -1;
			const length = Math.hypot(dx, dy) || 1;
			const offset = badgeRadius * offsetShare;
			return {seq, cardId, x: from.x + (dx / length) * offset, y: from.y + (dy / length) * offset};
		});

		setShown(current => [...current, ...started].slice(-maxShown));
		const startedSeqs = map(started, ({seq}) => seq);
		const timer = setTimeout(() => {
			setShown(current => filter(current, ({seq}) => !startedSeqs.includes(seq)));
			cleanupTimers.current = filter(cleanupTimers.current, item => item !== timer);
		}, effectMs);
		cleanupTimers.current.push(timer);
	}, [latestSeq]);

	return (
		<React.Fragment>
			{map(shown, ({seq, cardId, x, y}) => (
				<AppliedCard key={seq} cardId={cardId} x={x} y={y} badgeRadius={badgeRadius}/>
			))}
		</React.Fragment>
	);
});

export default CardEffects;
