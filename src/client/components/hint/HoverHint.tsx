import React, {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {clamp} from 'lodash';
import cn from 'classnames';
import './styles.scss';

// Универсальная всплывашка: оборачивает ЧТО УГОДНО (слово в логе, миниатюру
// карты, бейдж игрока) и показывает рядом произвольное содержимое.
//
// На устройствах с курсором окошко живёт по наведению, на тач-экранах наведения
// нет — там тап «прикалывает» окошко, и закрыть его можно крестиком или тапом
// мимо. Клик прикалывает окошко и с курсором тоже: подсказку бывает нужно
// разглядеть, не удерживая мышь на слове.

interface IHoverHintProps {
	// Что показать в окошке.
	content: React.ReactNode;
	// Что оборачиваем: текст, картинка, бейдж — что угодно.
	children: React.ReactNode;
	// Класс на якоре (сам оборачиваемый кусок) и на окошке.
	className?: string;
	hintClassName?: string;
}

const HINT_GAP = 8;
const HINT_MARGIN = 8;

const isHoverCapable = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function'
	? window.matchMedia('(hover: hover) and (pointer: fine)').matches
	: false;

interface IHintPosition {
	left: number;
	top: number;
}

// К чему прижимаемся. Ровно то, что нужно от DOMRect (он подходит как есть), —
// но так же можно прижаться к чему угодно, у чего есть место на экране: хоть к
// спрайту на канвасе (см. canvasHint).
export interface IHintAnchor {
	left: number;
	top: number;
	bottom: number;
	width: number;
}

// Окошко раскрывается вниз (лог и прочие оверлеи висят сверху), а если снизу не
// помещается — вверх. Если тесно и там, и там, просто прижимаем к краю экрана:
// лучше слегка перекрыть якорь, чем уехать за пределы видимого.
const placeHint = (anchor: IHintAnchor, width: number, height: number): IHintPosition => {
	const viewportWidth = window.innerWidth;
	const viewportHeight = window.innerHeight;
	const fit = (value: number, size: number, limit: number) =>
		clamp(value, HINT_MARGIN, Math.max(HINT_MARGIN, limit - size - HINT_MARGIN));

	const below = anchor.bottom + HINT_GAP;
	const above = anchor.top - HINT_GAP - height;
	const fitsBelow = below + height <= viewportHeight - HINT_MARGIN;
	const top = fitsBelow ? below : (above >= HINT_MARGIN ? above : fit(below, height, viewportHeight));
	const left = fit(anchor.left + anchor.width / 2 - width / 2, width, viewportWidth);
	return {left, top};
};

export interface IHintPopupProps {
	anchor: IHintAnchor;
	isPinned: boolean;
	onClose: () => void;
	className?: string;
	children: React.ReactNode;
}

export const HintPopup = ({anchor, isPinned, onClose, className, children}: IHintPopupProps) => {
	const popupRef = useRef<HTMLDivElement>(null);
	const [position, setPosition] = useState<IHintPosition | null>(null);

	// Размер содержимого заранее неизвестен (в него можно завернуть что угодно),
	// поэтому сначала рисуем окошко невидимым, меряем и только потом ставим.
	useLayoutEffect(() => {
		const popup = popupRef.current;
		if (!popup) return;
		const {width, height} = popup.getBoundingClientRect();
		setPosition(placeHint(anchor, width, height));
	}, [anchor]);

	return createPortal(
		<>
			{isPinned
				? <div className={'hoverHintBackdrop'} onPointerDown={onClose} data-hint-backdrop={''}/>
				: null}
			<div
				ref={popupRef}
				className={cn('hoverHintPopup', className, {isPinned})}
				style={{
					left: position ? position.left : 0,
					top: position ? position.top : 0,
					visibility: position ? 'visible' : 'hidden',
				}}
				data-hint-popup={''}
			>
				{children}
				{isPinned
					? <button
						type={'button'}
						className={'hoverHintClose'}
						onClick={onClose}
						aria-label={'Закрыть'}
						data-hint-close={''}
					>✕</button>
					: null}
			</div>
		</>,
		document.body,
	);
};

interface IHintState {
	anchor: IHintAnchor;
	isPinned: boolean;
}

export const HoverHint = ({content, children, className, hintClassName}: IHoverHintProps) => {
	const anchorRef = useRef<HTMLSpanElement>(null);
	const [hint, setHint] = useState<IHintState | null>(null);

	const close = useCallback(() => setHint(null), []);

	// Окошко висит в координатах экрана, а якорь ездит: лог сам прокручивается к
	// свежей строке, окно меняет размер. Поэтому не закрываем подсказку, а
	// пересчитываем её место — иначе она моргала бы на каждой новой строке лога.
	const reposition = useCallback(() => {
		const anchor = anchorRef.current;
		if (!anchor) return;
		const rect = anchor.getBoundingClientRect();
		setHint((current) => current ? {...current, anchor: rect} : current);
	}, []);

	const isOpen = hint !== null;
	useEffect(() => {
		if (!isOpen) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') close();
		};
		window.addEventListener('keydown', onKeyDown);
		window.addEventListener('resize', reposition);
		window.addEventListener('scroll', reposition, true);
		return () => {
			window.removeEventListener('keydown', onKeyDown);
			window.removeEventListener('resize', reposition);
			window.removeEventListener('scroll', reposition, true);
		};
	}, [isOpen, close, reposition]);

	const open = (isPinned: boolean) => {
		const anchor = anchorRef.current;
		if (!anchor) return;
		setHint({anchor: anchor.getBoundingClientRect(), isPinned});
	};

	const onPointerEnter = () => {
		// На тач-экранах pointerenter приходит вместе с тапом — там окошком
		// заведует onClick, иначе оно открывалось бы неприкрытым и не закрывалось.
		if (isHoverCapable() && !isOpen) open(false);
	};

	const onPointerLeave = () => setHint((current) => (current && current.isPinned) ? current : null);

	const onClick = (event: React.MouseEvent) => {
		// Клик по подсказке — это только подсказка: он не должен доходить до
		// того, на чём она висит (шапка лога, например, по клику сворачивается).
		event.stopPropagation();
		event.preventDefault();
		if (hint && hint.isPinned) {
			close();
			return;
		}
		open(true);
	};

	return <>
		<span
			ref={anchorRef}
			className={cn('hoverHint', className)}
			onPointerEnter={onPointerEnter}
			onPointerLeave={onPointerLeave}
			onClick={onClick}
			data-hint-anchor={''}
		>
			{children}
		</span>
		{hint
			? <HintPopup
				anchor={hint.anchor}
				isPinned={hint.isPinned}
				onClose={close}
				className={hintClassName}
			>{content}</HintPopup>
			: null}
	</>;
};

export default HoverHint;
