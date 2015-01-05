if (typeof Gossiperl === 'undefined') {
  Gossiperl = {};
}
if (typeof Gossiperl.Client === 'undefined') {
  Gossiperl.Client = {};
}
if (typeof Gossiperl.Client.Serialization === 'undefined') {
  Gossiperl.Client.Serialization = {};
}
if (typeof Gossiperl.Client.Encryption === 'undefined') {
  Gossiperl.Client.Encryption = {};
}
if (typeof Gossiperl.Client.Tests === 'undefined') {
  Gossiperl.Client.Tests = {};
}
if (typeof Gossiperl.Client.Transport === 'undefined') {
  Gossiperl.Client.Transport = {};
}
if (typeof Gossiperl.Client.Util === 'undefined') {
  Gossiperl.Client.Util = {};
}

/**
 * SUPERVISOR
 */

Gossiperl.Client.Supervisor = function() {
  this.connections = {};
};
Gossiperl.Client.Supervisor.prototype.connect = function(config, listener) {
  if ( this.isConnection( config.overlayName ) ) {
    throw new Error("Client for " + config.overlayName + " already present.");
  }
  var worker = new Gossiperl.Client.OverlayWorker(this, config, listener);
  this.connections[ config.overlayName ] = worker;
  worker.start();
}
Gossiperl.Client.Supervisor.prototype.disconnect = function(overlayName) {
  if ( this.isConnection( overlayName ) ) {

  } else {
    throw new Error("[supervisor] No overlay connection: " + overlayName);
  }
}
Gossiperl.Client.Supervisor.prototype.disconnected = function(config) {
  // do not call directly:
  delete this.connections[ config.overlayName ];
}
Gossiperl.Client.Supervisor.prototype.subscribe = function(overlayName, events) {
  if ( this.isConnection( overlayName ) ) {
    this.connections[ overlayName ].state.subscribe( events );
  } else {
    throw new Error("[supervisor] No overlay connection: " + overlayName);
  }
}
Gossiperl.Client.Supervisor.prototype.unsubscribe = function(overlayName, events) {
  if ( this.isConnection( overlayName ) ) {
    this.connections[ overlayName ].state.unsubscribe( events );
  } else {
    throw new Error("[supervisor] No overlay connection: " + overlayName);
  }
}
Gossiperl.Client.Supervisor.prototype.send = function(overlayName, digestType, digestData) {
  if ( this.isConnection( overlayName ) ) {

  } else {
    throw new Error("[supervisor] No overlay connection: " + overlayName);
  }
}
Gossiperl.Client.Supervisor.prototype.read = function(digestType, binDigest, digestData) {
  
}
Gossiperl.Client.Supervisor.prototype.getCurrentState = function(overlayName) {
  if ( this.isConnection( overlayName ) ) {
    this.connections[ overlayName ].state.status;
  } else {
    throw new Error("[supervisor] No overlay connection: " + overlayName);
  }
}
Gossiperl.Client.Supervisor.prototype.getSubscriptions = function(overlayName) {
  if ( this.isConnection( overlayName ) ) {
    this.connections[ overlayName ].state.subscriptions;
  } else {
    throw new Error("[supervisor] No overlay connection: " + overlayName);
  }
}
Gossiperl.Client.Supervisor.prototype.getNumberOfConnections = function() {
  return _.keys(this.connections).length;
}
Gossiperl.Client.Supervisor.prototype.isConnection = function(overlayName) {
  return _.keys(this.connections).indexOf( overlayName ) > -1;
}
Gossiperl.Client.Supervisor.prototype.stop = function() {
  
}

/**
 * OVERLAY WORKER:
 */

