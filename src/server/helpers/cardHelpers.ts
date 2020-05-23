import {ICardAny} from 'shared/interfaces/cards';
import { reduce } from 'lodash';

export const formatCards = (cards: ICardAny[]) => {
	return reduce(cards, (acc, item) => {
		acc[item.uniqueId] = item;
		return acc;
	}, {});
}
