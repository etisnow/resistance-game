import React from 'react';
import './styles.scss';
import {observer} from 'mobx-react-lite';
import cn from 'classnames';
import {map, range} from 'lodash';
import GameController from 'client/controllers/gameController';
import {EGamePhase} from 'shared/enum/phase';

// Табло партии: трек миссий, счётчик отклонений, состав команды и своя роль.
//
// Пока это DOM поверх стола, а не часть самого стола: играть без него нельзя, а
// рисовать его в PixiJS — работа фазы 3. Всё, что он показывает, приходит одним
// полем `round` в обновлении (см. formatRound).

interface IMissionTrackProps {
	controller: GameController;
}

const PHASE_TEXT: Record<EGamePhase, string> = {
	[EGamePhase.teamBuilding]: 'Набор команды',
	[EGamePhase.voting]: 'Голосование',
	[EGamePhase.mission]: 'Миссия идёт',
	[EGamePhase.over]: 'Партия окончена',
};

const MissionTrack = observer(({controller}: IMissionTrackProps) => {
	const round = controller.round;
	if (!round) return null;
	const {players} = controller;
	const nameOf = (id: string) => players[id]?.nickname ?? '?';
	const isSpy = controller.currentPlayer?.isSpy;

	return (
		<div className={'missionTrack'}>
			<div className={'missionTrackRow'}>
				{map(round.missionResults, (result, index) => {
					const isCurrent = index === round.missionIndex && round.phase !== EGamePhase.over;
					return (
						<div
							key={index}
							className={cn('missionNode', {
								ok: result === true,
								fail: result === false,
								current: isCurrent,
							})}
						>
							{result === true ? '✓' : result === false ? '✕' : index + 1}
						</div>
					);
				})}
			</div>

			<div className={'missionTrackLine'}>
				<span className={'phase'}>{PHASE_TEXT[round.phase]}</span>
				{/* Что требует текущая миссия. У сыгранных это уже ничего не решает, а
				    у будущих зависит от того, доживёт ли до них стол в этом составе. */}
				{round.phase !== EGamePhase.over && (
					<span>
						Команда: <b>{round.teamSize}</b>
						{round.failsNeeded > 1 && <span className={'twoFails'}> · нужно 2 провала</span>}
					</span>
				)}
				<span className={'rejects'}>
					Отклонений:
					{map(range(round.maxRejects), (i) => (
						<i key={i} className={cn('rejectDot', {on: i < round.rejectCount, last: i === round.maxRejects - 1})}/>
					))}
				</span>
			</div>

			<div className={'missionTrackLine'}>
				<span>Лидер: <b>{nameOf(round.leaderId)}</b></span>
				{round.team.length > 0 && <span>Команда: <b>{round.team.map(nameOf).join(', ')}</b></span>}
			</div>

			{/* Голоса в «Сопротивлении» открытые — по ним и играют. */}
			{round.revealedVotes && (
				<div className={'missionTrackLine votes'}>
					{map(round.revealedVotes, (isApproved, playerId) => (
						<span key={playerId} className={cn('vote', {approve: isApproved})}>
							{nameOf(playerId)} {isApproved ? '✓' : '✕'}
						</span>
					))}
				</div>
			)}

			{isSpy !== null && isSpy !== undefined && (
				<div className={cn('missionTrackRole', {spy: isSpy})}>
					{isSpy ? 'Ты шпион' : 'Ты в сопротивлении'}
				</div>
			)}
		</div>
	);
});

export default MissionTrack;