Gossiperl.Client.OverlayWorker = function(supervisor, config, listener) {
  var defaultListener = function( e ) {
    switch (e.event) {
      case 'connected':
        console.log("[" + this.config.clientName + "] Connected to an overlay.");
        break;
      case 'disconnected':
        console.log("[" + this.config.clientName + "] Disconnected from an overlay.");
        break;
      case 'subscribed':
        console.log("[" + this.config.clientName + "] Subscribed to events: " + e.events + ".");
        break;
      case 'unsubscribed':
        console.log("[" + this.config.clientName + "] Unsubscribed from events: " + e.events + ".");
        break;
      case 'event':
        console.log("[" + this.config.clientName + "] Received member related event. Event type " + e.type + ", member " + e.member + ", heartbeat: " + e.heartbeat + ".");
        break;
      case 'forwardedAck':
        console.log("[" + this.config.clientName + "] Received confirmation of forwarded message. Message ID: " + e.replyId + ".");
        break;
      case 'forwarded':
        console.log("[" + this.config.clientName + "] Received forwarded digest " + e.binEnvelope + " of type " + e.digestType + " with ID " + e.envelopeId + ".");
        break;
      case 'failed':
        console.error("[" + this.config.clientName + "] Received a client error: " + e.error + ".");
        break;
      default:
        console.error("[" + this.config.clientName + "] Unsupported event: " + e + ".");
    }
  };
  this.supervisor = supervisor;
  this.config = config;
  this.listener = ( typeof(listener) === 'function' ? listener : defaultListener);
  this.messaging = new Gossiperl.Client.Messaging(this);
  this.state = new Gossiperl.Client.State(this);
  this.working = true;
  console.log("[" + config.clientName + "] Overlay worker initialised.");
};
Gossiperl.Client.OverlayWorker.prototype.start = function() {
  this.state.start();
}
Gossiperl.Client.OverlayWorker.prototype.stop = function() {
  if (this.messaging.digestExit()) {
    this.working = false;
    this.supervisor.disconnected( this.config );
  }
}

/**
 * STATE:
 */

Gossiperl.Client.StateStatus = {
  'DISCONNECTED': 'disconnected',
  'CONNECTED':    'connected'
};

Gossiperl.Client.State = function(worker) {
  this.subscriptions = [];
  this.worker = worker;
  this.status = Gossiperl.Client.StateStatus.DISCONNECTED;
  this.lastTs = null;
  console.log("[" + this.worker.config.clientName + "] State initialised.");
}
Gossiperl.Client.State.prototype.start = function() {
  var _$self = this;
  setTimeout(function() {
    var work = function() {
      this.sendDigest.apply(this);
      if ( Gossiperl.Client.Util.getTimestamp() - this.lastTs > 5 ) {
        if (this.status === Gossiperl.Client.StateStatus.CONNECTED) {
          this.worker.listener.apply(this.worker, [ {event: 'disconnected'} ]);
        }
        this.status = Gossiperl.Client.StateStatus.DISCONNECTED;
      }
    };
    var f = function(func) {
      work.apply(this);
      var _$self = this;
      if (this.worker.working) {
        setTimeout(function() {
          func.apply(_$self, [func]);
        }, 2000);
      } else {
        this.worker.listener.apply(this.worker, [ {event: 'disconnected'} ]);
      }
    };
    f.apply(_$self, [f]);
  }, 1000);  
};
Gossiperl.Client.State.prototype.digestAck = function(ack) {
  if ( this.status === Gossiperl.Client.StateStatus.DISCONNECTED ) {
    this.worker.listener.apply(this.worker, [ {event: 'connected'} ]);
    if ( this.subscriptions.length > 0 ) {
      this.worker.messaging.digestSubscribe(this.subscriptions);
    }
  }
  this.status = Gossiperl.Client.StateStatus.CONNECTED;
  this.lastTs = ack.heartbeat;
}
Gossiperl.Client.State.prototype.sendDigest = function() {
  var digest = Gossiperl.Client.getAnnotatedDigest("Digest", {
    name: this.worker.config.clientName,
    port: this.worker.config.clientPort,
    heartbeat: Gossiperl.Client.Util.getTimestamp(),
    id: Gossiperl.Client.Util.getPseudoRandomMessageId(),
    secret: this.worker.config.clientSecret
  });
  this.worker.messaging.send( digest );
};
Gossiperl.Client.State.prototype.subscribe = function(events) {
  this.subscriptions = _.union( this.subscriptions, events );
  if ( this.status == Gossiperl.Client.StateStatus.CONNECTED ) {
    this.worker.messaging.digestSubscribe( events );
  }
  return this.subscriptions;
}
Gossiperl.Client.State.prototype.unsubscribe = function(events) {
  this.subscriptions = _.difference( this.subscriptions, events );
  if ( this.status == Gossiperl.Client.StateStatus.CONNECTED ) {
    this.worker.messaging.digestUnsubscribe( events );
  }
  return this.subscriptions;
}

/**
 * MESSAGING AND TRANSPORT:
 */

