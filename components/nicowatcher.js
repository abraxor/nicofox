/* vim: sw=2 ts=2 sts=2 et filetype=javascript 
 *
 * Use Content Policy to watch the download manager URL (?smilefox=get) or Nicowa (Used for Nicowa blocker)
 * Code originally referenced from IE tab & Greasemonkey
 */
const Cc = Components.classes;
const Ci = Components.interfaces;
const CONTRACT_ID = "@littleb.tc/nicowatcher;1";

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

function NicoWatcher() {
  this.wrappedJSObject = this;
}

NicoWatcher.prototype = {
  classDescription: "URL Loading Watcher for NicoFox",
  classID: Components.ID("62ca6b17-975f-4c70-b497-33146a16c797"),
  contractID: CONTRACT_ID,
  _xpcom_categories: [
    { category: "content-policy" },
    { category: "app-startup", service: true }
  ],
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIContentPolicy, Ci.nsIObserver, Ci.nsIWeakReference]),
  _nicowaBlocker: null,
  /* Implements nsIContentPolicy */
  shouldLoad: function(contentType, contentLocation, requestOrigin, requestingNode, mimeTypeGuess, extra) {
    if (contentType == Ci.nsIContentPolicy.TYPE_DOCUMENT) {
      var url = contentLocation.spec;
      /* Simplify the filter code to make it faster (don't check Nicovideo URL here) */
      if (url.search(/\?smilefox\=get$/) != -1) {
        var winWat = Cc["@mozilla.org/embedcomp/window-watcher;1"].getService(Ci.nsIWindowWatcher);
        if (winWat.activeWindow && winWat.activeWindow.nicofox_ui && winWat.activeWindow.nicofox_ui.overlay) {
          /* We have no setTimeout(), so... */
          var timer_event = { notify: function () {winWat.activeWindow.nicofox_ui.overlay.goDownload(url);} }
          var timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
          timer.initWithCallback(timer_event, 10, Ci.nsITimer.TYPE_ONE_SHOT);
        }
        
        return Ci.nsIContentPolicy.REJECT_REQUEST;
      }
    /* Block NicoWa if needed */
    } else if (contentType == Ci.nsIContentPolicy.TYPE_OBJECT_SUBREQUEST) {
      var url = contentLocation.spec;
      if(this._nicowaBlocker && url.indexOf('http://flapi.nicovideo.jp/api/getmarqueev3') == 0 ) {
        return Ci.nsIContentPolicy.REJECT_REQUEST;
      }
    }
   return Ci.nsIContentPolicy.ACCEPT;
  },
  // this is now for urls that directly load media, and meta-refreshes (before activation)
  shouldProcess: function(contentType, contentLocation, requestOrigin, requestingNode, mimeType, extra) {
    return Ci.nsIContentPolicy.ACCEPT;
  },
  /* Implements nsIObserver */
  observe: function(subject, topic, data) {
    /* In app-startup, profiles are unavailable */
    if (topic == "app-startup") {
      var obs = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
      obs.addObserver(this, "final-ui-startup", false);
      obs.addObserver(this, "quit-application", false);
      return;
    }
    /* In Startup or pref changed, cache the value of nicowa_blocker (avoid pref access in shouldLoad) */
    Components.utils.import("resource://nicofox/Core.jsm");
    switch(topic) {
      case "final-ui-startup":
      var obs = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
      obs.removeObserver(this, "final-ui-startup");
      Core.prefs.addObserver("nicowa_blocker", this, false);
      this._nicowaBlocker = Core.prefs.getBoolPref("nicowa_blocker");
      break;
      
      case "nsPref:changed":
      this._nicowaBlocker = Core.prefs.getBoolPref("nicowa_blocker");
      break;
      
      case "quit-application":
      Components.utils.import("resource://nicofox/Services.jsm");
      Services.obs.removeObserver(this, "quit-application")
      Core.prefs.removeObserver("nicowa_blocker", this);
      break;
    }
  }
}

function NSGetModule(compMgr, fileSpec) {
  return XPCOMUtils.generateModule([NicoWatcher]);
}
