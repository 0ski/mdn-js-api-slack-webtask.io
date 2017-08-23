const _ = require('lodash');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const fetch = require('node-fetch');

const template = (strings, ...keys) =>
  (...values) => {
    let dict = values[values.length - 1] || {};
    let result = [strings[0]];
    keys.forEach(function (key, i) {
      let value = Number.isInteger(key) ? values[key] : dict[key];
      result.push(value, strings[i + 1]);
    });

    return result.join('');
  };

const MDNQueryTpl = template`https://developer.mozilla.org/en-US/search?q=${0}&topic=js`;
const MDNTitleClass = 'document-title';
const MDNResultClass = 'result-1';
const MDNSyntaxClass = 'syntaxbox';
const MDNDescriptionID = 'Description';
const MDNSummaryID = 'Summary';
const MDNAcceptedURLs = [

  // /https:\/\/developer\.mozilla\.org\/.{1,5}\/docs\/Web\/API\/.*/,
    /https:\/\/developer\.mozilla\.org\/.{1,5}\/docs\/Web\/JavaScript\/.*/,
  ];

module.exports = (ctx, cb) => {

  let query = ctx.body.text;
  let MDNQuery = MDNQueryTpl(query);
  let MDNResponseText = '';

  let MDNPromise = fetch(MDNQuery)
    .then(res => res.text())
    .then(text => new JSDOM(text))
    .then(dom => {
      let result = dom.window.document.getElementsByClassName(MDNResultClass)[0];

      if (result) {
        let anchor = result.getElementsByTagName('a')[0];
        let url;

        if (anchor) {
          url = anchor.getAttribute('href');
          return url;
        } else {
          throw {
            text: 'No links found',
          };
        }
      }
    })
    .then(url => fetch(url))
    .then(res => res.text()
      .then(text => ({
        url: res.url,
        text: text,
      }))
    )
    .then(res => ({
      url: res.url,
      dom: new JSDOM(res.text),
    }))
    .then(parsedRes => {
      let dom = parsedRes.dom;
      let url = parsedRes.url;
      let title = dom.window.document.getElementsByClassName(MDNTitleClass)[0].textContent.trim();
      let syntax = dom.window.document.getElementsByClassName(MDNSyntaxClass)[0].textContent;

      let summaryHeader = dom.window.document.getElementById(MDNSummaryID);
      let descriptionHeader = dom.window.document.getElementById(MDNDescriptionID);
      let header = descriptionHeader || summaryHeader;

      let returnObject = {
        title,
        title_link: url,
        fields: [{
            title: 'Syntax',
            value: syntax,
            short: false,
          },
        ],
      };

      if (header) {
        let description = '';
        let descriptionHeaderSibling = header.nextElementSibling;
        while (
          descriptionHeaderSibling.tagName.toLowerCase() === 'p' ||
          descriptionHeaderSibling.tagName.toLowerCase() === 'pre'
        ) {
          description = description + '\n' + descriptionHeaderSibling.textContent;
          descriptionHeaderSibling = descriptionHeaderSibling.nextElementSibling;
        }

        description = description.trim();

        returnObject.fields = returnObject.fields.concat([
          {
            title: 'Description',
            value: description,
            short: true,
          },
       ]);
      }

      return returnObject;
    })
    .catch(err => cb(null, err))
    .then(ret => cb(null, { attachments: [ret] }));
};
