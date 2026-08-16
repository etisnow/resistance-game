import React from 'react';
import {observer} from 'mobx-react-lite';
import {map, range} from 'lodash';
import * as PIXI from 'pixi.js';
import {Container, Sprite, Text} from 'react-pixi-fiber';
import {rimGlowTexture} from 'client/helpers/glow';
import Circle from 'client/components/pixiPrimitives/Circle';
import Ring from 'client/components/pixiPrimitives/Ring';
import Plate from 'client/components/pixiPrimitives/Plate';
import DashedRing from 'client/components/pixiPrimitives/DashedRing';
import GameController from 'client/controllers/gameController';
import {EGamePhase} from 'shared/enum/phase';
import {getPixiTexture} from 'client/components/table/pixiInjected';
import {resources} from 'client/resources/resources';
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

const rejectIconTexture = getPixiTexture(resources.voteReject);

// Размеры — в долях ширины карты, которая лежала бы на этом столе: так трек
// растёт и сжимается вместе со столом, а не живёт в своих пикселях.
const nodeRadiusShare = 0.17;
const nodeGapShare = 0.44;
// Счётчик отклонений: размер значка и шаг между ними — в долях ширины карты,
// последний крупнее остальных.
const rejectIconShare = 0.15;
const rejectStepShare = 0.19;
const rejectLastShare = 1.3;
// Ряд точек под знаком сыгранной миссии: точка на каждого, кто на неё ходил,
// красные — по числу сданных провалов. Размеры в долях радиуса кружка; ряд не
// шире failDotRowShare, иначе на команде из пяти человек он выйдет за «яйцо».
const failDotShare = 0.14;
const failDotGapShare = 0.42;
const failDotLift = 0.5;
const failDotRowShare = 1.3;
// Пунктир на кружке идущей миссии: штрихов по кругу и оборотов в секунду. Идёт
// он в ту же сторону и с той же скоростью, что и кольца ушедших на дело.
const nodeDashes = 12;
const nodeDashSpeed = 0.22;
// Подсветка кружка на оглашении: спрайт вдвое шире самого кружка, и его кромка
// приходится ровно на середину радиуса спрайта — там, где светится текстура
// (см. rimGlowTexture).
const announceGlowShare = 4;
const announceGlowAlpha = 0.9;

const captionStyle = (size: number, color = 0xC8CDD4) => new PIXI.TextStyle({
	fontFamily: 'Arial',
	fontSize: size,
	fontWeight: 'bold',
	fill: color,
	letterSpacing: 1,
});

// Подложка под подписью. Поперёк неё идут и стрелки к команде, и швы столешницы,
// и края дальних кружков — по ним буквы теряются, а читают эту строку каждый
// раунд. Меряется она по самим буквам: строка то короткая («МИССИЯ 2 · 3 ЧЕЛ.»),
// то длинная («МИССИЯ 4 · 4 ЧЕЛ. · НУЖНО 2 ПРОВАЛА»), и плашка на глаз то жала
// бы одну, то болталась вокруг другой (та же беда, что у ника, — см. PlatedNickname).
const captionPlateColor = 0x0A0E14;
const captionPlateAlpha = 0.72;
const captionPadX = 10;
const captionPadY = 4;
// Та же подложка под самим рядом кружков: поля в долях радиуса кружка, а не в
// пикселях, — трек растёт вместе со столом. Она бледнее подписи: под кружками
// нужно приглушить рисунок столешницы, а не закрыть его наглухо.
const trackPlateAlpha = 0.62;
const trackPlatePadX = 0.45;
const trackPlatePadY = 0.35;

