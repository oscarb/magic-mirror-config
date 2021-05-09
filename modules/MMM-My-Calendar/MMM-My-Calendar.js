/* global Module */

/* Magic Mirror
 * Module: Calendar
 *
 * By Michael Teeuw http://michaelteeuw.nl
 * MIT Licensed.
 */

Module.register("MMM-My-Calendar", {

	// Define module defaults
	defaults: {
		maximumEntries: 10, // Total Maximum Entries
		maximumNumberOfDays: 365,
		displaySymbol: true,
		defaultSymbol: "calendar", // Fontawesome Symbol see https://fontawesome.com/cheatsheet?from=io
		showLocation: false,
		displayRepeatingCountTitle: false,
		defaultRepeatingCountTitle: "",
		maxTitleLength: 25,
		maxLocationTitleLength: 25,
		wrapEvents: false, // wrap events to multiple lines breaking at maxTitleLength
		wrapLocationEvents: false,
		maxTitleLines: 3,
		maxEventTitleLines: 3,
		fetchInterval: 5 * 60 * 1000, // Update every 5 minutes.
		animationSpeed: 2000,
		fade: true,
		urgency: 7,
		timeFormat: "relative",
		dateFormat: "MMM Do",
		dateEndFormat: "LT",
		fullDayEventDateFormat: "MMM Do",
		showEnd: false,
		getRelative: 6,
		fadePoint: 0.25, // Start on 1/4th of the list.
		hidePrivate: false,
		hideOngoing: false,
		colored: false,
		coloredSymbolOnly: false,
		tableClass: "small",
		numberOfDays: 7,
		calendars: [
			{
				symbol: "calendar",
				url: "https://www.calendarlabs.com/templates/ical/US-Holidays.ics"
			}
		],
		titleReplace: {
			"De verjaardag van ": "",
			"'s birthday": ""
		},
		locationTitleReplace: {
			"street ": ""
		},
		broadcastEvents: true,
		excludedEvents: [],
		sliceMultiDayEvents: false,
		broadcastPastEvents: true,
		nextDaysRelative: false
	},

	// Define required scripts.
	getStyles: function () {
		return ["calendar.css", "font-awesome.css"];
	},

	// Define required scripts.
	getScripts: function () {
		return ["moment.js"];
	},

	// Define required translations.
	getTranslations: function () {
		// The translations for the default modules are defined in the core translation files.
		// Therefor we can just return false. Otherwise we should have returned a dictionary.
		// If you're trying to build your own module including translations, check out the documentation.
		return false;
	},

	// Override start method.
	start: function () {
		Log.log("Starting module: " + this.name);

		// Set locale.
		moment.updateLocale(config.language, this.getLocaleSpecification(config.timeFormat));

		this.fetchSwedishDays();

		for (var c in this.config.calendars) {
			var calendar = this.config.calendars[c];
			calendar.url = calendar.url.replace("webcal://", "http://");

			var calendarConfig = {
				maximumEntries: calendar.maximumEntries,
				maximumNumberOfDays: calendar.maximumNumberOfDays,
				broadcastPastEvents: calendar.broadcastPastEvents
			};
			if (calendar.symbolClass === "undefined" || calendar.symbolClass === null) {
				calendarConfig.symbolClass = "";
			}
			if (calendar.titleClass === "undefined" || calendar.titleClass === null) {
				calendarConfig.titleClass = "";
			}
			if (calendar.timeClass === "undefined" || calendar.timeClass === null) {
				calendarConfig.timeClass = "";
			}

			// we check user and password here for backwards compatibility with old configs
			if (calendar.user && calendar.pass) {
				Log.warn("Deprecation warning: Please update your calendar authentication configuration.");
				Log.warn("https://github.com/MichMich/MagicMirror/tree/v2.1.2/modules/default/calendar#calendar-authentication-options");
				calendar.auth = {
					user: calendar.user,
					pass: calendar.pass
				};
			}

			this.addCalendar(calendar.url, calendar.auth, calendarConfig);

			// Trigger ADD_CALENDAR every fetchInterval to make sure there is always a calendar
			// fetcher running on the server side.
			var self = this;
			setInterval(function () {
				self.addCalendar(calendar.url, calendar.auth, calendarConfig);
			}, self.config.fetchInterval);
		}

		this.calendarData = {};
		this.swedishDays = {};
		this.loaded = false;
	},

	// Override socket notification handler.
	socketNotificationReceived: function (notification, payload) {
		if (notification !== "SWEDISH_DAYS" && this.identifier !== payload.id) {
			return;
		}

		if (notification === "CALENDAR_EVENTS") {
			if (this.hasCalendarURL(payload.url)) {
				this.calendarData[payload.url] = payload.events;
				this.loaded = true;

				if (this.config.broadcastEvents) {
					this.broadcastEvents();
				}
			}
		} else if (notification === "SWEDISH_DAYS") {
			this.swedishDays = payload.data
		} else if (notification === "FETCH_ERROR") {
			Log.error("Calendar Error. Could not fetch calendar: " + payload.url);
			this.loaded = true;
		} else if (notification === "INCORRECT_URL") {
			Log.error("Calendar Error. Incorrect url: " + payload.url);
		} else {
			Log.log("Calendar received an unknown socket notification: " + notification);
		}

		this.updateDom(this.config.animationSpeed);
	},

	// Override dom generator.
	getDom: function () {
		
		var events = this.createEventList();
		var wrapper = document.createElement("table");
		wrapper.className = this.config.tableClass;

		// Begin WEEKLY TABLE
		var dayHeaderRow = document.createElement("tr");

		let startDay = moment();
		let lastDay = startDay.clone().add(this.config.numberOfDays, 'days');

		while (!startDay.isSame(lastDay)) {
			let header = document.createElement("th")

			let dayOfYear = startDay.dayOfYear() - 1;

			if (this.swedishDays.dagar !== undefined && this.swedishDays.dagar[dayOfYear]["röd dag"] === "Ja") {
				header.className = "redDay"
			}

			var swedishFlag = '';

			if (this.swedishDays.dagar !== undefined && this.swedishDays.dagar[dayOfYear]["flaggdag"] !== "") {
				swedishFlag = ' 🇸🇪';
			}
			header.innerHTML = "<span>" + this.capFirst(startDay.format("dddd")) + swedishFlag + "</span>";
			header.innerHTML += "<span class='dayNumber'>" + startDay.format("D") + "</span>";
			startDay.add(1, 'days')
			dayHeaderRow.appendChild(header)
		}

		wrapper.appendChild(dayHeaderRow)

		var eventRow = document.createElement("tr")

		let eventDay = moment();
		let lastEventDay = eventDay.clone().add(this.config.numberOfDays, 'days');

		let schedule = { "days": Array.from({ length: this.config.numberOfDays }, () => ({ 'events': [] })) }

		var eventsPerDay = Array(this.config.numberOfDays).fill(Array(0))

		events.forEach(event => {

			for (let index = 0; index < this.config.numberOfDays; index++) {
				let currentDay = moment().add(index, 'days')
				let startDate = moment(event.startDate, "x")

				//subtract one second so that fullDayEvents end at 23:59:59, and not at 0:00:00 one the next day
				let endDate = moment(event.endDate, "x").subtract(1, 'second')
				
				if(endDate.isBefore(startDate, 'days')) {
					endDate.add(1, 'second')
				}

				if (startDate.isSameOrBefore(currentDay, 'days') &&
					endDate.isSameOrAfter(currentDay, 'days')) {

					// if(currentDay.isBetween(startDate, endDate, 'days', '(]')) {
					schedule.days[index].events.push(event)
				} else {
					continue
				}
			}

		})


		schedule.days.forEach(day => {
			let events = day.events;

			let cell = document.createElement("td")

			events.forEach(event => {
				let paragraph = document.createElement("p")

				if (event.fullDayEvent) {
					paragraph.className = "fullDayEvent"
					paragraph.style.cssText = "background-color: " + this.colorForUrl(event.url);
				} else {
					paragraph.style.cssText = "color: " + this.colorForUrl(event.url);
				}

				paragraph.innerHTML = event.title

				cell.appendChild(paragraph)
			});

			eventRow.appendChild(cell)
		})

		wrapper.appendChild(eventRow)

		// End WEEKLY TABLE

		if (events.length === 0) {
			wrapper.innerHTML = (this.loaded) ? this.translate("EMPTY") : this.translate("LOADING");
			wrapper.className = this.config.tableClass + " dimmed";
			return wrapper;
		}

		return wrapper;
	},

	/**
	 * This function accepts a number (either 12 or 24) and returns a moment.js LocaleSpecification with the
	 * corresponding timeformat to be used in the calendar display. If no number is given (or otherwise invalid input)
	 * it will a localeSpecification object with the system locale time format.
	 *
	 * @param {number} timeFormat Specifies either 12 or 24 hour time format
	 * @returns {moment.LocaleSpecification} formatted time	 
	 */
	getLocaleSpecification: function (timeFormat) {
		switch (timeFormat) {
			case 12: {
				return { longDateFormat: { LT: "h:mm A" } };
			}
			case 24: {
				return { longDateFormat: { LT: "HH:mm" } };
			}
			default: {
				return { longDateFormat: { LT: moment.localeData().longDateFormat("LT") } };
			}
		}
	},

	/**
	 * Checks if this config contains the calendar url.
	 *
	 * @param {string} url The calendar url
	 * @returns {boolean} True if the calendar config contains the url, False otherwise
	 */
	hasCalendarURL: function (url) {
		for (var c in this.config.calendars) {
			var calendar = this.config.calendars[c];
			if (calendar.url === url) {
				return true;
			}
		}

		return false;
	},

	/**
	 * Creates the sorted list of all events.
	 *
	 * @returns {object[]} Array with events.
	 */
	createEventList: function () {
		var events = [];
		var today = moment().startOf("day");
		var now = new Date();
		var future = moment().startOf("day").add(this.config.maximumNumberOfDays, "days").toDate();
		for (var c in this.calendarData) {
			var calendar = this.calendarData[c];
			for (var e in calendar) {
				var event = JSON.parse(JSON.stringify(calendar[e])); // clone object
				// Keep events from earlier today around
				if (moment(event.endDate, 'x').isBefore(now, 'day')) {
					continue;
				}
				if (this.config.hidePrivate) {
					if (event.class === "PRIVATE") {
						// do not add the current event, skip it
						continue;
					}
				}
				if (this.config.hideOngoing) {
					if (event.startDate < now) {
						continue;
					}
				}
				if (this.listContainsEvent(events, event)) {
					continue;
				}
				event.url = c;
				event.today = event.startDate >= today && event.startDate < today + 24 * 60 * 60 * 1000;

				/* if sliceMultiDayEvents is set to true, multiday events (events exceeding at least one midnight) are sliced into days,
				* otherwise, esp. in dateheaders mode it is not clear how long these events are.
				*/
				var maxCount = Math.ceil((event.endDate - 1 - moment(event.startDate, "x").endOf("day").format("x")) / (1000 * 60 * 60 * 24)) + 1;
				if (this.config.sliceMultiDayEvents && maxCount > 1) {
					var splitEvents = [];
					var midnight = moment(event.startDate, "x").clone().startOf("day").add(1, "day").format("x");
					var count = 1;
					while (event.endDate > midnight) {
						var thisEvent = JSON.parse(JSON.stringify(event)); // clone object
						thisEvent.today = thisEvent.startDate >= today && thisEvent.startDate < today + 24 * 60 * 60 * 1000;
						thisEvent.endDate = midnight;
						thisEvent.title += " (" + count + "/" + maxCount + ")";
						splitEvents.push(thisEvent);

						event.startDate = midnight;
						count += 1;
						midnight = moment(midnight, "x").add(1, "day").format("x"); // next day
					}
					// Last day
					event.title += " (" + count + "/" + maxCount + ")";
					splitEvents.push(event);

					for (event of splitEvents) {
						if (event.endDate > now && event.endDate <= future) {
							events.push(event);
						}
					}
				} else {
					events.push(event);
				}
			}
		}

		events.sort(function (a, b) {
			return a.startDate - b.startDate;
		});
		return events.slice(0, this.config.maximumEntries);
	},

	listContainsEvent: function (eventList, event) {
		for (var evt of eventList) {
			if (evt.title === event.title && parseInt(evt.startDate) === parseInt(event.startDate)) {
				return true;
			}
		}
		return false;
	},

	/**
	 * Requests node helper to add calendar url.
	 *
	 * @param {string} url The calendar url to add
	 * @param {object} auth The authentication method and credentials
	 * @param {object} calendarConfig The config of the specific calendar
	 */
	addCalendar: function (url, auth, calendarConfig) {
		this.sendSocketNotification("ADD_CALENDAR", {
			id: this.identifier,
			url: url,
			excludedEvents: calendarConfig.excludedEvents || this.config.excludedEvents,
			maximumEntries: calendarConfig.maximumEntries || this.config.maximumEntries,
			maximumNumberOfDays: calendarConfig.maximumNumberOfDays || this.config.maximumNumberOfDays,
			fetchInterval: this.config.fetchInterval,
			symbolClass: calendarConfig.symbolClass,
			titleClass: calendarConfig.titleClass,
			timeClass: calendarConfig.timeClass,
			auth: auth,
			broadcastPastEvents: calendarConfig.broadcastPastEvents || this.config.broadcastPastEvents
		});
	},

	fetchSwedishDays: function () {
		this.sendSocketNotification("ADD_SWEDISH_CALENDAR", {})
	},

	/**
	 * Retrieves the symbols for a specific event.
	 *
	 * @param {object} event Event to look for.
	 * @returns {string[]} The symbols
	 */
	symbolsForEvent: function (event) {
		let symbols = this.getCalendarPropertyAsArray(event.url, "symbol", this.config.defaultSymbol);

		if (event.recurringEvent === true && this.hasCalendarProperty(event.url, "recurringSymbol")) {
			symbols = this.mergeUnique(this.getCalendarPropertyAsArray(event.url, "recurringSymbol", this.config.defaultSymbol), symbols);
		}

		if (event.fullDayEvent === true && this.hasCalendarProperty(event.url, "fullDaySymbol")) {
			symbols = this.mergeUnique(this.getCalendarPropertyAsArray(event.url, "fullDaySymbol", this.config.defaultSymbol), symbols);
		}

		return symbols;
	},

	mergeUnique: function (arr1, arr2) {
		return arr1.concat(
			arr2.filter(function (item) {
				return arr1.indexOf(item) === -1;
			})
		);
	},

	/**
	 * Retrieves the symbolClass for a specific calendar url.
	 *
	 * @param {string} url The calendar url
	 * @returns {string} The class to be used for the symbols of the calendar
	 */
	symbolClassForUrl: function (url) {
		return this.getCalendarProperty(url, "symbolClass", "");
	},

	/**
	 * Retrieves the titleClass for a specific calendar url.
	 *
	 * @param {string} url The calendar url
	 * @returns {string} The class to be used for the title of the calendar
	 */
	titleClassForUrl: function (url) {
		return this.getCalendarProperty(url, "titleClass", "");
	},

	/**
	 * Retrieves the timeClass for a specific calendar url.
	 *
	 * @param {string} url The calendar url
	 * @returns {string} The class to be used for the time of the calendar
	 */
	timeClassForUrl: function (url) {
		return this.getCalendarProperty(url, "timeClass", "");
	},

	/**
	 * Retrieves the calendar name for a specific calendar url.
	 *
	 * @param {string} url The calendar url
	 * @returns {string} The name of the calendar
	 */
	calendarNameForUrl: function (url) {
		return this.getCalendarProperty(url, "name", "");
	},

	/**
	 * Retrieves the color for a specific calendar url.
	 *
	 * @param {string} url The calendar url
	 * @returns {string} The color
	 */
	colorForUrl: function (url) {
		return this.getCalendarProperty(url, "color", "#fff");
	},

	/**
	 * Retrieves the count title for a specific calendar url.
	 *
	 * @param {string} url The calendar url
	 * @returns {string} The title
	 */
	countTitleForUrl: function (url) {
		return this.getCalendarProperty(url, "repeatingCountTitle", this.config.defaultRepeatingCountTitle);
	},

	/**
	 * Helper method to retrieve the property for a specific calendar url.
	 *
	 * @param {string} url The calendar url
	 * @param {string} property The property to look for
	 * @param {string} defaultValue The value if the property is not found
	 * @returns {*} The property
	 */
	getCalendarProperty: function (url, property, defaultValue) {
		for (var c in this.config.calendars) {
			var calendar = this.config.calendars[c];
			if (calendar.url === url && calendar.hasOwnProperty(property)) {
				return calendar[property];
			}
		}

		return defaultValue;
	},

	getCalendarPropertyAsArray: function (url, property, defaultValue) {
		let p = this.getCalendarProperty(url, property, defaultValue);
		if (!(p instanceof Array)) p = [p];
		return p;
	},

	hasCalendarProperty: function (url, property) {
		return !!this.getCalendarProperty(url, property, undefined);
	},

	/**
	 * Shortens a string if it's longer than maxLength and add a ellipsis to the end
	 *
	 * @param {string} string Text string to shorten
	 * @param {number} maxLength The max length of the string
	 * @param {boolean} wrapEvents Wrap the text after the line has reached maxLength
	 * @param {number} maxTitleLines The max number of vertical lines before cutting event title
	 * @returns {string} The shortened string
	 */
	shorten: function (string, maxLength, wrapEvents, maxTitleLines) {
		if (typeof string !== "string") {
			return "";
		}

		if (wrapEvents === true) {
			var temp = "";
			var currentLine = "";
			var words = string.split(" ");
			var line = 0;

			for (var i = 0; i < words.length; i++) {
				var word = words[i];
				if (currentLine.length + word.length < (typeof maxLength === "number" ? maxLength : 25) - 1) {
					// max - 1 to account for a space
					currentLine += word + " ";				
				} else {
					line++;
					if (line > maxTitleLines - 1) {
						if (i < words.length) {
							currentLine += "&hellip;";
						}
						break;
					}

					if (currentLine.length > 0) {
						temp += currentLine + "<br>" + word + " ";
					} else {
						temp += word + "<br>";
					}
					currentLine = "";
				}
			}

			return (temp + currentLine).trim();
		} else {
			if (maxLength && typeof maxLength === "number" && string.length > maxLength) {
				return string.trim().slice(0, maxLength) + "&hellip;";
			} else {
				return string.trim();
			}
		}
	},

	/**
	 * Capitalize the first letter of a string
	 *
	 * @param {string} string The string to capitalize
	 * @returns {string} The capitalized string
	 */
	capFirst: function (string) {
		return string.charAt(0).toUpperCase() + string.slice(1);
	},

	/**
	 * Transforms the title of an event for usage.
	 * Replaces parts of the text as defined in config.titleReplace.
	 * Shortens title based on config.maxTitleLength and config.wrapEvents
	 *
	 * @param {string} title The title to transform.
	 * @param {object} titleReplace Pairs of strings to be replaced in the title
	 * @param {boolean} wrapEvents Wrap the text after the line has reached maxLength
	 * @param {number} maxTitleLength The max length of the string
	 * @param {number} maxTitleLines The max number of vertical lines before cutting event title
	 * @returns {string} The transformed title.
	 */
	titleTransform: function (title, titleReplace, wrapEvents, maxTitleLength, maxTitleLines) {
		for (var needle in titleReplace) {
			var replacement = titleReplace[needle];

			var regParts = needle.match(/^\/(.+)\/([gim]*)$/);
			if (regParts) {
				// the parsed pattern is a regexp.
				needle = new RegExp(regParts[1], regParts[2]);
			}

			title = title.replace(needle, replacement);
		}

		title = this.shorten(title, maxTitleLength, wrapEvents, maxTitleLines);
		return title;
	},

	/**
	 * Broadcasts the events to all other modules for reuse.
	 * The all events available in one array, sorted on startdate.
	 */
	broadcastEvents: function () {
		var eventList = [];
		for (var url in this.calendarData) {
			var calendar = this.calendarData[url];
			for (var e in calendar) {
				var event = cloneObject(calendar[e]);
				event.symbol = this.symbolsForEvent(event);
				event.calendarName = this.calendarNameForUrl(url);
				event.color = this.colorForUrl(url);
				delete event.url;
				eventList.push(event);
			}
		}

		eventList.sort(function (a, b) {
			return a.startDate - b.startDate;
		});

		this.sendNotification("CALENDAR_EVENTS", eventList);
	}
});
