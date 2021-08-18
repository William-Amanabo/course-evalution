require('dotenv').config();
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

const puppeteer = require('puppeteer');
const axios = require('axios'); // typescript const axios = require('axios').default;

const LOGIN_URL =
  'https://moodle.cu.edu.ng:8443/auth/realms/Cu/protocol/saml?SAMLRequest=fZLLTsMwEEV%2FJfI%2BdZyU4lhtpdIKUYlHRQsLNshNJtSSYwePzePvcROQYEFXlu7MPeO59hRlqzuxCP5g7uE1APrko9UGRV%2BYkeCMsBIVCiNbQOErsV3cXIt8lInOWW8rq8kvy2mHRATnlTUkWa9m5JmNJ%2BeskQ3LSnmWTbKm3DO2L4ox57zkAHmRs1LyJi9J8ggOo3NGIijaEQOsDXppfJSynKUZTxnfsYnIuCjOnkiyitsoI33vOnjfoaC0tbbWMKrCCOowMi%2BCj8cFlTEA6kDqFuky0J%2FN6HElkix%2Brr20BkMLbgvuTVXwcH%2F9P5iiajsNR0Ks1SHWukPXEykOZ57KCnt1MKfYkWTzPftCmVqZl9OB7ocmFFe73Sbd3G13ZD49okUfkJsP4Cn9rU2HR7%2BNtPVqY7WqPpNL61rpTw87KqpOm75VeCcNKjA%2B5qO1fV%2FG%2BDzMiHcBCJ0PI%2F9%2BrfkX&RelayState=https%3A%2F%2Fmoodle.cu.edu.ng%2Flogin%2Findex.php';
let feedbackId = 44084;
const SAFE_VALUES = [
  1,
  4,
  4,
  4,
  1,
  4,
  4,
  2,
  3,
  2,
  2,
  3,
  3,
  3,
  2,
  3,
  3,
  2,
  2,
  3,
  2,
  3,
  3,
  2,
  3,
  3,
  2,
  3,
  2,
  4
];

const evaluation = async (
  username = process.env.USER_ID,
  password = process.env.USER_PASSWORD
) => {
  const browser = await puppeteer.launch({
    headless: process.env.NODE_ENV == 'development' ? false : true
    //slowMo: 250, // slow down by 250ms
  });

  //login portion
  const page = await browser.newPage();
  await login(page, username, password);
  //get sessionID
  await page.setRequestInterception(true);
  page.on('request', async request => {
    const url = request.url();
    if (url.endsWith('notifications')) {
      const sessKey = getSessionKey(url);
      request.abort();
      const cookie = await page.cookies(url);
      await browser.close();
      const { err, data } = await getCourseDetails(cookie[0].value, sessKey);
      courseIds = await extractId(data['courses']);
      console.info(`sesskey  = ${sessKey} | cookie = ${cookie[0].value}`);
      //TODO remove added courseID
      const fields = await getFields(feedbackId, cookie[0].value);

      for (let courseId in courseIds) {
        await submitFeedback(
          feedbackId,
          courseId,
          courseIds[courseId],
          fields,
          sessKey,
          cookie[0].value
        );
      }
    } else request.continue();
  });
};
const submitFeedback = async (
  feedbackId,
  courseId,
  courseName,
  fields,
  sessKey,
  cookie
) => {
  const url = `https://moodle.covenantuniversity.edu.ng/mod/feedback/complete.php?id=${feedbackId}&courseid=${courseId}`;
  console.info(`staring: ${courseName}`);
  const data = {
    ...fields,
    id: feedbackId,
    courseid: courseId,
    sessKey: sessKey
  };

  const config = {
    method: 'post',
    url: 'https://moodle.covenantuniversity.edu.ng/mod/feedback/complete.php',
    headers: {
      Cookie: `MoodleSession=${cookie}`,
      Referer: url,
      'content-type': 'application/x-www-form-urlencoded'
    },
    referrer: url,
    data
  };
  //process.exit()
  response = await axios(config);
  console.info(`ending: ${courseName}`);
  return;
};

// GET form field and values
const getFields = async (
  feedbackId = 44084,
  cookie = 'hvfu1pdkj717ioac7797t47930',
  courseId = '19'
) => {
  let config = {
    method: 'get',
    url: `https://moodle.covenantuniversity.edu.ng/mod/feedback/complete.php?id=${feedbackId}&courseid=${courseId}`,
    headers: {
      Cookie: `MoodleSession=${cookie}`
    }
  };

  let response = await axios(config);
  let { data } = response;
  // Parse HTML
  const dom = new JSDOM(data);
  // Get options
  let options = dom.window.document.querySelectorAll('.custom-select');
  let values = {};
  const min = 1;
  const max = 4;

  //  assign safe_value to each field
  for (let i = 0; i < SAFE_VALUES.length; i++) {
    values[options[i].name] = SAFE_VALUES[i];
  }

  const name = dom.window.document.querySelector(
    'div.col-md-9.form-inline.felement input[type=text]'
  ).name;
  //TODO find a way to get all names
  values[name] = '.';
  return {
    ...values,
    savevalues: 'Submit your answers',
    _qf__mod_feedback_complete_form: 1,
    gopage: 0,
    lastpage: null,
    startitempos: null,
    lastitempos: null
  };
};

const extractId = courses => {
  const data = {};
  for (course of courses) {
    data[course.id] = course.shortname;
  }
  return data;
};

const getCourseDetails = async (cookie, sessionKey) => {
  const data =
    '[{"index":0,"methodname":"core_course_get_enrolled_courses_by_timeline_classification","args":{"offset":0,"limit":0,"classification":"all","sort":"fullname","customfieldname":"","customfieldvalue":""}}]';

  const config = {
    method: 'post',
    url: `https://moodle.covenantuniversity.edu.ng/lib/ajax/service.php?sesskey=${sessionKey}&info=core_course_get_enrolled_courses_by_timeline_classification`,
    headers: {
      Cookie: `MoodleSession=${cookie}`,
      'Content-Type': 'text/plain'
    },
    data
  };

  const response = await axios(config);
  return response.data[0];
};

const getSessionKey = url => {
  //Todo optimize
  return url.slice(url.indexOf('=') + 1, url.indexOf('&'));
};

const login = async (pageInstance, username, password) => {
  await pageInstance.goto(LOGIN_URL);
  await handleTying(pageInstance, '#username', username);
  await handleTying(pageInstance, '#password', password);
  await (await pageInstance.$('#kc-login')).click();
  return;
};

const handleTying = async (page, selectorId, inserted) => {
  const field = await page.$(selectorId);
  await field.type(inserted);
  return;
};

evaluation();

// SAFE_VALUES = [1,4,4,4,1,4,4,2,3,2,2,3,3,3,2,3,3,2,2,3,2,3,3,2,3,3,2,3,2,4];
