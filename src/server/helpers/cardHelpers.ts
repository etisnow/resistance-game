import {ICardAny} from 'shared/interfaces/cards';
import { clone, find, reduce } from 'lodash';
import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';
import {ETurnState} from 'shared/enum/player';
import {getCardActions} from 'server/formatters/formatCardActions';
import {EPlayerActionType} from 'shared/enum/playerActions';

// Карты, которые игрок может отдать в панике на обмен: те же, что он мог бы
// сбросить в свой ход (карту «Нечто» и единственное заражение отдать нельзя).
export const getDiscardableCards = ({game, player}: {game: Game, player: Player}): ICardAny[] => {
	const clonedPlayer = clone(player);
	clonedPlayer.turnState = ETurnState.inCardAction;
	return clonedPlayer.hand.filter(card => {
		const cardActions = getCardActions(game, clonedPlayer, card);
		return !!find(cardActions, { menuType: EPlayerActionType.cardDiscard});
	});
};

export const formatCards = (cards: ICardAny[]): {[key:string]: ICardAny} => {
	return reduce(cards, (acc: {[key:string]: ICardAny}, item) => {
		if (item.uniqueId) acc[item.uniqueId] = item;
		return acc;
	}, {});
}
