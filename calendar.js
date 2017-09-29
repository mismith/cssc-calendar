// imports
const ical = require('ical-generator');
const moment = require('moment-timezone');

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

    const calendarEvent = calendar.createEvent({
      summary: name,
      description: `${event.detail || ''} vs. ${opponents || ''}`,
      start: moment(event.datetime).toDate(),
      end: moment(event.datetime).add(1, 'hours').toDate(),
      location: event.location,
      url,
    });
  });
  return calendar;
}

module.exports = {
  generateCalendarEvents,
};