import {ENotification} from 'shared/enum/notifications';
import {ICardEvent, ICardPanic} from 'shared/interfaces/cards';

interface INotification {
	type: ENotification,
	text?: string;
	cards?: ICardEvent[] | ICardPanic[];
	playersToSelect?: string[],
	menu? : {text: string, action: string}[]
}

export default INotification;
