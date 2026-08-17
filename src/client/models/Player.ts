import {observable} from "mobx";
import {EPlayerState, ETurnState} from 'shared/enum/player';
import {EPlayerMark} from 'shared/enum/playerMarks';


export default class Player {
	@observable state: EPlayerState = EPlayerState.dummy;
	@observable nickname: string | null = null;
	@observable color: string = '';
	// Номер лица в resources.avatars: им залит кружок игрока за столом. Приходит
	// с сервера на старте партии — до него кружок просто цветной.
	@observable avatar: string = '';
	@observable gameId: string | null = null;
	@observable id: string = '';
	@observable isHost: boolean = false;
	@observable turnState: ETurnState = ETurnState.idle;
	@observable isInfected: boolean = false;
	@observable isThing: boolean = false;
	@observable quarantine: number = 0;
	@observable isYou: boolean = false;
	// Роль. null — «не твоё дело»: сопротивление чужих ролей не видит до развязки.
	@observable isSpy: boolean | null = null;
	// Особые роли — только в партии с ними (см. GameController.withMerlin).
	// Мерлина и Персиваля до развязки не знает никто, кроме них самих; Убийцу и
	// Моргану знают свои.
	@observable isMerlin: boolean | null = null;
	@observable isAssassin: boolean | null = null;
	@observable isPercival: boolean | null = null;
	@observable isMorgana: boolean | null = null;
	// Так этот игрок выглядит для Персиваля: Мерлин и Моргана — одинаково (FR-16).
	@observable looksLikeMerlin: boolean | null = null;
	@observable isReady: boolean = false;
	@observable isConnected: boolean = true;
	@observable marks: {[key:string]: EPlayerMark} = {};
}
