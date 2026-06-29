import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';
import {ENotificationAction} from 'shared/enum/notifications';
import {formatPlayerNotification} from 'server/formatters/formatOutgoingEvents';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {ICardEvent} from 'shared/interfaces/cards';
import {ETurnState} from 'shared/enum/player';

import {getCard} from 'shared/constant/cards';
import {EEventID} from 'shared/enum/cards';
import {find} from 'lodash';
import {formatCards} from 'server/helpers/cardHelpers';

export const flamethrowerAct = ({card, game, player} : {card:ICardEvent, game: Game, player: Player}) => {
	if (!card.uniqueId) return;
	game.turnContext = {
		type: ETurnContextType.burn,
		offensePlayer: player,
		defensePlayer: null,
		cardUniqueId: card.uniqueId,
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
		cardUniqueId: game.turnContext.cardUniqueId
	};
    let decisionMenu = [{
		text: 'Сгореть',
		action: 'burn',
	}];
	let text = `Игрок ${player.nickname} хочет использовать на тебе огнемет`;
	game.addLog(`Игрок ${player.nickname} используем огнемет на ${defensePlayer.nickname}`)
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
    defensePlayer.notify(formatPlayerNotification({
		player: player,
		notification: {
			type: ENotificationAction.actionDecision,
			text,
			menu: decisionMenu
		},
    }));
};


export const flamethrowerFinish = ({game, player, action} : {game: Game, player: Player, action:string}) => {
	if (!game.turnContext || game.turnContext.type !== ETurnContextType.burn) {
		throw new Error('Выбор огнемета произошел без контекста flamethrowerSelect');
	}
	const {defensePlayer, offensePlayer} = game.turnContext;
	if (!defensePlayer) return;
	switch (action) {
		case "burn": {
			game.killPlayer(defensePlayer)
			if (!game.gameInProcess) return;
			game.notifyAllPlayers(formatPlayerNotification({
			  player: player,
			  notification: {
				type: ENotificationAction.okayCard,
				cards: formatCards([getCard(EEventID.flamethrower)]),
				text: `Игрок ${defensePlayer.nickname} был заживо сожжен игроком ${offensePlayer.nickname} и выбывает из игры`,
			  },
			}));
			game.addLog(`Игрок ${defensePlayer.nickname} был заживо сожжен игроком ${offensePlayer.nickname} и выбывает из игры`);

			break;
		}
		case "noFire": {
			const noFireCard = find(defensePlayer.hand, {id: EEventID.noFire});
			game.notifyAllPlayers(formatPlayerNotification({
				player: player,
				notification: {
					type: ENotificationAction.okayCard,
					cards: formatCards([getCard(EEventID.noFire)]),
					text: `Игрок ${defensePlayer.nickname} использовал "Никакого шашлыка" и спасся от огнемета!`,
				},
		    }));
			//discardCard({player: defensePlayer, cardUniqueId: noFireCard.uniqueId, game});
			if (noFireCard && noFireCard.uniqueId) {
				defensePlayer.discardCard(noFireCard.uniqueId)
			}
			game.grabEventCardFromDeck({player});
			break;
		}
	}
	game.turnContext = null;
	offensePlayer.changeTurnState(ETurnState.inOffenseTrade);
};
