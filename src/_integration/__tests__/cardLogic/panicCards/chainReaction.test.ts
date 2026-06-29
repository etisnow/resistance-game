import {getPanic} from 'shared/constant/cards';
import {EPanicID} from 'shared/enum/cards';
import {createMockGameServer} from '_integration/createGameServer';
import {EPlayerState, ETurnState} from 'shared/enum/player';
import {each, isEqual} from 'lodash';
import {EPlayerActionType} from 'shared/enum/playerActions';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {Player} from 'server/models/Player';
import {ICardEvent} from 'shared/interfaces/cards';
import {getNextChainReactionPlayer} from 'server/helpers/cardActions/panic/chainReaction';
import {requirePlayer} from '_integration/helpers';
import {testPlayerAction} from '_integration/testPlayerActionsDecisions';


describe('chainReaction test',  () => {

	it('chainReaction card', () => {
		const [gameServer, game, offensePlayerMaybe, doorMaybe, BPlayerMaybe] = createMockGameServer();
		const offensePlayer = requirePlayer(game, offensePlayerMaybe?.id);
		const door = requirePlayer(game, doorMaybe?.id);
		const BPlayer = requirePlayer(game, BPlayerMaybe?.id);
		door.state = EPlayerState.door;
		BPlayer.quarantine = 3;
		offensePlayer.hand.splice(0,1);

		game.deck.splice(0,1, getPanic(EPanicID.chainReaction));
		game.changeTurn(offensePlayer.id);


		expect(game.turnContext).not.toBe(undefined);
		expect(game.turnContext?.type).toBe(ETurnContextType.chainReaction);

		const initialContext = game.turnContext;
		if (!initialContext || initialContext.type !== ETurnContextType.chainReaction) {
			throw new Error('Ожидался контекст chainReaction');
		}
		const startPlayer = initialContext.startPlayer;
		expect(startPlayer).not.toBe(undefined);

		let tradedCards: {player: Player, card: ICardEvent}[] = [];

		each(game.players, pl => {
			if (pl.state === EPlayerState.door) return;
			const card = pl.getRandomPlayableCard();
			if (!card) throw new Error('Ожидалась карта для обмена');
			tradedCards.push({player: pl, card});
			console.log(pl.nickname)
			expect(pl.turnState).toBe(ETurnState.inOffenseTrade);
			expect(game.turnContext?.type).toBe(ETurnContextType.chainReaction);

			testPlayerAction(gameServer, game, {
				player:pl,
				cardUniqueId: card.uniqueId ?? undefined,
				actionType: EPlayerActionType.cardTrade
			});
			const context = game.turnContext;
			if (context && context.type === ETurnContextType.chainReaction) {
				expect(isEqual(context.playersPick, tradedCards)).toBe(true);
			} else {

				expect(game.turnContext).toBe(null);
				each(tradedCards, ({player: tradedPlayer, card:tradedCard}) => {
					const nextPlayer = getNextChainReactionPlayer({currentPlayer: tradedPlayer, game});
					expect(nextPlayer?.hand).toContainEqual(
						expect.objectContaining({uniqueId: tradedCard.uniqueId})
					)
				})


				//Два некста, потому что была дверь
				const nextPlayerAfterStarter = startPlayer.getNextPlayer().getNextPlayer();
				expect(nextPlayerAfterStarter.turnState).toBe(ETurnState.inCardAction)


			}
		})


		//Не проверяем, потому что цифра не сойдется. Мы дверь зафейкали
		//expect(checkAllDeckCardsTestEdition(game, false)).toBe(true);
	});


	it('chainReaction card', () => {
		const [gameServer, game, offensePlayerMaybe, , BPlayerMaybe] = createMockGameServer();
		const offensePlayer = requirePlayer(game, offensePlayerMaybe?.id);
		const BPlayer = requirePlayer(game, BPlayerMaybe?.id);
		BPlayer.quarantine = 3;
		offensePlayer.hand.splice(0,1);

		game.deck.splice(0,1, getPanic(EPanicID.chainReaction));
		game.changeTurn(offensePlayer.id);


		expect(game.turnContext).not.toBe(undefined);
		expect(game.turnContext?.type).toBe(ETurnContextType.chainReaction);

		const initialContext = game.turnContext;
		if (!initialContext || initialContext.type !== ETurnContextType.chainReaction) {
			throw new Error('Ожидался контекст chainReaction');
		}
		const startPlayer = initialContext.startPlayer;
		expect(startPlayer).not.toBe(undefined);

		let tradedCards: {player: Player, card: ICardEvent}[] = [];

		each(game.players, pl => {
			if (pl.state === EPlayerState.door) return;
			const card = pl.getRandomPlayableCard();
			if (!card) throw new Error('Ожидалась карта для обмена');
			tradedCards.push({player: pl, card});
			expect(pl.turnState).toBe(ETurnState.inOffenseTrade);
			expect(game.turnContext?.type).toBe(ETurnContextType.chainReaction);

			testPlayerAction(gameServer, game, {
				player:pl,
				cardUniqueId: card.uniqueId ?? undefined,
				actionType: EPlayerActionType.cardTrade
			});
			const context = game.turnContext;
			if (context && context.type === ETurnContextType.chainReaction) {
				expect(isEqual(context.playersPick, tradedCards)).toBe(true);
			} else {

				expect(game.turnContext).toBe(null);
				each(tradedCards, ({player: tradedPlayer, card:tradedCard}) => {
					const nextPlayer = getNextChainReactionPlayer({currentPlayer: tradedPlayer, game});
					expect(nextPlayer?.hand).toContainEqual(
						expect.objectContaining({uniqueId: tradedCard.uniqueId})
					)
				})

				//один некст, потому что следующий игрок не дверь
				const nextPlayerAfterStarter = startPlayer.getNextPlayer();
				expect(nextPlayerAfterStarter.turnState).toBe(ETurnState.inCardAction)
			}
		})

		//expect(checkAllDeckCardsTestEdition(game, false)).toBe(true);
	});


});
