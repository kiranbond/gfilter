// Starts by looking at emails already labeled with ROOT_LABEL/CURRENT_LABEL
// and based on filter conditions, labels them with filter.name.
// Processed emails are labeled with ROOT_LABEL/PROCESSED_LABEL
// Filter conditions can be specified as body:regex, subject:regex or match:regex
// (match matches against whole raw text of the email message)
// Default action is to label with the "name" field of filter. 
// Additional supported actions that can be added as boolean true values-
// inbox: move back to inbox
// star: star the message
// markRead: mark the message as read
// archive: archive the message

var filters = [
  // RegEx match against the raw contents of the email
  { id:"MyName", name: "MyJIRA", body: /Kiran Bondalapati/, inbox: true }, 
  { id:"HOT-Issue", name: "MyJIRA", subject: /HOT-Issue/i, inbox: true }, 
];

var from = [
   "from:jira@domain.com",
  // "list:user@domain.com"
];
// Root filter where to apply the labels from filters above
var ROOT_LABEL = "Lists";
// Current folder to examine for threads and process them
var CURRENT_LABEL = "jira";
// label to apply to processed threads so it will not be found in query again
var PROCESSED_LABEL = "zzzz"

function labeler() {

  var batchSize = 100;
  var totalSize = 1000;

  var labelCache = {};
  var query = "label:" + ROOT_LABEL + "/" + CURRENT_LABEL + " -label:" + ROOT_LABEL + "/" + PROCESSED_LABEL;
  if (from.length > 0) {
    query += " AND (" + from.join(' OR ') + ")";
  }
  Logger.log("Query: ", query)
  
  var findOrCreateLabel = function(name) {
    if (labelCache[name] === undefined) {
      var labelObject = GmailApp.getUserLabelByName(name);
      if( labelObject ){
        labelCache[name] = labelObject;
      } else {
        labelCache[name] = GmailApp.createLabel(name);
        Logger.log("Created new label: [" + name + "]");
      }
    }
    return labelCache[name];
  }

  var applyLabel = function(name, thread){
    name = ROOT_LABEL + "/" + name;
    var label = null;
    var labelName = "";
    // create nested labels by parsing "/"
    name.split('/').forEach(function(labelPart, i) {
      labelName = labelName + (i===0 ? "" : "/") + labelPart.trim();
      label = findOrCreateLabel(labelName);
    });
    thread.addLabel(label);
  }

  threads = null;
  var count = 0;
  // Get threads in "pages" of 100 at a time
  while(count < totalSize) {
    threads = GmailApp.search(query, 0, batchSize);
    GmailApp.getMessagesForThreads(threads);
    Logger.log("Found #threads: ", threads.length);
    if (threads.length <= 0)
      break;
    count += threads.length;

    threads.forEach(function(thread) {
      var messages = thread.getMessages();
      if (messages == null) 
        return; // nothing to do

      var message = messages[messages.length - 1]; // most recent message
      var raw = message.getRawContent();
      var body = message.getBody();
      var subject = message.getSubject();
      Logger.log("Subject: " + subject);
      filters.forEach(function(filter){
        // Logger.log("Applying filter: " + filter.id);
        var matches;
        if (filter.subject) {
          filter.match = new RegExp(filter.subject);
          matches = filter.match.exec(subject);
        } else if (filter.body) {
          filter.match = new RegExp(filter.body);
          matches = filter.match.exec(body);
        } else if (filter.match != null) {
          filter.match = new RegExp(filter.match);
          matches = filter.match.exec(raw);
        }
        if (matches !== null) {
          Logger.log("found match for ", filter.id);
          // label will be regex match or name provided
          var label = filter.name || matches[1];
          if (label !== undefined) {
            applyLabel(label, thread);
          }

          // toggle flags
          if (filter.star) 
            message.star();
          if (filter.inbox) {
            thread.moveToInbox();
            Logger.log("Moving to inbox: ", subject);
          } else if (filter.archive)
            thread.archive();
          if (filter.markRead) 
            message.markRead();    
        }
      });
      applyLabel(PROCESSED_LABEL, thread);
    });
  }
}
