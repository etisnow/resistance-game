import {gameServer} from 'server/server/GameServer';
import {createMockSocketServer, createPlayer} from 'server/_playground/mockSocket';


gameServer.initialize(createMockSocketServer());

console.log('gameserver init');
const neeronePlayer = createPlayer();

const currentGame = gameServer.createGame({nickname: 'Neerone', player: neeronePlayer});
gameServer.connectGame({player: createPlayer(), gameId: currentGame.id, nickname:'Вася'});
gameServer.connectGame({player: createPlayer(), gameId: currentGame.id, nickname:'Петя'});
gameServer.connectGame({player: createPlayer(), gameId: currentGame.id, nickname:'Гена'});

gameServer.startGame({player: neeronePlayer});


export default 1;
