import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';
import {ENotification} from 'shared/enum/notifications';
import {formatPlayerNotification} from 'server/formatters/formatOutgoingEvents';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {ICardEvent} from 'shared/interfaces/cards';
import {EPlayerState, ETurnState} from 'shared/enum/player';
import {discardCard} from 'server/helpers/discardCard';

export const axeAct = ({card, game, player} : {card:ICardEvent, game: Game, player: Player}) => {
	game.turnContext = {
		type: ETurnContextType.axePersonSelect,
		playerId: player.id,
	};

	discardCard({game, player, cardUniqueId: card.uniqueId});
	player.changeTurnState(ETurnState.inCardActionProgress);

	const neighbours = player.getNeighbours().filter((n:string) => {
		const neigbh = game.players[n];
		return neigbh.quarantine > 0 || neigbh.state === EPlayerState.door;
	});



	const axeTargets = [...neighbours];
	if (player.quarantine > 0) {
		axeTargets.push(player.id)
	}

    player.notify(formatPlayerNotification({
      player: player,
      notification: {
		type: ENotification.playerSelect,
		playersToSelect: axeTargets,
		text: 'Выбри на что хочешь применить топор'
      },
    }));
};

export const axeSelect = ({game, player, selectedPlayerId} : {game: Game, player: Player, selectedPlayerId:string}) => {
	if (game.turnContext.type !== ETurnContextType.axePersonSelect) {
		throw new Error('Выбор подозрения произошел без контекста axePersonSelect');
	}
	const selectedPlayer = game.players[selectedPlayerId];
	game.turnContext = null;
	if (selectedPlayer.state === EPlayerState.door) {
		game.playersList = game.playersList.filter((playerId) => {
			return playerId !== selectedPlayer.id
		})
	}
	if (selectedPlayer.quarantine>0) {
		selectedPlayer.quarantine = 0;
	}
	game.addLog(`Игрок ${player.nickname} играет карту "Топор" на ${selectedPlayer.nickname}`);
	player.changeTurnState(ETurnState.inOffenseTrade)
};
