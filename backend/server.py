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
from ratelimit import limits


log = logging.getLogger('')


class Game():

    def __init__(self):
        self.players = []
        self.n_players = 0
        self.states = ['color', 'bigger', 'between', 'suits', 'bus']
        self.state = self.states[0]
        self.sips = {}
        self.turn_number = 0
        self.question_id = None
        self.total_turns = None
        self.questions = [
            '¿Rojo o Negro?',
            '¿Arriba o abajo?',
            '¿Entre medio o fuera?',
            '¿Palo?'
        ]
        self.turn = None
        cards = [
            '10C', '10D', '10H', '10S', '2C', '2D', '2H', '2S', '3C', '3D',
            '3H', '3S', '4C', '4D', '4H', '4S', '5C', '5D', '5H', '5S', '6C',
            '6D', '6H', '6S', '7C', '7D', '7H', '7S', '8C', '8D', '8H', '8S',
            '9C', '9D', '9H', '9S', 'AC', 'AD', 'AH', 'AS', 'JC', 'JD', 'JH',
            'JS', 'KC', 'KD', 'KH', 'KS', 'QC', 'QD', 'QH', 'QS'
        ]
        self.remaining_cards = cards
        self.current_card = None
        self.player_cards = {}

    def add_player(self, username):
        if username in self.players:
            raise Exception('Player already in room')
        self.players.append(username)

    def start(self):
        self.n_players = len(self.players)
        self.sips = {k: {'sent': 0, 'received': 0}  for k in self.players}
        self.player_cards = {k: [] for k in self.players}
        self.set_player_turn()
        self.total_turns = 4 * self.n_players + 1

    def set_player_turn(self):
        self.turn = self.players[(self.turn_number - 1) % self.n_players]

    def next_question(self, username, last_one_lost=False):
        if last_one_lost:
            self.sips[username]['received'] += 1 # TODO: fix this
        print('-'*50)
        print(self.turn_number)
        if self.turn_number < self.n_players:
            self.question_id = 0
            btn_0_text = 'ROJO'
            btn_1_text = 'NEGRO'
            btn_2_text = None
            btn_3_text = None
        elif self.turn_number < (2 * self.n_players):
            self.question_id = 1
            btn_0_text = 'ARRIBA'
            btn_1_text = 'ABAJO'
            btn_2_text = None
            btn_3_text = None
        elif self.turn_number < (3 * self.n_players):
            self.question_id = 2
            btn_0_text = 'ENTRE MEDIO'
            btn_1_text = 'FUERA'
            btn_2_text = None
            btn_3_text = None
        elif self.turn_number < (4 * self.n_players):
            self.question_id = 3
            btn_0_text = '♣'
            btn_1_text = '♦'
            btn_2_text = '♥'
            btn_3_text = '♠'

        msg = self.questions[self.question_id]
        self.set_player_turn()
        to_return = {
            'action': 'show_turn',
            'btn_0_text': btn_0_text,
            'btn_1_text': btn_1_text,
            'btn_2_text': btn_2_text,
            'btn_3_text': btn_3_text,
            'turn': self.turn,
            'all_cards_seen': self.player_cards,
            'msg': msg,
            'question_id': self.question_id
        }
        self.turn_number += 1
        return to_return

    def _get_letter_from_card(self, card):
        return card[-1]

    def _get_number_from_card(self, card):
        num = card[:-1]
        cards = {'J': 11, 'Q': 12, 'K': 13, 'A': 14}
        try:
            return cards[num]
        except KeyError:
            return int(num)

    def is_red(self, card):
        letter = self._get_letter_from_card(card)
        if letter in ('H', 'D'):
            return True
        return False

    def is_greater(self, username, card):
        num_bef = self._get_number_from_card(self.player_cards[username][-2])
        num_act = self._get_number_from_card(card)
        return num_act > num_bef

    def is_in_between(self, username, card):
        num_2_bef = self._get_number_from_card(self.player_cards[username][-3])
        num_bef = self._get_number_from_card(self.player_cards[username][-2])
        num_act = self._get_number_from_card(card)
        return (num_2_bef < num_act and num_bef > num_act)

    def get_num_from_suit(self, card):
        suit = self._get_letter_from_card(card)
        suits = {'C': 0, 'D': 1, 'H': 2, 'S': 3}
        return suits[suit]

    def is_answer_correct(self, username, answer_id, card):
        if self.question_id == 3:
            num = self.get_num_from_suit(card)
            if answer_id == num:
                return True
            return False
        elif self.question_id == 0:
            condition = self.is_red(card)
        elif self.question_id == 1:
            condition = self.is_greater(username, card)
        elif self.question_id == 2:
            condition = self.is_in_between(username, card)
        if ((condition and answer_id == 0) or
                (not condition and answer_id == 1)):
            return True
        return False

    def answer(self, username, answer_id):
        card = self.pick_random_card()
        self.player_cards[username].append(card)
        is_correct = self.is_answer_correct(username, answer_id, card)
        if is_correct:
            msg = 'Correcto, puedes enviar un sorbo'
            msg_2 = 'A quien le quieres enviar?'
            msg_others = f'Correcto, {self.turn} puede enviar un sorbo'
            msg_others_2 = 'A quien se lo enviará...'
        else:
            msg = 'Incorrecto, bebes un sorbo'
            msg_2 = None
            msg_others = f'Incorrecto, {self.turn} bebe un sorbo'
            msg_others_2 = 'Esperando a que se lo beba...'
        return {
            'action': 'answer_action',
            'card': card,
            'turn': self.turn,
            'all_cards_seen': self.player_cards,
            'is_correct': is_correct,
            'msg': msg,
            'msg_2': msg_2,
            'msg_others': msg_others,
            'msg_others_2': msg_others_2,
            'players': self.players
        }

    def send_sip(self, username, to, amount):
        self.sips[username]['sent'] += amount
        self.sips[to]['received'] += amount
        msg = f'Bebes {amount} sorbo'
        ans = 'Sorbo bebido. Continuar.'
        if amount > 1:
            msg += 's'
            ans = 'Sorbos bebidos. Continuar.'
        return {
            'action': 'notify_sip',
            'victim': to,
            'msg': msg,
            'ans': ans
        }

    def pick_random_card(self):
        card = random.choice(self.remaining_cards)
        self.remaining_cards.remove(card)
        return card


