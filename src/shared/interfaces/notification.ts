import {ENotification} from 'shared/enum/notifications';
import {ICard} from 'shared/interfaces/cards';

interface INotification {
	type: ENotification,
	text?: string;
	cards?: ICard[];
	playersToSelect?: string[]
}

export default INotification;
