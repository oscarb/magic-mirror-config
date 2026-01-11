/* global CalendarUtils */

/* MagicMirror²
 * Module: My Calendar
 *
 * Based on Calendar by Michael Teeuw https://michaelteeuw.nl
 * MIT Licensed.
 */
Module.register("MMM-My-Calendar", {
	// Define module defaults
	defaults: {
		maximumEntries: 10, // Total Maximum Entries
		maximumNumberOfDays: 365,
		limitDays: 7, // Limit the number of days shown, 0 = no limit
		numberOfDays: 7,
		pastDaysCount: 1,
		displaySymbol: true,
		defaultSymbol: "calendar-alt", // Fontawesome Symbol see https://fontawesome.com/cheatsheet?from=io
		defaultSymbolClassName: "fas fa-fw fa-",
		showLocation: false,
		displayRepeatingCountTitle: false,
		defaultRepeatingCountTitle: "",
		maxTitleLength: 25,
		maxLocationTitleLength: 25,
		wrapEvents: false, // Wrap events to multiple lines breaking at maxTitleLength
		wrapLocationEvents: false,
		maxTitleLines: 3,
		maxEventTitleLines: 3,
		fetchInterval: 5 * 60 * 1000, // Update every 5 minutes.
		animationSpeed: 1000,
		fade: true,
		fadePoint: 0.25, // Start on 1/4th of the list.
		urgency: 7,
		timeFormat: "relative",
		dateFormat: "MMM Do",
		dateEndFormat: "LT",
		fullDayEventDateFormat: "MMM Do",
		showEnd: false,
		showEndsOnlyWithDuration: false,
		getRelative: 6,
		hidePrivate: false,
		hideOngoing: false,
		hideTime: false,
		hideDuplicates: true,
		showTimeToday: false,
		colored: false,
		forceUseCurrentTime: false,
		tableClass: "small",
		calendars: [
			{
				symbol: "calendar-alt",
				url: "https://www.calendarlabs.com/templates/ical/US-Holidays.ics"
			}
		],
		customEvents: [
			// Array of {keyword: "", symbol: "", color: "", eventClass: ""} where Keyword is a regexp and symbol/color/eventClass are to be applied for matched
			{ keyword: ".*", transform: { search: "De verjaardag van ", replace: "" } },
			{ keyword: ".*", transform: { search: "'s birthday", replace: "" } }
		],
		locationTitleReplace: {
			"street ": ""
		},
		broadcastEvents: true,
		excludedEvents: [],
		sliceMultiDayEvents: false,
		broadcastPastEvents: true,
		nextDaysRelative: false,
		selfSignedCert: false,
		coloredText: false,
		coloredBorder: false,
		coloredSymbol: false,
		coloredBackground: false,
		limitDaysNeverSkip: false,
		flipDateHeaderTitle: false,
		updateOnFetch: true
	},

	requiresVersion: "2.1.0",

	// Define required scripts.
	getStyles () {
		return ["calendar.css", "font-awesome.css"];
	},

	// Define required scripts.
	getScripts () {
		return ["calendarutils.js", "moment.js", "moment-timezone.js"];
	},

	// Define required translations.
	getTranslations () {

		/*
		 * The translations for the default modules are defined in the core translation files.
		 * Therefore we can just return false. Otherwise we should have returned a dictionary.
		 * If you're trying to build your own module including translations, check out the documentation.
		 */		
		return false;
	},

	// Override start method.
	start () {
				Log.info(`Starting module: ${this.name}`);

		if (this.config.colored) {
			Log.warn("Your are using the deprecated config values 'colored'. Please switch to 'coloredSymbol' & 'coloredText'!");
			this.config.coloredText = true;
			this.config.coloredSymbol = true;
		}
		if (this.config.coloredSymbolOnly) {
			Log.warn("Your are using the deprecated config values 'coloredSymbolOnly'. Please switch to 'coloredSymbol' & 'coloredText'!");
			this.config.coloredText = false;
			this.config.coloredSymbol = true;
		}

		// Set locale.
		moment.updateLocale(config.language, CalendarUtils.getLocaleSpecification(config.timeFormat));

		// clear data holder before start
		this.calendarData = {};

		// indicate no data available yet
		this.loaded = false;

		// data holder of calendar url. Avoid fade out/in on updateDom (one for each calendar update)
		this.calendarDisplayer = {};

		// ME - Fetch swedish flag and red days
		this.swedishDays = {};
		this.fetchSwedishDays();
		
		this.config.calendars.forEach((calendar) => {
			calendar.url = calendar.url.replace("webcal://", "http://");

			const calendarConfig = {
				maximumEntries: calendar.maximumEntries,
				maximumNumberOfDays: calendar.maximumNumberOfDays,
				pastDaysCount: calendar.pastDaysCount,
				broadcastPastEvents: calendar.broadcastPastEvents,
				selfSignedCert: calendar.selfSignedCert,
				excludedEvents: calendar.excludedEvents,
				fetchInterval: calendar.fetchInterval
			};

			if (typeof calendar.symbolClass === "undefined" || calendar.symbolClass === null) {
				calendarConfig.symbolClass = "";
			}
			if (typeof calendar.titleClass === "undefined" || calendar.titleClass === null) {
				calendarConfig.titleClass = "";
			}
			if (typeof calendar.timeClass === "undefined" || calendar.timeClass === null) {
				calendarConfig.timeClass = "";
			}

			// we check user and password here for backwards compatibility with old configs
			if (calendar.user && calendar.pass) {
				Log.warn("Deprecation warning: Please update your calendar authentication configuration.");
				Log.warn("https://docs.magicmirror.builders/modules/calendar.html#configuration-options");
				calendar.auth = {
					user: calendar.user,
					pass: calendar.pass
				};
			}

			/*
			 * tell helper to start a fetcher for this calendar
			 * fetcher till cycle
			 */
			this.addCalendar(calendar.url, calendar.auth, calendarConfig);
		});

		// for backward compatibility titleReplace
		if (typeof this.config.titleReplace !== "undefined") {
			Log.warn("Deprecation warning: Please consider upgrading your calendar titleReplace configuration to customEvents.");
			for (const [titlesearchstr, titlereplacestr] of Object.entries(this.config.titleReplace)) {
				this.config.customEvents.push({ keyword: ".*", transform: { search: titlesearchstr, replace: titlereplacestr } });
			}
		}

		this.selfUpdate();
	},
	notificationReceived (notification, payload, sender) {

		if (notification === "FETCH_CALENDAR") {
			if (this.hasCalendarURL(payload.url)) {
				this.sendSocketNotification(notification, { url: payload.url, id: this.identifier });
			}
		}
	},

	// Override socket notification handler.
	socketNotificationReceived (notification, payload) {


		if (notification !== "SWEDISH_DAYS" && this.identifier !== payload.id) {
			return;
		}

		if (notification === "CALENDAR_EVENTS") {
			if (this.hasCalendarURL(payload.url)) {
				this.calendarData[payload.url] = payload.events;
				this.error = null;
				this.loaded = true;

				if (this.config.broadcastEvents) {
					this.broadcastEvents();
				}
			
				if (!this.config.updateOnFetch) {
					if (this.calendarDisplayer[payload.url] === undefined) {
						// calendar will never displayed, so display it
						this.updateDom(this.config.animationSpeed);
						// set this calendar as displayed
						this.calendarDisplayer[payload.url] = true;
					} else {
						Log.debug("[Calendar] DOM not updated waiting self update()");
					}
					return;
				}
			}
		} else if (notification === "SWEDISH_DAYS") {
			this.swedishDays = payload.data
		} else if (notification === "CALENDAR_ERROR") {
			let error_message = this.translate(payload.error_type);
			this.error = this.translate("MODULE_CONFIG_ERROR", { MODULE_NAME: this.name, ERROR: error_message });
			this.loaded = true;
		}

		this.updateDom(this.config.animationSpeed);
	},

	// Override dom generator.
	getDom () {
		const ONE_SECOND = 1000; // 1,000 milliseconds

		const events = this.createEventList(true);
		const wrapper = document.createElement("table");
		wrapper.className = this.config.tableClass;

		if (this.error) {
			wrapper.innerHTML = this.error;
			wrapper.className = `${this.config.tableClass} dimmed`;
			return wrapper;
		}

		if (events.length === 0) {
			wrapper.innerHTML = this.loaded ? this.translate("EMPTY") : this.translate("LOADING");
			wrapper.className = `${this.config.tableClass} dimmed`;
			return wrapper;
		}

		// Begin WEEKLY TABLE - MMM-My-Calendar modifications!
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
			header.innerHTML = "<span>" + CalendarUtils.capFirst(startDay.format("dddd")) + swedishFlag + "</span>";
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

				if (endDate.isBefore(startDate, 'days')) {
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

		return wrapper;
	},

	/**
	 * Checks if this config contains the calendar url.
	 * @param {string} url The calendar url
	 * @returns {boolean} True if the calendar config contains the url, False otherwise
	 */
	hasCalendarURL (url) {
		for (const calendar of this.config.calendars) {
			if (calendar.url === url) {
				return true;
			}
		}

		return false;
	},

	/**
	 * converts the given timestamp to a moment with a timezone
	 * @param {number} timestamp timestamp from an event
	 * @returns {moment.Moment} moment with a timezone
	 */
	timestampToMoment (timestamp) {
		return moment(timestamp, "x").tz(moment.tz.guess());
	},

	/**
	 * Creates the sorted list of all events.
	 * @param {boolean} limitNumberOfEntries Whether to filter returned events for display.
	 * @returns {object[]} Array with events.
	 */
	createEventList (limitNumberOfEntries) {
		let now = moment();
		let today = now.clone().startOf("day");
		let future = now.clone().startOf("day").add(this.config.maximumNumberOfDays, "days");

		let events = [];

		for (const calendarUrl in this.calendarData) {
			const calendar = this.calendarData[calendarUrl];
			let remainingEntries = this.maximumEntriesForUrl(calendarUrl);
			let maxPastDaysCompare = now.clone().subtract(this.maximumPastDaysForUrl(calendarUrl), "days");
			let by_url_calevents = [];
			for (const e in calendar) {
				const event = JSON.parse(JSON.stringify(calendar[e])); // clone object
				const eventStartDateMoment = this.timestampToMoment(event.startDate);
				const eventEndDateMoment = this.timestampToMoment(event.endDate);

				if (this.config.hidePrivate && event.class === "PRIVATE") {
					// do not add the current event, skip it
					continue;
				}
				if (limitNumberOfEntries) {
					if (eventEndDateMoment.isBefore(maxPastDaysCompare)) {
						continue;
					}
					if (this.config.hideOngoing && eventStartDateMoment.isBefore(now)) {
						continue;
					}
					if (this.config.hideDuplicates && this.listContainsEvent(events, event)) {
						continue;
					}
				}

				event.url = calendarUrl;
				event.today = eventStartDateMoment.isSame(now, "d");
				event.dayBeforeYesterday = eventStartDateMoment.isSame(now.clone().subtract(2, "days"), "d");
				event.yesterday = eventStartDateMoment.isSame(now.clone().subtract(1, "days"), "d");
				event.tomorrow = eventStartDateMoment.isSame(now.clone().add(1, "days"), "d");
				event.dayAfterTomorrow = eventStartDateMoment.isSame(now.clone().add(2, "days"), "d");

				/*
				 * if sliceMultiDayEvents is set to true, multiday events (events exceeding at least one midnight) are sliced into days,
				 * otherwise, esp. in dateheaders mode it is not clear how long these events are.
				 */
				const maxCount = eventEndDateMoment.diff(eventStartDateMoment, "days");
				if (this.config.sliceMultiDayEvents && maxCount > 1) {
					const splitEvents = [];
					let midnight
						= eventStartDateMoment
							.clone()
							.startOf("day")
							.add(1, "day")
							.endOf("day");
					let count = 1;
					while (eventEndDateMoment.isAfter(midnight)) {
						const thisEvent = JSON.parse(JSON.stringify(event)); // clone object
						thisEvent.today = this.timestampToMoment(thisEvent.startDate).isSame(now, "d");
						thisEvent.tomorrow = this.timestampToMoment(thisEvent.startDate).isSame(now.clone().add(1, "days"), "d");
						thisEvent.endDate = midnight.clone().subtract(1, "day").format("x");
						thisEvent.title += ` (${count}/${maxCount})`;
						splitEvents.push(thisEvent);

						event.startDate = midnight.format("x");
						count += 1;
						midnight = midnight.clone().add(1, "day").endOf("day"); // next day
					}
					// Last day
					event.title += ` (${count}/${maxCount})`;
					event.today += this.timestampToMoment(event.startDate).isSame(now, "d");
					event.tomorrow = this.timestampToMoment(event.startDate).isSame(now.clone().add(1, "days"), "d");
					splitEvents.push(event);

					for (let splitEvent of splitEvents) {
						if (this.timestampToMoment(splitEvent.endDate).isAfter(now) && this.timestampToMoment(splitEvent.endDate).isSameOrBefore(future)) {
							by_url_calevents.push(splitEvent);
						}
					}
				} else {
					by_url_calevents.push(event);
				}
			}
			if (limitNumberOfEntries) {
				// sort entries before clipping
				by_url_calevents.sort(function (a, b) {
					return a.startDate - b.startDate;
				});
				Log.debug(`pushing ${by_url_calevents.length} events to total with room for ${remainingEntries}`);
				events = events.concat(by_url_calevents.slice(0, remainingEntries));
				Log.debug(`events for calendar=${events.length}`);
			} else {
				events = events.concat(by_url_calevents);
			}
		}
		Log.info(`sorting events count=${events.length}`);
		events.sort(function (a, b) {
			return a.startDate - b.startDate;
		});

		if (!limitNumberOfEntries) {
			return events;
		}

		/*
		 * Limit the number of days displayed
		 * If limitDays is set > 0, limit display to that number of days
		 */
		if (this.config.limitDays > 0) {
			let newEvents = [];
			let lastDate = today.clone().subtract(1, "days");
			let days = 0;
			for (const ev of events) {
				let eventDate = this.timestampToMoment(ev.startDate);

				/*
				 * if date of event is later than lastdate
				 * check if we already are showing max unique days
				 */
				if (eventDate.isAfter(lastDate)) {
					// if the only entry in the first day is a full day event that day is not counted as unique
					if (!this.config.limitDaysNeverSkip && newEvents.length === 1 && days === 1 && newEvents[0].fullDayEvent) {
						days--;
					}
					days++;
					if (days > this.config.limitDays) {
						continue;
					} else {
						lastDate = eventDate;
					}
				}
				newEvents.push(ev);
			}
			events = newEvents;
		}
		Log.info(`slicing events total maxcount=${this.config.maximumEntries}`);
		return events.slice(0, this.config.maximumEntries);
	},

	listContainsEvent (eventList, event) {
		for (const evt of eventList) {
			if (evt.title === event.title && parseInt(evt.startDate) === parseInt(event.startDate) && parseInt(evt.endDate) === parseInt(event.endDate)) {
				return true;
			}
		}
		return false;
	},

	/**
	 * Requests node helper to add calendar url.
	 * @param {string} url The calendar url to add
	 * @param {object} auth The authentication method and credentials
	 * @param {object} calendarConfig The config of the specific calendar
	 */
	addCalendar (url, auth, calendarConfig) {
		this.sendSocketNotification("ADD_CALENDAR", {
			id: this.identifier,
			url: url,
			excludedEvents: calendarConfig.excludedEvents || this.config.excludedEvents,
			maximumEntries: calendarConfig.maximumEntries || this.config.maximumEntries,
			maximumNumberOfDays: calendarConfig.maximumNumberOfDays || this.config.maximumNumberOfDays,
			pastDaysCount: calendarConfig.pastDaysCount || this.config.pastDaysCount,
			fetchInterval: calendarConfig.fetchInterval || this.config.fetchInterval,
			symbolClass: calendarConfig.symbolClass,
			titleClass: calendarConfig.titleClass,
			timeClass: calendarConfig.timeClass,
			auth: auth,
			broadcastPastEvents: calendarConfig.broadcastPastEvents || this.config.broadcastPastEvents,
			selfSignedCert: calendarConfig.selfSignedCert || this.config.selfSignedCert
		});
	},

	fetchSwedishDays: function () {
		this.sendSocketNotification("ADD_SWEDISH_CALENDAR", {})
	},

	/**
	 * Retrieves the symbols for a specific event.
	 * @param {object} event Event to look for.
	 * @returns {string[]} The symbols
	 */
	symbolsForEvent (event) {
		let symbols = this.getCalendarPropertyAsArray(event.url, "symbol", this.config.defaultSymbol);

		if (event.recurringEvent === true && this.hasCalendarProperty(event.url, "recurringSymbol")) {
			symbols = this.mergeUnique(this.getCalendarPropertyAsArray(event.url, "recurringSymbol", this.config.defaultSymbol), symbols);
		}

		if (event.fullDayEvent === true && this.hasCalendarProperty(event.url, "fullDaySymbol")) {
			symbols = this.mergeUnique(this.getCalendarPropertyAsArray(event.url, "fullDaySymbol", this.config.defaultSymbol), symbols);
		}

		// If custom symbol is set, replace event symbol
		for (let ev of this.config.customEvents) {
			if (typeof ev.symbol !== "undefined" && ev.symbol !== "") {
				let needle = new RegExp(ev.keyword, "gi");
				if (needle.test(event.title)) {
					// Get the default prefix for this class name and add to the custom symbol provided
					const className = this.getCalendarProperty(event.url, "symbolClassName", this.config.defaultSymbolClassName);
					symbols[0] = className + ev.symbol;
					break;
				}
			}
		}

		return symbols;
	},

	mergeUnique (arr1, arr2) {
		return arr1.concat(
			arr2.filter(function (item) {
				return arr1.indexOf(item) === -1;
			})
		);
	},

	/**
	 * Retrieves the symbolClass for a specific calendar url.
	 * @param {string} url The calendar url
	 * @returns {string} The class to be used for the symbols of the calendar
	 */
	symbolClassForUrl (url) {
		return this.getCalendarProperty(url, "symbolClass", "");
	},

	/**
	 * Retrieves the titleClass for a specific calendar url.
	 * @param {string} url The calendar url
	 * @returns {string} The class to be used for the title of the calendar
	 */
	titleClassForUrl (url) {
		return this.getCalendarProperty(url, "titleClass", "");
	},

	/**
	 * Retrieves the timeClass for a specific calendar url.
	 * @param {string} url The calendar url
	 * @returns {string} The class to be used for the time of the calendar
	 */
	timeClassForUrl (url) {
		return this.getCalendarProperty(url, "timeClass", "");
	},

	/**
	 * Retrieves the calendar name for a specific calendar url.
	 * @param {string} url The calendar url
	 * @returns {string} The name of the calendar
	 */
	calendarNameForUrl (url) {
		return this.getCalendarProperty(url, "name", "");
	},

	/**
	 * Retrieves the color for a specific calendar url.
	 * @param {string} url The calendar url
	 * @param {boolean} isBg Determines if we fetch the bgColor or not
	 * @returns {string} The color
	 */
	colorForUrl (url, isBg) {
		return this.getCalendarProperty(url, isBg ? "bgColor" : "color", "#fff");
	},

	/**
	 * Retrieves the count title for a specific calendar url.
	 * @param {string} url The calendar url
	 * @returns {string} The title
	 */
	countTitleForUrl (url) {
		return this.getCalendarProperty(url, "repeatingCountTitle", this.config.defaultRepeatingCountTitle);
	},

	/**
	 * Retrieves the maximum entry count for a specific calendar url.
	 * @param {string} url The calendar url
	 * @returns {number} The maximum entry count
	 */
	maximumEntriesForUrl (url) {
		return this.getCalendarProperty(url, "maximumEntries", this.config.maximumEntries);
	},

	/**
	 * Retrieves the maximum count of past days which events of should be displayed for a specific calendar url.
	 * @param {string} url The calendar url
	 * @returns {number} The maximum past days count
	 */
	maximumPastDaysForUrl (url) {
		return this.getCalendarProperty(url, "pastDaysCount", this.config.pastDaysCount);
	},

	/**
	 * Helper method to retrieve the property for a specific calendar url.
	 * @param {string} url The calendar url
	 * @param {string} property The property to look for
	 * @param {string} defaultValue The value if the property is not found
	 * @returns {*} The property
	 */
	getCalendarProperty (url, property, defaultValue) {
		for (const calendar of this.config.calendars) {
			if (calendar.url === url && calendar.hasOwnProperty(property)) {
				return calendar[property];
			}
		}

		return defaultValue;
	},

	getCalendarPropertyAsArray (url, property, defaultValue) {
		let p = this.getCalendarProperty(url, property, defaultValue);
		if (property === "symbol" || property === "recurringSymbol" || property === "fullDaySymbol") {
			const className = this.getCalendarProperty(url, "symbolClassName", this.config.defaultSymbolClassName);
			if (p instanceof Array) {
				let t = [];
				p.forEach((n) => { t.push(className + n); });
				p = t;
			}
			else p = className + p;
		}
		if (!(p instanceof Array)) p = [p];
		return p;
	},

	hasCalendarProperty (url, property) {
		return !!this.getCalendarProperty(url, property, undefined);
	},

	/**
	 * Broadcasts the events to all other modules for reuse.
	 * The all events available in one array, sorted on startdate.
	 */
	broadcastEvents () {
		const eventList = this.createEventList(false);
		for (const event of eventList) {
			event.symbol = this.symbolsForEvent(event);
			event.calendarName = this.calendarNameForUrl(event.url);
			event.color = this.colorForUrl(event.url, false);
			delete event.url;
		}

		this.sendNotification("CALENDAR_EVENTS", eventList);
},

	/**
	 * Refresh the DOM every minute if needed: When using relative date format for events that start
	 * or end in less than an hour, the date shows minute granularity and we want to keep that accurate.
	 * --
	 * When updateOnFetch is not set, it will Avoid fade out/in on updateDom when many calendars are used
	 * and it's allow to refresh The DOM every minute with animation speed too
	 * (because updateDom is not set in CALENDAR_EVENTS for this case)
	 */
	selfUpdate () {
		const ONE_MINUTE = 60 * 1000;
		setTimeout(
			() => {
				setInterval(() => {
					Log.debug("[Calendar] self update");
					if (this.config.updateOnFetch) {
						this.updateDom(1);
					} else {
						this.updateDom(this.config.animationSpeed);
					}
				}, ONE_MINUTE);
			},
			ONE_MINUTE - (new Date() % ONE_MINUTE)
		);
	}
});
