/* global PeerConnection, _ */

import { Test } from '../TestSuite';
const PeerConnection = require('rtcpeerconnection');

class ConnectivityTest extends Test {
  constructor () {
    super(...arguments);
    this.name = 'Connectivity Test';

    this.pc1 = new PeerConnection(this.options);
    this.pc2 = new PeerConnection(this.options);
  }

  logIceServers () {
    if (this.options.iceServers) {
      this.options.iceServers.forEach((iceServer) => {
        this.log.push(`INFO: Using ICE Server: ${iceServer.url}`);
      });
      if (this.options.iceServers.length == 0) {
        this.log.push('ERROR: no ice servers provided');
      }
    } else {
      this.log.push('INFO: Using default ICE Servers');
    }
  }

  start () {
    super.start();
    this.log.push('INFO: Connectivity Test');
    this.logIceServers();

    return new Promise((resolve, reject) => {
      this.reject = reject;
      var connectivityCheckFailure = window.setTimeout(() => {
        this.log.push('ERROR: Connectivity timeout error');
        reject('connectivity timeout');
      }, 10000);
      this.pc2.on('ice', (candidate) => {
        this.log.push('SUCCESS: pc2 ICE candidate');
        this.pc1.processIce(candidate);
      });
      this.pc1.on('ice', (candidate) => {
        this.log.push('SUCCESS: pc1 ICE candidate');
        this.pc2.processIce(candidate);
      });
      this.pc2.on('answer', (answer) => {
        this.log.push('SUCCESS: pc2 handle answer');
        this.pc1.handleAnswer(answer);
      });

      // when pc1 gets the offer, instantly handle the offer by pc2
      this.pc1.on('offer', (offer) => {
        this.log.push('SUCCESS: pc1 offer');
        this.pc2.handleOffer(offer, (err) => {
          if (err) {
            this.log.push('ERROR: pc2 failed to handle offer');
            reject(err);
          }
          this.log.push('SUCCESS: pc2 handle offer');
          // this.log.push('Offer: ' + offer);
          this.pc2.answer((err, answer) => {
            if (err) {
              this.log.push('ERROR: pc2 failed answer');
              reject(err);
            }
            this.log.push(`SUCCESS: pc2 successful ${answer.type}`);
            // this.log.push(answer);
          });
        });
      });
      this.dataChannel = this.pc1.createDataChannel('testChannel');

      // generate list of messages to send over data channel
      var messageQueue = _.map(new Array(100), (n, i) => {
        return `message ${i}`;
      });

      var messagesReceived = 0;
      // when the data channel receives a message, remove it from the queue
      this.dataChannel.onmessage = (msgEvent) => {
        _.remove(messageQueue, (message) => {
          return message === msgEvent.data;
        });
        messagesReceived++;
        // when all messages have been received, we're clear
        if (messageQueue.length === 0) {
          window.clearTimeout(connectivityCheckFailure);
          this.log.push(`SUCCESS: Received ${messagesReceived} messages`);
          resolve();
        }
      };
      // when pc2 gets a data channel, send all messageQueue items on it
      this.pc2.on('addChannel', (channel) => {
        channel.onopen = () => {
          this.log.push(`Sending ${messageQueue.length} messages`);
          _.each(_.clone(messageQueue), (message) => {
            channel.send(message);
          });
        };
      });

      // kick it off
      this.pc1.offer();
    });
  }

  destroy () {
    super.destroy();
    this.pc1.close();
    this.pc2.close();
  }
}

export default ConnectivityTest;