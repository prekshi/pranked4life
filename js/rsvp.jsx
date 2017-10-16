
function makeRSVPRequest(path, data, callback) {
  var httpRequest = new XMLHttpRequest();
  httpRequest.open("POST", path);
  httpRequest.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
  httpRequest.send(JSON.stringify(data));
  httpRequest.onreadystatechange = function(){
    if (httpRequest.readyState === XMLHttpRequest.DONE) {
      try {
        if (httpRequest.status === 200) {
          callback(null, JSON.parse(httpRequest.responseText))
        } else {
          var response = JSON.parse(httpRequest.responseText);
          callback(new Error(response.error || httpRequest.responseText));
        }
      } catch( e ) {
        callback(new Error(e.message + ". Server response: " + httpRequest.responseText + " (" + httpRequest.status + ")"));
      }
    }
  }
}

var RSVPButton = React.createClass({
  render: function() {
    return (
      <div className="rsvp-actions" style={this.props.containerStyle}>
        <button className={"rsvp-button " + this.props.className} style={this.props.style} onClick={this.props.onClick} disabled={this.props.loading}>
          <div className={ this.props.loading ? "spinner-container visible" : "spinner-container"}><div className="spinner"></div></div>
          {this.props.label}
        </button>
      </div>
    );
  }
});

var RSVPError = React.createClass({
  render: function() {
    if (this.props.error) {
      return (<p className="rsvp-error">{this.props.error}</p>)
    } else {
      return (<p className="rsvp-message">{this.props.initial}</p>)
    }
  }
});

