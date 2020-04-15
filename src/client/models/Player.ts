import {observable} from "mobx";
import {EPlayerState, ETurnState} from 'shared/enum/player';
import {ICard} from 'shared/interfaces/cards';


export default class Player {
	@observable state: EPlayerState = EPlayerState.dummy;
	@observable nickname: string | null = null;
	@observable color: string = '';
	@observable gameId: string | null = null;
	@observable id: string = '';
	@observable isHost: boolean = false;
	@observable hand: ICard[] = [];
	@observable turnState: ETurnState = ETurnState.idle;
	@observable isInjured: boolean = false;
	@observable isThing: boolean = false;
	@observable quarantine: number = 0;
}
