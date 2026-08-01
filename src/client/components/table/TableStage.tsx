import React from 'react';
import * as PIXI from 'pixi.js';
import {observer} from 'mobx-react-lite';
import {Stage, usePixiApp} from 'react-pixi-fiber';
import {useViewportElement, viewport} from 'client/helpers/viewport';

type IApplicationOptions = NonNullable<ConstructorParameters<typeof PIXI.Application>[0]>;

interface ITableStageProps {
	children: React.ReactNode;
}

// Приводит рендерер к текущему размеру области стола. Живёт внутри <Stage>,
// потому что только оттуда доступно созданное приложение PIXI.
const RendererSync = observer(() => {
	const app = usePixiApp();
	const {width, height, resolution} = viewport;

	React.useLayoutEffect(() => {
		const renderer = app ? (app.renderer as PIXI.Renderer) : null;
		if (!renderer) return;
		// resolution у пикси — обычное поле: и бэкбуфер, и пересчёт координат
		// указателя обновляются только в resize(), поэтому меняем его до вызова.
		// Интеракции ведут свою копию — без неё хит-тесты уезжают на HiDPI.
		if (renderer.resolution !== resolution) {
			renderer.resolution = resolution;
			const interaction = renderer.plugins && renderer.plugins.interaction;
			if (interaction) interaction.resolution = resolution;
		}
		renderer.resize(width, height);
	}, [app, width, height, resolution]);

	return null;
});

/**
 * Канвас стола и его размер.
 *
 * Опции приложения PIXI фиксируем один раз: react-pixi-fiber держит проп
 * options (как и width/height) в зависимостях эффекта, который создаёт
 * приложение, — новый объект на каждый рендер означал бы пересоздание
 * приложения и потерю WebGL-контекста при каждом кадре ресайза. Дальше размером
 * канваса управляет RendererSync.
 */
export const TableStage = ({children}: ITableStageProps) => {
	const host = useViewportElement<HTMLDivElement>();
	const options = React.useRef<IApplicationOptions | null>(null);
	if (!options.current) {
		options.current = {
			width: viewport.width,
			height: viewport.height,
			resolution: viewport.resolution,
			transparent: true,
			antialias: true,
		};
	}

	return (
		<div className={'pixi-stage'} ref={host}>
			<Stage className={'pixi-canvas'} options={options.current}>
				<RendererSync/>
				{children}
			</Stage>
		</div>
	);
};
