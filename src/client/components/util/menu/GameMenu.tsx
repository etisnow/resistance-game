import React from 'react';
import './menu.scss';

/**
 * Меню игры — одно и то же и за столом, и на входе: кнопка в углу, затемнение
 * поверх экрана и панель с пунктами. Отсюда его берут оба экрана, чтобы на
 * главном не завелось второе меню со своими отступами и своим шрифтом.
 *
 * Что внутри панели, каждый экран решает сам: за столом это выход и вид стола,
 * на входе — только громкости.
 */

interface IVolumeSliderProps {
	label: string;
	value: number;
	onChange: (value: number) => void;
	/** Чем отозваться, когда ползунок отпустили. Музыке не нужно — она уже играет. */
	onRelease?: () => void;
}

/**
 * Пункт-ползунок. Не кнопка: ползунок ловит нажатия сам, и меню от них
 * закрываться не должно.
 */
export const VolumeSlider = ({label, value, onChange, onRelease}: IVolumeSliderProps) => (
	<div className={'gameMenuItem slider'}>
		<span className={'gameMenuSliderLabel'}>{label}</span>
		<input
			type={'range'}
			className={'gameMenuSliderInput'}
			min={0}
			max={100}
			step={1}
			value={Math.round(value * 100)}
			onChange={(event) => onChange(Number(event.target.value) / 100)}
			onPointerUp={onRelease}
			onKeyUp={onRelease}
		/>
		<span className={'gameMenuSliderValue'}>{Math.round(value * 100)}</span>
	</div>
);

/** Кнопка в углу, которой меню открывают. */
export const MenuButton = ({onClick}: {onClick: () => void}) => (
	<button className={'gameMenuButton'} onClick={onClick}>
		Меню
	</button>
);

/**
 * Само меню: затемнение на весь экран и панель поверх него. Щелчок мимо панели
 * закрывает — это привычнее, чем искать «закрыть», а ничего необратимого внутри
 * панели нет.
 */
export const MenuPanel = ({onClose, children}: {onClose: () => void, children: React.ReactNode}) => (
	<div className={'gameMenuOverlay'} onClick={onClose}>
		<div className={'gameMenu'} onClick={(event) => event.stopPropagation()}>
			{children}
		</div>
	</div>
);
