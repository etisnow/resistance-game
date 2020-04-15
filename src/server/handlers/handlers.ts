import {gameServer} from 'server/server/GameServer';
import {Player} from 'server/models/Player';
import {EPlayerActionType} from 'shared/enum/playerActions';
import {EClientEventType} from 'shared/enum/enumClientEvents';

export const registerHandlers = (player: Player) => {
  player.socket.on(EClientEventType.createGame, ({ nickname }) => {
    gameServer.createGame({nickname, player})
  });
  player.socket.on(EClientEventType.connectGame, ({ nickname, gameId }) => {
    gameServer.connectGame({nickname, player, gameId})
  });
  player.socket.on(EClientEventType.kickPlayer, ({ playerId }) => {
    gameServer.kickPlayer({playerId})
  });
  player.socket.on(EClientEventType.startGame, function () {
    gameServer.startGame({player});
  });
  player.socket.on(EClientEventType.grabCardFromDeck, function () {
    gameServer.grabCardFromDeck({player});
  });
  player.socket.on(EClientEventType.playerAction, function ({
    actionType,
    cardUniqueId,
    selectedPlayerId,
    actionContext
  }: {
    actionType: EPlayerActionType,
    cardUniqueId: string,
    selectedPlayerId: string,
    actionContext: any
  }) {
    gameServer.playerAction({player, actionType, cardUniqueId, selectedPlayerId, actionContext});
  });
  player.socket.on("disconnect", function () {
    player.makeOffline();
  });
};
