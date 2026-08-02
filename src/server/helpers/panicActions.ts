import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';
import {ICardPanic} from 'shared/interfaces/cards';
import {EPanicID} from 'shared/enum/cards';
import {threeFourAct} from 'server/helpers/cardActions/panic/threeFour';
import {chainReactionAct} from 'server/helpers/cardActions/panic/chainReaction';
import {blindDateAct} from 'server/helpers/cardActions/panic/blindDate';
import {oldRopesAct} from 'server/helpers/cardActions/panic/oldRopes';
import {oneTwoAct} from 'server/helpers/cardActions/panic/oneTwo';
import {onlyBetweenUsAct} from 'server/helpers/cardActions/panic/onlyBetweenUs';
import {youCallThisPartyAct} from 'server/helpers/cardActions/panic/youCallThisParty';
import {goAwayAct} from 'server/helpers/cardActions/panic/goAway';
import {oopsAct} from 'server/helpers/cardActions/panic/oops';
import {friendshipAct} from 'server/helpers/cardActions/panic/friendship';
import {forgetfullnessAct} from 'server/helpers/cardActions/panic/forgetfulness';
import {cardNames} from 'shared/constant/cardNames';
import {EGameLogType} from 'shared/enum/gameLogType';

export const panicAction = ({game, player, panicCard}: {game:Game, player:Player, panicCard: ICardPanic}) => {
    // Модалки здесь больше нет: саму карту стол показывает крупно в центре всё
    // время события паники (см. Game.panicCard и клиентский PanicCard). В лог
    // пишем её название — оно же становится подсказкой с картинкой карты.
    game.addLog(
      `Игрок ${player.nickname} достает карту паники «${cardNames[panicCard.id] || panicCard.id}»`,
      EGameLogType.panic,
    );

    switch (panicCard.id) {
	    case EPanicID.threeFour:
			return threeFourAct({game, player});
	    case EPanicID.chainReaction:
			return chainReactionAct({game, player});
	    case EPanicID.blindDate:
			return blindDateAct({game, player});
	    case EPanicID.oldRopes:
			return oldRopesAct({game, player});
	    case EPanicID.oneTwo:
			return oneTwoAct({game, player});
	    case EPanicID.onlyBetweenUs:
			return onlyBetweenUsAct({game, player});
	    case EPanicID.youCallThisParty:
			return youCallThisPartyAct({game, player});
	    case EPanicID.goAway:
			return goAwayAct({game, player});
	    case EPanicID.oops:
			return oopsAct({game, player});
	    case EPanicID.friendship:
			return friendshipAct({game, player});
	    case EPanicID.forgetfulness:
			return forgetfullnessAct({game, player});
    }
};
