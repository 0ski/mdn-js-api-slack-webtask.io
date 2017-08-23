const _ = require('lodash@4.17.4');
const fetch = require('node-fetch@1.7.2');
const jsdom = require('jsdom');

const JSDOM = jsdom.jsdom;

const MDNTitleClass = 'document-title';
const MDNResultClass = 'result-';
const MDNSyntaxClass = 'syntaxbox';
const MDNDescriptionID = 'Description';
const MDNSummaryID = 'Summary';
const MDNAcceptedURLs = [

  // /https:\/\/developer\.mozilla\.org\/.{1,5}\/docs\/Web\/API\/.*/,
    /https:\/\/developer\.mozilla\.org\/.{1,5}\/docs\/Web\/JavaScript\/.*/,
  ];

module.exports = (ctx, cb) => {
  'use strict';
  console.info('STARTED');
  let query = ctx.body.text;
  let MDNQuery = `https://developer.mozilla.org/en-US/search?q=${query}&topic=js`;
  console.info('REQUESTING ' + MDNQuery);
  let MDNPromise = fetch(MDNQuery)
    .then(res => {
      console.info('REQUEST 1 FINISHED');
      return res.text();
    })
    .then(text => new JSDOM(text))
    .then(dom => {
      console.info('PARSING 1st PAGE');
      dom.window = dom.parentWindow;
      let result;
      for (let i = 1; i < 11; i++) {
        result = dom.window.document.getElementsByClassName(MDNResultClass + i)[0];
        if (result) {
          let anchor = result.getElementsByTagName('a')[0];
          let url;

          if (anchor) {
            url = anchor.getAttribute('href');
            console.info('FOUND AN INTERESTING ANCHOR ' + url);
            if (MDNAcceptedURLs.some(acceptedURL => acceptedURL.test(url))) {
              console.info('ACCEPTING THE ANCHOR ' + url);
              return url;
            }
          }
        }
      }

      console.info('NO GOOD CANDIDATE');
      throw {
        text: 'No links found',
      };
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
      dom.window = dom.parentWindow;
      let url = parsedRes.url;
      let title = dom.window.document.getElementsByClassName(MDNTitleClass)[0].textContent.trim();
      let syntax = dom.window.document.getElementsByClassName(MDNSyntaxClass)[0].textContent;
      console.info('PARSING 2nd PAGE ' + url);
      console.info('GOT TITLE: ' + title);
      console.info('GOT SYNTAX: ' + syntax);
      let summaryHeader = dom.window.document.getElementById(MDNSummaryID);
      let descriptionHeader = dom.window.document.getElementById(MDNDescriptionID);
      let header = descriptionHeader || summaryHeader;

      let returnObject = {
        fallback: 'Parsed MDN page: ' + url,
        title: title,
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
        let mainArticleChildNodes = dom.window.document.getElementById('wikiArticle').children;
        let i = 0;
        let length = mainArticleChildNodes.length;
        console.info('PARSING DESCRIPTION / SUMMARY ');

        //Need to fastforward to get siblings of the header
        while (i < length && mainArticleChildNodes[i].id !== header.id) {
          i++;
        }

        i++;
        if (i < length) {
          let descriptionHeaderSibling = mainArticleChildNodes[i];
          while (
            i < length && (
              descriptionHeaderSibling.tagName.toLowerCase() === 'p' ||
              descriptionHeaderSibling.tagName.toLowerCase() === 'pre'
            )
          ) {
            console.info('PARSING DESCRIPTION / SUMMARY');
            description = description + '\n' + descriptionHeaderSibling.textContent;
            i++;
            descriptionHeaderSibling =  mainArticleChildNodes[i];
          }

          description = description.trim();

          console.info('GOT DESCRIPTION / SUMMARY: ' + description);

          returnObject.fields = returnObject.fields.concat([
            {
              title: 'Description',
              value: description,
              short: false,
            },
         ]);
        }
      }

      console.info('RETURNING OBJECT:\n' + JSON.stringify(returnObject));
      return returnObject;
    })
    .catch(err => {
      console.error('GOT AN ERROR: ' + JSON.stringify(err));
      return { text: 'I\'m sorry, but I couldn\'t find sufficient information' };
    })
    .then(ret => {
      console.info('CALLING CALLBACK WITH OBJECT: \n' + JSON.stringify(ret));
      if (ret && ret.title) {
        cb(null, { attachments: [ret] });
      } else {
        cb(null, { text: 'I\'m sorry, but I couldn\'t find sufficient information' });
      }

    });
};