var RSVPRoot = React.createClass({
  displayName: 'RSVPRoot',

  getInitialState: function() {
    return {step: 1};
  },

  componentDidUpdate: function(prevProps, prevState) {
    var input = ReactDOM.findDOMNode(this).querySelector('input');
    if (input && prevState.step !== this.state.step) {
      input.focus();
    }
  },

  getGuestKnownNames: function() {
    if (this.state.guest.name.indexOf('Family') > 0) {
      return [];
    }

    var names = this.state.guest.name.replace(/&/g, " and ").replace(/,/g, " and ").replace(/\+/g, " and ").split(" and ");
    var final = [];

    if (names[names.length - 1].toLowerCase() === 'guest') {
      names.pop();
    }

    var lastname = null;
    for (var x = 0; x < names.length; x ++) {
      if (names[x].split(' ').length > 1) {
        lastname = names[x].split(' ').pop();
        break;
      }
    }

    for (var ii = 0; ii < names.length; ii ++) {
      if ((names[ii].split(' ').length === 1) && lastname) {
        // try to find a name with a last name
        names[ii] = names[ii] + " " + lastname;
      }
      names[ii] = names[ii].trim();
    }
    return names;
  },

  onLookupRSVP: function(event) {
    event.preventDefault();

    var value = ReactDOM.findDOMNode(this.refs.name).value;

    this.setState({loading: true});
    makeRSVPRequest('/rsvp/lookup', {search: value}, (err, results) => {
      if (err) {
        this.setState({loading: false, error: err.message});
      } else if (results.length === 0) {
        this.setState({loading: false, error: "Sorry, we couldn't find you on the guest list. Try searching by your first name or last name only, or contact Preethi directly at preethir1989@gmail.com."});
      } else if (results.length > 3) {
        this.setState({loading: false, error: "Sorry, we couldn't find you on the guest list. Try searching by your full name, or contact Preethi directly at preethir1989@gmail.com."});
      } else {
        var nextStep = (results.length === 1) ? 3 : 2;
        this.setState({loading: false, guests: results, guest: results[0], step: nextStep, error: null});
      }
    });
  },

  onSelectGuest: function(guest) {
    this.setState({step: this.state.step + 1, guest: guest});
  },

  onWillAttend: function(attending) {
    if (attending) {
      this.setState({step: this.state.step + 1});
    } else {
      var guest = this.state.guest;
      guest.attending = {
        rehearsal: 0,
        wedding: 0,
      }
      this.setState({loading: true, guest: guest});
      this.onSubmit();
    }
  },

  onConfirmHeadCount: function(event) {
    event.preventDefault();

    var guest = this.state.guest;
    var rehearsalEl = ReactDOM.findDOMNode(this.refs.rehearsal)
    var weddingEl = ReactDOM.findDOMNode(this.refs.wedding)

    guest.attending = {
      rehearsal: rehearsalEl ? rehearsalEl.value : 0,
      wedding: weddingEl ? weddingEl.value : 0,
    }

    if (guest.attending.rehearsal > guest.invited.rehearsal) {
      this.setState({error: "Please enter a maximum of " + guest.invited.rehearsal + " guests for the rehearsal dinner."});
      return;
    }
    if (guest.attending.wedding > guest.invited.wedding) {
      this.setState({error: "Please enter a maximum of " + guest.invited.wedding + " guests for the wedding."});
      return;
    }
    if (guest.attending.wedding === "") {
      this.setState({error: "Please indicate whether you'll be able to attend the wedding."});
      return;
    }

    var knownNames = this.getGuestKnownNames();
    guest.guestInfo.rehearsal = knownNames.slice(0, Math.max(knownNames.length, guest.attending.rehearsal))
    guest.guestInfo.wedding = knownNames.slice(0, Math.max(knownNames.length, guest.attending.wedding))
    this.setState({guest: guest, step: this.state.step + 1, error: null});
  },

  onConfirmNames: function(event) {
    if (event) {
      event.preventDefault();
    }

    var guest = this.state.guest;
    var phoneEl = ReactDOM.findDOMNode(this.refs.phone)
    var emailEl = ReactDOM.findDOMNode(this.refs.email)
    if (phoneEl) { guest.phone = phoneEl.value; }
    if (emailEl) { guest.email = emailEl.value; }

    guest.guestInfo.rehearsal = [];
    guest.guestInfo.wedding = [];

    let rehearsalGuestEls = ReactDOM.findDOMNode(this).querySelectorAll('.rehearsalGuest');
    let rehearsalGuestFoodEls = ReactDOM.findDOMNode(this).querySelectorAll('.rehearsalGuestFood');
    for (var ii = 0; ii < rehearsalGuestEls.length; ii ++) {
      guest.guestInfo.rehearsal.push(rehearsalGuestEls[ii].value + " (" + rehearsalGuestFoodEls[ii].value + ")");
    }

    let weddingGuestEls = ReactDOM.findDOMNode(this).querySelectorAll('.weddingGuest');
    for (var ii = 0; ii < weddingGuestEls.length; ii ++) {
      guest.guestInfo.wedding.push(weddingGuestEls[ii].value);
    }
    this.setState({guest: guest, step: this.state.step + 1});
  },

  onSubmit: function(event) {
    if (event) {
      event.preventDefault();
    }

    var guest = this.state.guest;
    var commentsEl = ReactDOM.findDOMNode(this.refs.comments);
    if (commentsEl) {
      guest.comments = commentsEl.value
    }

    this.setState({loading: true, guest: guest});
    makeRSVPRequest('/rsvp/update', guest, (err, results) => {
      if (err) {
        this.setState({loading: false, error: err.message});
      } else {
        this.setState({loading: false, step: 7, error: null});
      }
    });
  },

  onBack: function() {
    this.setState({step: this.state.step - 1, error: null});
  },

  onClose: function() {

  },

  render: function() {
    var {step, error, loading, guest, guests} = this.state;

    if (step === 1) {
      return (
        <div>
          <RSVPError
            initial={"Enter your first and last name to find yourself on the guest list!"}
            error={error}
          />
          <form onSubmit={this.onLookupRSVP}>
            <div className="rsvp-form">
              <input type="text" id="rsvp-name" ref="name" autocomplete="off" />
              <RSVPButton onClick={this.onLookupRSVP} label='SEARCH' loading={this.state.loading} />
            </div>
          </form>
        </div>
      );
    } else if (step === 2) {
      return (
        <div>
          <a onClick={this.onBack} className="rsvp-back">◀ Back</a>
          <RSVPError initial="Select your name from the list below, or click Back to search again:" />
          <form>
            <ul>
              {guests.map((guest) =>
                <li key={guest.row} onClick={() => this.onSelectGuest(guest)}>{guest.name}</li>
              )}
            </ul>
          </form>
        </div>
      );
    } else if (step === 3) {
      return (
        <div>
          <a onClick={this.onBack} className="rsvp-back">◀ Back</a>
          <RSVPError initial={`Welcome ${guest.name}! Will you be able to attend this August?`} />
          <div style={{textAlign: 'center'}}>
            <RSVPButton className="white" style={{width: '100%'}} onClick={() => this.onWillAttend(true) } label='Accept with 🎉' containerStyle={{paddingBottom: 0}} />
            <RSVPButton className="white" style={{width: '100%'}} onClick={() => this.onWillAttend(false)} label='Decline with 😓' loading={loading} />
          </div>
        </div>
      );
    } else if (step === 4) {
      var fields = (
        <input ref="wedding" type="number" />
      );

      if (guest.invited.rehearsal > 0) {
        fields = (
          <div>
            <label>Rehearsal Dinner (Friday, August 19th)</label>
            <input ref="rehearsal" type="number" />
            <label>Wedding (Saturday, August 20th)</label>
            <input ref="wedding" type="number" />
          </div>
        )
      }

      return (
        <div>
          <a onClick={this.onBack} className="rsvp-back">◀ Back</a>
          <RSVPError
            initial={`How many people in your party will be attending? (Up to ${guest.invited.wedding})`}
            error={error}
          />
          <form onSubmit={this.onConfirmHeadCount}>
            {fields}
            <RSVPButton onClick={this.onConfirmHeadCount} label='CONTINUE' loading={loading} />
          </form>
        </div>
      );

    } else if (step === 5) {
      var fields = [];
      var namesKnown = this.getGuestKnownNames().length;

      if (guest.attending.rehearsal > 0) {
        var guestTerm = guest.attending.rehearsal > 1 ? 'Guests' : 'Guest';
        fields.push(<label key="rehearsal-label">{guestTerm + ' attending the rehearsal dinner:'}</label>)
        for (var ii = 0; ii < guest.attending.rehearsal; ii ++) {
          var name = guest.guestInfo.rehearsal[ii] || "";
          var match = /(.*)\((\w)\)/.exec(name);
          var food = "C";
          if (match) {
            name = match[1]
            food = match[2]
          }
          fields.push(
            <input key={"rehearsal"+ii} className={"rehearsalGuest"} type="text" autocomplete="off" defaultValue={name} />
          )
          fields.push(
            <select key={"rehearsalFood"+ii} className={"rehearsalGuestFood"} defaultValue={food} >
              <option value="L">Lamb</option>
              <option value="F">Fish</option>
              <option value="V">Vegetarian</option>
            </select>
          )
        }
      }
      if (guest.attending.wedding > 0) {
        if (guest.invited.rehearsal > 0) {
          fields.push(<label key="wedding-label">{'Guests attending the wedding:'}</label>)
        } else if (guest.attending.wedding > 1) {
          fields.push(<label key="wedding-label">{"Guests' names:"}</label>)
        } else {
          fields.push(<label key="wedding-label">{"Guest name:"}</label>)
        }
        for (var ii = 0; ii < guest.attending.wedding; ii++) {
          var name = guest.guestInfo.wedding[ii] || "";
          fields.push(<input key={"wedding"+ii} className={"weddingGuest"} type="text" autocomplete="off" defaultValue={name} />)
        }
      }

      if (!guest.phonePresent) {
        fields.push(<label key="phone-label">Phone Number</label>)
        fields.push(<input key="phone" ref="phone" type="text" />)
      }
      if (!guest.emailPresent) {
        fields.push(<label key="email-label">Email Address</label>)
        fields.push(<input key="email" ref="email" type="text" />)
      }

      return (
        <div>
          <a onClick={this.onBack} className="rsvp-back">◀ Back</a>
          <RSVPError
            initial={"Thanks! Please fill in the information below to complete your RSVP."}
          />
        <form onSubmit={this.onConfirmNames}>
            <div>{fields}</div>
            <RSVPButton onClick={this.onConfirmNames} label='CONTINUE' loading={loading} />
          </form>
        </div>
      );
    } else if (step === 6) {
      return (
        <div>
          <a onClick={this.onBack} className="rsvp-back">◀ Back</a>
          <RSVPError
            initial={"Any other dietary restrictions or comments?"}
            error={error}
          />
          <form onSubmit={this.onSubmit}>
            <textarea ref="comments" style={{width:'100%', height: 50, fontSize: 16}}></textarea>
            <RSVPButton onClick={this.onSubmit} label='FINISH' loading={loading} />
          </form>
        </div>
      );

    } else if (step === 7) {
      var msg = guest.attending.wedding > 0 ? "That's all we need to complete your RSVP - check out the rest of the site for travel, accommodations, and registry info. See you in August!" : "That's all we need to complete your RSVP!";
      return (
        <div>
          <form>
            {msg}
          </form>
          <RSVPButton onClick={onHideRSVP} label='CLOSE' />
        </div>
      );
    }
  },
});

ReactDOM.render(
  <RSVPRoot />,
  document.getElementById('rsvp-container')
);
