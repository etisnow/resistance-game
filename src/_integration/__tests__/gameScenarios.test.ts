import {getCard, getPanic} from 'shared/constant/cards';
import {EEventID, EPanicID} from 'shared/enum/cards';
import {createMockGameServer} from '_integration/createGameServer';
import {ETurnState} from 'shared/enum/player';
import {find} from 'lodash';
import {EPlayerActionType} from 'shared/enum/playerActions';
import {ENotificationAction} from 'shared/enum/notifications';
import type INotificationAction from 'shared/interfaces/notification';
import {requirePlayer} from '_integration/helpers';
import {createMockSocket, getSpyCalls} from '_integration/mockSocket';
import {testPlayerAction} from '_integration/testPlayerActionsDecisions';

// General game-ending / state-machine scenarios that the per-card tests don't
// cover: win/lose via flamethrower, and the quarantine duration contract.
describe('game scenarios', () => {
	it('burning the Thing ends the game — the Thing loses', () => {
		const [gameServer, game, defenseMaybe] = createMockGameServer();
		const defensePlayer = requirePlayer(game, defenseMaybe?.id);
		// Make the burn target the Thing.
		defensePlayer.isThing = true;
		defensePlayer.isInfected = true;

		const offensePlayer = game.getPlayerByPosition({isNext: false, playerId: defensePlayer.id});
		offensePlayer.hand.splice(0, 1, getCard(EEventID.flamethrower));

		game.changeTurn(offensePlayer.id);
		const flamethrower = find(offensePlayer.hand, {id: EEventID.flamethrower});
		if (!flamethrower) throw new Error('flamethrower card not found');

		testPlayerAction(gameServer, game, {
			player: offensePlayer,
			cardUniqueId: flamethrower.uniqueId ?? undefined,
			actionType: EPlayerActionType.cardAct,
		});
		testPlayerAction(gameServer, game, {
			player: offensePlayer,
			selectedPlayerId: defensePlayer.id,
			actionType: EPlayerActionType.playerSelect,
		});
		testPlayerAction(gameServer, game, {
			actionType: EPlayerActionType.actionDecision,
			player: defensePlayer,
			action: 'burn',
		});

		expect(game.gameInProcess).toBe(false);
		expect(game.gameLog[game.gameLog.length - 1]?.text).toBe('Нечто проиграло');
	});

	it('quarantine stays active for the target\'s next 3 turns, then frees', () => {
		const [, game, targetMaybe] = createMockGameServer();
		const target = requirePlayer(game, targetMaybe?.id);

		// Freshly applied quarantine: 3, not yet ticked.
		target.quarantine = 3;
		target.quarantineFresh = true;

		// Turn 1 (the turn that immediately follows applying it): no tick.
		game.changeTurn(target.id);
		expect(target.quarantine).toBe(3);
		expect(target.quarantineFresh).toBe(false);

		// Turns 2..4: the counter ticks down one per turn-start.
		game.changeTurn(target.id);
		expect(target.quarantine).toBe(2);
		game.changeTurn(target.id);
		expect(target.quarantine).toBe(1);
		game.changeTurn(target.id);
		expect(target.quarantine).toBe(0);
	});

	it('quarantined player gets a quarantine-specific action label until the counter frees them', () => {
		const [, game, targetMaybe] = createMockGameServer();
		const target = requirePlayer(game, targetMaybe?.id);
		target.quarantine = 2;

		// Кладем сверху обычную карту события, чтобы ход не ушел в панику.
		game.deck.splice(0, 1, getCard(EEventID.analysis));
		game.changeTurn(target.id);
		expect(target.quarantine).toBe(1);
		expect(target.currentAction?.type).toBe(ENotificationAction.turnCard);
		expect(target.currentAction?.text).toContain('карантине');

		// Ход, на котором карантин истекает: играть можно все, подпись обычная.
		game.deck.splice(0, 1, getCard(EEventID.analysis));
		game.changeTurn(target.id);
		expect(target.quarantine).toBe(0);
		expect(target.currentAction?.text).toBe('Сбрось или сыграй карту');
	});

	it('reconnect re-sends the pending interactive prompt (select-card)', () => {
		const [gameServer, game, targetMaybe] = createMockGameServer();
		const target = requirePlayer(game, targetMaybe?.id);
		// Give the player a pending select-card prompt via a forgetfulness panic.
		game.deck.splice(0, 1, getPanic(EPanicID.forgetfulness));
		game.changeTurn(target.id);
		expect(target.currentAction?.type).toBe(ENotificationAction.selectCard);

		// Simulate a reconnect with a fresh socket (the one-shot prompt was lost).
		const newSocket = createMockSocket(true);
		gameServer.reconnectPlayer(target, newSocket);

		const gotSelectCard = getSpyCalls(target).some(
			([type, event]) => type === 'notification'
				&& (event as INotificationAction | null)?.type === ENotificationAction.selectCard,
		);
		expect(gotSelectCard).toBe(true);
	});

	it('a burned non-Thing neighbour is removed from the game', () => {
		const [gameServer, game, defenseMaybe] = createMockGameServer();
		const defensePlayer = requirePlayer(game, defenseMaybe?.id);
		defensePlayer.isThing = false;

		const offensePlayer = game.getPlayerByPosition({isNext: false, playerId: defensePlayer.id});
		offensePlayer.hand.splice(0, 1, getCard(EEventID.flamethrower));

		game.changeTurn(offensePlayer.id);
		const flamethrower = find(offensePlayer.hand, {id: EEventID.flamethrower});
		if (!flamethrower) throw new Error('flamethrower card not found');

		testPlayerAction(gameServer, game, {
			player: offensePlayer,
			cardUniqueId: flamethrower.uniqueId ?? undefined,
			actionType: EPlayerActionType.cardAct,
		});
		testPlayerAction(gameServer, game, {
			player: offensePlayer,
			selectedPlayerId: defensePlayer.id,
			actionType: EPlayerActionType.playerSelect,
		});
		testPlayerAction(gameServer, game, {
			actionType: EPlayerActionType.actionDecision,
			player: defensePlayer,
			action: 'burn',
		});

		expect(game.playersList).not.toContain(defensePlayer.id);
		expect(defensePlayer.turnState).toBe(ETurnState.dead);
	});
});
