import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';
import {ENotificationAction} from 'shared/enum/notifications';
import {formatPlayerNotification} from 'server/formatters/formatOutgoingEvents';
import {askDecision} from 'server/helpers/askDecision';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {ICardEvent} from 'shared/interfaces/cards';
import {ETurnState} from 'shared/enum/player';

import {EEventID} from 'shared/enum/cards';
import {find} from 'lodash';
import {EGameLogType} from 'shared/enum/gameLogType';

export const flamethrowerAct = ({card, game, player} : {card:ICardEvent, game: Game, player: Player}) => {
	if (!card.uniqueId) return;
	game.turnContext = {
		type: ETurnContextType.burn,
		offensePlayer: player,
		defensePlayer: null,
		cardUniqueId: card.uniqueId,
		cardId: EEventID.flamethrower,
	};


	player.changeTurnState(ETurnState.inCardActionProgress);
    player.notify(formatPlayerNotification({
      player: player,
      notification: {
		type: ENotificationAction.playerSelect,
		playersToSelect: player.getPlayabeNeighbours(),
		text: 'Выбери кого ты хочешь сжечь'
      },
    }));
};

export const flamethrowerSelect = ({game, player, selectedPlayerId} : {game: Game, player: Player, selectedPlayerId:string}) => {
	if (!game.turnContext || game.turnContext.type !== ETurnContextType.burn) {
		throw new Error('Выбор огнемета произошел без контекста flamethrowerSelect');
	}
	player.discardCard(game.turnContext.cardUniqueId);
	const defensePlayer = game.players[selectedPlayerId];
	if (!defensePlayer) return;
	player.currentAction = null;
	game.turnContext = {
		type: ETurnContextType.burn,
		offensePlayer: player,
		defensePlayer: defensePlayer,
		cardUniqueId: game.turnContext.cardUniqueId,
		cardId: game.turnContext.cardId,
	};
    let decisionMenu = [{
		text: 'Сгореть',
		action: 'burn',
	}];
	let text = `Игрок ${player.nickname} хочет использовать на тебе огнемет`;
	game.addLog(`Игрок ${player.nickname} используем огнемет на ${defensePlayer.nickname}`, EGameLogType.card)
	const hasNoFireCard = !!find(defensePlayer.hand, {id: EEventID.noFire});
	if (hasNoFireCard) {
		decisionMenu.push({
			text: 'Использовать шашлык',
			action: 'noFire',
		});
		text = `Игрок ${player.nickname} использует на тебе огнемет, но у тебя есть "Никакого шашлыка"`
	}
	// The offense player's action is still in progress: they are waiting for the
	// defense player to decide whether to burn or use "no fire".
	player.changeTurnState(ETurnState.inCardActionProgress);
	askDecision({asker: player, decider: defensePlayer, text, menu: decisionMenu});
};


export const flamethrowerFinish = ({game, player, action} : {game: Game, player: Player, action:string}) => {
	if (!game.turnContext || game.turnContext.type !== ETurnContextType.burn) {
		throw new Error('Выбор огнемета произошел без контекста flamethrowerSelect');
	}
	const {defensePlayer, offensePlayer} = game.turnContext;
	if (!defensePlayer) return;
	switch (action) {
		case "burn": {
			// И событие сожжения, и запись в лог — до killPlayer. Во-первых, в
			// списке игроков сгоревшего сразу не станет, а стол по этому событию
			// поджигает его кружок на том месте, где он сидел (см. Burn).
			// Во-вторых, сожжённый может оказаться Нечто: тогда killPlayer тут же
			// заканчивает партию, и всё, что не записано до него, не попадёт в
			// последнее обновление стола.
			game.addCardEffect({cardId: EEventID.flamethrower, player: offensePlayer, target: defensePlayer});
			game.addLog(`Игрок ${defensePlayer.nickname} был заживо сожжен игроком ${offensePlayer.nickname} и выбывает из игры`, EGameLogType.death);
			game.killPlayer(defensePlayer)
			if (!game.gameInProcess) return;

			break;
		}
		case "noFire": {
			const noFireCard = find(defensePlayer.hand, {id: EEventID.noFire});
			game.addLog(`Игрок ${defensePlayer.nickname} использовал "Никакого шашлыка" и спасся от огнемета`, EGameLogType.defense);
			//discardCard({player: defensePlayer, cardUniqueId: noFireCard.uniqueId, game});
			if (noFireCard && noFireCard.uniqueId) {
				defensePlayer.discardCard(noFireCard.uniqueId)
			}
			game.addCardEffect({cardId: EEventID.noFire, player: defensePlayer, target: offensePlayer});
			game.grabEventCardFromDeck({player});
			break;
		}
	}
	game.turnContext = null;
	offensePlayer.changeTurnState(ETurnState.inOffenseTrade);
};