const PlatedCaption = ({text, style, y}: {text: string, style: PIXI.TextStyle, y: number}) => {
	const {width, height} = PIXI.TextMetrics.measureText(text, style);
	const plateHeight = height + captionPadY * 2;
	return (
		<Container y={y}>
			<Plate
				plateWidth={width + captionPadX * 2}
				plateHeight={plateHeight}
				borderRadius={plateHeight / 2}
				color={captionPlateColor}
				alpha={captionPlateAlpha}
			/>
			<Text text={text} anchor={0.5} style={style}/>
		</Container>
	);
};

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

	// Исход только что сыгранной миссии: пока сервер держит паузу на нём, номер
	// миссии ещё не переехал вперёд, и её результат уже проставлен.
	const shownResult = round.missionResults[round.missionIndex] ?? null;
	const shownFails = round.missionFails[round.missionIndex] ?? 0;

	// Что с миссией прямо сейчас, по фазе раунда. Размер команды стоит только на
	// наборе: там по нему и набирают, а дальше состав уже собран и число ничего не
	// решает.
	const missionState = round.phase === EGamePhase.mission
		? 'В ПРОЦЕССЕ'
		: round.phase === EGamePhase.voting
			? 'ГОЛОСОВАНИЕ'
			: `НАБОР (${round.teamSize} ЧЕЛ)`;

	// Подпись под треком говорит одно: что со столом происходит прямо сейчас.
	// Обычно это состояние миссии, а на паузе вскрытия — её итог, ровно на том же
	// месте: туда и смотрят, когда команда возвращается.
	const caption = round.phase === EGamePhase.over
		? 'ПАРТИЯ ОКОНЧЕНА'
		: shownResult !== null
			? `МИССИЯ ${round.missionIndex + 1} ${shownResult ? 'ВЫПОЛНЕНА' : 'СОРВАНА'} · ${shownFails === 0 ? 'ПРОВАЛОВ НЕТ' : `ПРОВАЛОВ: ${shownFails}`}`
			: `МИССИЯ ${round.missionIndex + 1} · ${missionState}${round.failsNeeded > 1 ? ' · НУЖНО 2 ПРОВАЛА' : ''}`;
	const captionColor = shownResult === null ? undefined : shownResult ? okColor : failColor;

	return (
		<Container x={tableCenterX() + point.x} y={tableCenterY() + point.y}>
			{/* Полоса под самим треком — та же подложка, что и под подписью: сквозь
			    кружки просвечивает рисунок столешницы, а по ним читают счёт партии.
			    Одна на весь ряд, а не по кружку у каждого: пять отдельных плашек
			    рассыпали бы ряд, который читается как одна шкала. */}
			<Plate
				plateWidth={width + nodeRadius * 2 + nodeRadius * trackPlatePadX * 2}
				plateHeight={nodeRadius * 2 * (1 + trackPlatePadY)}
				borderRadius={nodeRadius * (1 + trackPlatePadY)}
				color={captionPlateColor}
				alpha={trackPlateAlpha}
			/>
			{map(round.missionResults, (result, index) => {
				const isCurrent = index === round.missionIndex && round.phase !== EGamePhase.over;
				// Команда на деле: её кружок на треке отмечен так же, как и сами
				// ушедшие, — бегущим пунктиром.
				// Пока её исход не вскрыт: на паузе оглашения кружок уже носит свой
				// знак, и бежать пунктиру больше незачем.
				const isRunning = isCurrent && round.phase === EGamePhase.mission && result === null;
				// Оглашение: исход уже проставлен, а номер миссии ещё не переехал
				// вперёд (см. resolveMission). Ровно те секунды, что стол смотрит на
				// итог, — кружок и подсвечен.
				const isAnnouncing = isCurrent && result !== null;
				const color = colorOf(result, isCurrent);
				const x = index * gap - width / 2;
				// Точка на каждого, кто ходил на эту миссию, красные — по числу
				// провалов. Только у сыгранных: у будущих ходить ещё некому, а размер
				// их команды стол и так читает в подписи, когда до них доходит.
				const members = result === null ? 0 : round.missionTeamSizes[index] ?? 0;
				const fails = round.missionFails[index] ?? 0;
				// На пятерых шаг ужимается, иначе ряд вылезет за «яйцо»; точки при
				// этом не должны слипнуться в полосу.
				const dotGap = members > 1
					? Math.min(nodeRadius * failDotGapShare, (nodeRadius * failDotRowShare) / (members - 1))
					: 0;
				const dotRadius = Math.min(nodeRadius * failDotShare, members > 1 ? dotGap * 0.4 : Infinity);
				return (
					<Container key={index} x={x}>
						{/* Пока стол читает итог, у его кружка горит кромка: на треке из пяти
						    одинаковых кружков иначе не видно, о котором речь, а середину
						    свет занимать не должен — там знак и точки. */}
						{isAnnouncing && (
							<Sprite
								texture={rimGlowTexture()}
								anchor={0.5}
								tint={color}
								alpha={announceGlowAlpha}
								width={nodeRadius * announceGlowShare}
								height={nodeRadius * announceGlowShare}
							/>
						)}
						{/* Сыгранная миссия залита своим цветом, будущая — только обведена.
						    Текущая — самым ярким кольцом, потолще, а пока команда на деле
						    оно рассыпается в бегущий пунктир: тем же знаком обведены и сами
						    ушедшие (см. ETeamRing). */}
						{isRunning ? (
							<DashedRing
								rx={nodeRadius}
								ry={nodeRadius}
								thickness={3}
								color={color}
								dashes={nodeDashes}
								speed={nodeDashSpeed}
								fillAlpha={0.14}
							/>
						) : (
							<Ring
								rx={nodeRadius}
								ry={nodeRadius}
								thickness={isCurrent ? 3 : 2}
								color={color}
								fillAlpha={result === null ? 0.14 : isAnnouncing ? 0.45 : 0.3}
							/>
						)}
						{/* Знак сдвигается вверх, освобождая точкам низ кружка. */}
						<Text
							text={result === true ? '✓' : result === false ? '✕' : String(index + 1)}
							anchor={0.5}
							y={members > 0 ? -nodeRadius * 0.22 : 0}
							style={nodeStyle(nodeRadius * (members > 0 ? 0.95 : 1.1), color)}
						/>
						{/* Провалы идут первыми — кто именно их сдал, всё равно тайна (FR-9),
						    и разбрасывать их по ряду значило бы намекать на порядок мест. */}
						{map(range(members), (dot) => (
							<Circle
								key={dot}
								xCoord={dot * dotGap - (dotGap * (members - 1)) / 2}
								yCoord={nodeRadius * failDotLift}
								r={dotRadius}
								color={dot < fails ? failColor : okColor}
							/>
						))}
					</Container>
				);
			})}

			<PlatedCaption
				text={caption}
				y={-nodeRadius * 2.1}
				style={captionStyle(Math.max(nodeRadius * 0.52, 9), captionColor)}
			/>

			{/* Счётчик отклонений — теми же пальцами вниз, какими стол голосует против
			    (см. Room): отклонение и есть «против», и значок у них должен быть
			    один. Последний крупнее остальных: на нём партия кончается, а красным
			    он выделиться уже не может — он и так красный. */}
			<Container y={nodeRadius * 2.2}>
				{map(range(round.maxRejects), (index) => {
					const isLast = index === round.maxRejects - 1;
					const isOn = index < round.rejectCount;
					const step = unit * rejectStepShare;
					const size = unit * rejectIconShare * (isLast ? rejectLastShare : 1);
					return (
						<Sprite
							key={index}
							texture={rejectIconTexture}
							anchor={0.5}
							x={index * step - (step * (round.maxRejects - 1)) / 2}
							width={size}
							height={size}
							alpha={isOn ? 1 : 0.22}
						/>
					);
				})}
			</Container>
		</Container>
	);
});

export default MissionTrack;
