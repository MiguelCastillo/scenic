// Taken from https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener

(function() {
  if (!Event.prototype.preventDefault) {
    Event.prototype.preventDefault=function() {
      this.returnValue=false;
    };
  }
  if (!Event.prototype.stopPropagation) {
    Event.prototype.stopPropagation=function() {
      this.cancelBubble=true;
    };
  }
  if (!Element.prototype.addEventListener) {
    var eventListeners=[];

    var addEventListener=function(type,listener /*, useCapture (will be ignored) */) {
      var self=this;
      var wrapper=function(e) {
        e.target=e.srcElement;
        e.currentTarget=self;
        if (listener.handleEvent) {
          listener.handleEvent(e);
        } else {
          listener.call(self,e);
        }
      };
      if (type=="DOMContentLoaded") {
        var wrapper2=function(e) {
          if (document.readyState=="complete") {
            wrapper(e);
          }
        };
        document.attachEvent("onreadystatechange",wrapper2);
        eventListeners.push({object:this,type:type,listener:listener,wrapper:wrapper2});

        if (document.readyState=="complete") {
          var e=new Event();
          e.srcElement=window;
          wrapper2(e);
        }
      } else {
        this.attachEvent("on"+type,wrapper);
        eventListeners.push({object:this,type:type,listener:listener,wrapper:wrapper});
      }
    };
    var removeEventListener=function(type,listener /*, useCapture (will be ignored) */) {
      var counter=0;
      while (counter<eventListeners.length) {
        var eventListener=eventListeners[counter];
        if (eventListener.object==this && eventListener.type==type && eventListener.listener==listener) {
          if (type=="DOMContentLoaded") {
            this.detachEvent("onreadystatechange",eventListener.wrapper);
          } else {
            this.detachEvent("on"+type,eventListener.wrapper);
          }
          eventListeners.splice(counter, 1);
          break;
        }
        ++counter;
      }
    };
    Element.prototype.addEventListener=addEventListener;
    Element.prototype.removeEventListener=removeEventListener;
    if (HTMLDocument) {
      HTMLDocument.prototype.addEventListener=addEventListener;
      HTMLDocument.prototype.removeEventListener=removeEventListener;
    }
    if (Window) {
      Window.prototype.addEventListener=addEventListener;
      Window.prototype.removeEventListener=removeEventListener;
    }
  }
})();

export class Subscription {
  constructor(target, events = {}) {
    this._el = target;
    this._events = {};

    for (var event in events) {
      this.on(event, events[event]);
    }
  }

  on(evts) {
    var fn, evtName, handlers;
    evts = evtsObject(...arguments);

    for (var evt in evts) {
      evtName = evt;
      fn = evts[evtName];

      if (!this._events[evtName]) {
        this._events[evtName] = [];
      }

      handlers = this._events[evtName];
      if (!(~handlers.indexOf(fn))) {
        handlers.push(fn);
        this._el.addEventListener(evtName, fn);
      }
    }

    return this;
  }

  off(evts) {
    var fn, evtName, handlers;
    evts = evtsObject(...arguments);

    for (var evt in evts) {
      evtName = evt;

      handlers = this._events[evtName];
      if (handlers && ~handlers.indexOf(fn)) {
        handlers.splice(handlers.indexOf(fn), 1);
        this._el.removeEventListener(evtName, fn);
      }
    }

    return this;
  }

  static create(target, options = {}) {
    return new Subscription(target, options);
  }
}

function evtsObject(evts) {
  var fn, evtName;

  // Handle passing in an event name and function handler as arguments instead
  // of an object literal
  if (typeof(evts) === "string") {
    evtName = arguments[0];
    fn = arguments[1];

    evts = {
      [evtName]: fn
    };
  }

  return evts;
}
