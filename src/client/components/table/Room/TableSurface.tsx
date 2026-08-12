import React from 'react';
import {Container} from 'react-pixi-fiber';
import Ellipse from 'client/components/pixiPrimitives/Ellipse';
import EllipseTexture from 'client/components/pixiPrimitives/EllipseTexture';
import {getPixiTexture} from 'client/components/table/pixiInjected';
import {resources} from 'client/resources/resources';

/**
 * Сам стол: круглая столешница, увиденная из-за её края, то есть эллипс (см.
 * tableSquash), и торец под ней.
 *
 * Объём здесь держится на трёх вещах, и все три обязательны: сплюснутая
 * проекция, видимый борт (столешница — доска, а не наклейка) и то, что сидящих
 * на дальней половине стол загораживает — их рисуют ДО него (см. Room).
 *
 * Никакой геометрии сама не считает: полуоси приходят из roomHelpers, общие со
 * всем остальным на столе.
 */

// Торец доски — самое тёмное пятно: свет на него не попадает.
const sideColor = 0x121110;
// Кант по краю столешницы: тонкая полоска, на которой ломается свет. Без него
// столешница сливается с бортом в одно плоское пятно.
const rimColor = 0x4a423a;
// Столешница — картинка: круглый клёпаный люк, увиденный сверху (см.
// resources.tableTop). Растягиваем её под эллипс, а не вписываем: это тот же
// круг, только в проекции стола, и рисунок обязан сжаться вместе с ним.
const topTexture = getPixiTexture(resources.tableTop);
// Цвет под ней — на то время, пока картинка не догрузилась: пустой дырой посреди
// стола это выглядеть не должно.
const topColor = 0x2b2724;

// Кант — в долях полуоси, но не тоньше волоска и не толще этого.
const rimShare = 0.012;
const rimMin = 1;
const rimMax = 4;

interface ITableSurfaceProps {
	rx: number;
	ry: number;
	// Толщина борта: на столько торец выступает из-под столешницы.
	thickness: number;
}

const TableSurface = ({rx, ry, thickness}: ITableSurfaceProps) => {
	if (rx <= 0 || ry <= 0) return null;
	const rim = Math.min(rimMax, Math.max(rimMin, ry * rimShare));
	return (
		<Container interactiveChildren={false}>
			{/* Торец: тот же эллипс, опущенный на толщину доски. Снизу из-под
			    столешницы видно ровно его. */}
			<Ellipse yCoord={thickness} rx={rx} ry={ry} color={sideColor}/>
			{/* Кант — столешница чуть больше того, что залито её цветом. */}
			<Ellipse rx={rx} ry={ry} color={rimColor}/>
			<Ellipse rx={rx - rim} ry={ry - rim} color={topColor}/>
			<EllipseTexture rx={rx - rim} ry={ry - rim} texture={topTexture} stretch={true}/>
		</Container>
	);
};

export default TableSurface;
