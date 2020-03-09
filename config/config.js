/* Magic Mirror Config Sample
 *
 * By Michael Teeuw http://michaelteeuw.nl
 * MIT Licensed.
 *
 * For more information how you can configurate this file
 * See https://github.com/MichMich/MagicMirror#configuration
 *
 */

 /* Secrets from URL params */
 const secrets = (typeof location !== undefined) ? Object.fromEntries(new URLSearchParams(location.search)) : {}; 

 var config = {
	 address: "0.0.0.0", // Address to listen on, can be:
						   // - "localhost", "127.0.0.1", "::1" to listen on loopback interface
						   // - another specific IPv4/6 to listen on a specific interface
						   // - "", "0.0.0.0", "::" to listen on any interface
						   // Default, when address config is left out, is "localhost"
	 port: 8080,
	 ipWhitelist: [], // Set [] to allow all IP addresses
															// or add a specific IPv4 of 192.168.1.5 :
															// ["127.0.0.1", "::ffff:127.0.0.1", "::1", "::ffff:192.168.1.5"],
															// or IPv4 range of 192.168.3.0 --> 192.168.3.15 use CIDR format :
															// ["127.0.0.1", "::ffff:127.0.0.1", "::1", "::ffff:192.168.3.0/28"],
 
	 language: "sv",
	 timeFormat: 24,
	 units: "metric",
	 customCss: "css/custom.css",
 
	 modules: [
		 {
			 module: "alert",
		 },
		 {
			 module: "clock",
			 position: "top_left",
			 config: {
				 displaySeconds: false,
				 dateFormat: "dddd D MMMM[<br><small>vecka ]W[</small>]",
			 }
		 },
		 {
			 module: "MMM-DarkSkyForecast",
			 position: "top_left",
			 config: {
			   apikey: secrets.darkSky,
			   latitude: "59.3515632",
			   longitude: "17.807671",
			   updateInterval: 5, // minutes
			   units: 'si',
			   showExtraCurrentConditions: false,
			   showHourlyForecast: false,
			   showDailyForecast: false,
			   showWind: false,
			   concise: true,
			   useAnimatedIcons: false,     
			   iconset: "2c"
			 }
		   },
		 {
			 module: "compliments",
			 position: "lower_third",
			 config: {
				 compliments: {
					 anytime: [
						 "Hey there Oscar"
					 ],
					 morning: [
						 "Hej!"
					 ],
					 afternoon: [
						 "Hej"
					 ],
					 evening: [
						 "Hej"
					 ]
				 }
			 }
		 },
		 {
			 module: "newsfeed",
			 position: "bottom_bar",
			 config: {
				 feeds: [
					 {
						 title: "New York Times",
						 url: "http://www.nytimes.com/services/xml/rss/nyt/HomePage.xml"
					 }
				 ],
				 showSourceTitle: true,
				 showPublishDate: true
			 }
		 },
	 ]
 
 };
 
 /*************** DO NOT EDIT THE LINE BELOW ***************/
 if (typeof module !== "undefined") {module.exports = config;}
 
 
 