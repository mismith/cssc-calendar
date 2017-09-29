// imports
const scrapeIt = require('scrape-it');
const jsdom = require('jsdom');
const moment = require('moment-timezone');

function jsdomEnvAsync(...args) {
  return new Promise((resolve, reject) => {
    args.push((err, window) => {
      if (err) return reject(err);
      return resolve(window);
    });
    jsdom.env.apply(this, args);
  });
}

// config
const BASE_URL = 'https://www.calgarysportsclub.com';

// main
function scrapeLeagues() {
  return jsdomEnvAsync(BASE_URL)
    .then((window) => {
      const leaguesNode = window.document.querySelector('#navigation a[href="/leagues/"] + ul');
      if (!leaguesNode) throw new Error('Could not find leagues node');

      const leagues = Array.from(leaguesNode.querySelectorAll('li:not(.menu-mlid-2138):not(.menu-mlid-2344) a')).map(a => {
        const parent = a.parentNode.parentNode.parentNode;
        let group;
        if (parent.classList.contains('expanded') && !parent.classList.contains('first')) {
          group = parent.firstChild.textContent;
        }
        return {
          name: (group ? `${group} - ` : '') + a.textContent,
          url: `${a.href}/schedules-standings`,
        };
      });
      return leagues;
    });
}

function scrapeLeagueDivisions(url) {
  return scrapeIt(url, {
    days: {
      listItem: '#tabs-0-tabs li',
      data: {
        name: 'a',
        tab: {
          selector: 'a',
          attr: 'href',
        },
      },
    },
    tabs: {
      listItem: '#tabs-0-tabs > div',
      data: {
        id: {
          attr: 'id',
        },
        divisions: {
          listItem: 'p',
          data: {
            name: 'strong',
            url: {
              selector: 'a',
              attr: 'href',
              convert: href => `${BASE_URL}${href}`,
            },
          },
        },
      },
    },
  })
    .then(data => {
      const divisions = [];
      data.days.forEach(day => {
        data.tabs.find(t => `#${t.id}` === day.tab).divisions.forEach(division => {
          divisions.push(Object.assign({
            day: day.name,
          }, division));
        });
      });
      return divisions;
    });
}

function scrapeSeason(url) {
  return jsdomEnvAsync(url)
    .then((window) => {
      // setup
      const scheduleNode = window.document.querySelector('.sscSchedule');
      if (!scheduleNode) throw new Error('Could not find schedule node');

      const facilitiesNode = scheduleNode.querySelector('table:nth-of-type(1)');
      if (!facilitiesNode) throw new Error('Could not find facilities table');

      const teamsNode = scheduleNode.querySelector('table:nth-of-type(2)');
      if (!teamsNode) throw new Error('Could not find teams table');

      const gamesNodes = scheduleNode.querySelectorAll('table:nth-of-type(2) ~ table');
      if (!gamesNodes || !gamesNodes.length) throw new Error('Could not find any games');

      // methods
      function getFacilities() {
        return Array.from(facilitiesNode.querySelectorAll('tbody tr')).map(tr => {
          return {
            name:    tr.querySelector('td:nth-of-type(1)').textContent,
            address: tr.querySelector('td:nth-of-type(2)').textContent,
            link:    tr.querySelector('td:nth-of-type(3) a[href]').getAttribute('href'),
          };
        });
      }
      function getTeams() {
        let teams = [];
        Array.from(teamsNode.querySelectorAll('tbody tr')).forEach(tr => {
          for(let i = 2; i <= 4; i += 2) {
            teams.push({
              name:    tr.querySelector(`td:nth-of-type(${i}) b`).nextSibling.textContent.replace(/^[\s-]+|[\s-]+$/ig, ''),
              captain: tr.querySelector(`td:nth-of-type(${i}) b`).textContent.replace(/^[\s-]+|[\s-]+$/ig, ''),
            });
          }
        });
        return teams;
      }
      function getGames() {
        let games = [];
        Array.from(gamesNodes).map(table => {
          let locationNode;
          let detailNode;
          games = games.concat(Array.from(table.querySelectorAll('tbody tr')).map(game => {
            // time & date
            const timeNode = table.querySelector('td[rowspan="4"]') || game.querySelector('td[align="center"]');
            let time = timeNode ? timeNode.textContent : '';
            const matches = time.match(/(\d+:\d{2} [AP]M)/i);
            if (matches) {
              time = matches[0];
            }
            const date = table.querySelector('thead tr:nth-of-type(1) th b').textContent;
            const datetime = moment(`${time}, ${date}`, 'h:mm A, dddd, MMMM D, YYYY').format();

            // game types
            detailNode = detailNode || game.querySelector('td[colspan]');

            // location
            locationNode = table.querySelector('td[rowspan="4"] b') || game.querySelector('td:not([colspan]):first-child') || locationNode; // fallback to previous location for multi-row tables

            return locationNode ? {
              location: locationNode.textContent,
              datetime: datetime,
              teams:  (game.querySelector('td:last-child').textContent.match('^(.*?) vs. (.*?)$') || []).slice(1, 3),
              detail: detailNode && detailNode.textContent.replace(/\s{2,}/g, ' ').replace(/^\s+|\s+$/g, '') || null,
            } : false;
          }).filter(game => !!game)); // filter out separator rows
        });
        return games;
      }

      return {
        facilities: getFacilities(url),
        teams: getTeams(url),
        games: getGames(url),
      };
    });
}

function parseSchedule(season, team) {
  const schedule = [];
  season.games.filter(game => game.teams.includes(team)).forEach(game => {
    game.teams = game.teams.filter(t => t !== team);
    const existingGame = schedule.find(g => moment(g.datetime).isSame(game.datetime, 'day'));
    if (existingGame) {
      // append team
      existingGame.teams = [].concat(existingGame.teams, game.teams);
    } else {
      // add game
      schedule.push(game);
    }
  });
  return schedule;
}

module.exports = {
  scrapeLeagues,
  scrapeLeagueDivisions,
  scrapeSeason,
  parseSchedule,
};