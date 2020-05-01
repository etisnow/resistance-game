import {ETurnContextType} from 'shared/enum/turnContextType';

export interface IFormatTradeContext {
	offensePlayerId: string | null;
	defensePlayerId: string | null;
	isCardPicked?: boolean;
	type: ETurnContextType;
}