class WSHandler(tornado.websocket.WebSocketHandler):
    rooms = {}

    def check_origin(self, origin):
        return True

    def open(self):
        log.info('Connection to client opened')

    @limits(calls=2, period=1)
    def notify_players_in_room(self, room, msg='test'):
        print(msg)
        if msg == 'test':
            players = [p['username'] for p in self.rooms[room]['players']]
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
                    msg = json.dumps(data['msg'])
                    r['ws'].write_message(room, msg)
            elif action == 'start_game':
                self.rooms[room]['game'].start()
                self.notify_players_in_room(
                    room, self.rooms[room]['game'].next_question(username)
                )
            elif action == 'answer':
                self.notify_players_in_room(
                    room,
                    self.rooms[room]['game'].answer(
                        username, data['answer_id']
                    )
                )
            elif action == 'next_question':
                self.notify_players_in_room(
                    room, self.rooms[room]['game'].next_question(
                        username, last_one_lost=data['last_one_lost'])
                )
            elif action == 'send_sip':
                self.notify_players_in_room(
                    room,
                    self.rooms[room]['game'].send_sip(
                        username, data['to'], data['amount']
                    )
                )
            else:
                pass
        except Exception as e:
            print('\n\nERROR')
            print(e)
            print('\n\n')
            log.exception(e)
            raise

    def on_close(self):
        log.info('Connection closed')


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
        #    "/etc/ssl/certs/cert.crt",
        #    "/etc/ssl/private/key.key"
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

