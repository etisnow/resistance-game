import {Game} from 'server/models/Game';
import {each} from 'lodash';
import {Player} from 'server/models/Player';
import {debugLog} from 'server/helpers/util';
import {getSpyCalls} from '_integration/mockSocket';

// Test helper: fetch a player by id, asserting presence (keeps tests free of
// non-null assertions on the game.players index map).
export const requirePlayer = (game: Game, id: string | undefined): Player => {
	const player = id ? game.players[id] : undefined;
	if (!player) throw new Error(`Игрок не найден в игре: ${id}`);
	return player;
};

export const printPlayersStatuses = (game: Game) => {
	each(game.players, pl => {
		debugLog(pl.nickname, pl.turnState);
	})
}

export const printNotifications = (player: Player) => {
	each(getSpyCalls(player), ([type, event]) => {
		if (type !== 'notification') return;
		debugLog(event);
	})
}
