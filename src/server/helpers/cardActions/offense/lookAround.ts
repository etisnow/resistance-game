import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';
import {ICardEvent} from 'shared/interfaces/cards';
import {ETurnState} from 'shared/enum/player';
import {EEventID} from 'shared/enum/cards';
import {EGameLogType} from 'shared/enum/gameLogType';

export const lookAroundAct = ({card, game, player} : {card:ICardEvent, game: Game, player: Player}) => {
	//player.discardCard(card.uniqueId);
	if (!card.uniqueId) return;
	player.discardCard(card.uniqueId);
	game.isClockwise = !game.isClockwise;
	player.changeTurnState(ETurnState.inCardActionProgress);
    game.addLog(`${player.nickname} изменил направление хода`, EGameLogType.card);
    game.addCardEffect({cardId: EEventID.lookaround, player});
    player.changeTurnState(ETurnState.inOffenseTrade)
};
