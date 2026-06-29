import {ICardAny} from 'shared/interfaces/cards';
import { reduce } from 'lodash';

export const formatCards = (cards: ICardAny[]): {[key:string]: ICardAny} => {
	return reduce(cards, (acc: {[key:string]: ICardAny}, item) => {
		if (item.uniqueId) acc[item.uniqueId] = item;
		return acc;
	}, {});
}
