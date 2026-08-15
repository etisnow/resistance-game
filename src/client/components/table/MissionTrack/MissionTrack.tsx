import React from 'react';
import {observer} from 'mobx-react-lite';
import {map, range} from 'lodash';
import * as PIXI from 'pixi.js';
import {Container, Text} from 'react-pixi-fiber';
import Circle from 'client/components/pixiPrimitives/Circle';
import Ring from 'client/components/pixiPrimitives/Ring';
import GameController from 'client/controllers/gameController';
import {EGamePhase} from 'shared/enum/phase';
import {deckCardWidth, tableCardPoint} from 'client/helpers/roomHelpers';
import {tableCenterX, tableCenterY} from 'client/helpers/window';

// Трек миссий лежит там же, где в «Нечто» лежала колода, — посреди столешницы.
// Это главный элемент стола: он же счётчик раундов, он же табло счёта, он же
// напоминание про особое правило четвёртой миссии.

interface IMissionTrackProps {
	controller: GameController;
}

const okColor = 0x5CA98D;
const failColor = 0xDD6A5D;
const idleColor = 0x4A4F57;
const currentColor = 0xF2F4F7;
const warnColor = 0xC39B4A;

// Размеры — в долях ширины карты, которая лежала бы на этом столе: так трек
// растёт и сжимается вместе со столом, а не живёт в своих пикселях.
const nodeRadiusShare = 0.17;
const nodeGapShare = 0.44;
const rejectDotShare = 0.035;
const rejectGapShare = 0.09;

const captionStyle = (size: number, color = 0xC8CDD4) => new PIXI.TextStyle({
	fontFamily: 'Arial',
	fontSize: size,
	fontWeight: 'bold',
	fill: color,
	letterSpacing: 1,
});

const nodeStyle = (size: number, color: number) => new PIXI.TextStyle({
	fontFamily: 'Arial',
	fontSize: size,
	fontWeight: 'bold',
	fill: color,
});

const MissionTrack = observer(({controller}: IMissionTrackProps) => {
	const round = controller.round;
	if (!round) return null;
	const playersCount = controller.playersList.length;
	if (!playersCount) return null;

	const unit = deckCardWidth(playersCount);
	const nodeRadius = unit * nodeRadiusShare;
	const gap = unit * nodeGapShare;
	const point = tableCardPoint(playersCount);
	const width = gap * (round.missionResults.length - 1);

	const colorOf = (result: boolean | null, isCurrent: boolean): number => {
		if (result === true) return okColor;
		if (result === false) return failColor;
		return isCurrent ? currentColor : idleColor;
	};

	const caption = round.phase === EGamePhase.over
		? 'ПАРТИЯ ОКОНЧЕНА'
		: `МИССИЯ ${round.missionIndex + 1} · ${round.teamSize} ЧЕЛ.${round.failsNeeded > 1 ? ' · НУЖНО 2 ПРОВАЛА' : ''}`;

	return (
		<Container x={tableCenterX() + point.x} y={tableCenterY() + point.y}>
			{map(round.missionResults, (result, index) => {
				const isCurrent = index === round.missionIndex && round.phase !== EGamePhase.over;
				const color = colorOf(result, isCurrent);
				const x = index * gap - width / 2;
				return (
					<Container key={index} x={x}>
						{/* Сыгранная миссия залита своим цветом, будущая — только обведена.
						    Текущая — самым ярким кольцом, потолще. */}
						<Ring
							rx={nodeRadius}
							ry={nodeRadius}
							thickness={isCurrent ? 3 : 2}
							color={color}
							fillAlpha={result === null ? 0.14 : 0.3}
						/>
						<Text
							text={result === true ? '✓' : result === false ? '✕' : String(index + 1)}
							anchor={0.5}
							style={nodeStyle(nodeRadius * 1.1, color)}
						/>
					</Container>
				);
			})}

			<Text
				text={caption}
				anchor={0.5}
				y={-nodeRadius * 2.1}
				style={captionStyle(Math.max(nodeRadius * 0.52, 9))}
			/>

			{/* Чем вскрылась последняя сыгранная миссия. Числом, а не поимённо: кто
			    сдал провал — тайна (FR-9). Висит до конца следующего набора команды —
			    столько, сколько его и обсуждают. */}
			{round.lastFailCount !== null && round.phase !== EGamePhase.mission && (
				<Text
					text={round.lastFailCount === 0
						? 'ПРОВАЛОВ НЕ БЫЛО'
						: `ПРОВАЛОВ: ${round.lastFailCount}`}
					anchor={0.5}
					y={-nodeRadius * 3.3}
					style={captionStyle(Math.max(nodeRadius * 0.5, 9), round.lastFailCount === 0 ? okColor : failColor)}
				/>
			)}

			{/* Счётчик отклонений: пятое деление красное — на нём партия кончается. */}
			<Container y={nodeRadius * 2.2}>
				{map(range(round.maxRejects), (index) => {
					const isLast = index === round.maxRejects - 1;
					const isOn = index < round.rejectCount;
					const color = isLast ? failColor : warnColor;
					const dotGap = unit * rejectGapShare;
					return (
						<Circle
							key={index}
							xCoord={index * dotGap - (dotGap * (round.maxRejects - 1)) / 2}
							r={unit * rejectDotShare}
							color={color}
							alpha={isOn ? 1 : 0.22}
						/>
					);
				})}
			</Container>
		</Container>
	);
});

export default MissionTrack;
