import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';
import {yporstvoAct, yporstvoSelect} from 'server/helpers/cardActions/yporstvo';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {podozrenieAct, podozrenieSelect} from 'server/helpers/cardActions/podozrenie';
import {menyaemsyaMestamiAct, menyaemsyaMestamiSelect} from 'server/helpers/cardActions/menyaemsyaMestami';
import {ognemetAct, ognemetSelect} from 'server/helpers/cardActions/ognemet';
import {smatyvayUdochkiAct, smatyvayUdochkiSelect} from 'server/helpers/cardActions/smatyvayUdochki';
import {zakolochennayaDverAct, zakolochennayaDverSelect} from 'server/helpers/cardActions/zakolochennayaDver';
import {soblaznAct, soblaznSelect} from 'server/helpers/cardActions/soblazn';
import {viskyAct} from 'server/helpers/cardActions/visky';
import {karantinAct, karantinSelect} from 'server/helpers/cardActions/karantin';
import {toporAct, toporSelect} from 'server/helpers/cardActions/topor';
import {lookAroundAct} from 'server/helpers/cardActions/lookAround';
import {analizAct, analizSelect} from 'server/helpers/cardActions/analiz';
import {EEventID} from 'shared/enum/cards';

export const actCard = ({game, cardUniqueId, player, actionContext} : {game: Game, player: Player, cardUniqueId: string, actionContext?:any}) => {
	const card = player.getCardByUniqueId(cardUniqueId);
	if (!card) {
		throw new Error('Похоже карта не была найдена у игрока ' + player.nickname + ' c ID ' + card.uniqueId);
	}
	switch (card.id) {
		case EEventID.yporstvo:
			yporstvoAct({card, player, game}); break;
		case EEventID.podozrenie:
			podozrenieAct({player, game, card}); break;
		case EEventID.menyaemsya_mestami:
			menyaemsyaMestamiAct({player, game, card}); break;
		case EEventID.ognemet:
			ognemetAct({player, game, card}); break;
		case EEventID.smatyvay_udochki:
			smatyvayUdochkiAct({player, game, card}); break;
		case EEventID.zakolochennaya_dver:
			zakolochennayaDverAct({player, game, card}); break;
		case EEventID.soblazn:
			soblaznAct({player, game, card}); break;
		case EEventID.visky:
			viskyAct({player, game, card}); break;
		case EEventID.karantin:
			karantinAct({player, game, card}); break;
		case EEventID.topor:
			toporAct({player, game, card}); break;
		case EEventID.look_around:
			lookAroundAct({player, game, card}); break;
		case EEventID.analiz:
			analizAct({player, game, card}); break;
	}
}

export const selectCard = ({game, cardUniqueId, player, actionContext} : {game: Game, player: Player, cardUniqueId: string, actionContext?:any}) => {
	let cardFunction: ({game: Game, player: Player, actionContext: any}) => void | null = null;
	const {turnContext} = game;
	if (turnContext.type === ETurnContextType.yporstvoCardSelect) {
		return yporstvoSelect({game, cardUniqueId, player})
	}
}

export const selectPlayer = ({game, selectedPlayerId, player, actionContext} : {game: Game, player: Player, selectedPlayerId: string, actionContext?:any}) => {
	let cardFunction: ({game: Game, player: Player, actionContext: any}) => void | null = null;
	const {turnContext} = game;
	switch (turnContext.type) {
		case ETurnContextType.podozreniePersonSelect:
			return podozrenieSelect({game, selectedPlayerId, player});
		case ETurnContextType.menyaemsyaMestamiPersonSelect:
			return menyaemsyaMestamiSelect({game, selectedPlayerId, player});
		case ETurnContextType.ognemetSelect:
			return ognemetSelect({game, selectedPlayerId, player});
		case ETurnContextType.smatyvayUdochkiPersonSelect:
			return smatyvayUdochkiSelect({game, selectedPlayerId, player})
		case ETurnContextType.zakolochennayaDverPersonSelect:
			return zakolochennayaDverSelect({game, selectedPlayerId, player})
		case ETurnContextType.soblazn:
			return soblaznSelect({game, selectedPlayerId, player})
		case ETurnContextType.karantinPersonSelect:
			return karantinSelect({game, selectedPlayerId, player})
		case ETurnContextType.toporPersonSelect:
			return toporSelect({game, selectedPlayerId, player})
		case ETurnContextType.analizPersonSelect:
			return analizSelect({game, selectedPlayerId, player})
	}

}


