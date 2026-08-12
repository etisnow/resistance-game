import { CustomPIXIComponent } from "react-pixi-fiber";
import * as PIXI from "pixi.js";
import { perspectiveVertices } from "client/helpers/perspective";

/**
 * Картинка, лежащая на столе, — в перспективе: ближний к смотрящему край шире
 * дальнего, и к дальнему краю картинка не только сужается, но и сжимается по
 * высоте (дальняя половина занимает на экране меньше места, чем ближняя).
 *
 * Обычный спрайт так не умеет — он остаётся прямоугольником, как его ни сжимай,
 * — поэтому кладём текстуру на сетку и двигаем её узлы. Узлы ставим по самой
 * проекции, а не равномерно (см. perspectiveVertices): между соседними узлами
 * текстура тянется линейно, и если узлов достаточно, ошибка на глаз не видна.
 */

interface PerspectiveTextureProps {
	texture: PIXI.Texture;
	// Ширина посередине картинки и её высота на экране: считать перспективу от
	// середины удобнее — размер «в среднем» остаётся тем, что заложила вёрстка.
	width: number;
	height: number;
	// Во сколько раз дальний край уже ближнего.
	taper: number;
}

// Узлов сетки поперёк и вдоль картинки. Вдоль их больше: именно вдоль неё идёт
// нелинейное сжатие, поперёк текстура тянется ровно.
const gridX = 8;
const gridY = 14;

const buildVertices = (width: number, height: number, taper: number): Float32Array =>
	perspectiveVertices(width, height, taper, gridX, gridY);

const buildUvs = (): Float32Array => {
	const data = new Float32Array(gridX * gridY * 2);
	let at = 0;
	for (let row = 0; row < gridY; row++) {
		for (let col = 0; col < gridX; col++) {
			data[at++] = col / (gridX - 1);
			data[at++] = row / (gridY - 1);
		}
	}
	return data;
};

const buildIndices = (): Uint16Array => {
	const data = new Uint16Array((gridX - 1) * (gridY - 1) * 6);
	let at = 0;
	for (let row = 0; row < gridY - 1; row++) {
		for (let col = 0; col < gridX - 1; col++) {
			const corner = row * gridX + col;
			data[at++] = corner;
			data[at++] = corner + 1;
			data[at++] = corner + gridX;
			data[at++] = corner + gridX;
			data[at++] = corner + 1;
			data[at++] = corner + gridX + 1;
		}
	}
	return data;
};

type IRestProps = Record<string, unknown>;

interface MeshBehaviorThis {
	applyDisplayObjectProps(oldProps: IRestProps, newProps: IRestProps): void;
}

// Последнее, что нам присылали. Пружина, гоня кадр анимации, отдаёт примитиву
// ТОЛЬКО анимируемые пропсы (см. pixiInjected) — картинка и всё постоянное до
// него не доезжают. Приняв их отсутствие за «убрать», меш на кадр остался бы без
// текстуры и замигал бы, а вместо ширины получил бы нечисло.
interface IMeshWithProps extends PIXI.Mesh {
	perspectiveProps?: PerspectiveTextureProps;
}

const TYPE = "PerspectiveTexture";
export const behavior = {
	// Сетку собираем сами, а не берём готовый SimplePlane: тот пересобирает свою
	// геометрию всякий раз, как обновится текстура, — и стирает наши узлы.
	customDisplayObject: (props: PerspectiveTextureProps) => {
		const {texture, width, height, taper} = props;
		const mesh: IMeshWithProps = new PIXI.Mesh(
			new PIXI.MeshGeometry(buildVertices(width, height, taper), buildUvs(), buildIndices()),
			new PIXI.MeshMaterial(texture),
		);
		mesh.perspectiveProps = props;
		return mesh;
	},
	customApplyProps: function(
		this: MeshBehaviorThis,
		instance: IMeshWithProps,
		oldProps: PerspectiveTextureProps | undefined,
		newProps: PerspectiveTextureProps,
	) {
		const previous = instance.perspectiveProps;
		const shape: PerspectiveTextureProps = {
			texture: newProps.texture ?? previous?.texture ?? PIXI.Texture.WHITE,
			width: newProps.width ?? previous?.width ?? 0,
			height: newProps.height ?? previous?.height ?? 0,
			taper: newProps.taper ?? previous?.taper ?? 1,
		};
		instance.perspectiveProps = shape;

		// Материал у меша наш собственный (см. customDisplayObject), но типы pixi
		// знают о нём только как о произвольном шейдере.
		const material = instance.shader as PIXI.MeshMaterial;
		if (material.texture !== shape.texture) material.texture = shape.texture;
		if (!previous || previous.width !== shape.width || previous.height !== shape.height || previous.taper !== shape.taper) {
			const buffer = instance.geometry.getBuffer('aVertexPosition');
			buffer.data = buildVertices(shape.width, shape.height, shape.taper);
			buffer.update();
		}

		// Свои пропсы дальше не пускаем: width и height у любого DisplayObject —
		// это масштаб, и pixi растянул бы ими уже построенную сетку ещё раз.
		const {texture: _texture, width: _width, height: _height, taper: _taper, ...rest} = newProps as PerspectiveTextureProps & IRestProps;
		const {texture: _oldTexture, width: _oldWidth, height: _oldHeight, taper: _oldTaper, ...oldRest} =
			(oldProps ?? {}) as PerspectiveTextureProps & IRestProps;
		this.applyDisplayObjectProps(oldRest, rest);
	},
};

export default CustomPIXIComponent(behavior, TYPE);
