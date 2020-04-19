import {ENotification} from 'shared/enum/notifications';
import {ICardEvent} from 'shared/interfaces/cards';

interface INotification {
	type: ENotification,
	text?: string;
	cards?: ICardEvent[];
	playersToSelect?: string[],
	menu? : {text: string, action: string}[]
}

export default INotification;
