import React from 'react';
import {observer} from 'mobx-react-lite';
import {clamp} from 'lodash';
import backdrop from 'client/resources/images/room_bg.jpg';
import {backdropAnchorY, getWindowHeight, getWindowWidth, tableCenterX} from 'client/helpers/window';

/**
 * Задник: отсек станции, в котором стоит стол.
 *
 * Обычным CSS-фоном его не поставить. Стол стоит не в середине экрана: сверху
 * его теснит лог, снизу — рука, и центр он держит по свободному полю между ними
 * (см. tableCenterY). Круг на полу картинки, вокруг которого построена вся
 * комната, тоже не в её середине — он ниже. Оба смещения зависят от размера
 * окна каждое по-своему, а background-position умеет ровнять только середину с
 * серединой, и стол оказывался сдвинут относительно круга.
 *
 * Поэтому картинку кладём отдельным слоем и считаем ей место сами: точку круга
 * на полу ставим ровно в середину свободного поля. Двигается при этом задник, а
 * не стол — стол занимает то поле, которое ему оставляет интерфейс. Сам стол
 * внутри комнаты ещё и приподнят (см. roomLift), и на задник этот подъём не
 * распространяется: комната стоит на месте.
 */

// Своя геометрия картинки: размер в пикселях и доля, на которой лежит середина
// круга на полу. Меняется картинка — меняются и эти четыре числа.
//
// Середина снята по самим кольцам: у эллипса берутся крайние точки — левая с
// правой дают середину по горизонтали, верхняя с нижней по вертикали. Все три
// кольца сходятся на одном центре, и он заметно ниже середины картинки: пол
// уходит вниз, а над ним ещё стоят стены. На глаз она получалась выше, и стол
// оказывался поднят над нарисованным кругом.
const imageWidth = 1672;
const imageHeight = 941;
const focusX = 0.5;
const focusY = 0.669;

// Масштаб: не мельче, чем нужно, чтобы закрыть окно по каждой из осей. До всех
// четырёх краёв картинку ПОСЛЕ привязки к кругу не дотянуть: под столом на экране
// остаётся больше половины высоты, а под кругом на картинке — треть, и её
// пришлось бы раздуть до состояния, когда от комнаты остаётся один пол.
// Незакрытое добирает чёрный фон обёртки: края картинки и так уходят в темноту.
// Приходится полоса ровно на руку, в игре за картами её и не видно, а сам стык
// с чёрным гасим растушёвкой (см. fadeMask) — иначе край режет ровной линией.
const coverScale = (width: number, height: number): number =>
	Math.max(width / imageWidth, height / imageHeight);

// Обрез снизу сам по себе всё-таки читается: на входе руки ещё нет, и низ
// картинки упирается в чёрный фон обёртки ровной линией. Гасим край маской —
// последние пиксели уходят в прозрачность, и полоса под ними читается как
// темнота, в которой теряется пол.
//
// Длину растушёвки меряем от края в пикселях, а не в долях картинки: когда
// нижний край уходит под окно (широкие окна — масштаб берётся по ширине, и
// картинка вылезает вниз), доля растянулась бы на пол-экрана и притемнила бы
// комнату там, где обреза и не видно.
const fadeLength = (height: number): number => clamp(height * 0.2, 90, 280);

// Ступеньки маски: у самого края ноль, дальше плавный выход в единицу
// (smoothstep). Одним стопом не обойтись — линейный градиент виден началом,
// то есть вместо одной границы получаются две, просто помягче.
const fadeMask = (fadePx: number): string => {
	const steps = 8;
	const stops = Array.from({length: steps + 1}, (_, i) => {
		const t = i / steps;
		const alpha = t * t * (3 - 2 * t);
		return `rgba(0, 0, 0, ${alpha.toFixed(3)}) ${(t * fadePx).toFixed(1)}px`;
	});
	return `linear-gradient(to top, ${stops.join(', ')})`;
};

export const RoomBackdrop = observer(() => {
	const width = getWindowWidth();
	const height = getWindowHeight();
	const scale = coverScale(width, height);
	const shownWidth = imageWidth * scale;
	const shownHeight = imageHeight * scale;
	const mask = fadeMask(fadeLength(height));
	return (
		<img
			className="nechto-backdrop"
			src={backdrop}
			alt=""
			draggable={false}
			style={{
				width: shownWidth,
				height: shownHeight,
				left: tableCenterX() - focusX * shownWidth,
				top: backdropAnchorY() - focusY * shownHeight,
				WebkitMaskImage: mask,
				maskImage: mask,
			}}
		/>
	);
});

export default RoomBackdrop;