Gossiperl.Client.Messaging = function(worker) {
  this.worker = worker;
  this.transport = new Gossiperl.Client.Transport.Udp( this.worker );
  console.log("[" + this.worker.config.clientName + "] Messaging initialised.");
};
Gossiperl.Client.Messaging.prototype.digestAck = function(digest) {
  var ack = Gossiperl.Client.getAnnotatedDigest("DigestAck", {
    name: this.worker.config.clientName,
    secret: this.worker.config.clientSecret,
    reply_id: digest.id,
    heartbeat: Gossiperl.Client.Util.getTimestamp(),
    membership: []
  });
  this.send(ack);
};
Gossiperl.Client.Messaging.prototype.digestSubscribe = function(events) {
  var digest = Gossiperl.Client.getAnnotatedDigest("DigestSubscribe", {
    name: this.worker.config.clientName,
    secret: this.worker.config.clientSecret,
    id: Gossiperl.Client.Util.getPseudoRandomMessageId(),
    heartbeat: Gossiperl.Client.Util.getTimestamp(),
    event_types: events
  });
  this.send(digest);
};
Gossiperl.Client.Messaging.prototype.digestUnsubscribe = function(events) {
  var digest = Gossiperl.Client.getAnnotatedDigest("DigestUnsubscribe", {
    name: this.worker.config.clientName,
    secret: this.worker.config.clientSecret,
    id: Gossiperl.Client.Util.getPseudoRandomMessageId(),
    heartbeat: Gossiperl.Client.Util.getTimestamp(),
    event_types: events
  });
  this.send(digest);
};
Gossiperl.Client.Messaging.prototype.digestForwardedAck = function(replyId) {
  var digest = Gossiperl.Client.getAnnotatedDigest("DigestForwardedAck", {
    name: this.worker.config.clientName,
    secret: this.worker.config.clientSecret,
    reply_id: replyId
  });
  this.send(digest);
};
Gossiperl.Client.Messaging.prototype.digestExit = function() {
  var digest = Gossiperl.Client.getAnnotatedDigest("DigestExit", {
    name: this.worker.config.clientName,
    secret: this.worker.config.clientSecret,
    heartbeat: Gossiperl.Client.Util.getTimestamp()
  });
  this.send(digest);
  return true;
};
Gossiperl.Client.Messaging.prototype.send = function(digest) {
  this.transport.send( digest );
};
Gossiperl.Client.Messaging.prototype.receive = function(digest) {
  if ( digest.__annotated_type === 'Digest' ) {
    this.digestAck( digest );
  } else if ( digest.__annotated_type === 'DigestEvent' ) {
    this.worker.listener.apply(this.worker, [ { event: 'event',
                                                type: digest.event_type,
                                                member: digest.event_object,
                                                heartbeat: digest.heartbeat } ]);
  } else if ( digest.__annotated_type === 'DigestAck' ) {
    this.worker.state.digestAck( digest );
  } else if ( digest.__annotated_type === 'DigestSubscribeAck' ) {
    this.worker.listener.apply(this.worker, [ { event: 'subscribed',
                                                events: digest.event_types,
                                                heartbeat: digest.heartbeat } ]);
  } else if ( digest.__annotated_type === 'DigestUnsubscribeAck' ) {
    this.worker.listener.apply(this.worker, [ { event: 'unsubscribed',
                                                events: digest.event_types,
                                                heartbeat: digest.heartbeat } ]);
  } else if ( digest.__annotated_type === 'DigestForwardedAck' ) {
    this.worker.listener.apply(this.worker, [ { event: 'forwardedAck',
                                                replyId: digest.reply_id } ]);
  }
}
Gossiperl.Client.Messaging.prototype.receiveForward = function(forwardData) {
  this.worker.listener.apply( this.worker, [ { event: 'forwarded',
                                               binEnvelope: forwardData.envelope,
                                               envelopeId: forwardData.id,
                                               digestType: forwardData.type } ] );
  this.digestForwardedAck( forwardData.id );
}

