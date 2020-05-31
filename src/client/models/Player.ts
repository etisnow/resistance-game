import {observable} from "mobx";
import {EPlayerState, ETurnState} from 'shared/enum/player';
import {EPlayerMark} from 'shared/enum/playerMarks';


export default class Player {
	@observable state: EPlayerState = EPlayerState.dummy;
	@observable nickname: string | null = null;
	@observable color: string = '';
	@observable gameId: string | null = null;
	@observable id: string = '';
	@observable isHost: boolean = false;
	@observable turnState: ETurnState = ETurnState.idle;
	@observable isInfected: boolean = false;
	@observable isThing: boolean = false;
	@observable quarantine: number = 0;
	@observable isYou: boolean = false;
	@observable isReady: boolean = false;
	@observable isConnected: boolean = true;
	@observable marks: {[key:string]: EPlayerMark} = {};
}
