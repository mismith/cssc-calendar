// imports
const inquirer = require('inquirer');
const {
  scrapeLeagues,
  scrapeLeagueDivisions,
  scrapeSeason,
  parseSchedule,
} = require('./scraper.js');
const {
  generateCalendarEvents,
} = require('./calendar.js');

// main
/*
const URL1 = 'https://www.calgarysportsclub.com/leagues/volleyball/indoor-volleyball/schedules/fall-2017/thurs-int-b';
const URL2 = 'https://www.calgarysportsclub.com/leagues/dodgeball/indoor-dodgeball/schedules/fall-2017/wed-rec-multi-format';

scrapeSeason(URL2)
  .then(season => {
    // console.log(JSON.stringify(season, null, 2));

    const schedule = parseSchedule(season, 'Ball So Hard');

    console.log(schedule);
  });
// */

///*
scrapeLeagues()
  .then(leagues => {
    return inquirer.prompt({
      type: 'list',
      name: 'league',
      message: 'Which league?',
      choices: leagues.map(league => league.name),
    })
      .then(answers => leagues.find(l => l.name === answers.league))
      .then(league => ({ league }));
  })
  .then(data => {
    return scrapeLeagueDivisions(data.league.url)
      .then(divisions => Object.assign(data, { divisions }));
  })
  .then(data => {
    return inquirer.prompt({
      type: 'list',
      name: 'division',
      message: 'Which division?',
      choices: data.divisions.map(division => `${division.day} / ${division.name}`),
    })
      .then(answers => data.divisions.find(division => answers.division === `${division.day} / ${division.name}`))
      .then(division => Object.assign(data, { division }));
  })
  .then(data => {
    return scrapeSeason(data.division.url)
      .then(season => Object.assign(data, { season }));
  })
  .then(data => {
    return inquirer.prompt({
      type: 'list',
      name: 'team',
      message: 'Which team?',
      choices: data.season.teams.map(team => team.name),
    })
      .then(answers => {
        const team = data.season.teams.find(team => team.name === answers.team);
        const schedule = parseSchedule(data.season, team.name);

        return Object.assign(data, { team, schedule });
      });
  })
  .then(data => {
    const calendar = generateCalendarEvents(data.league.name, data.schedule, data.division.url);

    return Object.assign(data, { calendar });
  })
  .then(data => {
    // console.log(data);
    inquirer.prompt({
      type: 'confirm',
      name: 'save',
      message: 'Export iCal file?',
    })
      .then(answers => answers.save)
      .then((save) => {
        if (save) {
          data.calendar.saveSync(`${data.league.name}.ics`);
        } else {
          // write to STDOUT
          console.log(JSON.stringify(data, null, 2));
        }
      });
  });
// */