Gossiperl.Client.Transport.Udp = function(worker) {
  this.worker = worker;
  this.serializer = new Gossiperl.Client.Serialization.Serializer();
  this.encryption = new Gossiperl.Client.Encryption.Aes256( this.worker.config.symmetricKey );
  this.setup();
  this.socketId = null;
  console.log("[" + this.worker.config.clientName + "] UDP transport initialised.");
};
Gossiperl.Client.Transport.Udp.prototype.setup = function() {
  var _$self = this;
  chrome.sockets.udp.create({}, function(createInfo) {
    chrome.sockets.udp.bind(createInfo['socketId'], "127.0.0.1", _$self.worker.config.clientPort, function(result) {
      if (result >= 0) {
        console.log("UDP socket bound to 127.0.0.1:" + _$self.worker.config.clientPort);
        _$self.socketId = createInfo['socketId'];
        chrome.sockets.udp.onReceive.addListener(function(incomingInfo) {
          if (incomingInfo.socketId === _$self.socketId) {
            try {
              var receivedData = String.fromCharCode.apply(null, new Uint8Array(incomingInfo.data));
              try {
                var decrypted = _$self.encryption.decrypt( receivedData );
                try {
                  var deserialized = _$self.serializer.deserialize( decrypted );
                  if ( typeof(deserialized.__annotated_type) !== 'undefined' ) {
                    _$self.worker.messaging.receive( deserialized );
                  } else {
                    _$self.worker.messaging.receiveForward( deserialized );
                  }
                } catch (e) {
                  _$self.worker.listener.apply(_$self.worker, [ { event: 'failed', error: { reason: e, detail: 'Error while deserializing digest.' } } ]);
                }
              } catch (e) {
                _$self.worker.listener.apply(_$self.worker, [ { event: 'failed', error: { reason: e, detail: 'Error while decrypting digest.' } } ]);
              }
            } catch (e) {
              _$self.worker.listener.apply(_$self.worker, [ { event: 'failed', error: { reason: e, detail: 'Error while receiving the data.' } } ]);
            }
          }
        });
        chrome.sockets.udp.onReceiveError.addListener(function(errorInfo) {
          _$self.worker.listener.apply(_$self.worker, [ { event: 'failed', error: { reason: errorInfo, detail: 'Socket error.' } } ]);
        });
      } else {
        console.error("Could not bind UDP socket to 127.0.0.1:" + _$self.worker.config.clientPort);
      }
    });
  });
};
Gossiperl.Client.Transport.Udp.prototype.send = function(digest) {
  var serialized = this.serializer.serialize( digest );
  var encrypted  = this.encryption.encrypt( serialized );
  var buf = new ArrayBuffer(encrypted.length);
  var bufView = new Uint8Array(buf);
  for ( var i=0; i<encrypted.length; i++ ) {
    bufView[i] = encrypted.charCodeAt(i);
  }
  var _$self = this;
  chrome.sockets.udp.send(this.socketId, buf, "127.0.0.1", this.worker.config.overlayPort, function(sendInfo) {
    if ( sendInfo.resultCode < 0 ) {
      _$self.worker.listener.apply(_$self.worker, [ { event: 'failed', error: { reason: sendInfo, detail: 'Digest not sent.' } } ]);
    }
  });
};

/**
 * SERIALIZER:
 */

Gossiperl.Client.Serialization.Serializer = function() {
  this.Type = {
    'DIGEST_ERROR': 'digestError',
    'DIGEST_FORWARDED_ACK': 'digestForwardedAck',
    'DIGEST_ENVELOPE': 'digestEnvelope',
    'DIGEST': 'digest',
    'DIGEST_ACK': 'digestAck',
    'DIGEST_SUBSCRIPTIONS': 'digestSubscriptions',
    'DIGEST_EXIT': 'digestExit',
    'DIGEST_SUBSCRIBE': 'digestSubscribe',
    'DIGEST_SUBSCRIBE_ACK': 'digestSubscribeAck',
    'DIGEST_UNSUBSCRIBE': 'digestUnsubscribe',
    'DIGEST_UNSUBSCRIBE_ACK': 'digestUnsubscribeAck',
    'DIGEST_EVENT': 'digestEvent'
  }
};

Gossiperl.Client.Serialization.Serializer.prototype.serialize = function(annotatedDigest) {
  var digestType = Gossiperl.Client.Util.lCaseFirst( annotatedDigest.__annotated_type );
  if (digestType == "digestEnvelope") {
    return annotatedDigest;
  }
  var serialized = this.digestToBinary( annotatedDigest );
  var base64encoded = CryptoJS.enc.Base64.stringify(
                        Gossiperl.Client.Util.toCryptoJSWordArray( serialized )
                      );
  var envelope = Gossiperl.Client.getAnnotatedDigest("DigestEnvelope", {
    payload_type: digestType,
    bin_payload: base64encoded,
    id: Gossiperl.Client.Util.getPseudoRandomMessageId()
  });
  return this.digestToBinary( envelope );
};

