import {GameServer} from 'server/server/GameServer';
import {EPlayerActionType} from 'shared/enum/playerActions';
import {EClientEventType} from 'shared/enum/enumClientEvents';
import socketIO from "socket.io";

export const registerHandlers = (gameServer: GameServer, socket: socketIO.Socket) => {
  socket.on(EClientEventType.createGame, ({ nickname }) => {
    gameServer.createGame({nickname, socket})
  });
  socket.on(EClientEventType.leaveGame, function () {
    const player = gameServer.getPlayerBySocket(socket);
    if (!player) return;
    gameServer.leaveGame({player});
  });
  socket.on(EClientEventType.connectGame, ({ nickname, gameId }) => {
    gameServer.connectGame({nickname, socket, gameId})
  });
  socket.on(EClientEventType.kickPlayer, ({ playerId }) => {
    gameServer.kickPlayer({playerId})
  });
  socket.on(EClientEventType.startGame, function () {
    const player = gameServer.getPlayerBySocket(socket);
    if (!player) return;
    gameServer.startGame({player});
  });
  socket.on(EClientEventType.toggleReadyGame, function () {
    const player = gameServer.getPlayerBySocket(socket);
    if (!player) return;
    gameServer.toggleReady({player});
  });
  socket.on(EClientEventType.playerAction, function ({
    actionType,
    cardUniqueId,
    selectedPlayerId,
    action
  }: {
    actionType: EPlayerActionType,
    cardUniqueId: string,
    selectedPlayerId: string,
    actionContext: any,
    action: string,
  }) {
    const player = gameServer.getPlayerBySocket(socket);
    if (!player) return;
    gameServer.playerAction({player, actionType, cardUniqueId, selectedPlayerId, action});
  });
  socket.on("disconnect", function () {
    const player = gameServer.getPlayerBySocket(socket);
    if (!player) {
      gameServer.sockets.delete(socket);
      return;
    }
    player.makeOffline();
  });
};
