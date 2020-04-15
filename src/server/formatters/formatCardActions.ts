import {filter, find} from 'lodash';
import {ICardMenuItem} from 'shared/interfaces/cardMenu';
import {ETurnState} from 'shared/enum/player';
import {EEventID, EEventType} from 'shared/enum/cards';
import {EPlayerActionType} from 'shared/enum/playerActions';
import {Game} from 'server/models/Game';
import {ICard} from 'shared/interfaces/cards';
import {Player} from 'server/models/Player';

const injuresCount = (player: Player) => {
	const injures = filter(player.hand, card => { return card.id === EEventID.injure});
	return injures.length;
};

const getTargetPlayer = (game:Game, player: Player): Player | null => {
	//Пассивный ход
	if (player.turnState === ETurnState.idle
		|| player.turnState === ETurnState.inCardAction
		|| player.turnState === ETurnState.inCardActionProgress
	) return null;

	//Во всех остальных случаях должен быть оппонент
	switch (player.turnState) {
		case ETurnState.inDefenseSwap:
			return find(game.players, {turnState: ETurnState.inOffenseSwap});
		case ETurnState.inOffenseSwap:
			return find(game.players, {turnState: ETurnState.inDefenseSwap});

		case ETurnState.inOffenseTrade:
			return find(game.players, {turnState: ETurnState.inDefenseTrade});
		case ETurnState.inDefenseTrade:
			return find(game.players, {turnState: ETurnState.inOffenseTrade});

		case ETurnState.inOffenseFiring:
			return find(game.players, {turnState: ETurnState.inDefenseFiring});
		case ETurnState.inDefenseFiring:
			return find(game.players, {turnState: ETurnState.inOffenseFiring});
	}

};

export const formatCardActions = (game: Game, player: Player, card: ICard): ICardMenuItem[] => {
	let actions : ICardMenuItem[] = [];
	if (!card.eventType) return actions;
	if (card.id === "thing") return actions;

	const isCurrentPlayerInjured = player.isInjured;
	const isCurrentPlayerThing = player.isThing;

	const targetPlayer = getTargetPlayer(game, player);
	console.log('target player', targetPlayer)

	const isTargetPlayerThing = targetPlayer && targetPlayer.isThing;

	//у инжуры дроп только если не заражен ИЛИ карт заражения больше 1 или игрок нечто
	const canDiscardInjure = !isCurrentPlayerInjured || injuresCount(player) > 1 || isCurrentPlayerThing;
	const canTradeInjure = isCurrentPlayerThing || (isCurrentPlayerInjured && isTargetPlayerThing);



	switch (player.turnState) {
		case ETurnState.idle:
			return actions;
		case ETurnState.inCardAction:
			if (player.quarantine > 0 && card.eventType !== EEventType.axe) {
				actions.push({ menuType: EPlayerActionType.cardDiscard});
				return actions;
			}

			if (card.eventType === EEventType.axe) {
				actions.push({ menuType: EPlayerActionType.cardDiscard});
				if (player.quarantine > 0) {
					actions.push({ menuType: EPlayerActionType.cardAct});
				}
				return actions;
				//TODO: Логика возможностей использования топора
				//if ()
			}


			if (card.eventType === EEventType.injure && canDiscardInjure) {
				actions.push({ menuType: EPlayerActionType.cardDiscard});
				return actions;
			}
			actions.push({ menuType: EPlayerActionType.cardDiscard});
			if (card.eventType === EEventType.playable) {
				actions.push({ menuType: EPlayerActionType.cardAct});
			}
			return actions;
		case ETurnState.inOffenseTrade:
			if (card.eventType === EEventType.injure) {
				if (canTradeInjure)	actions.push({ menuType: EPlayerActionType.cardTrade});
				return actions;
			}
			actions.push({ menuType: EPlayerActionType.cardTrade});
			return actions;
		case ETurnState.inDefenseTrade:
			if (card.eventType === EEventType.injure && canTradeInjure) {
				actions.push({ menuType: EPlayerActionType.cardTrade});
				return actions;
			}
			if (card.eventType === EEventType.antiTrade) {
				actions.push({ menuType: EPlayerActionType.cardAct});
				actions.push({ menuType: EPlayerActionType.cardTrade});
				return actions;
			}
			actions.push({ menuType: EPlayerActionType.cardTrade});
			break;
	}
	return actions;
};
