
import { Game } from './game';
import { Message } from './protocol';

class TestClient {
  game: Game | null = null;
  playerId: string | null = null;
  sent: Array<Message> = [];
  heartbeatIntervalId = setTimeout(() => {} , 0);
  isAlive = false;

  isAuthed: boolean = false;
  send(msg: string): void {
    this.sent.push(JSON.parse(msg) as Message);
  }

  last(): Message {
    return this.sent[this.sent.length - 1];
  }
}

describe('Game', function() {
  it('join', function() {
    const game = new Game('xxx');
    const client = new TestClient();
    game.join(client);
    expect(client.game).toBe(game);
    expect(client.playerId).not.toBe(null);
    const password = client.sent[0].type == 'JOINED' ? client.sent[0].password : undefined;
    expect(client.sent).toEqual([
      { type: 'JOINED', gameId: 'xxx', playerId: client.playerId, isFirst: true, password: password },
      { type: 'UPDATE', entries: [], full: true},
    ]);
  });

  it('join second player', function() {
    const game = new Game('xxx');
    const client1 = new TestClient();
    const client2 = new TestClient();
    game.join(client1);
    game.onMessage(client1, {
      type: 'UPDATE',
      entries: [
        ['foo', 'bar', 'baz'],
        ['foo', 'bar2', 'baz2'],
      ],
      full: false,
    });
    game.onMessage(client1, {
      type: 'UPDATE',
      entries: [['foo', 'bar', null]],
      full: false,
    });
    game.join(client2);
    expect(client2.game).toBe(game);
    expect(client2.playerId).not.toBe(null);
    const password = client2.sent[0].type == 'JOINED' ? client2.sent[0].password : undefined;
    expect(client2.sent).toEqual([
      { type: 'JOINED', gameId: 'xxx', playerId: client2.playerId, isFirst: false, password: password },
      { type: 'UPDATE', entries: [['foo', 'bar2', 'baz2']], full: true},
    ]);
  });

  it('unique', function() {
    const game = new Game('xxx');
    const client = new TestClient();
    game.join(client);
    game.onMessage(client, {
      type: 'UPDATE',
      entries: [
        ['foo', 'bar', { x: 1 }],
        ['foo', 'bar2', { x: 2 }],
        ['unique', 'foo', 'x'],
      ],
      full: false,
    });
    game.onMessage(client, {
      type: 'UPDATE',
      entries: [
        ['foo', 'bar', { x: 2 }],
      ],
      full: false,
    });
    expect(client.last()).toEqual({
      type: 'UPDATE',
      entries: [
        ['foo', 'bar', { x: 1 }],
        ['foo', 'bar2', { x: 2 }],
        ['unique', 'foo', 'x'],
      ],
      full: true,
    });
  });

  it('perPlayer', function() {
    const game = new Game('xxx');
    const client1 = new TestClient();
    const client2 = new TestClient();
    game.join(client1);
    game.join(client2);
    game.onMessage(client1, {
      type: 'UPDATE',
      entries: [
        ['perPlayer', 'foo', true],
        ['foo', client1.playerId!, 'xxx'],
      ],
      full: false,
    });
    game.onMessage(client2, {
      type: 'UPDATE',
      entries: [
        ['foo', client2.playerId!, 'yyy'],
      ],
      full: false,
    });

    game.leave(client2);
    expect(client1.last()).toEqual({
      type: 'UPDATE',
      entries: [
        ['foo', client2.playerId!, null],
      ],
      full: false,
    });
  });
});
