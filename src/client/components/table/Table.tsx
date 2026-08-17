import React from 'react';
import './style.scss';
import cn from 'classnames';
import {observer} from 'mobx-react-lite';
import {EGamePhase} from 'shared/enum/phase';
import {ENotificationAction} from 'shared/enum/notifications';
import GameController from 'client/controllers/gameController';
import ActionStack from 'client/components/actionStack/ActionStack';
import RoleHintOverlay from 'client/components/hint/RoleHint';
import Room from 'client/components/table/Room/Room';
import Notifier from 'client/components/table/notifier/notifier';
import {Helmet} from "react-helmet";
import ActionInteracter from 'client/components/table/ActionInteracter/ActionInteracter';
import TableMenu from 'client/components/table/TableMenu/TableMenu';
import MissionTrack from 'client/components/table/MissionTrack/MissionTrack';
import {StageBoundary} from 'client/components/table/StageBoundary';
import {TableStage} from 'client/components/table/TableStage';


interface ITableProps {
	controller: GameController
}


const Table = observer(({controller} : ITableProps) => {
		const {currentPlayer: player} = controller;
		if (!player) return null;
		// Убийца выбирает цель — курсор над столом становится прицелом. Стрелка
		// «указать и нажать» здесь неверна: нажатие наводит оружие, а не открывает
		// что-то (см. FR-15).
		const isAiming = controller.round?.phase === EGamePhase.assassination
			&& controller.currentAction?.type === ENotificationAction.playerSelect;

		return (
			<div className={cn('gameTable', {isAiming})}>
				<ActionStack controller={controller}/>
				{/* Подсказка жетона роли: живёт в DOM поверх канваса, а открывает её
				    сам жетон на кружке (см. roleHintStore). */}
				<RoleHintOverlay/>
				<TableMenu controller={controller}/>
				{/* Время идёт на прицеле ходящего (см. Reticle), а не полоской сверху
				    экрана: полоса висела над столом отдельной шкалой и не говорила,
				    кого именно ждут. */}
				<ActionInteracter controller={controller}/>
				<StageBoundary>
					<TableStage>
						{/* Стол рисуется слоями по глубине: сначала дальняя половина
						    игроков, потом столешница (она их и подрезает), потом всё,
						    что на ней лежит, и только потом ближние игроки. Трек миссий
						    ляжет на столешницу и станет ребёнком Room — ровно в этот
						    промежуток (фаза 3). */}
						<Room controller={controller}>
							<MissionTrack controller={controller}/>
						</Room>
						<Notifier controller={controller} />
					</TableStage>
				</StageBoundary>

				{/*<div className={"debug-div"}><div></div></div>*/}
	            <Helmet>
	                <title>{player.nickname}</title>
	            </Helmet>
			</div>
		)
});

export default Table;