Gossiperl.Client.Serialization.Serializer.prototype.deserialize = function(binDigest) {
  var envelope = this.digestFromBinary( "DigestEnvelope", binDigest );
  if ( this.isGossiperlDigest( envelope.payload_type ) ) {
    var digestType = Gossiperl.Client.Util.uCaseFirst( envelope.payload_type );
    var rawDecoded = atob(envelope.bin_payload);
    var buf = Gossiperl.Client.Util.stringToByteArray(rawDecoded);
    var digest = this.digestFromBinary( digestType, buf );
    return digest;
  } else {
    return { forward: true, type: envelope.payload_type, envelope: binDigest, id: envelope.id };
  }
};

Gossiperl.Client.Serialization.Serializer.prototype.digestToBinary = function(digest) {
  var transport = new Thrift.TWebSocketTransport("http://dummy");
  var protocol  = new Thrift.BinaryProtocol( transport );
  try {
    digest.write(protocol);
    return protocol.buffer;
  } catch (e) {
    console.log("[ERROR] : ", e)
  }
}

Gossiperl.Client.Serialization.Serializer.prototype.digestFromBinary = function(digestType, binDigest) {
  var transport = new Thrift.TWebSocketTransport("http://dummy");
  var protocol  = new Thrift.BinaryProtocol( transport );
  protocol.buffer = binDigest;
  var digest = Gossiperl.Client.getAnnotatedDigest(digestType);
  try {
    digest.read(protocol);
    return digest;
  } catch (e) {
    console.log("[ERROR] : ", e)
  }
};

Gossiperl.Client.Serialization.Serializer.prototype.isGossiperlDigest = function(digest) {
  for (var key in this.Type) {
    if ( this.Type[key] === digest ) {
      return true;
    }
  }
  return false;
};

/**
 * ENCRYPTION:
 */

Gossiperl.Client.Encryption.Aes256 = function(symmetricKey) {
  this.key = CryptoJS.SHA256( symmetricKey );
};
Gossiperl.Client.Encryption.Aes256.prototype.encrypt = function(binary) {
  var wordArray = Gossiperl.Client.Util.toCryptoJSWordArray( binary );
  var iv = CryptoJS.lib.WordArray.random( 16 );
  var encrypted = CryptoJS.AES.encrypt( wordArray,
                                        this.key,
                                        { iv: iv, format: CryptoJS.format.OpenSSL } ).ciphertext;
  var ivStr = iv.toString(CryptoJS.enc.Latin1);
  return ivStr + encrypted.toString(CryptoJS.enc.Latin1);
};
Gossiperl.Client.Encryption.Aes256.prototype.decrypt = function(data) {
  var iv = data.substring(0,16);
  var encrypted = data.substr(16);
  var decrypted = CryptoJS.AES.decrypt( { ciphertext: CryptoJS.enc.Latin1.parse(encrypted) },
                                          this.key,
                                          { iv: CryptoJS.enc.Latin1.parse(iv), format: CryptoJS.format.OpenSSL, padding: CryptoJS.pad.NoPadding } ).toString(CryptoJS.enc.Latin1);
  return Gossiperl.Client.Util.stringToByteArray(decrypted);
};

/**
 * UTILITIES:
 */

Gossiperl.Client.Util = function() {}
Gossiperl.Client.Util.byteArrayToString = function(barr) {
  return String.fromCharCode.apply(null, barr);
};
Gossiperl.Client.Util.stringToByteArray = function(str) {
  var buf = [];
  for (var i=0; i<str.length; i++) {
    buf.push( str.charCodeAt(i) );
  }
  return buf;
};
Gossiperl.Client.Util.toCryptoJSWordArray = function(bArr) {
  var words = [];
  for (var i = 0; i < bArr.length; i++) {
    words[i >>> 2] |= (bArr[i] & 0xff) << (24 - (i % 4) * 8);
  }
  return new CryptoJS.lib.WordArray.init(words, bArr.length);
};
Gossiperl.Client.Util.lCaseFirst = function(str) {
  return str.substring(0,1).toLowerCase() + str.substring(1,str.length);
};
Gossiperl.Client.Util.uCaseFirst = function(str) {
  return str.substring(0,1).toUpperCase() + str.substring(1,str.length);
};
Gossiperl.Client.Util.getTimestamp = function() {
  return parseInt(Date.now()/1000);
};
Gossiperl.Client.Util.getPseudoRandomMessageId = function() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
    return v.toString(16);
  });
};

Gossiperl.Client.getAnnotatedDigest = function(name, args) {
  var cls = window["Gossiperl"]["Client"]["Thrift"][name];
  if (typeof cls === "function") {
    var options = args || {};
    var inst = new cls( options );
    inst.__annotated_type = name;
    return inst;
  } else {
    throw new Error("Digest " + name + " does not exist.");
  }
};
