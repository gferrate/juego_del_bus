import tornado.httpserver
import tornado.websocket
import tornado.ioloop
import tornado.web
from tornado.ioloop import IOLoop
from tornado import gen
from tornado.websocket import websocket_connect
import ssl

import json
import logging
import random

log = logging.getLogger('')


class Game():

    def __init__(self):
        self.players = []
        self.states = ['color', 'bigger', 'between', 'suits', 'bus']
        self.state = self.states[0]
        self.rounds = {}
        self.turn_number = 0
        self.turn = None
        self.cards = [
            '10C', '10D', '10H', '10S', '2C', '2D', '2H', '2S', '3C', '3D',
            '3H', '3S', '4C', '4D', '4H', '4S', '5C', '5D', '5H', '5S', '6C',
            '6D', '6H', '6S', '7C', '7D', '7H', '7S', '8C', '8D', '8H', '8S',
            '9C', '9D', '9H', '9S', 'AC', 'AD', 'AH', 'AS', 'JC', 'JD', 'JH',
            'JS', 'KC', 'KD', 'KH', 'KS', 'QC', 'QD', 'QH', 'QS'
        ]
        self.remaining_cards = self.cards

    def add_player(self, username):
        self.players.append(username)

    def start(self):
        self.turn_number += 1
        self.rounds = {k: {} for k in self.players}
        self.turn = self.players[(self.turn_number - 1) % len(self.players)]

    def next_turn(self):
        if self.turn_number == 1:
            turn = self.turn
            msg = '¿Blanco o negro?'
            return {'action': 'show_turn', 'turn': turn, 'msg': msg}
        if self.turn > 0 and (self.turn_number % len(self.players)) == 0:
            pass
        pass

    def get_turn(self):
        return self.turn

    def get_turn_number(self):
        return self.turn_number

    def pick_random_card(self):
        card = random.choice(self.remaining_cards)
        self.remaining_cards.pop(card)


class WSHandler(tornado.websocket.WebSocketHandler):
    rooms = {}

    def check_origin(self, origin):
        return True

    def open(self):
        log.info('Connection to client opened')

    def notify_players_in_room(self, room, msg='test'):
        print(msg)
        if msg == 'test':
            players = [p['username'] for p in self.rooms[room]]
            msg = json.dumps({'action': 'notify_players', 'players': players})
            for r in self.rooms[room]['players']:
                r['ws'].write_message(msg)
        else:
            for r in self.rooms[room]['players']:
                r['ws'].write_message(msg)

    def on_message(self, message):
        try:
            data = json.loads(message);
            action = data['action']
            room = data['room']
            username = data['username']
            if action == 'create_room':
                if room in self.rooms.keys():
                    raise Exception('Room already exists')
                self.rooms[room] = {
                    'game': Game(),
                    'players': [{'ws': self, 'username': username}]
                }
                self.rooms[room]['game'].add_player(username)
            elif action == 'join_room':
                self.rooms[room]['players'].append(
                    {'ws': self, 'username': username}
                )
                self.notify_players_in_room(room)
                self.rooms[room]['game'].add_player(username)
            elif action == 'send_message':
                for r in self.rooms[room]['players']:
                    msg = json.dumps({'test': f'Hi, {r["username"]}', 'test3': 333})
                    r['ws'].write_message(msg)
            elif action == 'start_game':
                self.rooms[room]['game'].start()
                self.notify_players_in_room(room, {'msg': 'Hell yeah'})
                self.notify_players_in_room(
                    room, self.rooms[room]['game'].next_turn()
                )
            else:
                pass
        except Exception as e:
            log.exception(e)
            raise

    def on_close(self):
        log.info('Connection with raspberry closed')


if __name__ == "__main__":
    try:
        format = "%(asctime)s: %(message)s"
        logging.basicConfig(
            filename='/var/log/bus/bus.log',
            format=format,
            level=logging.INFO,
            datefmt="%H:%M:%S"
        )
        #ssl_ctx = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH)
        #ssl_ctx.load_cert_chain(
        #    "/etc/ssl/certs/_wildcard_.bmat.com_2019-2021_good.crt",
        #    "/etc/ssl/private/_wildcard_.bmat.com_2017-2019.key"
        #)
        application = tornado.web.Application([(r'/', WSHandler),])
        http_server = tornado.httpserver.HTTPServer(
            application#, ssl_options=ssl_ctx
        )
        http_server.listen(7777)
        tornado.ioloop.IOLoop.instance().start()
    except Exception as e:
        log.exception(e)
        raise e

