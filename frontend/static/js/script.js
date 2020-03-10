 $(document).ready(function() {
     var username;
     var room_number;
     //clubs (♣), diamonds (♦), hearts (♥) and spades (♠),
     var cards = [
         '10C', '10D', '10H', '10S', '2C', '2D', '2H', '2S', '3C', '3D', '3H',
         '3S', '4C', '4D', '4H', '4S', '5C', '5D', '5H', '5S', '6C', '6D', '6H',
         '6S', '7C', '7D', '7H', '7S', '8C', '8D', '8H', '8S', '9C', '9D', '9H',
         '9S', 'AC', 'AD', 'AH', 'AS', 'JC', 'JD', 'JH', 'JS', 'KC', 'KD', 'KH',
         'KS', 'QC', 'QD', 'QH', 'QS'
     ];
     var socket = new WebSocket('ws://192.168.1.130:7777');
     socket.onopen = function() {
         console.log('Connected!');
     };
     socket.onmessage = function(event) {
         let dataReceived = JSON.parse(event.data);
         console.log(dataReceived);
         action = dataReceived.action;
         if (action == 'notify_players'){
             notifyPlayers(dataReceived.players);
         }else if(action == 'show_turn'){
             msg = dataReceived.msg;
             turn = dataReceived.turn;
             $('#question').html('Turno de ' + turn);
             setTimeout(() => { $('#question').html(msg); }, 2000);
         }
     };
     socket.onclose = function() {
         console.log('Lost connection!');
     };
     socket.onerror = function() {
         console.log('error');
     };

     function send(msg){
         socket.send(JSON.stringify(msg));
     }

     ///    MENU STUFF    ///
     $('#menu-create').on('click', function() {
         username = $('#menu-username').val();
         room_number = generateRandomCode();
         $('#menu-content-init').attr('hidden', true);
         $('#code').html(room_number);
         $('#menu-content-create').attr('hidden', false);
         $('#menu').removeClass('menu-w-1');
         $('#nav-username').html(username);
         socket.send(JSON.stringify({
             'action': 'create_room',
             'room': room_number,
             'username': username
         }));
     });

     $('#menu-join').click(function() {
         username = $('#menu-username').val();
         $('#menu-content-init').attr('hidden', true);
         $('#menu-content-create').attr('hidden', true);
         $('#menu-content-join').attr('hidden', false);
         $('#nav-username').html(username);
     });

     $('#menu-join-btn').click(function() {
         room_number = $('#menu-room-number').val();
         $('#menu').attr('hidden', true);
         socket.send(JSON.stringify({
             'action': 'join_room',
             'room': room_number,
             'username': username
         }));
     });

     $('#menu-start-game').click(function() {
         $('#menu').attr('hidden', true);
         $('#questions').attr('hidden', false);
         send({
             'action': 'start_game',
             'room': room_number,
             'username': username
         });
     });
     ///    MENU STUFF    ///


     $('#test').click(function() {
         socket.send(JSON.stringify({
             'action': 'send_message',
             'room': room_number,
             'username': username
         }));
     });

     /// IMAGES ///
     /// IMAGES ///

     function getRandomCard() {
         return cards[Math.floor(Math.random() * 52)]
     }
     function notifyPlayers(players){
         $('#players-in-room').html('Jugadores: ' + players.join(', '));
     }
     function generateRandomCode(){
         var code = '';
         for (j = 0; j < 6; j++){
             code += Math.floor(Math.random() * 9).toString();
         }
         return code;
     }

 });
