import {Game} from 'server/models/Game';
import {concat, each, map, range} from 'lodash';
import {avatarsCount} from 'shared/constant/avatars';
import {shuffle} from 'server/helpers/util';
import {gameServer} from 'server/server/GameServer';

// Рассадка и лица. Раздача ролей появится здесь же в фазе 1 (см. docs/PLAN.md).
export const gameStarter = (game: Game) => {
	const playersCount = Object.keys(game.players).length || 0;
	if (!playersCount) throw new Error("количество игроков равно нулю");

	const playerList = Object.keys(game.players);
	// В тестах места не тасуем: сценарии написаны на порядок, в котором игроки
	// садились за стол.
	game.playersList = gameServer.isMock ? playerList : shuffle(playerList, game.rng);

	// Лица раздаём вразнобой: список аватарок один и тот же, и без тасовки за
	// каждым столом сидели бы одни и те же люди в одном и том же порядке.
	// Игроков может оказаться больше, чем лиц, — тогда список идёт по второму
	// кругу, но уже в другом порядке, и одинаковые лица расходятся по столу.
	const avatarDeck = concat(
		[],
		...map(range(Math.ceil(playersCount / avatarsCount)), () => shuffle(range(avatarsCount), game.rng)),
	);

	each(playerList, (playerId, index) => {
		const player = game.players[playerId];
		if (!player) return;
		player.color = index + ''
		player.avatar = avatarDeck[index] + ''
	});
};
