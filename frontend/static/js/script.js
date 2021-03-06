 $(document).ready(function() {
     var username;
     var current_question = 0;
     var room_number = undefined;
     var players = [];
     var last_one_correct;
     var action = null;
     var prev_action = null;
     var loser = null;
     var game_has_finished = false;
     var currentBusRow = 0;
     var currentBusCard = null;
     var currentBusCardId = null;
     var currentBusCardIsNum = false;
     var currentBusCardFlipped = false;
     //clubs (♣), diamonds (♦), hearts (♥) and spades (♠),
     var cards = [
         '10C', '10D', '10H', '10S', '2C', '2D', '2H', '2S', '3C', '3D', '3H',
         '3S', '4C', '4D', '4H', '4S', '5C', '5D', '5H', '5S', '6C', '6D', '6H',
         '6S', '7C', '7D', '7H', '7S', '8C', '8D', '8H', '8S', '9C', '9D', '9H',
         '9S', 'AC', 'AD', 'AH', 'AS', 'JC', 'JD', 'JH', 'JS', 'KC', 'KD', 'KH',
         'KS', 'QC', 'QD', 'QH', 'QS'
     ];

     // PRELOAD IMAGES
     var loadedimages = new Array();
     for (var i = 0; i < cards.length; i++) {
         let card = cards[i];
         let src = `static/img/deck/${card}.png`;
         loadedimages[i] = new Image();
         loadedimages[i].src = src;
     }

     var socket = new WebSocket('ws://192.168.1.129:7777');
     var n_unfolded_prebus_cards = 0;
     var acc_sips_user = 0;
     var navbar_cards = [];
     var used_pre_bus_sips = 0;

     function getUrlVars() {
         var vars = {};
         var parts = window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(m, key, value) {
             vars[key] = value;
         });
         return vars;
     }

     function scrollToTop() {
         window.scrollTo(0, 0);
     }
     setTimeout(function() {
         scrollToTop();
     }, 500);

     function diffuminateCardInNav(i) {
         var id = "#nav-card-" + i.toString();
         $(id).css({
             'opacity': 0.5
         });
     }

     function getNumberOfCard(card) {
         var n = card.substring(0, card.length - 1);
         if (n == 'J') {
             return 11
         } else if (n == 'Q') {
             return 12
         } else if (n == 'K') {
             return 13
         } else if (n == 'A') {
             return 14
         }
         return parseInt(n);
     }

     function numbersCoincide(c1, c2) {
         return getNumberOfCard(c1) == getNumberOfCard(c2);
     }

     function preBusDone() {
         players_filtered = players.filter(e => e !== username);
         if (acc_sips_user > 0) {
             for (player of players_filtered) {
                 var input = `<div class="d-flex justify-content-center flex-row w-100 mt-2 sip-selector">
                 <div class="input-group" style="width:10rem;">
                     <div class="input-group-prepend">
                         <button data-player="${player}" class="btn btn-dark decrement-sip" type="button">
                         <i class="fa fa-minus"></i></button>
                     </div>
                     <input data-player="${player}" type="text" value="0" inputmode="decimal"
                     style="text-align: center; width: 2rem" class="form-control sip-input" placeholder="Sorbos" >
                     <div class="input-group-append">
                         <button data-player="${player}" class="btn btn-dark increment-sip" type="button">
                         <i class="fa fa-plus"></i></button>
                     </div>
                 </div>
                 <span class="ml-3 pt-2">${player}</span>
                 </div>`
                 $('#pre-bus-buttons').append(input);
             }
             var btn = `<button id="send-pre-bus-sips" type="button" class="btn btn-dark mt-3 sip-selector">Envía</button>`;
             $('#pre-bus-buttons').append(btn);
         } else {
             send({
                 'action': 'send_pre_bus_sips',
                 'sips': {}
             });
         }
     }

     function unFoldPreBusCards(pre_bus_cards, sips_to_send) {
         setTimeout(function() {
             if (n_unfolded_prebus_cards < 8) {
                 var sips_to_send_round = sips_to_send[username][n_unfolded_prebus_cards];
                 card = pre_bus_cards[n_unfolded_prebus_cards];
                 for (i in navbar_cards) {
                     c = navbar_cards[i];
                     if (numbersCoincide(c, card)) {
                         diffuminateCardInNav(i);
                     }
                 }
                 var id = "#pre-bus-" + n_unfolded_prebus_cards.toString();
                 let src = `static/img/deck/${card}.png`;
                 $(id).addClass("flip-scale-down-diag-2");
                 setTimeout(function() {
                     $(id).attr("src", src);
                 }, 500 / 2);
                 if (sips_to_send_round > 0) {
                     acc_sips_user += sips_to_send_round;
                 }
                 let msg = `Envías ${acc_sips_user} sorbo`
                 if (acc_sips_user > 1 || acc_sips_user == 0) {
                     msg += 's'
                 }
                 $('#question-pre-bus-2').html(msg);
                 unFoldPreBusCards(pre_bus_cards, sips_to_send);
             } else {
                 preBusDone()
             }
             n_unfolded_prebus_cards += 1;
         }, 2000);
     }
     socket.onopen = function() {
         console.log('Connected!');
     };
     /*for (var i = 0; i <= 7; i++) {
         var id = `#card-${i}`;
         $(id).flip({
             'trigger': 'manual'
         });
         id = `#pre-bus-${i}`;
         $(id).flip({
             'trigger': 'manual'
         });
     }*/
     function reloadIn(ms) {
         setTimeout(function() {
             window.location.href = "";
         }, ms);
     }
     socket.onmessage = function(event) {
         let dataReceived = JSON.parse(event.data);
         if (dataReceived.player_out) {
             toggleAlert(`${dataReceived.player} se ha ido de la sala`);
             players = dataReceived.players;
             notifyPlayers(players);
             return
         }   
         action = dataReceived.action;
         if (action == 'chao') {
             somethingWentWrong();
         }
         if (action == 'add_player') {
             players = dataReceived.players;
             if (dataReceived.max_players) {
                 toggleAlert('Número máximo de jugadores alcanzado (11). Anfitrión, empieza la partida!');
             }
             notifyPlayers(dataReceived.players);
             if (dataReceived.new_player != username) {
                 toggleAlert(`${dataReceived.new_player} se ha unido!`, false, true);
             }
         } else if (action == 'game_has_started') {
             toggleAlert(`Lo siento, la partida ya ha epezado`);
             reloadIn(2000);
         } else if (action == 'max_players_reached') {
             toggleAlert(`Lo siento, ya se ha llegado al límite de usuarios en esta sala.`);
             reloadIn(2000);
         } else if (action == 'player_already_in_room') {
             toggleAlert(`El jugador ${dataReceived.usr} ya está en la sala`);
             reloadIn(2000);
         } else if (action == 'room_does_not_exist') {
             $('#waiting-players').attr('hidden', true);
             toggleAlert('La sala no existe');
             reloadIn(2000);
         } else if (action == 'show_turn') {
             current_question = dataReceived.question_id;
             $('#menu').attr('hidden', true);
             $('#waiting-players').attr('hidden', true);
             $('#questions').attr('hidden', false);
             $('#answer-0').html(dataReceived.btn_0_text);
             $('#answer-1').html(dataReceived.btn_1_text);
             var cards_to_show = dataReceived.all_cards_seen[dataReceived.turn];
             cards_to_show.push('back');
             var id = "#card-" + (cards_to_show.length - 1).toString()
             $(id).removeClass("flip-scale-down-diag-2");
             showCards(cards_to_show);
             msg = dataReceived.msg;
             turn = dataReceived.turn;
             enableButtons();
             $('#question').html('Turno de ' + turn);
             $('#question-2').html(msg);
             if (current_question == 3) {
                 showNButtons(4);
                 $('#answer-2').html(dataReceived.btn_2_text);
                 $('#answer-3').html(dataReceived.btn_3_text);
             } else {
                 showNButtons(2);
             }
             if (turn != username) {
                 disableButtons();
             }
         } else if (action == 'answer_action') {
             msg = dataReceived.msg;
             msg_2 = dataReceived.msg_2;
             turn = dataReceived.turn;
             card = dataReceived.card;
             last_one_correct = dataReceived.is_correct;
             hideButtons();
             if (turn == username) {
                 $('#question').html(msg);
                 $('#question-2').html(msg_2 || '');
             } else {
                 $('#question').html(dataReceived.msg_others);
                 $('#question-2').html(dataReceived.msg_others_2);
             }
             var all_cards_seen = dataReceived.all_cards_seen;
             var cards_to_show = all_cards_seen[dataReceived.turn];
             var id = "#card-" + (cards_to_show.length - 1).toString()
             $(id).addClass("flip-scale-down-diag-2");
             setTimeout(function() {
                 showCards(cards_to_show);
             }, 500 / 2);
             showNavCards(all_cards_seen[username]);
             if (dataReceived.is_correct) {
                 addPlayersToButtons(dataReceived.players);
             } else {
                 if (turn == username) {
                     showNButtons(1);
                     enableButtons();
                     $('#answer-0').html('Sorbo bebido. Continuar');
                 } else {
                     //
                 }
             }
         } else if (action == 'add_player') {
             players = dataReceived.players;
         } else if (action == 'answered') {
             //pass
         } else if (action == 'notify_sip') {
             msg = dataReceived.msg;
             msg_others = dataReceived.msg_others;
             msg_others_2 = dataReceived.msg_others_2;
             victim = dataReceived.victim;
             hideButtons();
             if (victim == username) {
                 showNButtons(1);
                 $('#answer-0').html(dataReceived.ans);
                 $('#question').html(msg);
                 $('#question-2').html('');
                 enableButtons();
             } else {
                 $('#question').html(msg_others);
                 $('#question-2').html(msg_others_2);
             }
         } else if (action == 'start_pre_bus') {
             $('#questions').attr('hidden', true);
             $('#pre-bus').attr('hidden', false);
         } else if (action == 'pre_bus_cards') {
             $('#pre-bus-cards').attr('hidden', true);
             var pre_bus_cards = dataReceived.pre_bus_cards;
             var sips_to_send = dataReceived.sips_to_send;
             unFoldPreBusCards(pre_bus_cards, sips_to_send)
         } else if (action == 'wait_all_pre_bus_sips') {
             let missing = dataReceived.missing;
             let missing_str = missing.join(', ');
             if (!missing.includes(username)) {
                 hidePreBusButtons();
                 $('#question-pre-bus-2').html(`Esperando a que se envíen los sorbos. Faltan: ${missing_str}`);
             }
         } else if (action == 'drink_pre_bus_sips') {
             hidePreBusButtons();
             let unified_sips = dataReceived.unified_sips;
             var msg = '';
             for (const [to, amount] of Object.entries(unified_sips)) {
                 if (to == username) {
                     msg += `Bebes ${amount} sorbo`;
                     if (amount != 1) {
                         msg += 's';
                     }
                     msg += '</br>';
                 } else {
                     msg += `${to} bebe ${amount} sorbo`
                     if (amount != 1) {
                         msg += 's';
                     }
                     msg += '</br>';
                 }
             }
             $('#question-pre-bus-2').html(msg);
             var usr_amount = unified_sips[username];
             if (usr_amount > 0) {
                 if (usr_amount == 1) {
                     var btn_msg = 'Sorbo bebido. Continuar';
                 } else {
                     var btn_msg = 'Sorbos bebidos. Continuar';
                 }
                 $('#pre-bus-cards').html(btn_msg);
                 $('#pre-bus-cards').attr('hidden', false);
             } else {
                 send({
                     'action': 'pre_bus_sips_drunk'
                 });
             }
         } else if (action == 'pre_bus_waiting_all_players_drink') {
             if (!dataReceived.missing.includes(username)) {
                 var msg = `Esperando a que ${dataReceived.missing.join(', ')} beba`;
                 if (dataReceived.missing.length > 1) {
                     msg += 'n';
                 }
                 $('#question-pre-bus-2').html(msg);
             }
         } else if (action == 'pre_bus_all_players_drunk') {
             $('#pre-bus-cards').attr('hidden', true);
             var msg = `${dataReceived.loser} va al bus...`;
             $('#question-pre-bus-2').html(msg);
             if (dataReceived.loser == username) {
                 $('#pre-bus-cards').html('Estoy preparado...');
                 $('#pre-bus-cards').attr('hidden', false);
             }
         } else if (action == 'next_bus_card') {
             $('#nav-cards').attr('hidden', true);
             loser = dataReceived.loser;
             makeClickableCurrentRow();
             updateBusQuestion();
             currentBusCardFlipped = false;
             $('#pre-bus').attr('hidden', true);
             $('#bus').attr('hidden', false);
         } else if (action == 'notify_bus_selection') {
             $('#bus-button').attr('hidden', true);
             currentBusCardFlipped = false;
             currentBusCard = dataReceived.card;
             currentBusCardIsNum = dataReceived.is_number;
             var card_id = dataReceived.card_id
             showBusCard(card_id);
             if (!currentBusCardIsNum) {
                 //currentBusCardFlipped = false;
                 if (loser == username) {
                     send({
                         'action': 'notify_incorrect_bus_answer',
                         'sips_to_drink': currentBusRow + 1
                     });
                 }
             } else if (currentBusCardIsNum && currentBusRow == 4) {
                 if (loser == username) {
                     send({
                         'action': 'win'
                     });
                 }
             } else {
                 currentBusRow += 1;
             }
             makeClickableCurrentRow();
             updateBusQuestion();
         } else if (action == 'notify_incorrect_bus_answer') {
             currentBusCardFlipped = true
             //makeClickableAllRows();
             let sips_to_drink = dataReceived.sips_to_drink;
             var msg_button = 'Sorbo bebido. Continuar';
             var msg = `Es una figura! ${loser}, bebes ${sips_to_drink} sorbo`;
             var msg_2 = `Esperando a que ${loser} se beba el sorbo...`;
             if (sips_to_drink > 1) {
                 msg += 's';
                 msg_button = 'Sorbos bebidos. Continuar';
                 msg_2 = `Esperando a que ${loser} beba los ${sips_to_drink} sorbos...`;
             }
             $('#question-bus').html(msg);
             $('#bus-button').attr('hidden', true);

             setTimeout(function() {
                 coverAllCards();
                 if (loser == username) {
                     $('#bus-button').html(msg_button);
                     $('#bus-button').attr('hidden', false);
                 } else {
                     $('#question-bus-2').html(msg_2);
                 }
                 //currentBusCardFlipped = false
                 currentBusRow = 0;
                 makeClickableCurrentRow();
             }, 2000);
         } else if (action == 'notify_win') {
             if (dataReceived.no_cards_left) {
                 var msg = `${loser} se ha acabado las cartas! Ha salido del bus.`;
             } else {
                 var msg = `${loser} ha salido del bus!`;
             }
             $('#question-bus').html(msg);
             $('#bus-button').attr('hidden', true);

             setTimeout(function() {
                 $('#bus').attr('hidden', true);
                 var msg = '';
                 for (const [user, values] of Object.entries(dataReceived.stats)) {
                     msg += `${user} ha enviado ${values['sent']} sorbos y ha recibido ${values['received']}</br>`;
                 }
                 $('#stats-2').html(msg);
                 $('#stats').attr('hidden', false);
                 game_has_finished = true;
             }, 3000);
         }
     };

     function somethingWentWrong() {
         if (!game_has_finished) {
             $('#menu').attr('hidden', true);
             $('#questions').attr('hidden', true);
             $('#pre-bus').attr('hidden', true);
             $('#pre').attr('hidden', true);
             toggleAlert(
                 'Algo ha ido mal. Seguramente un participante ha salido de la sala.',
                 true
             );
             $('#something_went_wrong').attr('hidden', false);
         }
     }

     socket.onclose = function() {
         somethingWentWrong();
         console.log('Lost connection!');
     };
     socket.onerror = function() {
         somethingWentWrong();
         console.log('error');
     };

     function updateBusQuestion() {
         if (currentBusRow == 0) {
             var msg = `${loser}, clicka una carta de la fila de abajo`
         } else if (currentBusRow == 1 || currentBusRow == 2 || currentBusRow == 3) {
             if (currentBusRow == 1) {
                 var num_str = 'cuarta';
             } else if (currentBusRow == 2) {
                 var num_str = 'tercera';
             } else if (currentBusRow == 3) {
                 var num_str = 'segunda';
             }
             var msg = `${loser}, clicka una carta de la ${num_str} fila`
         } else {
             var msg = `${loser}, clicka una carta de la fila de arriba`
         }
         $('#question-bus').html(msg);
     }

     function send(msg) {
         msg['room'] = room_number
         msg['username'] = username
         socket.send(JSON.stringify(msg));
     }

     function hidePreBusButtons() {
         $('#pre-bus-buttons').attr('hidden', true);
     }

     function makeClickableCurrentRow() {
         $('.card-bus').each(function() {
             var row = parseInt($(this).data("row"));
             if (row == currentBusRow) {
                 $(this).css({
                     'opacity': 1,
                     'cursor': 'pointer'
                 });
             } else {
                 $(this).css({
                     'opacity': 0.5,
                     'cursor': 'auto'
                 });
             }
         });
     }

     function makeClickableAllRows() {
         $('.card-bus').each(function() {
             $(this).css({
                 'opacity': 1,
                 'cursor': 'auto'
             });
         });
     }

     function coverAllCards() {
         var src = `static/img/deck/back.png`;
         $('.card-bus').each(function() {
             $(this).removeClass("flip-scale-down-diag-2");
             $(this).attr("src", src);
         });
         /*for (_id of flippedBusCards) {
             _id = `#${_id}`;
             $(_id).removeClass("flip-scale-down-diag-2");
             setTimeout(function() {
                 $(_id).attr("src", src);
             }, 500 / 2);
             $(_id).addClass("flip-scale-down-diag-2");
         }*/
     }

     function disableButtons() {
         $("#answer-0").addClass('disabled');
         $("#answer-1").addClass('disabled');
         $("#answer-2").addClass('disabled');
         $("#answer-3").addClass('disabled');
         $("#answer-4").addClass('disabled');
         $("#answer-5").addClass('disabled');
     }

     function enableButtons() {
         $("#answer-0").removeClass('disabled');
         $("#answer-1").removeClass('disabled');
         $("#answer-2").removeClass('disabled');
         $("#answer-3").removeClass('disabled');
         $("#answer-4").removeClass('disabled');
         $("#answer-5").removeClass('disabled');
     }

     function hideButtons() {
         $("#answer-0").attr('hidden', true);
         $("#answer-1").attr('hidden', true);
         $("#answer-2").attr('hidden', true);
         $("#answer-3").attr('hidden', true);
         $("#answer-4").attr('hidden', true);
         $("#answer-5").attr('hidden', true);
     }

     function showButtons() {
         $("#answer-0").attr('hidden', false);
         $("#answer-1").attr('hidden', false);
         $("#answer-2").attr('hidden', false);
         $("#answer-3").attr('hidden', false);
         $("#answer-4").attr('hidden', false);
         $("#answer-5").attr('hidden', false);
     }

     function showNButtons(n) {
         hideButtons();
         for (let idx = 0; idx < n; idx++) {
             var id = `#answer-${idx}`;
             $(id).attr('hidden', false);
         }
     }

     function enableButton(id) {
         $(id).attr('hidden', false);
     }

     function showNcards(n) {
         if (n == 1) {
             $('#card-0').parent().removeClass('col-6').addClass('col-12');
             $('#card-1').parent().attr('hidden', true);
             $('#card-2').parent().attr('hidden', true);
         } else if (n == 2) {
             $('#card-0').parent().removeClass('col-12').addClass('col-6');
             $('#card-1').parent().removeClass('col-12').addClass('col-6');
             $('#card-1').parent().attr('hidden', false);
         } else if (n == 3) {
             $('#card-0').parent().removeClass('col-12').removeClass('col-6').addClass('col-4');
             $('#card-1').parent().removeClass('col-12').removeClass('col-6').addClass('col-4');
             $('#card-2').parent().removeClass('col-12').removeClass('col-6').addClass('col-4');
             $('#card-0').parent().attr('hidden', false);
             $('#card-1').parent().attr('hidden', false);
             $('#card-2').parent().attr('hidden', false);
         } else if (n == 4) {
             $('#card-0').parent().removeClass('col-12').removeClass('col-6').removeClass('col-4').addClass('col-3');
             $('#card-1').parent().removeClass('col-12').removeClass('col-6').removeClass('col-4').addClass('col-3');
             $('#card-2').parent().removeClass('col-12').removeClass('col-6').removeClass('col-4').addClass('col-3');
             $('#card-3').parent().removeClass('col-12').removeClass('col-6').removeClass('col-4').addClass('col-3');
             $('#card-0').parent().attr('hidden', false);
             $('#card-1').parent().attr('hidden', false);
             $('#card-2').parent().attr('hidden', false);
             $('#card-3').parent().attr('hidden', false);

             /*for (i = 0; i < n; i++) {
                 let id = `#card-${i}`
                 $(id).attr('hidden', false);
             }
             for (i = n; i < 4; i++) {
                 let id = `#card-${i}`
                 $(id).attr('hidden', true);*/
         }
     }

     function addPlayersToButtons(players) {
         players_filtered = players.filter(e => e !== username);
         hideButtons();
         for (idx in players_filtered) {
             let id = `#answer-${idx}`;
             $(id).html(players_filtered[idx]);
             $(id).attr('hidden', false);
         }
     }

     function showNavCards(cards) {
         navbar_cards = cards;
         for (idx in cards) {
             card = cards[idx];
             let src = `static/img/deck/${card}.png`;
             let id = "#nav-card-" + idx;
             $(id).attr("src", src);
             $(id).attr("hidden", false);
             $(id).data("card", card);
         }
     }

     function showCards(cards) {
         showNcards(cards.length);
         for (idx in cards) {
             card = cards[idx];
             let src = `static/img/deck/${card}.png`;
             let id = "#card-" + idx;
             $(id).attr("src", src);
         }
     }

     function getRandomCard() {
         return cards[Math.floor(Math.random() * 52)]
     }

     function notifyPlayers(players) {
         $('#players-in-room').html('Jugadores: ' + players.join(', '));
     }

     function generateRandomCode() {
         var code = '';
         for (j = 0; j < 6; j++) {
             code += Math.floor(Math.random() * 9).toString();
         }
         return code;
     }

     function toggleAlert(msg, forever, green) {
         if (forever == undefined) {
             forever = false;
         }
         if (green == undefined) {
             green = false;
         }
         if (green) {
             var alert_id = '#green-alert';
         } else {
             var alert_id = '#alert';
         }
         $(alert_id).html(msg);
         $(alert_id).attr('hidden', false);
         if (!forever) {
             $(alert_id).fadeTo(2000, 500).slideUp(500, function() {
                 $(alert_id).slideUp(500);
             });
         }
     }

     function verifyUsername() {
         username = $('#menu-username').val();
         if (username == '') {
             toggleAlert('Nombre de usuario requerido');
             return false
         } else {
             $('#alert').attr('hidden', true);
             return true
         }
     }

     function showBusCard(id) {
         id = `#${id}`;
         let src = `static/img/deck/${currentBusCard}.png`;
         setTimeout(function() {
             $(id).attr("src", src);
         }, 500 / 2);
         $(id).addClass("flip-scale-down-diag-2");
     }

     $('#shareWhatsapp').click(function() {
         let text = `Hacemos una partida del juegodelbus.es?%0AEl código de sala es: *${room_number}*.%0ACópialo o dale click al siguiente enlace: juegodelbus.es/?room=${room_number}`;
         let href = "whatsapp://send?text=" + text;
         window.location.href = href;
     });

     $('#bus-button').click(function() {
         if (loser == username) {
             send({
                 'action': 'bus_sips_drunk'
             });
         }
         currentBusCardFlipped = false
         $(this).attr('hidden', true);
     });

     $('#pre-bus-cards').click(function() {
         if (action == 'drink_pre_bus_sips' || action == 'pre_bus_waiting_all_players_drink') {
             send({
                 'action': 'pre_bus_sips_drunk',
             });
             $('#pre-bus-cards').attr('hidden', true);
         } else if (action == 'pre_bus_all_players_drunk') {
             send({
                 'action': 'start_bus'
             });
         } else {
             send({
                 'action': 'pre_bus_cards'
             });
         }
     });

     function getTotalInputSips() {
         var tot = 0;
         $('.sip-input').each(function() {
             tot += parseInt($(this).val());
         });
         return tot
     }

     function getTotalInputSipsDict() {
         var sips_dict = {};
         $('.sip-input').each(function() {
             let p = $(this).data('player');
             sips_dict[p] = parseInt($(this).val());
         });
         return sips_dict
     }

     $(document.body).on('click', '.increment-sip', function() {
         var usr = $(this).data('player');
         var input = $('input').filter(`[data-player="${usr}"]`);
         var total = getTotalInputSips();
         var val = parseInt(input.val());
         if (total < acc_sips_user) {
             input.val(val + 1);
         }
     });

     $(document.body).on('click', '.decrement-sip', function() {
         var usr = $(this).data('player');
         var input = $('input').filter(`[data-player="${usr}"]`);
         var val = parseInt(input.val());
         if (val > 0) {
             input.val(val - 1);
         }
     });

     function notifyOthersBusSelection() {
         send({
             'action': 'notify_bus_selection',
             'card_id': currentBusCardId
         });
     }

     $(document.body).on('click', '.card-bus', function() {
         var row = parseInt($(this).data("row"));
         if (row != currentBusRow || username != loser || currentBusCardFlipped) {
             return
         }
         currentBusCardFlipped = true;
         currentBusCardId = $(this).attr('id');
         notifyOthersBusSelection();
     });

     var vars = getUrlVars();
     if (vars['room'] != undefined) {
         room_number = parseInt(vars['room']);
         $('#menu-room-number').val(room_number);
     }

     $('#menu-create').on('click', function() {
         if (!verifyUsername()) {
             return
         }
         room_number = generateRandomCode();
         $('#menu-content-init').attr('hidden', true);
         $('#code').html(room_number);
         $('#menu-content-create').attr('hidden', false);
         scrollToTop();
         $('#menu').removeClass('menu-w-1');
         $('#nav-username').html(username);
         send({
             'action': 'create_room'
         });
     });

     $('#menu-join').click(function() {
         if (!verifyUsername()) {
             return
         }
         $('#menu-content-init').attr('hidden', true);
         $('#menu-content-create').attr('hidden', true);
         scrollToTop();
         $('#menu-content-join').attr('hidden', false);
         $('#nav-username').html(username);
     });

     $('#menu-join-btn').click(function() {
         room_number = $('#menu-room-number').val();
         if (room_number == '') {
             toggleAlert('Número de sala requerido')
             return
         }
         $('#menu').attr('hidden', true);
         $('#waiting-players').attr('hidden', false);
         let rnd_num = Math.floor(Math.random() * 10) + 1;
         let src = `static/img/waiting_gifs/gif_${rnd_num}.gif`;
         $('#waiting-img').attr('src', src);
         send({
             'action': 'join_room'
         });
     });

     $('.new_game').click(function() {
         window.location.href = "";
     });

     $('#menu-start-game').click(function() {
         if (players.length <= 1) {
             toggleAlert('Aún no hay ningún jugador en la sala');
             return
         }
         $('#menu').attr('hidden', true);
         send({
             'action': 'start_game'
         });
     });

     $(document.body).on('click', '#send-pre-bus-sips', function() {
         var total = getTotalInputSips();
         if (total < acc_sips_user) {
             toggleAlert('Tienes que repartir todos los sorbos');
             return
         } else {
             send({
                 'action': 'send_pre_bus_sips',
                 'sips': getTotalInputSipsDict()
             });
         }
     });

     $('#answer-0, #answer-1, #answer-2, #answer-3').on('click', function() {
         var button_num = parseInt($(this).attr('id').split('-')[1]);
         if ($(this).hasClass('disabled')) {
             return
         }
         if (current_question == 0 ||
             current_question == 1 ||
             current_question == 2 ||
             current_question == 3) {
             if (action == 'show_turn') {
                 send({
                     'action': 'answer',
                     'question_id': 0,
                     'answer_id': button_num
                 })
             } else if (action == 'answer_action') {
                 //$("#sound")[0].play();
                 if (last_one_correct) {
                     send({
                         'action': 'send_sip',
                         'amount': 1,
                         'to': $(this).html()
                     })
                 } else {
                     send({
                         'action': 'next_question',
                         'last_one_lost': true
                     })
                 }
             } else if (action == 'notify_sip') {
                 send({
                     'action': 'next_question',
                     'last_one_lost': false
                 })
             }
         }
     });
 });
