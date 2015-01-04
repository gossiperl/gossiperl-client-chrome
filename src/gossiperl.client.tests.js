
if (typeof Gossiperl === 'undefined') {
  Gossiperl = {};
}
if (typeof Gossiperl.Client === 'undefined') {
  Gossiperl.Client = {};
}
if (typeof Gossiperl.Client.Tests === 'undefined') {
  Gossiperl.Client.Tests = {};
}

Gossiperl.Client.Tests.TestSuite = function() {
  
}
Gossiperl.Client.Tests.TestSuite.prototype.getTests = function() {
  return "testSerializeDeserialize".split(",");
};
Gossiperl.Client.Tests.TestSuite.prototype.testSerializeDeserialize = function() {

  
  
}
Gossiperl.Client.Tests.TestSuite.prototype.testSerializeDeserializeWithEncryption = function() {
  var digest = new Gossiperl.Client.Thrift.Digest({
    name: "chrome-test-client",
    port: 54321,
    heartbeat: Gossiperl.Client.Util.getTimestamp(),
    id: Gossiperl.Client.Util.getPseudoRandomMessageId(),
    secret: "chrome-client-secret"
  });
  console.log(digest);
}