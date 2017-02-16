const buildCSP = (host) => {
  return new Promise((resolve, reject) => {
    const a = document.createElement('a');
    let csp = 'default-src \'none\';';
    let path;

    // first, we need to construct a shadow CSP that contains directives by strictness
    console.log('lab is', Lab);
    const shadowCSP = Lab.siteTemplate;

    // get the record for our host
    Lab.read('records').then((records) => {
      Object.entries(records[host]).forEach((entry) => {
        // if we don't have a record for the host, let's bail
        if (!(host in records)) {
          reject(undefined);
        }

        const directive = entry[0];
        const sources = entry[1];

        // get the strictness for a given category
        const strict = Lab.strictness[directive];

        // now we need to iterate over each source and munge it
        sources.forEach((source) => {
          let mungedSource;
          a.href = source;

          switch (strict) {
            case 'origin':
              if (a.host === host) {
                mungedSource = '\'self\'';
              } else {
                mungedSource = a.origin;
              }
              break;
            case 'self-if-same-origin-else-folder':
              if (a.host === host) {
                mungedSource = '\'self\'';
                break;
              }
              // falls through
            case 'folder':
              path = a.pathname.split('/');
              path.pop();
              mungedSource = `${a.origin}${path.join('/')}/`;
              break;
            case 'self-if-same-origin-else-path':
              if (a.host === host) {
                mungedSource = '\'self\'';
                break;
              }
              // falls through
            case 'path':
              mungedSource = a.href;
              break;
            default:
              break;
          }

          // now we simply add the entry to the shadowCSP, if it's not already there
          if (!shadowCSP[directive].includes(mungedSource)) {
            shadowCSP[directive].push(mungedSource);
          }
        });
      });

      // compile together a new CSP policy
      Object.keys(shadowCSP).sort().forEach((key) => {
        const directive = key;
        const sources = shadowCSP[directive].sort();

        if (sources.length > 0) {
          csp = `${csp} ${directive} ${sources.join(' ')};`;
        }
      });

      // strip off the trailing semicolon
      csp = csp.slice(0, -1);
      console.log(`Suggested CSP for ${host} is`, csp);

      // return our resolved CSP
      resolve(csp);
    });
  });
};


const getCurrentTabHost = () => {
  return new Promise((resolve, reject) => {
    browser.tabs.query({
      active: true,
      currentWindow: true,
    }).then((tab) => {
      resolve(Lab.extractHostname(tab[0].url));
    }).catch((err) => {
      reject(err);
    });
  });
};


const insertCSP = (csp) => {
  console.log(document.getElementsByTagName('div'));
  document.getElementById('csp-report').textContent = csp;
};


const toggleRecord = function toggleRecord(host, enable) {
  console.log('enable is', enable, 'host is', host);
  Lab.read('hosts').then((hosts) => {
    // if it's in the hosts list + enable -> move on
    // if it's not in the hosts list + disable -> move on
    // this shouldn't happen, but we're guarding against it anyways
    // also wtf does es6 not have a true logical xor operator?
    if ((hosts.includes(host)) ^ !enable) {
      console.error('Unexpected toggling for site encountered');
      return;
    }

    if (enable) {
      hosts.push(host);
    } else {
      const i = hosts.indexOf(host);
      hosts.splice(i, 1);
    }

    // now we write the hosts list back
    Lab.write('hosts', hosts).then(() => {
      console.log('Successfully updated hosts to ', hosts);
    }).catch((err) => {
      console.log(err);
    });
  });
};


/* set up our event listeners */
document.addEventListener('DOMContentLoaded', () => {
  $('#toggle-csp-record').bootstrapToggle();

  // set a listener for toggling for a site
  $('#toggle-csp-record').change((event) => {
    getCurrentTabHost().then(host => toggleRecord(host, event.target.checked));
  });

  // disable the current CSP if we have one
  getCurrentTabHost().then(host => buildCSP(host)).then(csp => insertCSP(csp));
});
