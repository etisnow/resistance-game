import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';
import {tenacityAct, tenacitySelect} from 'server/helpers/cardActions/tenacity';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {suspicionAct, suspicionSelect} from 'server/helpers/cardActions/suspicion';
import {positionswapAct, positionswapSelect} from 'server/helpers/cardActions/positionswap';
import {flamethrowerAct, flamethrowerSelect} from 'server/helpers/cardActions/flamethrower';
import {smatyvayUdochkiAct, smatyvayUdochkiSelect} from 'server/helpers/cardActions/smatyvayUdochki';
import {zakolochennayaDverAct, zakolochennayaDverSelect} from 'server/helpers/cardActions/zakolochennayaDver';
import {seductionAct, seductionSelect} from 'server/helpers/cardActions/seduction';
import {whiskeyAct} from 'server/helpers/cardActions/whiskey';
import {quarantineAct, quarantineSelect} from 'server/helpers/cardActions/quarantine';
import {axeAct, axeSelect} from 'server/helpers/cardActions/axe';
import {lookAroundAct} from 'server/helpers/cardActions/lookAround';
import {analysisAct, analysisSelect} from 'server/helpers/cardActions/analysis';
import {EEventID} from 'shared/enum/cards';

export const actCard = ({game, cardUniqueId, player, actionContext} : {game: Game, player: Player, cardUniqueId: string, actionContext?:any}) => {
	const card = player.getCardByUniqueId(cardUniqueId);
	if (!card) {
		throw new Error('Похоже карта не была найдена у игрока ' + player.nickname + ' c ID ' + card.uniqueId);
	}
	switch (card.id) {
		case EEventID.tenacity:
			tenacityAct({card, player, game}); break;
		case EEventID.suspicion:
			suspicionAct({player, game, card}); break;
		case EEventID.positionswap:
			positionswapAct({player, game, card}); break;
		case EEventID.flamethrower:
			flamethrowerAct({player, game, card}); break;
		case EEventID.reelFishingRods:
			smatyvayUdochkiAct({player, game, card}); break;
		case EEventID.barricade:
			zakolochennayaDverAct({player, game, card}); break;
		case EEventID.seduction:
			seductionAct({player, game, card}); break;
		case EEventID.whiskey:
			whiskeyAct({player, game, card}); break;
		case EEventID.quarantine:
			quarantineAct({player, game, card}); break;
		case EEventID.axe:
			axeAct({player, game, card}); break;
		case EEventID.lookaround:
			lookAroundAct({player, game, card}); break;
		case EEventID.analysis:
			analysisAct({player, game, card}); break;
	}
}

export const selectCard = ({game, cardUniqueId, player, actionContext} : {game: Game, player: Player, cardUniqueId: string, actionContext?:any}) => {
	let cardFunction: ({game: Game, player: Player, actionContext: any}) => void | null = null;
	const {turnContext} = game;
	if (turnContext.type === ETurnContextType.tenacityCardSelect) {
		return tenacitySelect({game, cardUniqueId, player})
	}
}

export const selectPlayer = ({game, selectedPlayerId, player, actionContext} : {game: Game, player: Player, selectedPlayerId: string, actionContext?:any}) => {
	let cardFunction: ({game: Game, player: Player, actionContext: any}) => void | null = null;
	const {turnContext} = game;
	switch (turnContext.type) {
		case ETurnContextType.suspicionPersonSelect:
			return suspicionSelect({game, selectedPlayerId, player});
		case ETurnContextType.positionswapPersonSelect:
			return positionswapSelect({game, selectedPlayerId, player});
		case ETurnContextType.flamethrowerSelect:
			return flamethrowerSelect({game, selectedPlayerId, player});
		case ETurnContextType.smatyvayUdochkiPersonSelect:
			return smatyvayUdochkiSelect({game, selectedPlayerId, player})
		case ETurnContextType.zakolochennayaDverPersonSelect:
			return zakolochennayaDverSelect({game, selectedPlayerId, player})
		case ETurnContextType.seduction:
			return seductionSelect({game, selectedPlayerId, player})
		case ETurnContextType.quarantinePersonSelect:
			return quarantineSelect({game, selectedPlayerId, player})
		case ETurnContextType.axePersonSelect:
			return axeSelect({game, selectedPlayerId, player})
		case ETurnContextType.analysisPersonSelect:
			return analysisSelect({game, selectedPlayerId, player})
	}

}


