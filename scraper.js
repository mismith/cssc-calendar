// imports
const scrapeIt = require('scrape-it');
const jsdom = require('jsdom');
const moment = require('moment-timezone');
const fuzzy = require('fuzzy');

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
const sourceDateFormat = 'dddd, MMMM D, YYYY';

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
  return scrapeIt(url, {
    facilities: {
      listItem: '.sscSchedule table:nth-of-type(1) tbody tr',
      data: {
        name: 'td:nth-of-type(1)',
        address: 'td:nth-of-type(2)',
        link: {
          selector: 'td:nth-of-type(3) a[href]',
          attr: 'href',
        },
      },
    },
    teams: {
      listItem: '.sscSchedule table:nth-of-type(2) tbody tr td:nth-child(2n+2)',
      data: {
        name: {
          // TODO
          selector: 'b',
          how: ch => ch[0].next.data,
          convert: v => v.replace(/^[\s-]+|[\s-]+$/ig, ''),
        },
        captain: {
          selector: 'b',
          convert: v => v.replace(/^[\s-]+|[\s-]+$/ig, ''),
        },
      },
    },
    days: {
      listItem: '.sscSchedule table:nth-of-type(2) ~ table',
      data: {
        date: 'thead th b',
        detail: {
          selector: 'td[colspan]',
          convert: v => v ? v.replace(/\s{2,}/g, ' ').replace(/^\s+|\s+$/g, '') : undefined,
        },
        games: {
          listItem: 'tbody tr',
          data: {
            location: {
              selector: 'td[rowspan=4] b, td:not([rowspan]):not([align]):first-child b',
              convert: v => (/^(vs\.)+$/ig.test(v) ? undefined : v) || undefined,
              // how: ch => {
              //   if (ch.parent) console.log(ch.parent());
              //   return ch.textContent;
              // },
            },
            time: {
              selector: 'td[rowspan=4], td[align=center]',
              convert: (v) => {
                const matches = (v || '').match(/(\d+:\d{2} [AP]M)/i);
                if (matches) {
                  return matches[0];
                }
              },
            },
            teams: {
              selector: 'td:not([colspan]):last-child',
              convert: (v) => {
                if (!v) return []; // exclude spacer/divider

                const sep = ' vs. ';
                const teams = v.split(sep);
                return teams.length > 2 ? [teams[0] + sep + teams[1], teams[2] + sep + teams[3]] : teams;
              }
            },
          },
        },
      },
    },
  })
    .then((data) => {
      data.games = [];
      let previous = {};
      let finalWeekIndex = 0;
      data.days.forEach((day, i) => {
        // auto-guess dates for semis/finals
        let nextWeek;
        if (day.date !== 'Date TBD') {
          finalWeekIndex = i;
        } else {
          nextWeek = moment(data.days[finalWeekIndex].date, sourceDateFormat)
            .add(i - finalWeekIndex, 'weeks')
            .hours(19);
        }

        // cascade games
        day.games.forEach((game) => {
          // clean up
          if (!game.teams.length) return;
          if (!game.location) delete game.location;
          if (!game.time) delete game.time;

          // cascade detail
          if (day.detail && !game.detail) game.detail = day.detail;

          // empties cascade/fallback to previous game's values
          previous = Object.assign({}, previous, game);

          // auto-guess dates for semis/finals
          if (nextWeek) {
            previous.date = nextWeek.format(sourceDateFormat);
            delete previous.time;
            delete previous.location;
            delete previous.detail;
          } else {
            previous.date = day.date;
          }

          data.games.push(previous);
        });
      });
      delete data.days;

      return data;
    });
}

function getFacilityFromLocation(location, facilities) {
    const simplifiedLocation = location.replace(/ (School|North|South|East|West|Calgary|- .*?)$/i, '').replace(/[^\w]+/g, ' ');
    const matches = [].concat(
      fuzzy.filter(simplifiedLocation, facilities, {
        extract: (facility) => facility.name,
      }),
      fuzzy.filter(simplifiedLocation.replace(/[^A-Z]+/g, ''), facilities, {
        extract: (facility) => facility.name.replace(/[^A-Z]+/g, ' '),
      })
    );
    return matches.length ? matches[0].original : null;
}

function parseSchedule(season, team) {
  const schedule = [];
  season.games
    .filter(game => !game.time || game.teams.includes(team))
    .forEach(game => {
      game.teams = game.teams.filter(t => t !== team);

      game.datetime = moment(`${game.time || '7:00 PM'}, ${game.date}`, `h:mm A, ${sourceDateFormat}`).format();

      // merge days with mutiple opponents
      const existingGame = schedule.find(g => moment(g.datetime).isSame(game.datetime, 'day'));
      if (existingGame) {
        // append team
        existingGame.teams = [].concat(existingGame.teams, game.teams);
      } else {
        // add game
        schedule.push(game);
      }

      // link facility
      if (game.location) {
        game.facility = getFacilityFromLocation(game.location, season.facilities);
      }
    });
  return schedule;
}

module.exports = {
  scrapeLeagues,
  scrapeLeagueDivisions,
  scrapeSeason,
  getFacilityFromLocation,
  parseSchedule,
};