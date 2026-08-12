import React from 'react';
import {observer} from 'mobx-react-lite';
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
// Незакрытое добирает чёрный фон обёртки: края картинки и так уходят в темноту,
// поэтому полоса снизу читается как пол, теряющийся в темноте, а не как обрез.
// Приходится она ровно на руку, за картами её и не видно.
const coverScale = (width: number, height: number): number =>
	Math.max(width / imageWidth, height / imageHeight);

export const RoomBackdrop = observer(() => {
	const width = getWindowWidth();
	const height = getWindowHeight();
	const scale = coverScale(width, height);
	const shownWidth = imageWidth * scale;
	const shownHeight = imageHeight * scale;
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
			}}
		/>
	);
});

export default RoomBackdrop;
