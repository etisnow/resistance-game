import {reduce} from 'lodash';
import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';
import {ICardEvent} from 'shared/interfaces/cards';

export const formatHand = (game:Game, player:Player): {[key:string]: ICardEvent} => {
	return reduce(player.hand, (acc, card) => {
		acc[card.uniqueId] = card;
		return acc;
	}, {})
};
