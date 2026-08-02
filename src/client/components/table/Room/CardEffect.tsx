import React from 'react';
import {filter, map, reduce} from 'lodash';
import {observer} from 'mobx-react-lite';
import {useSpring} from 'react-spring/universal';
import {cardAspectRatio} from 'shared/constant/cards';
import {Sprite} from 'react-pixi-fiber';
import {AnimatedPixi, getPixiTexture} from 'client/components/table/pixiInjected';
import Circle from 'client/components/pixiPrimitives/Circle';
import {cardColor, cardImage} from 'client/helpers/cardVisuals';
import GameController from 'client/controllers/gameController';

// Разовые применения карт — подсмотр «Подозрением», отказ «Нет уж спасибо»,
// «Никакого шашлыка» и прочее — не оставляют на столе стрелки. Их показываем
// самой картой поверх бейджа того, кто её применил, со сдвигом в сторону того,
// на кого применили: сразу видно и что сделали, и против кого.

// Сколько карта висит над бейджем.
const effectMs = 1800;
// Больше стольких значков разом на столе не держим: в быстрой игре они копятся
// и превращаются в кашу (а на слабом железе ещё и тормозят).
const maxShown = 4;
// Доли радиуса бейджа: размер карты и сдвиг в сторону цели.
const cardShare = 1.05;
const offsetShare = 0.6;
// Подложка под картой — кружок её цветом, чтобы действие читалось издалека.
const haloShare = 0.62;
const haloAlpha = 0.5;

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
	const image = cardImage(cardId);
	if (!image) return null;

	const size = badgeRadius * cardShare;
	// Карта успевает проявиться, повисеть и растаять; заодно чуть всплывает.
	const alpha = t.interpolate(progress => {
		if (progress < 0.12) return progress / 0.12;
		if (progress > 0.75) return (1 - progress) / 0.25;
		return 1;
	});
	const riseY = t.interpolate(progress => y - badgeRadius * 0.25 * progress);

	return (
		<AnimatedPixi.Container x={x} y={riseY} alpha={alpha}>
			<Circle r={size * haloShare} color={cardColor(cardId)} alpha={haloAlpha}/>
			<Sprite
				texture={getPixiTexture(image)}
				anchor={0.5}
				width={size}
				height={size * cardAspectRatio}
			/>
		</AnimatedPixi.Container>
	);
};

const CardEffects = observer(({controller, getPosition, badgeRadius}: ICardEffectsProps) => {
	const {cardEffects} = controller;
	const [shown, setShown] = React.useState<IEffect[]>([]);
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
		const timeout = setTimeout(() => {
			setShown(current => filter(current, ({seq}) => !startedSeqs.includes(seq)));
		}, effectMs);
		return () => clearTimeout(timeout);
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
