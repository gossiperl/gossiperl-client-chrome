$(document).ready(function() {

  $("#btn-tests").click(function() {
    var testSuite = new Gossiperl.Client.Tests.TestSuite();
    _.each(testSuite.getTests(), function(testName) {
      testSuite[ testName ].apply( testSuite );
    });
  });

});