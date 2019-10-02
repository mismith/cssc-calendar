// imports
const ical = require('ical-generator');
const moment = require('moment-timezone');
const { BASE_URL } = require('./scraper');

// config
const TIMEZONE = 'America/Edmonton';

// main
function generateCalendarEvents(name, schedule, url) {
  const calendar = ical({
    name,
    timezone: TIMEZONE,
  });
  schedule.forEach(event => {
    const opponents = event.teams.join(', ');
    const [, geo] = `${event.facility && event.facility.link || ''}`.match(/\&ll=([^&]+)/) || [];
    const location = event.facility
      ? `${event.location}\n${event.facility.address}\n${event.facility.name}`
      : event.location;

    calendar.createEvent({
      summary: name,
      description: `${event.detail || ''} vs. ${opponents || ''}`,
      start: moment(event.datetime).toDate(),
      end: moment(event.datetime).add(1, 'hours').toDate(),
      location,
      geo,
      url: `${BASE_URL}${url}`,
    });
  });
  return calendar;
}

module.exports = {
  generateCalendarEvents,
};